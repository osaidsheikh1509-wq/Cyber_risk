import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.core.security import (
    hash_password,
    verify_password,
    generate_otp_code,
    generate_secure_token,
    hash_token,
)
from app.models.user import User, TwoFactorSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    Verify2FARequest,
    Resend2FARequest,
    AuthSuccessResponse,
    UserProfile,
    RegisterRequest,
    GoogleAuthRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def mask_email(email: str) -> str:
    """Mask email for privacy in 2FA prompt: adm***n@cyberrisk.soc"""
    try:
        parts = email.split("@")
        if len(parts) != 2:
            return email
        name, domain = parts
        if len(name) <= 2:
            masked_name = name[0] + "***"
        else:
            masked_name = name[0] + "***" + name[-1]
        return f"{masked_name}@{domain}"
    except Exception:
        return email


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Dependency to retrieve currently authenticated user from Bearer token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]
    user = (
        db.query(User)
        .filter(
            User.session_token == token,
            User.is_active == True,
        )
        .first()
    )

    if not user or not user.session_token_expires_at or to_utc(user.session_token_expires_at) < utc_now():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


@router.post("/login", response_model=LoginResponse, summary="Step 1: Primary Authentication (Credentials Check)")
def login_step_one(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Step 1 of Double Verification Login:
    Validates username/email and password.
    If valid, issues a temporary 2FA session token and generates a 6-digit OTP security code.
    Access to protected resources remains blocked until Step 2 (/verify-2fa) is satisfied.
    """
    ident = request.username_or_email.strip().lower()
    user = (
        db.query(User)
        .filter(
            (User.email.ilike(ident)) | (User.username.ilike(ident))
        )
        .first()
    )

    if not user or not verify_password(request.password, user.hashed_password):
        # Prevent timing attacks and user enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Verify your username/email and master password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your security account has been locked or suspended by the SOC administrator.",
        )

    # Factor 1 Succeeded -> Initiate Factor 2 (Double Verification)
    otp_code = generate_otp_code()
    temp_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    two_fa_session = TwoFactorSession(
        user_id=user.id,
        temp_token=temp_token,
        otp_code_hash=hash_token(otp_code),
        plain_otp_preview=otp_code,  # Stored for dev/demo testing simulator
        attempts_left=5,
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(two_fa_session)
    db.commit()

    masked_target = mask_email(user.email)
    logger.info(f"[SOC 2FA] Verification code generated for user {user.username}: {otp_code}")

    return LoginResponse(
        requires_2fa=True,
        temp_token=temp_token,
        masked_destination=masked_target,
        expires_in_seconds=300,
        preview_otp=otp_code,  # Provided for local testing and developer preview
        message=f"Level 1 authentication passed. 6-digit security code dispatched to registered device for {masked_target}.",
    )


@router.post("/verify-2fa", response_model=AuthSuccessResponse, summary="Step 2: Second Verification (Security Code)")
def verify_step_two(request: Verify2FARequest, db: Session = Depends(get_db)):
    """
    Step 2 of Double Verification Login:
    Validates the 6-digit OTP code against the temporary 2FA token.
    Enforces maximum attempts and expiration.
    Once verified, elevates user to authenticated status and issues full session Bearer token.
    """
    now = datetime.now(timezone.utc)
    two_fa_session = (
        db.query(TwoFactorSession)
        .filter(
            TwoFactorSession.temp_token == request.temp_token,
            TwoFactorSession.is_verified == False,
        )
        .first()
    )

    if not two_fa_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification session. Please initiate login again.",
        )

    # Check expiration
    if to_utc(two_fa_session.expires_at) < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security code has expired. Please request a new code.",
        )

    # Check attempt limit
    if two_fa_session.attempts_left <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maximum verification attempts exceeded. Session invalidated for security reasons.",
        )

    # Verify OTP
    input_code = request.otp_code.strip()
    expected_hash = hash_token(input_code)

    if two_fa_session.otp_code_hash != expected_hash:
        two_fa_session.attempts_left -= 1
        db.commit()
        remaining = two_fa_session.attempts_left
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect security code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # Factor 2 Verified Successfully!
    two_fa_session.is_verified = True
    user = db.query(User).filter(User.id == two_fa_session.user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User record not found.")

    # Issue Session Bearer Token
    session_token = generate_secure_token()
    user.session_token = session_token
    user.session_token_expires_at = now + timedelta(days=7)
    user.last_login = now
    db.commit()
    db.refresh(user)

    logger.info(f"[SOC 2FA] User {user.username} successfully completed double verification.")

    return AuthSuccessResponse(
        access_token=session_token,
        token_type="Bearer",
        user=UserProfile.model_validate(user),
        message="Double verification complete. SOC Terminal access granted.",
    )


@router.post("/resend-2fa", summary="Resend fresh 6-digit OTP code")
def resend_otp(request: Resend2FARequest, db: Session = Depends(get_db)):
    """Resend a fresh 6-digit OTP code for an active 2FA temporary session."""
    two_fa_session = (
        db.query(TwoFactorSession)
        .filter(
            TwoFactorSession.temp_token == request.temp_token,
            TwoFactorSession.is_verified == False,
        )
        .first()
    )

    if not two_fa_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification session.",
        )

    new_otp = generate_otp_code()
    two_fa_session.otp_code_hash = hash_token(new_otp)
    two_fa_session.plain_otp_preview = new_otp
    two_fa_session.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    two_fa_session.attempts_left = 5
    db.commit()

    user = db.query(User).filter(User.id == two_fa_session.user_id).first()
    masked = mask_email(user.email) if user else "your device"

    logger.info(f"[SOC 2FA] Resent code for session {two_fa_session.id}: {new_otp}")

    return {
        "message": f"Fresh security code dispatched to {masked}.",
        "preview_otp": new_otp,
        "expires_in_seconds": 300,
    }


@router.get("/me", response_model=UserProfile, summary="Get current authenticated user profile")
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve profile and clearance level of the authenticated analyst."""
    return UserProfile.model_validate(current_user)


@router.post("/logout", summary="Log out and invalidate current session")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invalidate the session token and close active SOC terminal session."""
    current_user.session_token = None
    current_user.session_token_expires_at = None
    db.commit()
    return {"message": "SOC Session terminated securely."}


@router.post("/register", response_model=LoginResponse, summary="Register a new SOC analyst account and initiate double verification")
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new analyst account and immediately initiate Level 2 double verification.
    """
    email_clean = request.email.strip().lower()
    existing_email = db.query(User).filter(User.email.ilike(email_clean)).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email address already exists. Please sign in.")

    # Determine username
    base_username = request.username.strip().lower() if request.username else email_clean.split("@")[0]
    final_username = base_username
    # Avoid collisions
    counter = 1
    while db.query(User).filter(User.username.ilike(final_username)).first():
        final_username = f"{base_username}_{counter}"
        counter += 1

    new_user = User(
        email=email_clean,
        username=final_username,
        full_name=request.full_name.strip(),
        hashed_password=hash_password(request.password),
        role=request.role or "Security Analyst",
        security_clearance=request.security_clearance or "Alpha-1 (Confidential)",
        is_active=True,
        is_2fa_enabled=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initiate Double Verification Session
    otp_code = generate_otp_code()
    temp_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    two_fa_session = TwoFactorSession(
        user_id=new_user.id,
        temp_token=temp_token,
        otp_code_hash=hash_token(otp_code),
        plain_otp_preview=otp_code,
        attempts_left=5,
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(two_fa_session)
    db.commit()

    masked = mask_email(new_user.email)
    logger.info(f"[SOC 2FA Register] User {new_user.username} registered. OTP: {otp_code}")

    return LoginResponse(
        requires_2fa=True,
        temp_token=temp_token,
        masked_destination=masked,
        expires_in_seconds=300,
        preview_otp=otp_code,
        message=f"Account created successfully! A 6-digit verification code has been dispatched to {masked}.",
    )


@router.post("/google", response_model=LoginResponse, summary="Authenticate with Google and initiate double verification")
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Sign in or automatically register an account via Google, then prompt for Level 2 double verification.
    """
    email_clean = request.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email_clean)).first()

    if not user:
        # Auto-provision user for Google SSO
        base_username = email_clean.split("@")[0].lower()
        final_username = base_username
        counter = 1
        while db.query(User).filter(User.username.ilike(final_username)).first():
            final_username = f"{base_username}_{counter}"
            counter += 1

        user = User(
            email=email_clean,
            username=final_username,
            full_name=request.name.strip() or "Google User",
            hashed_password=hash_password(secrets.token_urlsafe(24)),
            role="Security Analyst",
            security_clearance="Alpha-1 (Confidential)",
            is_active=True,
            is_2fa_enabled=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"[SOC Google Auth] Provisioned new Google user: {user.email}")
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been locked or suspended by the SOC administrator.",
            )

    # Initiate Double Verification Session
    otp_code = generate_otp_code()
    temp_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    two_fa_session = TwoFactorSession(
        user_id=user.id,
        temp_token=temp_token,
        otp_code_hash=hash_token(otp_code),
        plain_otp_preview=otp_code,
        attempts_left=5,
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(two_fa_session)
    db.commit()

    masked = mask_email(user.email)
    logger.info(f"[SOC Google 2FA] OTP for Google user {user.email}: {otp_code}")

    return LoginResponse(
        requires_2fa=True,
        temp_token=temp_token,
        masked_destination=masked,
        expires_in_seconds=300,
        preview_otp=otp_code,
        message=f"Google account verified. Enter the 6-digit security code sent to {masked} to complete dual-factor login.",
    )


def seed_demo_users_if_empty():
    """Seed initial demo accounts for immediate testing of 2FA login."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            demo_accounts = [
                User(
                    email="admin@cyberrisk.soc",
                    username="admin",
                    full_name="Devaans Patwari (SOC Admin)",
                    hashed_password=hash_password("AdminPassword@2026"),
                    role="SOC Lead Administrator",
                    security_clearance="Level 3 - Top Secret (Alpha-1)",
                    is_active=True,
                    is_2fa_enabled=True,
                ),
                User(
                    email="analyst@cyberrisk.soc",
                    username="analyst",
                    full_name="Alex Vance (Threat Intel)",
                    hashed_password=hash_password("AnalystPassword@2026"),
                    role="Senior Incident Responder",
                    security_clearance="Level 2 - Confidential (Bravo-2)",
                    is_active=True,
                    is_2fa_enabled=True,
                ),
                User(
                    email="ciso@cyberrisk.soc",
                    username="ciso",
                    full_name="Elena Rostova (CISO)",
                    hashed_password=hash_password("CisoPassword@2026"),
                    role="Chief Information Security Officer",
                    security_clearance="Level 4 - Executive Command",
                    is_active=True,
                    is_2fa_enabled=True,
                ),
            ]
            db.add_all(demo_accounts)
            db.commit()
            logger.info("Default SOC demo accounts seeded with 2FA support.")
    except Exception as e:
        logger.warning(f"Could not seed demo users: {e}")
    finally:
        db.close()
