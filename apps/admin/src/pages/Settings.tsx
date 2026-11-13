import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Download, KeyRound, Plus, Save, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { api, ApiError, downloadFile } from '../lib/api';
import { PageHeader, FullPageSpinner } from '../components/ui/Feedback';
import { Field } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { formatBytes, formatDate } from '../lib/utils';
import type { AdminUser } from '../lib/types';

type Settings = Record<string, string>;
interface SocialLink { label: string; url: string; icon: string; }

const ICON_OPTIONS = ['Linkedin', 'Facebook', 'Instagram', 'Youtube', 'Twitter'];

export function SettingsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [settings, setSettings] = useState<Settings>({});
  const [socials, setSocials] = useState<SocialLink[]>([]);

  // MFA
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaMode, setMfaMode] = useState<'setup' | 'disable'>('setup');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  // password
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/admin/settings') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get<AdminUser>('/admin/auth/me') });
  // Backup + settings writes are super-admin only on the backend — don't fire
  // queries/mutations that would just 403 for a content editor.
  const isSuper = me?.role === 'super_admin';
  const { data: backup } = useQuery({
    queryKey: ['backup-info'],
    queryFn: () => api.get<{ driver: string; downloadable: boolean; sizeBytes?: number; modifiedAt?: string | null }>('/admin/backup/info'),
    enabled: isSuper,
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
      try {
        const arr = JSON.parse(data.social_links || '[]');
        setSocials(Array.isArray(arr) ? arr : []);
      } catch {
        setSocials([]);
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = [
        { keyName: 'enquiry_recipients', keyValue: settings.enquiry_recipients || '' },
        { keyName: 'footer_text', keyValue: settings.footer_text || '' },
        { keyName: 'copyright', keyValue: settings.copyright || '' },
        { keyName: 'legal_disclaimer', keyValue: settings.legal_disclaimer || '' },
        { keyName: 'social_links', keyValue: JSON.stringify(socials) },
      ];
      return api.put('/admin/settings', { items });
    },
    onSuccess: () => { success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const mfaSetupMutation = useMutation({
    mutationFn: () => api.post<{ secret: string; qr: string }>('/admin/auth/mfa/setup'),
    onSuccess: (r) => { setMfaMode('setup'); setMfaSetup(r); setMfaOpen(true); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'MFA setup failed'),
  });
  const mfaConfirmMutation = useMutation({
    mutationFn: (body: { enable: boolean; code?: string }) => api.post('/admin/auth/mfa/setup/confirm', body),
    onSuccess: (_r, v) => { success(v.enable ? 'MFA enabled' : 'MFA disabled'); setMfaOpen(false); setMfaSetup(null); setMfaCode(''); qc.invalidateQueries({ queryKey: ['me'] }); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'MFA update failed'),
  });

  const pwMutation = useMutation({
    mutationFn: () => api.post('/admin/auth/change-password', { currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => { success('Password updated. Please sign in again.'); setPwOpen(false); setPw({ current: '', next: '' }); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Password change failed'),
  });

  async function handleBackup() {
    try {
      await downloadFile('/admin/backup/download', `swift-backup-${Date.now()}.db`);
      success('Backup downloaded');
    } catch (e) {
      error(e instanceof ApiError ? e.message : 'Backup failed');
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Settings & Backup"
        description="Notification recipients, footer content, security and database backups."
        actions={isSuper ? <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving…' : 'Save settings'}</button> : null}
      />

      {!isSuper ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Site settings below are read-only for your role. A Super Admin can update them.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Notifications</h2>
          <Field label="Enquiry notification recipients" hint="Comma-separated email addresses that receive new enquiry alerts.">
            <textarea disabled={!isSuper} className="input min-h-[80px]" value={settings.enquiry_recipients || ''} onChange={(e) => setSettings((s) => ({ ...s, enquiry_recipients: e.target.value }))} placeholder="sales@swiftinstruments.in, admin@swiftinstruments.in" />
          </Field>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Footer & Legal</h2>
          <div className="space-y-4">
            <Field label="Footer text"><textarea disabled={!isSuper} className="input min-h-[70px]" value={settings.footer_text || ''} onChange={(e) => setSettings((s) => ({ ...s, footer_text: e.target.value }))} /></Field>
            <Field label="Copyright"><input disabled={!isSuper} className="input" value={settings.copyright || ''} onChange={(e) => setSettings((s) => ({ ...s, copyright: e.target.value }))} /></Field>
            <Field label="Legal disclaimer"><input disabled={!isSuper} className="input" value={settings.legal_disclaimer || ''} onChange={(e) => setSettings((s) => ({ ...s, legal_disclaimer: e.target.value }))} /></Field>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Social Links</h2>
            {isSuper ? <button className="btn-outline !py-1.5" onClick={() => setSocials((s) => [...s, { label: '', url: '', icon: 'Linkedin' }])}><Plus className="h-4 w-4" /> Add link</button> : null}
          </div>
          {socials.length === 0 ? <p className="text-sm text-slate-400">No social links configured.</p> : (
            <div className="space-y-3">
              {socials.map((link, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3">
                  <Field label="Label" className="min-w-[140px] flex-1"><input className="input" value={link.label} onChange={(e) => setSocials((s) => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /></Field>
                  <Field label="URL" className="min-w-[200px] flex-[2]"><input className="input" value={link.url} onChange={(e) => setSocials((s) => s.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} /></Field>
                  <Field label="Icon" className="w-[140px]">
                    <select className="input" value={link.icon} onChange={(e) => setSocials((s) => s.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}>
                      {ICON_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                    </select>
                  </Field>
                  {isSuper ? <button className="btn-ghost mb-0.5 text-red-600 hover:bg-red-50" onClick={() => setSocials((s) => s.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Security</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${me?.mfaEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                  {me?.mfaEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
                </span>
                <div>
                  <p className="font-medium text-slate-800">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-500">{me?.mfaEnabled ? 'Enabled via authenticator app' : 'Not enabled'}</p>
                </div>
              </div>
              {me?.mfaEnabled ? (
                <button
                  className="btn-outline"
                  onClick={() => { setMfaMode('disable'); setMfaCode(''); setMfaOpen(true); }}
                >
                  Disable
                </button>
              ) : (
                <button className="btn-primary" onClick={() => mfaSetupMutation.mutate()} disabled={mfaSetupMutation.isPending}>Enable MFA</button>
              )}
            </div>
            <button className="btn-outline w-full" onClick={() => setPwOpen(true)}><KeyRound className="h-4 w-4" /> Change password</button>
            <p className="text-xs text-slate-400">Sessions end after 20 minutes or 15 minutes of inactivity; changing your password signs out all sessions.</p>
          </div>
        </div>

        {isSuper ? (
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Database Backup</h2>
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-800"><Database className="h-5 w-5" /></span>
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-700">Driver: {backup?.driver?.toUpperCase() || '—'}</p>
              {backup?.downloadable ? (
                <p className="text-xs text-slate-500">{formatBytes(backup.sizeBytes || 0)} · last modified {formatDate(backup.modifiedAt)}</p>
              ) : (
                <p className="text-xs text-slate-500">Automated snapshots are handled by your managed database provider.</p>
              )}
            </div>
          </div>
          <button className="btn-primary mt-4 w-full" onClick={handleBackup} disabled={!backup?.downloadable}><Download className="h-4 w-4" /> Download backup</button>
          <p className="mt-2 text-xs text-slate-400">Manual download of a point-in-time snapshot. Schedule automated backups at the infrastructure level.</p>
        </div>
        ) : null}
      </div>

      <Modal
        open={mfaOpen}
        onClose={() => { setMfaOpen(false); setMfaSetup(null); setMfaCode(''); }}
        title={mfaMode === 'disable' ? 'Disable two-factor authentication' : 'Set up two-factor authentication'}
        footer={
          <>
            <button className="btn-outline" onClick={() => { setMfaOpen(false); setMfaSetup(null); setMfaCode(''); }}>Cancel</button>
            <button
              className="btn-primary"
              disabled={mfaCode.length < 6 || mfaConfirmMutation.isPending}
              onClick={() => mfaConfirmMutation.mutate({ enable: mfaMode === 'setup', code: mfaCode })}
            >
              {mfaConfirmMutation.isPending ? 'Verifying…' : mfaMode === 'disable' ? 'Verify & disable' : 'Verify & enable'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {mfaMode === 'disable' ? (
            <p className="text-sm text-slate-600">
              Enter the current 6-digit code from your authenticator app to confirm disabling
              two-factor authentication.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.</p>
              {mfaSetup?.qr ? (
                <div className="flex justify-center">
                  <img src={mfaSetup.qr} alt="MFA QR code" className="h-44 w-44 rounded-lg border border-slate-200" />
                </div>
              ) : null}
              {mfaSetup?.secret ? (
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs uppercase text-slate-400">Manual entry key</p>
                  <p className="mt-1 break-all font-mono text-sm text-slate-700">{mfaSetup.secret}</p>
                </div>
              ) : null}
            </>
          )}
          <Field label="6-digit code">
            <input className="input text-center text-xl tracking-[0.3em]" maxLength={6} inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        footer={
          <>
            <button className="btn-outline" onClick={() => setPwOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={pw.next.length < 8 || !pw.current || pwMutation.isPending} onClick={() => pwMutation.mutate()}>
              {pwMutation.isPending ? 'Updating…' : 'Update password'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current password" required><input type="password" className="input" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} /></Field>
          <Field label="New password" required hint="Minimum 8 characters"><input type="password" className="input" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
