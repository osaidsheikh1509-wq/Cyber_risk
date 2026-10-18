import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginStep } from '../types/auth';
import {
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  loginWithCredentials as apiLogin,
  loginWithGoogle as apiLoginGoogle,
  registerUser as apiRegister,
  verifyTwoFactor as apiVerify2FA,
  resendTwoFactorOtp as apiResend2FA,
  fetchCurrentUser,
  logoutUser as apiLogout,
} from '../services/authApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginStep: LoginStep;
  tempToken: string | null;
  maskedDestination: string | null;
  previewOtp: string | null;
  authError: string | null;
  clearError: () => void;
  login: (usernameOrEmail: string, pass: string) => Promise<boolean>;
  loginWithGoogle: (email: string, name: string) => Promise<boolean>;
  register: (email: string, password: string, fullName: string, role?: string) => Promise<boolean>;
  verify2FA: (otpCode: string) => Promise<boolean>;
  resend2FA: () => Promise<string | undefined>;
  cancel2FA: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginStep, setLoginStep] = useState<LoginStep>('CREDENTIALS');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Validate session on app initialization
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(storedToken);
        setUser(currentUser);
        setStoredUser(currentUser);
      } catch {
        // Token invalid or expired
        setToken(null);
        setUser(null);
        await apiLogout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Factor 1: Credentials check
  const login = async (usernameOrEmail: string, pass: string): Promise<boolean> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await apiLogin(usernameOrEmail, pass);
      if (res.requires_2fa) {
        setTempToken(res.temp_token);
        setMaskedDestination(res.masked_destination);
        setPreviewOtp(res.preview_otp || null);
        setLoginStep('TWO_FACTOR_VERIFICATION');
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login / Single Sign-On
  const loginWithGoogle = async (email: string, name: string): Promise<boolean> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await apiLoginGoogle(email, name);
      if (res.requires_2fa) {
        setTempToken(res.temp_token);
        setMaskedDestination(res.masked_destination);
        setPreviewOtp(res.preview_otp || null);
        setLoginStep('TWO_FACTOR_VERIFICATION');
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setAuthError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // User Registration
  const register = async (email: string, pass: string, fullName: string, role?: string): Promise<boolean> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await apiRegister({
        email,
        password: pass,
        full_name: fullName,
        role: role || 'Security Analyst',
      });
      if (res.requires_2fa) {
        setTempToken(res.temp_token);
        setMaskedDestination(res.masked_destination);
        setPreviewOtp(res.preview_otp || null);
        setLoginStep('TWO_FACTOR_VERIFICATION');
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setAuthError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Factor 2: OTP verification check
  const verify2FA = async (otpCode: string): Promise<boolean> => {
    if (!tempToken) {
      setAuthError('No active verification session found. Please log in again.');
      setLoginStep('CREDENTIALS');
      return false;
    }

    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await apiVerify2FA(tempToken, otpCode);
      setToken(res.access_token);
      setUser(res.user);
      setStoredToken(res.access_token);
      setStoredUser(res.user);
      // Reset 2FA intermediate state
      setTempToken(null);
      setPreviewOtp(null);
      setMaskedDestination(null);
      setLoginStep('CREDENTIALS');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setAuthError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Factor 2 OTP
  const resend2FA = async (): Promise<string | undefined> => {
    if (!tempToken) {
      setAuthError('No active verification session.');
      return undefined;
    }
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await apiResend2FA(tempToken);
      if (res.preview_otp) {
        setPreviewOtp(res.preview_otp);
      }
      return res.preview_otp;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code';
      setAuthError(msg);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  const cancel2FA = () => {
    setLoginStep('CREDENTIALS');
    setTempToken(null);
    setPreviewOtp(null);
    setMaskedDestination(null);
    setAuthError(null);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiLogout(token);
    } finally {
      setToken(null);
      setUser(null);
      setLoginStep('CREDENTIALS');
      setTempToken(null);
      setPreviewOtp(null);
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        loginStep,
        tempToken,
        maskedDestination,
        previewOtp,
        authError,
        clearError,
        login,
        loginWithGoogle,
        register,
        verify2FA,
        resend2FA,
        cancel2FA,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
