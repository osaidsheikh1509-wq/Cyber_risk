import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  User as UserIcon,
  KeyRound,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Sparkles,
  Fingerprint,
  Mail,
  UserPlus,
  LogIn,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DoubleVerificationLoginProps {
  onSuccess?: () => void;
}

// Google Multi-Color SVG Icon
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const DoubleVerificationLogin: React.FC<DoubleVerificationLoginProps> = ({ onSuccess }) => {
  const {
    loginStep,
    maskedDestination,
    previewOtp,
    authError,
    clearError,
    isLoading,
    login,
    loginWithGoogle,
    register,
    verify2FA,
    resend2FA,
    cancel2FA,
  } = useAuth();

  // Mode: 'SIGN_IN' or 'REGISTER'
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');

  // Sign In Form State
  const [loginIdent, setLoginIdent] = useState('admin');
  const [loginPass, setLoginPass] = useState('AdminPassword@2026');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regRole, setRegRole] = useState('Security Analyst');
  const [showRegPass, setShowRegPass] = useState(false);

  // Google Modal Simulation State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  // Factor 2 OTP Digits State (6 boxes)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Focus first OTP input when entering Factor 2
  useEffect(() => {
    if (loginStep === 'TWO_FACTOR_VERIFICATION') {
      setCountdown(300);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [loginStep]);

  // Countdown timer for 2FA OTP
  useEffect(() => {
    if (loginStep !== 'TWO_FACTOR_VERIFICATION' || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [loginStep, countdown]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sign In Handler
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdent.trim() || !loginPass) return;
    await login(loginIdent.trim(), loginPass);
  };

  // Register Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPass || !regFullName.trim()) return;
    if (regPass !== regConfirmPass) {
      alert('Passwords do not match. Please re-enter your password.');
      return;
    }
    await register(regEmail.trim(), regPass, regFullName.trim(), regRole);
  };

  // Google Sign-In Handler
  const handleGoogleSelect = async (email: string, name: string) => {
    setShowGoogleModal(false);
    await loginWithGoogle(email, name);
  };

  // Factor 2 digit input
  const handleDigitChange = (index: number, value: string) => {
    clearError();
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanValue;
    setOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = nextDigits.join('');
    if (fullCode.length === 6 && !nextDigits.includes('')) {
      handleVerifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const nextDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || '';
    }
    setOtpDigits(nextDigits);
    const fullCode = nextDigits.join('');
    if (fullCode.length === 6) {
      inputRefs.current[5]?.focus();
      handleVerifyCode(fullCode);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) return;
    const ok = await verify2FA(code);
    if (ok && onSuccess) {
      onSuccess();
    }
  };

  const handleResend = async () => {
    setResendStatus(null);
    const newCode = await resend2FA();
    if (newCode) {
      setCountdown(300);
      setOtpDigits(['', '', '', '', '', '']);
      setResendStatus('New 6-digit code has been dispatched.');
      inputRefs.current[0]?.focus();
    }
  };

  const handleQuickFillOtp = () => {
    if (!previewOtp || previewOtp.length !== 6) return;
    const digits = previewOtp.split('');
    setOtpDigits(digits);
    handleVerifyCode(previewOtp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      {/* Decorative Cyber Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[560px] h-96 bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden backdrop-blur-md my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[var(--shadow-glow)]">
              {loginStep === 'CREDENTIALS' ? (
                <Shield className="w-6 h-6 text-cyan-400" />
              ) : (
                <Fingerprint className="w-6 h-6 text-cyan-400 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-500 dark:text-cyan-400">
                  SOC Access Portal
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  DOUBLE VERIFICATION
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Cyber Risk Security Gateway
              </h2>
            </div>
          </div>

          <div className="hidden xs:flex flex-col items-end text-right">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Security Clearance</span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {loginStep === 'CREDENTIALS' ? 'Step 1: Identity' : 'Step 2: 2FA Token'}
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 font-medium">{authError}</div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: IDENTITY AUTH (GOOGLE / SIGN IN / REGISTER)      */}
        {/* ======================================================== */}
        {loginStep === 'CREDENTIALS' && (
          <div>
            {/* Primary Action: CONTINUE WITH GOOGLE */}
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 dark:border-slate-700 shadow-md transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5 shrink-0" />
              <span>Continue with Google</span>
            </button>

            {/* Visual Separator */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-color)]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase font-mono">
                <span className="bg-[var(--bg-surface)] px-3 text-[var(--text-muted)]">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Tab Switcher: Sign In vs Register */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('SIGN_IN');
                  clearError();
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'SIGN_IN'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('REGISTER');
                  clearError();
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'REGISTER'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>

            {/* TAB 1: SIGN IN */}
            {authMode === 'SIGN_IN' && (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 font-mono">
                    EMAIL OR USERNAME
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={loginIdent}
                      onChange={(e) => {
                        setLoginIdent(e.target.value);
                        clearError();
                      }}
                      required
                      placeholder="admin or admin@cyberrisk.soc"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] font-mono">
                      MASTER PASSWORD
                    </label>
                    <span className="text-[11px] text-cyan-500 font-mono">SHA-256 Protected</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type={showLoginPass ? 'text' : 'password'}
                      value={loginPass}
                      onChange={(e) => {
                        setLoginPass(e.target.value);
                        clearError();
                      }}
                      required
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                    >
                      {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 transition-all shadow-[var(--shadow-glow)] cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Checking Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Double Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER NEW ACCOUNT */}
            {authMode === 'REGISTER' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 font-mono">
                    FULL NAME
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                      placeholder="e.g. Devaans Patwari"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 font-mono">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="name@company.com or user@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] font-mono">
                        PASSWORD
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        className="text-[10px] text-cyan-400 hover:underline"
                      >
                        {showRegPass ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 font-mono">
                      CONFIRM
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        value={regConfirmPass}
                        onChange={(e) => setRegConfirmPass(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 font-mono">
                    SOC ROLE / CLEARANCE TIER
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-cyan-500 transition"
                  >
                    <option value="Security Analyst">Security Analyst (Tier-1)</option>
                    <option value="Senior Incident Responder">Senior Incident Responder (Tier-2)</option>
                    <option value="Threat Intelligence Lead">Threat Intelligence Lead</option>
                    <option value="SOC Lead Administrator">SOC Lead Administrator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account & Verify (2FA)</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick Demo Credentials Footer */}
            {authMode === 'SIGN_IN' && (
              <div className="mt-5 pt-4 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    ⚡ Quick Demo Profiles:
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">1-Click Test</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdent('admin');
                      setLoginPass('AdminPassword@2026');
                      clearError();
                    }}
                    className="px-2 py-1.5 rounded-lg text-left border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:border-cyan-500 transition cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-[var(--text-primary)]">Admin</div>
                    <div className="text-[9px] text-[var(--text-muted)]">Alpha-1</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdent('analyst');
                      setLoginPass('AnalystPassword@2026');
                      clearError();
                    }}
                    className="px-2 py-1.5 rounded-lg text-left border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:border-cyan-500 transition cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-[var(--text-primary)]">Responder</div>
                    <div className="text-[9px] text-[var(--text-muted)]">Bravo-2</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdent('ciso');
                      setLoginPass('CisoPassword@2026');
                      clearError();
                    }}
                    className="px-2 py-1.5 rounded-lg text-left border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:border-cyan-500 transition cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-[var(--text-primary)]">CISO</div>
                    <div className="text-[9px] text-[var(--text-muted)]">Executive</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: DOUBLE VERIFICATION 2FA CODE GATEWAY             */}
        {/* ======================================================== */}
        {loginStep === 'TWO_FACTOR_VERIFICATION' && (
          <div>
            <div className="mb-4 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2 shadow-[var(--shadow-glow)]">
                <KeyRound className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Level 2: Double Verification
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                A 6-digit one-time authorization code has been dispatched to:
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                {maskedDestination || 'registered security device'}
              </div>
            </div>

            {/* Simulated Authenticator Code Preview for Demo / Developer Testing */}
            {previewOtp && (
              <div className="mb-5 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between shadow-[var(--shadow-glow)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                  <div>
                    <span className="font-semibold text-cyan-200">Security Simulator:</span>
                    <span className="ml-1.5 font-mono font-bold tracking-widest text-white text-sm bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/50">
                      {previewOtp}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickFillOtp}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer shadow-sm"
                >
                  Quick Fill
                </button>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="mb-5">
              <label className="block text-center text-xs font-mono font-medium text-[var(--text-muted)] mb-3">
                ENTER 6-DIGIT SECURITY CODE
              </label>
              <div className="flex justify-center items-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-14 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 shadow-inner transition"
                  />
                ))}
              </div>
            </div>

            {/* Timer & Resend Status */}
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] mb-5 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Expires in:</span>
                <span className={`font-bold ${countdown < 60 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`}>
                  {formatTimer(countdown)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="hover:text-cyan-400 transition underline underline-offset-2 cursor-pointer disabled:opacity-50"
              >
                Resend Code
              </button>
            </div>

            {resendStatus && (
              <div className="mb-4 text-center text-xs font-medium text-emerald-400 animate-fade-in">
                {resendStatus}
              </div>
            )}

            {/* Actions: Verify & Back */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleVerifyCode()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 transition-all shadow-[var(--shadow-glow)] cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Access SOC Terminal</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={cancel2FA}
                disabled={isLoading}
                className="w-full py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                ← Return to Previous Step
              </button>
            </div>
          </div>
        )}

        {/* Footer Security Watermark */}
        <div className="mt-5 pt-3.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            End-to-End TLS 1.3
          </span>
          <span>Zero-Trust Architecture</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GOOGLE ACCOUNT CHOOSER MODAL SIMULATOR                   */}
      {/* ======================================================== */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative">
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <GoogleIcon className="w-6 h-6" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sign in with Google</h4>
                <p className="text-[11px] text-slate-500">Choose an account to continue to Cyber Risk SOC</p>
              </div>
            </div>

            {/* Preset Google Accounts */}
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleGoogleSelect('devaans.patwari@gmail.com', 'Devaans Patwari')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500 hover:bg-cyan-500/5 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    D
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-400">
                      Devaans Patwari
                    </div>
                    <div className="text-[10px] text-slate-500">devaans.patwari@gmail.com</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
              </button>

              <button
                onClick={() => handleGoogleSelect('alex.vance.analyst@gmail.com', 'Alex Vance')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500 hover:bg-cyan-500/5 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                    A
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-400">
                      Alex Vance (SOC)
                    </div>
                    <div className="text-[10px] text-slate-500">alex.vance.analyst@gmail.com</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
              </button>
            </div>

            {/* Custom Google Account Input */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-2 block">
                Or use another Google email:
              </span>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Your Name (Optional)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={!customGoogleEmail.trim()}
                  onClick={() =>
                    handleGoogleSelect(
                      customGoogleEmail.trim(),
                      customGoogleName.trim() || customGoogleEmail.split('@')[0]
                    )
                  }
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Continue with this Google Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
