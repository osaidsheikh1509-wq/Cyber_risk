from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, engine, SessionLocal
from app.models.risk import RiskItem
from app.models.threat import Threat, TimelineEvent
from app.models.user import User, TwoFactorSession
from app.core.seed import seed_threats_if_empty
from app.api.v1.endpoints import health, risks, threats, stats, ai, voice, auth
from app.api.v1.endpoints.auth import seed_demo_users_if_empty

settings = get_settings()


def seed_initial_risks():
    """Seed initial cyber risk items if database is empty."""
    db = SessionLocal()
    try:
        if db.query(RiskItem).count() == 0:
            sample_risks = [
                RiskItem(
                    title="Exposed Database Port (3306) on Public IP",
                    description="Production MySQL instance is reachable without VPN or IP whitelisting.",
                    severity="critical",
                    category="network",
                    status="open",
                    score=9.8,
                ),
                RiskItem(
                    title="Missing Multi-Factor Authentication for Admin Portal",
                    description="SSO is not enforced on the internal admin portal for privileged access accounts.",
                    severity="high",
                    category="identity",
                    status="open",
                    score=8.5,
                ),
                RiskItem(
                    title="Outdated TLS 1.0/1.1 Enabled on Edge Gateway",
                    description="Edge reverse proxy supports legacy deprecated cryptographic cipher suites.",
                    severity="medium",
                    category="cloud",
                    status="in_review",
                    score=5.4,
                ),
                RiskItem(
                    title="Unrestricted CORS Policy on Public API Gateway",
                    description="Wildcard CORS header present on non-public authentication callback routes.",
                    severity="low",
                    category="application",
                    status="mitigated",
                    score=3.2,
                ),
            ]
            db.add_all(sample_risks)
            db.commit()
    finally:
        db.close()


from app.core.mongo import init_mongo_indexes, get_mongo_db, close_mongo_client
from app.repositories.dependencies import get_active_backend_name

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database depending on active backend
    active_backend = get_active_backend_name()
    if active_backend == "mongo":
        try:
            mongo_db = get_mongo_db()
            init_mongo_indexes(mongo_db)
            seed_threats_if_empty()
        except Exception:
            pass
    else:
        Base.metadata.create_all(bind=engine)
        seed_threats_if_empty()
        seed_initial_risks()
        seed_demo_users_if_empty()
    yield
    # Shutdown
    close_mongo_client()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Cyber Risk Tracker - Threat Intelligence and Security Posture Monitoring API",
    lifespan=lifespan,
)

# CORS Middleware configuration
allow_all = "*" in settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else settings.cors_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$" if not allow_all else None,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount endpoints under both root and /api/v1
app.include_router(auth.router, prefix="/auth", tags=["Authentication & 2FA"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication & 2FA"])

app.include_router(threats.router, prefix="/threats", tags=["Threats"])
app.include_router(threats.router, prefix="/api/v1/threats", tags=["Threats"])

app.include_router(stats.router, prefix="", tags=["Stats"])
app.include_router(stats.router, prefix="/api/v1", tags=["Stats"])

app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(health.router, prefix="", tags=["Health"])

app.include_router(ai.router, prefix="/ai", tags=["AI Threat Assessment"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Threat Assessment"])

app.include_router(voice.router, prefix="/voice", tags=["Voice Reporting"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["Voice Reporting"])

app.include_router(risks.router, prefix="/api/v1/risks", tags=["Risks"])


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs_url": "/docs",
        "threats_url": "/threats",
        "stats_url": "/stats",
        "health_url": "/api/v1/health",
    }
