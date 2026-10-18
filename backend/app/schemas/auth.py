from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    security_clearance: str
    is_2fa_enabled: bool
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username_or_email: str = Field(..., description="User's email or SOC username")
    password: str = Field(..., description="Account master password")


class LoginResponse(BaseModel):
    requires_2fa: bool = True
    temp_token: str
    masked_destination: str
    expires_in_seconds: int = 300
    preview_otp: Optional[str] = None  # Returned for local testing and developer convenience
    message: str


class Verify2FARequest(BaseModel):
    temp_token: str = Field(..., description="Temporary token issued after Level 1 credentials check")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class Resend2FARequest(BaseModel):
    temp_token: str = Field(..., description="Temporary token issued during login")


class AuthSuccessResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserProfile
    message: str


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, description="Analyst email address")
    username: Optional[str] = Field(None, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    role: Optional[str] = "Security Analyst"
    security_clearance: Optional[str] = "Alpha-1 (Confidential)"


class GoogleAuthRequest(BaseModel):
    email: str = Field(..., min_length=5, description="Google account email")
    name: str = Field(..., min_length=1, description="Google account full name")
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
