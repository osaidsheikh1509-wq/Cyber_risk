export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: string;
  security_clearance: string;
  is_2fa_enabled: boolean;
  last_login?: string | null;
}

export type LoginStep = 'CREDENTIALS' | 'TWO_FACTOR_VERIFICATION';

export interface LoginResponse {
  requires_2fa: boolean;
  temp_token: string;
  masked_destination: string;
  expires_in_seconds: number;
  preview_otp?: string;
  message: string;
}

export interface AuthSuccessResponse {
  access_token: string;
  token_type: string;
  user: User;
  message: string;
}

export interface Resend2FAResponse {
  message: string;
  preview_otp?: string;
  expires_in_seconds: number;
}
