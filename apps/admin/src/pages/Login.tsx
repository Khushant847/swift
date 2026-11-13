import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, ShieldCheck, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api, ApiError, mediaSrc } from '../lib/api';
import { useToast } from '../components/ui/Toast';

export function LoginPage() {
  const { login, verifyMfa, sessionNotice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const { error } = useToast();

  const { data: company } = useQuery({
    queryKey: ['public-company-info'],
    queryFn: () => api.get<Record<string, string>>('/company-info'),
  });
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = company?.logo_url || company?.logo;
  const companyName = company?.company_name || 'Swift Instruments';

  // Re-try a freshly configured logo even if the old URL failed to load.
  useEffect(() => setLogoFailed(false), [logo]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [challenge, setChallenge] = useState<{ id: string; method: 'totp' | 'email' } | null>(null);
  const [code, setCode] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.mfaRequired && res.challengeId) {
        setChallenge({ id: res.challengeId, method: res.method || 'totp' });
      } else {
        navigate('/');
      }
    } catch (err) {
      error(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setLoading(true);
    try {
      await verifyMfa(challenge.id, code);
      navigate('/');
    } catch (err) {
      error(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {logo && !logoFailed ? (
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 p-2 text-white backdrop-blur overflow-hidden">
              <img
                src={mediaSrc(logo)}
                alt={companyName}
                className="h-full w-full object-contain"
                onError={() => setLogoFailed(true)}
              />
            </div>
          ) : (
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur">
              <Scale className="h-7 w-7" />
            </span>
          )}
          <h1 className="text-2xl font-bold text-white">{companyName}</h1>
          <p className="mt-1 text-sm text-slate-300">Admin Control Console</p>
        </div>

        {sessionNotice ? (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {sessionNotice}
            <button type="button" className="ml-2 font-semibold underline" onClick={clearNotice}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          {!challenge ? (
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
              <div>
                <label htmlFor="login-email" className="label">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  className="input"
                  placeholder="admin@swiftinstruments.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sign in securely
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 text-brand-700" />
                {challenge.method === 'email'
                  ? 'We emailed a 6-digit code to your inbox.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </div>
              <div>
                <label htmlFor="mfa-code" className="label">Verification code</label>
                <input
                  id="mfa-code"
                  className="input text-center text-2xl tracking-[0.4em]"
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full py-2.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify & continue
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setChallenge(null);
                  setCode('');
                }}
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Protected area. Unauthorised access is prohibited and logged.
        </p>
      </div>
    </div>
  );
}
