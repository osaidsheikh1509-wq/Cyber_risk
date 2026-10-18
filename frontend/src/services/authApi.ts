import { User, LoginResponse, AuthSuccessResponse, Resend2FAResponse } from '../types/auth';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const AUTH_API = `${BASE_URL}/api/v1/auth`;

const TOKEN_STORAGE_KEY = 'cyber_risk_auth_token';
const USER_STORAGE_KEY = 'cyber_risk_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}

export async function loginWithCredentials(
  usernameOrEmail: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username_or_email: usernameOrEmail,
      password: password,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.detail || 'Authentication failed. Please verify credentials.');
  }

  return res.json();
}

export async function loginWithGoogle(
  email: string,
  name: string
): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_API}/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.detail || 'Google authentication failed.');
  }

  return res.json();
}

export async function registerUser(data: {
  email: string;
  password: string;
  full_name: string;
  username?: string;
  role?: string;
}): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.detail || 'Registration failed.');
  }

  return res.json();
}

export async function verifyTwoFactor(
  tempToken: string,
  otpCode: string
): Promise<AuthSuccessResponse> {
  const res = await fetch(`${AUTH_API}/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      temp_token: tempToken,
      otp_code: otpCode,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.detail || 'Two-factor verification failed.');
  }

  return res.json();
}

export async function resendTwoFactorOtp(tempToken: string): Promise<Resend2FAResponse> {
  const res = await fetch(`${AUTH_API}/resend-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp_token: tempToken }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.detail || 'Failed to resend verification code.');
  }

  return res.json();
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${AUTH_API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Session is expired or invalid.');
  }

  return res.json();
}

export async function logoutUser(token?: string | null): Promise<void> {
  if (token) {
    try {
      await fetch(`${AUTH_API}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  clearStoredToken();
  clearStoredUser();
}
