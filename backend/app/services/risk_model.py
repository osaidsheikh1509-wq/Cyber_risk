import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Tuple
import httpx

from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.ai import AIAssessmentRaw
from app.schemas.threat import ThreatCategory
from app.services.sarvam import SarvamClient, SarvamError

logger = logging.getLogger(__name__)


@dataclass
class AssessmentResult:
    category: ThreatCategory
    likelihood: int
    impact: int
    reasoning: str
    recommended_actions: List[str]
    fallback: bool = False
    backend_used: str = "mock"


class RiskModelClient(ABC):
    """Abstract interface for cybersecurity event risk assessment."""

    @abstractmethod
    def assess(self, event_text: str) -> AssessmentResult:
        """Analyze an event description and return structured risk evaluation."""
        pass


def _matches_any_pattern(text: str, patterns: List[str]) -> bool:
    for pat in patterns:
        escaped = re.escape(pat)
        # Short acronyms/tokens need exact word boundaries to avoid false positives (e.g. 'rce' vs 'force')
        if len(pat) <= 4 or pat in ["rce", "s3", "iam", "ddos", "cve", "pii", "ssh", "udp"]:
            regex = rf"\b{escaped}\b"
        else:
            # Word stems match at word start boundary (e.g. \bphish matches phishing, \bransom matches ransomware)
            regex = rf"\b{escaped}"
        if re.search(regex, text, re.IGNORECASE):
            return True
    return False


class MockRiskModelClient(RiskModelClient):
    """
    Keyword and rule-based heuristic risk assessment client.
    Guarantees deterministic, fast, offline evaluations without requiring API keys.
    """

    def assess(self, event_text: str, is_fallback: bool = False, original_backend: Optional[str] = None) -> AssessmentResult:
        text = event_text.lower()

        # Heuristic rules for classification
        if _matches_any_pattern(text, ["ransom", "encrypt", ".locked", "ransomware", "decryptor", "bitcoin demand"]):
            category = ThreatCategory.RANSOMWARE
            likelihood = 4
            impact = 5
            reasoning = "Indicators of active encryption and extortion patterns detected, representing catastrophic operational impact."
            actions = [
                "Immediately isolate affected endpoints and disconnect backup storage from the network.",
                "Capture volatile RAM dumps and forensic disk snapshots for incident investigation.",
                "Activate Incident Response Plan and verify offline immutable backups for recovery."
            ]
        elif _matches_any_pattern(text, ["phish", "spear", "fake login", "spoof", "credential harvesting", "suspicious email", "ceo fraud"]):
            category = ThreatCategory.PHISHING
            likelihood = 4
            impact = 3
            reasoning = "Social engineering and deceptive communication signatures observed targeting user credentials or system access."
            actions = [
                "Purge malicious emails across all mailboxes using message-ID sweep.",
                "Force password reset and invalidate active SSO sessions for targeted users.",
                "Enforce FIDO2/hardware MFA and update email gateway protection filters."
            ]
        elif _matches_any_pattern(text, ["brute force", "credential stuffing", "unauthorized ssh", "password spraying", "unauthorized login", "token theft"]):
            category = ThreatCategory.CREDENTIAL_ATTACK
            likelihood = 4
            impact = 4
            reasoning = "Automated authentication attempts or anomalous credential utilization detected against access gateways."
            actions = [
                "Block malicious source IP addresses at perimeter firewall and CDN layers.",
                "Temporarily lock targeted accounts and require out-of-band verification.",
                "Audit privileged access logs and enable step-up authentication on administrative portals."
            ]
        elif _matches_any_pattern(text, ["sql injection", "sqli", "cve-", "exploit", "rce", "remote code", "unpatched", "zero-day", "vulnerability"]):
            category = ThreatCategory.VULNERABILITY
            likelihood = 4
            impact = 4
            reasoning = "Software flaw or active exploitation attempt detected against network-exposed service endpoints."
            actions = [
                "Deploy emergency WAF virtual patch blocking the specific attack vector.",
                "Isolate or rate-limit vulnerable endpoints until official patches are staged.",
                "Execute authenticated vulnerability scanning to identify all related exposed assets."
            ]
        elif _matches_any_pattern(text, ["ddos", "syn flood", "volumetric", "botnet", "udp flood", "dns amplification", "high traffic"]):
            category = ThreatCategory.DDOS
            likelihood = 4
            impact = 3
            reasoning = "High-volume distributed traffic spike threatening service availability and operational uptime."
            actions = [
                "Engage upstream ISP / Cloudflare DDoS mitigation scrubbing centers.",
                "Apply geo-blocking and aggressive rate limiting on edge load balancers.",
                "Monitor edge bandwidth utilization and failover critical services if needed."
            ]
        elif _matches_any_pattern(text, ["s3", "bucket", "iam", "cloud misconfig", "exposed secret", "kubernetes", "aws", "azure", "gcp", "public blob"]):
            category = ThreatCategory.CLOUD_MISCONFIGURATION
            likelihood = 3
            impact = 4
            reasoning = "Exposed cloud infrastructure or overly permissive security policies exposing internal data to unauthorized access."
            actions = [
                "Immediately revoke public access permissions on exposed storage containers/buckets.",
                "Rotate all cloud API keys, IAM credentials, and secrets associated with the asset.",
                "Audit cloud trail logs for unauthorized read/write access during the exposure window."
            ]
        elif _matches_any_pattern(text, ["exfiltration", "data breach", "customer data", "customer records", "database dump", "leak", "leaked", "leakage", "pii", "stolen records"]):
            category = ThreatCategory.DATA_BREACH
            likelihood = 3
            impact = 5
            reasoning = "Potential leakage or exfiltration of sensitive organizational records and confidential data detected."
            actions = [
                "Terminate active egress sessions and throttle outbound network bandwidth from affected nodes.",
                "Identify precise data scope and engage legal and regulatory data breach notification teams.",
                "Preserve database audit logs and initiate data-loss prevention forensics."
            ]
        elif _matches_any_pattern(text, ["insider", "disgruntled", "unauthorized export", "privilege abuse", "former employee"]):
            category = ThreatCategory.INSIDER_THREAT
            likelihood = 2
            impact = 4
            reasoning = "Suspicious behavior or unauthorized data movement initiated by authenticated internal personnel."
            actions = [
                "Suspend internal user account and revoke badge/physical site access.",
                "Audit user endpoint activities, file transfers, and external USB storage events.",
                "Preserve forensic custody of employee device and document audit timeline."
            ]
        elif _matches_any_pattern(text, ["vendor", "supplier", "third-party", "contractor", "supply chain"]):
            category = ThreatCategory.THIRD_PARTY_RISK
            likelihood = 3
            impact = 4
            reasoning = "Security incident originating from external service provider or shared supply-chain access tunnel."
            actions = [
                "Temporarily sever interconnect tunnels and VPN access granted to the third party.",
                "Request formal incident disclosure and breach impact assessment from the vendor.",
                "Inspect shared API integrations and enforce strict mutual TLS authentication."
            ]
        else:
            # General malware / intrusion detection default
            category = ThreatCategory.MALWARE
            likelihood = 3
            impact = 4
            reasoning = "Suspicious system behavior, process injection, or anomalous binary execution detected."
            actions = [
                "Isolate the host from the corporate network and preserve memory image.",
                "Run deep EDR root-cause inspection and submit suspicious payloads for sandbox detonation.",
                "Review perimeter proxy logs for Command and Control (C2) beaconing activity."
            ]

        backend_name = "mock"
        if is_fallback and original_backend:
            backend_name = f"mock (fallback from {original_backend})"

        return AssessmentResult(
            category=category,
            likelihood=likelihood,
            impact=impact,
            reasoning=reasoning,
            recommended_actions=actions[:3],
            fallback=is_fallback,
            backend_used=backend_name,
        )


class SarvamRiskModelClient(RiskModelClient):
    """
    LLM-powered risk assessment client backed by Sarvam AI chat completions.
    Automatically prompts for JSON-only responses, validates with Pydantic,
    and seamlessly falls back to MockRiskModelClient if any error occurs.
    """

    def __init__(self, sarvam_client: Optional[SarvamClient] = None):
        self.sarvam_client = sarvam_client or SarvamClient()
        self.mock_client = MockRiskModelClient()

    def assess(self, event_text: str) -> AssessmentResult:
        # Check if Sarvam API key is available
        if not self.sarvam_client.has_api_key:
            logger.warning("SARVAM_API_KEY is not configured; falling back to mock assessment backend.")
            return self.mock_client.assess(event_text, is_fallback=True, original_backend="sarvam")

        allowed_categories = ", ".join([f"'{c.value}'" for c in ThreatCategory])

        system_prompt = (
            "You are an expert cybersecurity threat analyst. Analyze the provided security event and assess its risk.\n"
            "You MUST respond ONLY with valid JSON (no markdown formatting, no code blocks, no additional prose).\n"
            "JSON structure:\n"
            "{\n"
            f'  "category": <one of: {allowed_categories}>,\n'
            '  "likelihood": <integer 1 to 5>,\n'
            '  "impact": <integer 1 to 5>,\n'
            '  "reasoning": "<concise analytical justification (1-2 sentences)>",\n'
            '  "recommended_actions": ["<Action 1>", "<Action 2>", "<Action 3>"]\n'
            "}\n"
            "Ensure recommended_actions contains exactly 3 concrete, high-priority SOC mitigation steps."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Security Event: {event_text}"},
        ]

        try:
            raw_response = self.sarvam_client.chat(
                messages=messages,
                model="sarvam-105b",
                temperature=0.1,
            )

            choices = raw_response.get("choices", [])
            if not choices:
                raise SarvamError("No choices returned in Sarvam chat completion response")

            content = choices[0].get("message", {}).get("content", "").strip()
            
            # Clean possible markdown fence blocks (e.g. ```json ... ```)
            json_str = content
            if "```" in json_str:
                match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", json_str)
                if match:
                    json_str = match.group(1).strip()

            parsed_data = json.loads(json_str)
            raw_validated = AIAssessmentRaw.model_validate(parsed_data)

            # Ensure exactly 3 actions
            actions = raw_validated.recommended_actions
            if len(actions) < 3:
                actions = actions + ["Review relevant SIEM audit logs for associated telemetry."] * (3 - len(actions))
            elif len(actions) > 3:
                actions = actions[:3]

            return AssessmentResult(
                category=raw_validated.category,
                likelihood=raw_validated.likelihood,
                impact=raw_validated.impact,
                reasoning=raw_validated.reasoning,
                recommended_actions=actions,
                fallback=False,
                backend_used="sarvam",
            )

        except (SarvamError, ValidationError, json.JSONDecodeError, Exception) as exc:
            # Fall back to mock heuristic model cleanly without leaking secrets
            logger.warning("Sarvam assessment failed (%s). Falling back to mock model.", type(exc).__name__)
            return self.mock_client.assess(event_text, is_fallback=True, original_backend="sarvam")


def rule_based_scorer(event_text: str) -> Tuple[int, int]:
    """
    Deterministically computes (likelihood, impact) from cybersecurity keywords in event_text.
    Keywords:
      - 'internet-facing': Public attack surface increases likelihood (+1)
      - 'MFA': Missing/bypassed increases likelihood & impact (+1, +1); present in report increases likelihood (+1)
      - 'exploited': Active exploitation in the wild increases likelihood & impact (+1, +1)
      - 'monitoring': Lack of monitoring increases impact (+1); monitoring detection decreases impact (-1)
      - 'regulated data': PII, HIPAA, financial data increases impact (+2)
      - 'backups': Encrypted/deleted backups increases impact (+2); viable backups decreases impact (-1)
    Clamped to range [1, 5].
    """
    text = event_text.lower()
    likelihood = 3
    impact = 3

    # 1. internet-facing
    if re.search(r"\b(?:internet[- ]facing|publicly[- ]facing|public[- ]facing|exposed to (?:the )?internet)\b", text):
        likelihood += 1

    # 2. exploited
    if re.search(r"\b(?:exploit|exploited|exploitation|in the wild|zero[- ]day)\b", text):
        likelihood += 1
        impact += 1

    # 3. MFA
    if re.search(r"\b(?:no|without|lacked|bypassed|bypass|disabled|fatigue)\s+(?:mfa|2fa|multi[- ]factor)\b", text) or \
       re.search(r"\b(?:mfa|2fa|multi[- ]factor)\s+(?:bypassed|fatigue|disabled|absent)\b", text):
        likelihood += 1
        impact += 1
    elif re.search(r"\b(?:mfa|2fa|multi[- ]factor)\b", text):
        likelihood += 1

    # 4. monitoring
    if re.search(r"\b(?:unmonitored|no monitoring|without monitoring|lacked monitoring|monitoring bypassed|undetected)\b", text):
        impact += 1
    elif re.search(r"\b(?:monitoring detected|alerted by monitoring|caught by monitoring|siem detected)\b", text):
        impact -= 1
    elif re.search(r"\b(?:monitoring|monitored|siem|edr|telemetry)\b", text):
        impact += 1

    # 5. regulated data
    if re.search(r"\b(?:regulated data|pii|phi|hipaa|gdpr|pci[- ]dss|pci|credit card|cardholder|ssn|social security|customer records)\b", text):
        impact += 2

    # 6. backups
    if re.search(r"\b(?:backups? encrypted|no backups?|without backups?|backups? deleted|backups? destroyed|backups? compromised|backups? corrupted)\b", text):
        impact += 2
    elif re.search(r"\b(?:offline backups?|immutable backups?|restored from backups?|healthy backups?)\b", text):
        impact -= 1
    elif re.search(r"\b(?:backups?)\b", text):
        impact += 1

    return max(1, min(5, likelihood)), max(1, min(5, impact))


def extract_first_json_block(text: str) -> Optional[dict]:
    """
    Defensively extracts and parses the first {...} JSON object block from text,
    handling markdown fences, conversational prefixes/suffixes, and nested braces.
    """
    if not text:
        return None

    # First attempt: find opening '{' and extract using balanced brace tracking
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    json_str = text[start : i + 1]
                    try:
                        parsed = json.loads(json_str)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        break

    # Secondary fallback: greedy regex on any markdown fence or outer braces
    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


class OllamaRiskModelClient(RiskModelClient):
    """
    Risk assessment client backed by local/remote Ollama server (/api/chat).
    Treats model output as a suggestion:
      - Calls /api/chat with stream=false and sends only event_text.
      - Parses JSON defensively (extracts first {...} block, retries once on failure).
      - Retains suggested category (if valid ThreatCategory) and 3 recommended_actions.
      - Calibrates likelihood and impact against keyword rule-based scorer:
        adopts model values only if within 1 of rule-based scores.
      - Recomputes all other attributes.
      - On any failure, falls back to SarvamRiskModelClient, and subsequently to MockRiskModelClient.
    """

    def __init__(
        self,
        model_url: Optional[str] = None,
        model_name: Optional[str] = None,
        sarvam_client: Optional[SarvamRiskModelClient] = None,
        mock_client: Optional[MockRiskModelClient] = None,
        timeout: float = 10.0,
    ):
        settings = get_settings()
        self.model_url = (model_url or settings.MODEL_URL or "http://localhost:11434").rstrip("/")
        self.model_name = model_name or settings.MODEL_NAME or "cyber-risk"
        self.sarvam_client = sarvam_client or SarvamRiskModelClient()
        self.mock_client = mock_client or MockRiskModelClient()
        self.timeout = timeout

    def assess(self, event_text: str) -> AssessmentResult:
        endpoint = f"{self.model_url}/api/chat"
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "user", "content": event_text}
            ],
            "stream": False,
        }

        parsed_json: Optional[dict] = None
        last_error: Optional[Exception] = None

        # Execute call with 1 retry (total 2 attempts)
        for attempt in range(2):
            try:
                response = httpx.post(
                    endpoint,
                    json=payload,
                    timeout=self.timeout,
                )
                if response.status_code == 200:
                    res_data = response.json()
                    content = res_data.get("message", {}).get("content", "")
                    parsed_json = extract_first_json_block(content)
                    if parsed_json and isinstance(parsed_json, dict):
                        break
                    else:
                        last_error = ValueError(f"Failed to extract JSON from response: {content[:100]}")
                else:
                    last_error = RuntimeError(f"Ollama returned HTTP {response.status_code}")
            except Exception as exc:
                last_error = exc

        # If both attempts failed, fall back to Sarvam -> Mock
        if parsed_json is None:
            logger.warning(
                "Ollama assessment failed after retry (%s). Falling back to Sarvam backend.",
                last_error,
            )
            return self._fallback_sarvam_or_mock(event_text)

        # 1. Keep category if it is a known ThreatCategory
        raw_cat = str(parsed_json.get("category", "")).strip().lower()
        matched_category: Optional[ThreatCategory] = None
        for cat in ThreatCategory:
            if cat.value.lower() == raw_cat:
                matched_category = cat
                break
        if not matched_category:
            mock_res = self.mock_client.assess(event_text)
            matched_category = mock_res.category

        # 2. Keep recommended_actions (list of exactly 3 strings)
        raw_actions = parsed_json.get("recommended_actions")
        actions: List[str] = []
        if isinstance(raw_actions, list):
            for a in raw_actions:
                s = str(a).strip()
                if s:
                    actions.append(s)

        if len(actions) < 3:
            mock_res = self.mock_client.assess(event_text)
            for a in mock_res.recommended_actions:
                if a not in actions:
                    actions.append(a)
                if len(actions) == 3:
                    break
            while len(actions) < 3:
                actions.append("Review relevant SIEM audit logs for associated telemetry.")
        elif len(actions) > 3:
            actions = actions[:3]

        # 3. Rule-based scorer for likelihood and impact from keywords
        rule_l, rule_i = rule_based_scorer(event_text)

        # Model's values are used only if within 1 of rule-based ones
        model_l = parsed_json.get("likelihood")
        if isinstance(model_l, (int, float)) and abs(int(model_l) - rule_l) <= 1:
            final_l = max(1, min(5, int(model_l)))
        else:
            final_l = rule_l

        model_i = parsed_json.get("impact")
        if isinstance(model_i, (int, float)) and abs(int(model_i) - rule_i) <= 1:
            final_i = max(1, min(5, int(model_i)))
        else:
            final_i = rule_i

        # 4. Reasoning
        model_reasoning = parsed_json.get("reasoning")
        if isinstance(model_reasoning, str) and model_reasoning.strip():
            reasoning = model_reasoning.strip()
        else:
            reasoning = f"Evaluated event via Ollama {self.model_name} with rule-based keyword calibration."

        return AssessmentResult(
            category=matched_category,
            likelihood=final_l,
            impact=final_i,
            reasoning=reasoning,
            recommended_actions=actions,
            fallback=False,
            backend_used=f"ollama ({self.model_name})",
        )

    def _fallback_sarvam_or_mock(self, event_text: str) -> AssessmentResult:
        """Cascade fallback from Ollama failure: try Sarvam, then fall back to Mock."""
        try:
            sarvam_res = self.sarvam_client.assess(event_text)
            if sarvam_res.fallback:
                return AssessmentResult(
                    category=sarvam_res.category,
                    likelihood=sarvam_res.likelihood,
                    impact=sarvam_res.impact,
                    reasoning=sarvam_res.reasoning,
                    recommended_actions=sarvam_res.recommended_actions,
                    fallback=True,
                    backend_used="mock (fallback from ollama -> sarvam)",
                )
            else:
                return AssessmentResult(
                    category=sarvam_res.category,
                    likelihood=sarvam_res.likelihood,
                    impact=sarvam_res.impact,
                    reasoning=sarvam_res.reasoning,
                    recommended_actions=sarvam_res.recommended_actions,
                    fallback=True,
                    backend_used="sarvam (fallback from ollama)",
                )
        except Exception as exc:
            logger.warning("Sarvam fallback failed (%s). Falling back to mock heuristics.", exc)
            return self.mock_client.assess(event_text, is_fallback=True, original_backend="ollama -> sarvam")


def get_risk_model_client(backend: Optional[str] = None) -> RiskModelClient:
    """
    Factory function to retrieve the configured RiskModelClient implementation.
    Backends:
      - 'mock' (default)
      - 'sarvam'
      - 'ollama'
    """
    settings = get_settings()
    chosen_backend = (backend or settings.MODEL_BACKEND or "mock").strip().lower()

    if chosen_backend == "sarvam":
        return SarvamRiskModelClient()
    elif chosen_backend == "ollama":
        return OllamaRiskModelClient(
            model_url=settings.MODEL_URL,
            model_name=settings.MODEL_NAME,
        )
    else:
        return MockRiskModelClient()

