import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.config import get_settings
from app.main import app
from app.core.seed import seed_threats_if_empty
from app.repositories import (
    get_threat_repo,
    get_timeline_repo,
    get_briefing_repo,
    SQLiteThreatRepository,
    SQLiteTimelineRepository,
    SQLiteBriefingCacheRepository,
)

# Use in-memory SQLite database for isolated unit/integration tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def default_test_settings(monkeypatch):
    """Ensure tests run against SQLite by default unless explicitly configured otherwise."""
    settings = get_settings()
    monkeypatch.setattr(settings, "DB_BACKEND", "sqlite")
    monkeypatch.setattr(settings, "DB_FALLBACK", True)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test function."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden repository and database dependencies."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_threat_repo] = lambda: SQLiteThreatRepository(db_session)
    app.dependency_overrides[get_timeline_repo] = lambda: SQLiteTimelineRepository(db_session)
    app.dependency_overrides[get_briefing_repo] = lambda: SQLiteBriefingCacheRepository()

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seeded_client(client, db_session):
    """Test client with the 25 realistic threats pre-seeded."""
    seed_threats_if_empty(db=db_session)
    return client
