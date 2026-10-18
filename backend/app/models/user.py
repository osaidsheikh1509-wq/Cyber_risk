from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(100), nullable=False, default="Security Analyst")
    security_clearance = Column(String(50), nullable=False, default="Alpha-1 (Confidential)")
    is_active = Column(Boolean, default=True, nullable=False)
    is_2fa_enabled = Column(Boolean, default=True, nullable=False)
    session_token = Column(String(255), nullable=True, index=True)
    session_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    two_factor_sessions = relationship(
        "TwoFactorSession",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="TwoFactorSession.created_at.desc()",
    )


class TwoFactorSession(Base):
    __tablename__ = "two_factor_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    temp_token = Column(String(255), unique=True, index=True, nullable=False)
    otp_code_hash = Column(String(255), nullable=False)
    plain_otp_preview = Column(String(10), nullable=True)  # Stored for dev/testing simulator
    attempts_left = Column(Integer, default=5, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="two_factor_sessions")
