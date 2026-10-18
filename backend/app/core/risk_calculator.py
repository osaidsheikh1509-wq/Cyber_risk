from typing import Tuple


def calculate_risk(likelihood: int, impact: int) -> Tuple[int, str]:
    """Calculate risk_score and risk_level from likelihood and impact.
    
    Risk score: likelihood (1-5) * impact (1-5) -> 1-25.
    Risk levels:
      - Low: 1-4
      - Medium: 5-9
      - High: 10-16
      - Critical: 17-25
    """
    if not (1 <= likelihood <= 5):
        raise ValueError(f"Likelihood must be between 1 and 5, got {likelihood}")
    if not (1 <= impact <= 5):
        raise ValueError(f"Impact must be between 1 and 5, got {impact}")

    score = likelihood * impact
    if score >= 17:
        level = "Critical"
    elif score >= 10:
        level = "High"
    elif score >= 5:
        level = "Medium"
    else:
        level = "Low"

    return score, level


def get_response_timeline_hours(risk_level: str) -> int:
    """Return the required response SLA timeline in hours based on risk level.
    - Critical: 4 hours
    - High: 24 hours
    - Medium: 72 hours
    - Low: 168 hours (7 days)
    """
    normalized = risk_level.strip().title()
    mapping = {
        "Critical": 4,
        "High": 24,
        "Medium": 72,
        "Low": 168,
    }
    return mapping.get(normalized, 72)

