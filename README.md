# Cyber Risk Tracker

A production-grade, full-stack cybersecurity threat intelligence and risk management platform with multilingual AI voice reporting and audio briefings powered by Sarvam AI.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Cyber Risk Tracker Web UI       |
                      |  (React 18 + Vite + TS + Tailwind)   |
                      +-------------------+-------------------+
                                          |
                        Vite Proxy (:5173 -> :8000)
                                          |
                                          v
                      +---------------------------------------+
                      |         FastAPI REST Backend          |
                      |          (Python 3.12, Uvicorn)       |
                      +---+-------------------+---------------+
                          |                   |
            +-------------+                   +---------------+
            v                                                 v
+-----------------------+                         +-----------------------+
|  SQLite Database      |                         |  Sarvam AI Services   |
|  - Threats Registry   |                         |  - STT (saaras:v3)    |
|  - Audit Timelines    |                         |  - TTS (bulbul:v3)    |
|  - Seed Data (25)     |                         |  - Translate (mayura) |
+-----------------------+                         |  - LLM (sarvam-105b)  |
                                                  +-----------------------+
                                                              ^
                                                              |
                                                  +-----------+-----------+
                                                  |  LRU Briefing Cache   |
                                                  |  (Threat ID + Lang)   |
                                                  |  Zero-credit repeats  |
                                                  +-----------------------+
```

### Directory Structure

```text
cyber-risk-tracker/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── ai.py              # POST /ai/assess (Risk analysis & SLAs)
│   │   │   ├── threats.py         # Threats CRUD, stats, timeline, briefings
│   │   │   ├── voice.py           # POST /voice/report (Voice intake & STT)
│   │   │   └── health.py          # GET /health
│   │   ├── core/
│   │   │   ├── config.py          # Settings, env secrets, model provider
│   │   │   └── database.py        # SQLAlchemy SQLite engine & session
│   │   ├── models/
│   │   │   └── threat.py          # Threat & TimelineEvent SQLAlchemy models
│   │   ├── schemas/
│   │   │   └── threat.py          # Pydantic v2 schemas for all requests/responses
│   │   ├── services/
│   │   │   ├── briefing_cache.py  # Thread-safe LRU audio briefing cache
│   │   │   ├── risk_model.py      # RiskModelClient (Mock, Sarvam, Ollama)
│   │   │   └── sarvam.py          # SarvamClient (STT, TTS, Translate, Chat)
│   │   ├── db_seed.py             # 25 realistic seeded cybersecurity threats
│   │   └── main.py                # FastAPI app initialization, routes, CORS
│   ├── tests/
│   │   ├── test_ai_assess.py      # AI assessment endpoint & provider tests
│   │   ├── test_briefing.py       # Audio briefing synthesis & caching tests
│   │   ├── test_sarvam.py         # Sarvam API client tests (mocked & auth)
│   │   ├── test_threats.py        # Threat CRUD, filter, timeline, stats tests
│   │   └── test_voice.py          # Voice report intake & validation tests
│   ├── .env                       # Local secrets (gitignored)
│   ├── .env.example               # Environment template
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConfirmDialog.tsx       # Delete confirmation modal
│   │   │   ├── Navbar.tsx              # Brand bar, live connectivity, "+ Threat"
│   │   │   ├── RiskScoreGauge.tsx      # SVG risk gauge with dynamic arcs
│   │   │   ├── RiskTrendChart.tsx      # 30-day risk trend area chart (Recharts)
│   │   │   ├── SummaryCards.tsx        # Critical / High / Medium / Low metrics
│   │   │   ├── ThreatCard.tsx          # Threat card with badges, sliders, actions
│   │   │   ├── ThreatDetailPage.tsx    # Detailed profile, timeline, audio player
│   │   │   ├── ThreatFiltersBar.tsx    # Category, status, level & search filters
│   │   │   ├── ThreatModal.tsx         # Voice report & AI assessment modal
│   │   │   ├── ThreatTimelineModal.tsx # Quick timeline preview modal
│   │   │   └── Toast.tsx               # Non-blocking notification toasts
│   │   ├── services/
│   │   │   └── threatApi.ts            # Typed client API for backend endpoints
│   │   ├── types/
│   │   │   └── threat.ts               # TypeScript interfaces mirroring backend
│   │   ├── App.tsx                     # Main layout, view switching & state
│   │   └── main.tsx                    # React application bootstrap
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts                  # Reverse proxy for backend endpoints
└── README.md
```

---

## Core Capabilities

1. **Cybersecurity Threats Registry**:
   - Manage threats across 10 industry categories: *Phishing, Ransomware, Data Breach, Vulnerability, Third-Party Risk, Credential Attack, Cloud Misconfiguration, Insider Threat, DDoS, Malware*.
   - Live risk scoring: $\text{Risk Score} = \text{Likelihood (1–5)} \times \text{Impact (1–5)}$ (Score 1–25).
   - Color-coded severity tiers: **Low (1–4)**, **Medium (5–9)**, **High (10–16)**, **Critical (17–25)**.
   - Investigation workflow states: `Open`, `Investigating`, `Mitigated`, `Closed`.

2. **Automated Audit Timeline**:
   - System automatically records immutable audit records on creation (`CREATED`), status updates (`STATUS_CHANGED`), and risk re-assessments (`ASSESSMENT_UPDATED`).
   - Analysts can append notes and action logs directly from the Threat Detail view.

3. **Multilingual Voice Incident Reporting (`POST /voice/report`)**:
   - Record threat reports via microphone directly in the browser with 30s auto-stop.
   - Transcribes Indian Indic languages (Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Gujarati, etc.) and English using Sarvam Saaras v3 STT.
   - Automatically runs AI risk assessment and pre-fills the threat registration modal.

4. **Sarvam AI Risk Assessment (`POST /ai/assess`)**:
   - Pluggable `RiskModelClient` backend: `sarvam` (Sarvam-105b LLM), `mock` (keyword rules fallback), and `ollama` (local model ready).
   - Derives category, likelihood, impact, reasoning, 3 actionable mitigations, and incident SLA response time:
     - **Critical**: 4 hours
     - **High**: 24 hours
     - **Medium**: 72 hours
     - **Low**: 168 hours (7 days)

5. **Audio Intelligence Briefings (`POST /threats/{id}/briefing?lang=xx`)**:
   - Generates a concise 3-sentence threat intelligence briefing for incident commanders.
   - Translates into 11 Indic languages using Sarvam Mayura v1.
   - Synthesizes spoken audio in native accent using Sarvam Bulbul v3 TTS.
   - In-memory thread-safe LRU cache saves API credits on repeated listens, with automatic cache invalidation on threat updates.

---

## Setup & Running

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 1. Backend Setup

```bash
cd backend

# Create & activate Python virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and insert your Sarvam API Key
cp .env.example .env

# Run FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- ReDoc Documentation: `http://127.0.0.1:8000/redoc`

### 2. Frontend Setup

```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev -- --host 127.0.0.1 --port 5173
```

- Web Application: `http://127.0.0.1:5173`
- The Vite development server automatically proxies `/threats`, `/stats`, `/ai`, and `/voice` requests to `http://127.0.0.1:8000`.

---

## Environment Configuration (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SARVAM_API_KEY` | `""` | API subscription key for `https://api.sarvam.ai` |
| `MODEL_BACKEND` | `sarvam` | AI engine: `sarvam`, `mock`, or `ollama` (falls back gracefully to `mock` if key missing) |
| `DATABASE_URL` | `sqlite:///./cyber_risk.db` | SQLite database connection string |
| `ENVIRONMENT` | `development` | Deployment environment (`development` / `production`) |
| `BRIEFING_CACHE_SIZE` | `256` | Maximum number of cached audio briefings |

> [!NOTE]
> Secrets are strictly confined to `backend/.env` which is excluded in `.gitignore`. API keys are never printed in logs or exposed to frontend clients.

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/stats` | Aggregate counts by risk level, status, and 30-day trend |
| `GET` | `/threats` | List threats with query filters (`category`, `risk_level`, `status`, `search`) |
| `POST` | `/threats` | Create a new threat (recalculates score/level & adds `CREATED` timeline event) |
| `GET` | `/threats/{id}` | Retrieve threat details by ID |
| `PATCH` | `/threats/{id}` | Update threat fields (logs `STATUS_CHANGED` or `ASSESSMENT_UPDATED` events) |
| `DELETE` | `/threats/{id}` | Delete threat and cascade delete associated timeline events |
| `GET` | `/threats/{id}/timeline` | Retrieve chronological audit timeline events |
| `POST` | `/threats/{id}/timeline` | Append an analyst note or remediation event |
| `POST` | `/threats/{id}/briefing?lang={code}` | Multilingual audio briefing (translated & synthesized via Sarvam AI, cached) |
| `POST` | `/ai/assess` | Natural language threat evaluation with category, score, SLA, and mitigations |
| `POST` | `/voice/report` | Multi-language audio file upload (max 30s/5MB) -> STT -> AI assessment |

---

## Verification & Testing

### Running Backend Unit & Integration Tests

```bash
cd backend
.\venv\Scripts\pytest.exe -v
```
*Current test suite: **38 passing tests** covering threat CRUD, Sarvam client methods with key masking and error handling, AI assessment SLA calculations, voice audio validations, and briefing cache invalidation.*

### Verifying Frontend TypeScript & Production Build

```bash
cd frontend
npx tsc --noEmit
npm run build
```
*Compiles clean with zero TypeScript errors.*
