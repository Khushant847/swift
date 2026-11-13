'use client';

import { cloneElement, isValidElement, useId, useState } from 'react';
import { CheckCircle2, Loader2, Send, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { PUBLIC_API_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(2, 'Please enter your full name').max(120, 'Name must be 120 characters or fewer'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(7, 'Please enter a valid phone number').max(20),
  companyName: z.string().max(160).optional().or(z.literal('')),
  subject: z.string().max(200).optional().or(z.literal('')),
  message: z.string().min(5, 'Please describe your requirement').max(4000, 'Message must be 4000 characters or fewer'),
});

type FormData = z.infer<typeof schema>;
type Errors = Partial<Record<keyof FormData, string>>;

const EMPTY: FormData = { name: '', email: '', phone: '', companyName: '', subject: '', message: '' };

export function EnquiryForm({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return; // guard against Enter-key double submit
    if (honeypot) return; // bot trap

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        fieldErrors[k as keyof FormData] = v?.[0];
      }
      setErrors(fieldErrors);
      return;
    }

    setStatus('loading');
    setServerError('');
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      // Tolerate non-JSON error bodies (proxy/HTML error pages).
      const text = await res.text();
      let json: { success?: boolean; error?: string } | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!res.ok || !json?.success) throw new Error(json?.error || `Submission failed (${res.status})`);
      setStatus('success');
      setForm(EMPTY);
    } catch (err) {
      setStatus('error');
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
          <Field label="Full Name" required error={errors.name}>
            <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email Address" required error={errors.email}>
            <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone Number" required error={errors.phone}>
            <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Company (optional)" error={errors.companyName}>
            <input className="input" placeholder="Company name" value={form.companyName} onChange={set('companyName')} />
          </Field>
        </div>
        <Field label="Subject (optional)" error={errors.subject}>
          <input className="input" placeholder="What is this regarding?" value={form.subject} onChange={set('subject')} />
        </Field>
        <Field label="Message" required error={errors.message}>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="Tell us about your requirement…"
            value={form.message}
            onChange={set('message')}
          />
        </Field>

        {serverError ? (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {serverError}
          </p>
        ) : null}

        <button type="submit" disabled={status === 'loading'} className="btn-primary w-full py-3 text-base">
          {status === 'loading' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-5 w-5" /> Submit Enquiry
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-400">
          By submitting you agree to be contacted regarding your enquiry.
        </p>
      </form>

      {status === 'success' ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl animate-fade-up">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <h3 className="font-display text-xl font-bold text-slate-900">Thank you!</h3>
            <p className="mt-2 text-sm text-slate-600">
              Your enquiry has been received. Our team will get back to you shortly. A confirmation email is on its way.
            </p>
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setStatus('idle')}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  // Associate the label with the control: inject our id into the child input
  // (single-element children only — everything in this form is one control).
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
        })
      : children;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
