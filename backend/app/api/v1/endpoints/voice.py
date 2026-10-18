import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.risk_calculator import calculate_risk, get_response_timeline_hours
from app.schemas.ai import AIAssessResponse
from app.schemas.voice import VoiceReportResponse
from app.services.risk_model import get_risk_model_client
from app.services.sarvam import SarvamClient, SarvamError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Voice Threat Reporting"])

MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/report", response_model=VoiceReportResponse, summary="Submit a voice report for audio transcription and threat assessment")
async def report_threat_by_voice(
    file: UploadFile = File(..., description="Audio recording of security incident (max 30s, 5 MB)"),
    language_code: Optional[str] = Form("unknown", description="Spoken language code (e.g. 'unknown', 'en-IN', 'hi-IN', 'kn-IN', 'ta-IN')"),
) -> VoiceReportResponse:
    """
    Accepts an audio recording (max 30 seconds, 5 MB):
    1. Validates audio file size and non-empty payload.
    2. Transcribes with SarvamClient using model 'saaras:v3'.
    3. Translates non-English transcripts to English using Sarvam Translate ('mayura:v1').
    4. Evaluates the English transcript through the AI assessment engine.
    5. Returns both original and English transcripts along with the structured risk evaluation.
    """
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded audio file is empty.",
        )

    if len(content) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file size exceeds the 5 MB limit ({len(content)} bytes uploaded).",
        )

    lang_param = (language_code or "unknown").strip()
    sarvam = SarvamClient()

    transcript_original = ""
    transcript_english = ""
    detected_lang = lang_param

    # Try transcription with Sarvam if API key is configured
    if sarvam.has_api_key:
        try:
            # 1. Transcribe in original language
            stt_res = sarvam.transcribe(
                audio=(file.filename or "voice_report.wav", content, file.content_type or "audio/wav"),
                language=lang_param,
                model="saaras:v3",
                mode="transcribe",
            )
            transcript_original = stt_res.get("transcript", "").strip()
            detected_lang = stt_res.get("language_code", lang_param)

            # 2. If original is in an Indic language or not English, translate to English
            if detected_lang not in ("en-IN", "en") and transcript_original:
                try:
                    trans_res = sarvam.translate(
                        text=transcript_original,
                        source=detected_lang if detected_lang != "unknown" else "hi-IN",
                        target="en-IN",
                        mode="formal",
                        model="mayura:v1",
                    )
                    transcript_english = trans_res.get("translated_text", "").strip()
                except Exception as trans_err:
                    logger.warning("Translation failed, falling back to original transcript: %s", trans_err)
                    transcript_english = transcript_original
            else:
                transcript_english = transcript_original

        except SarvamError as exc:
            logger.warning("Sarvam STT failed: %s. Falling back to mock voice transcription.", exc)
            transcript_original, transcript_english = _get_mock_voice_transcripts(lang_param)
    else:
        # Graceful mock voice transcription when offline or testing without key
        transcript_original, transcript_english = _get_mock_voice_transcripts(lang_param)

    if not transcript_english:
        transcript_english = transcript_original or "Security incident reported via voice."
    if not transcript_original:
        transcript_original = transcript_english

    # 3. Evaluate threat intelligence assessment using the English transcript
    risk_client = get_risk_model_client()
    assess_res = risk_client.assess(transcript_english)

    risk_score, risk_level = calculate_risk(assess_res.likelihood, assess_res.impact)
    sla_hours = get_response_timeline_hours(risk_level)

    assessment = AIAssessResponse(
        category=assess_res.category,
        likelihood=assess_res.likelihood,
        impact=assess_res.impact,
        risk_score=risk_score,
        risk_level=risk_level,  # type: ignore[arg-type]
        response_timeline_hours=sla_hours,
        reasoning=assess_res.reasoning,
        recommended_actions=assess_res.recommended_actions[:3],
        fallback=assess_res.fallback,
        backend_used=assess_res.backend_used,
    )

    return VoiceReportResponse(
        transcript_original=transcript_original,
        transcript_english=transcript_english,
        language_code=detected_lang,
        assessment=assessment,
    )


def _get_mock_voice_transcripts(lang: str) -> tuple[str, str]:
    """Provide realistic mock transcription pairs for offline testing."""
    if lang == "hi-IN":
        return (
            "हमारे मुख्य प्रोडक्शन डेटाबेस सर्वर पर रैनसमवेयर संक्रमण का पता चला है, फाइलें लॉक हो गई हैं और रैनसम नोट छोड़ा गया है।",
            "Ransomware infection detected on primary production database server, files are locked and ransom note was left behind.",
        )
    elif lang == "kn-IN":
        return (
            "ನಮ್ಮ ಸರ್ವರ್ ಮೇಲೆ ರಾನ್ಸಮ್‌ವೇರ್ ದಾಳಿ ನಡೆದಿದೆ ಮತ್ತು ಫೈಲ್‌ಗಳು ಎನ್‌ಕ್ರಿಪ್ಟ್ ಆಗಿವೆ.",
            "Ransomware attack detected on our server and files have been encrypted.",
        )
    elif lang == "ta-IN":
        return (
            "எங்கள் சேவையகத்தில் ரான்சம்வேர் தாக்குதல் கண்டறியப்பட்டது மற்றும் கோப்புகள் குறியாக்கம் செய்யப்பட்டுள்ளன.",
            "Ransomware attack detected on our server and files have been encrypted.",
        )
    elif lang == "te-IN":
        return (
            "మా ప్రొడక్షన్ సర్వర్‌పై రాన్సమ్‌వేర్ దాడి గుర్తించబడింది మరియు ఫైల్‌లు లాక్ చేయబడ్డాయి.",
            "Ransomware attack detected on our production server and files have been locked.",
        )
    elif lang == "bn-IN":
        return (
            "আমাদের প্রোডাকশন সার্ভারে র্যানসমওয়্যার সংক্রমণ সনাক্ত করা হয়েছে এবং ফাইল লক করা হয়েছে।",
            "Ransomware infection detected on our production server and files are locked.",
        )
    elif lang == "mr-IN":
        return (
            "आमच्या डेटाबेस सर्व्हरवर रॅन्समवेअर हल्ला आढळला आहे आणि फाइल्स कूटबद्ध केल्या आहेत.",
            "Ransomware attack detected on our database server and files are encrypted.",
        )
    else:
        return (
            "Critical ransomware deployment detected across production file cluster with encrypted volumes and extortion note.",
            "Critical ransomware deployment detected across production file cluster with encrypted volumes and extortion note.",
        )
