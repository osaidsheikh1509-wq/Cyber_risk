"""
Check and verify Sarvam Translate and TTS support for all 11 dropdown languages.
Uses ONE short test sentence (10 words <= 15 words limit).
Does NOT use the cache and does NOT save results as briefings.
Never logs or prints the API key.
"""

import os
import sys
import base64
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.services.sarvam import SarvamClient, SarvamError

TEST_SENTENCE = "Critical security vulnerability detected on the main production database server."

LANGUAGES_TO_TEST = [
    {"name": "English", "code": "en-IN"},
    {"name": "Hindi", "code": "hi-IN"},
    {"name": "Bengali", "code": "bn-IN"},
    {"name": "Tamil", "code": "ta-IN"},
    {"name": "Telugu", "code": "te-IN"},
    {"name": "Gujarati", "code": "gu-IN"},
    {"name": "Kannada", "code": "kn-IN"},
    {"name": "Malayalam", "code": "ml-IN"},
    {"name": "Marathi", "code": "mr-IN"},
    {"name": "Punjabi", "code": "pa-IN"},
    {"name": "Odia", "code": "od-IN"},
]


def run_checks():
    settings = get_settings()
    api_key = (os.getenv("SARVAM_API_KEY") or settings.SARVAM_API_KEY or "").strip()

    print("=" * 80)
    print("SARVAM MULTILINGUAL TRANSLATE & TTS VERIFICATION")
    print(f"Test Sentence ({len(TEST_SENTENCE.split())} words): '{TEST_SENTENCE}'")
    print(f"API Key Present: {'YES' if api_key else 'NO (Missing)'}")
    print("=" * 80)

    client = SarvamClient(api_key=api_key)

    results = []

    for item in LANGUAGES_TO_TEST:
        lang_name = item["name"]
        lang_code = item["code"]

        translate_ok = "FAIL"
        tts_ok = "FAIL"
        audio_bytes = 0
        error_msg = ""

        if not api_key:
            results.append({
                "language": lang_name,
                "code": lang_code,
                "translate": "FAIL",
                "tts": "FAIL",
                "bytes": 0,
                "error": "SARVAM_API_KEY is not set",
            })
            continue

        text_to_synthesize = TEST_SENTENCE

        # 1. Test Translate (only for non-English)
        if lang_code == "en-IN":
            translate_ok = "OK (N/A)"
        else:
            try:
                trans_res = client.translate(
                    text=TEST_SENTENCE,
                    source="en-IN",
                    target=lang_code,
                    mode="formal",
                    model="mayura:v1",
                )
                translated_text = trans_res.get("translated_text", "").strip()
                if translated_text:
                    translate_ok = "OK"
                    text_to_synthesize = translated_text
                else:
                    translate_ok = "FAIL"
                    error_msg = "Translate returned empty text"
            except Exception as exc:
                translate_ok = "FAIL"
                error_msg = f"Translate error: {str(exc)[:60]}"

        # 2. Test TTS (if translation didn't fail)
        if translate_ok.startswith("OK"):
            try:
                tts_res = client.synthesize(
                    text=text_to_synthesize,
                    language=lang_code,
                    speaker="shubh",
                    model="bulbul:v3",
                )
                audios = tts_res.get("audios", [])
                if audios and audios[0]:
                    raw_audio = base64.b64decode(audios[0])
                    audio_bytes = len(raw_audio)
                    if audio_bytes > 100:
                        tts_ok = "OK"
                    else:
                        tts_ok = "FAIL"
                        error_msg = f"Audio too small ({audio_bytes} bytes)"
                else:
                    tts_ok = "FAIL"
                    error_msg = "TTS returned no audio"
            except Exception as exc:
                tts_ok = "FAIL"
                error_msg = f"TTS error: {str(exc)[:60]}"

        results.append({
            "language": lang_name,
            "code": lang_code,
            "translate": translate_ok,
            "tts": tts_ok,
            "bytes": audio_bytes,
            "error": error_msg or "-",
        })

    # Print Table
    col_widths = {
        "language": 12,
        "code": 8,
        "translate": 11,
        "tts": 9,
        "bytes": 13,
        "error": 32,
    }

    header_line = (
        f"| {'Language':<{col_widths['language']}} "
        f"| {'Code':<{col_widths['code']}} "
        f"| {'Translate':<{col_widths['translate']}} "
        f"| {'TTS':<{col_widths['tts']}} "
        f"| {'Audio Bytes':<{col_widths['bytes']}} "
        f"| {'Error':<{col_widths['error']}} |"
    )
    separator = (
        f"+{'-' * (col_widths['language'] + 2)}"
        f"+{'-' * (col_widths['code'] + 2)}"
        f"+{'-' * (col_widths['translate'] + 2)}"
        f"+{'-' * (col_widths['tts'] + 2)}"
        f"+{'-' * (col_widths['bytes'] + 2)}"
        f"+{'-' * (col_widths['error'] + 2)}+"
    )

    print("\n" + separator)
    print(header_line)
    print(separator)

    all_ok = True
    for r in results:
        is_ok = r["translate"].startswith("OK") and r["tts"] == "OK"
        if not is_ok:
            all_ok = False
        row = (
            f"| {r['language']:<{col_widths['language']}} "
            f"| {r['code']:<{col_widths['code']}} "
            f"| {r['translate']:<{col_widths['translate']}} "
            f"| {r['tts']:<{col_widths['tts']}} "
            f"| {str(r['bytes']):<{col_widths['bytes']}} "
            f"| {r['error']:<{col_widths['error']}} |"
        )
        print(row)

    print(separator)
    print(f"\nFinal Result: {'ALL 11 LANGUAGES PASSED' if all_ok else 'SOME LANGUAGES FAILED'}\n")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(run_checks())
