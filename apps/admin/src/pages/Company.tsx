import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { PageHeader, FullPageSpinner } from '../components/ui/Feedback';
import { Field } from '../components/ui/Form';
import { ImageUploader } from '../components/ImageUploader';
import { MEDIA_PRESETS } from '../lib/mediaPresets';
import { RichTextEditor } from '../components/RichTextEditor';
import { useToast } from '../components/ui/Toast';

type Info = Record<string, string>;

export function CompanyPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [info, setInfo] = useState<Info>({});
  const [certText, setCertText] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['company-info'], queryFn: () => api.get<Info>('/admin/company-info') });

  useEffect(() => {
    if (data) {
      setInfo(data);
      try {
        const arr = JSON.parse(data.certifications || '[]');
        setCertText(Array.isArray(arr) ? arr.join(', ') : '');
      } catch {
        setCertText('');
      }
    }
  }, [data]);

  const set = (key: string) => (value: string) => setInfo((p) => ({ ...p, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const certifications = JSON.stringify(certText.split(',').map((s) => s.trim()).filter(Boolean));
      const items = Object.entries({ ...info, certifications }).map(([keyName, keyValue]) => ({ keyName, keyValue }));
      return api.put('/admin/company-info', { items });
    },
    onSuccess: () => {
      success('Company info saved');
      qc.invalidateQueries({ queryKey: ['company-info'] });
      qc.invalidateQueries({ queryKey: ['public-company-info'] });
    },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Company Info & Content"
        description="Edit contact details, founder bio, history and branding."
        actions={<button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving…' : 'Save changes'}</button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Branding</h2>
          <Field label="Company Logo">
            <ImageUploader value={info.logo_url} onChange={set('logo_url')} preset={MEDIA_PRESETS.logo} label="Upload logo" />
          </Field>
          <Field label="Certification badges (comma separated)">
            <input className="input" value={certText} onChange={(e) => setCertText(e.target.value)} placeholder="ISO 9001, NABL, CE" />
          </Field>
          <div className="grid gap-4">
            <Field label="Company Name"><input className="input" value={info.company_name || ''} onChange={(e) => set('company_name')(e.target.value)} /></Field>
            <Field label="Tagline"><input className="input" value={info.tagline || ''} onChange={(e) => set('tagline')(e.target.value)} /></Field>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Contact Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><input className="input" value={info.phone || ''} onChange={(e) => set('phone')(e.target.value)} /></Field>
            <Field label="Fax"><input className="input" value={info.fax || ''} onChange={(e) => set('fax')(e.target.value)} /></Field>
            <Field label="Mobile"><input className="input" value={info.mobile || ''} onChange={(e) => set('mobile')(e.target.value)} /></Field>
            <Field label="WhatsApp (digits only)"><input className="input" value={info.whatsapp || ''} onChange={(e) => set('whatsapp')(e.target.value)} placeholder="919810325260" /></Field>
            <Field label="Email" className="sm:col-span-2"><input className="input" value={info.email || ''} onChange={(e) => set('email')(e.target.value)} /></Field>
            <Field label="Address" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={info.address || ''} onChange={(e) => set('address')(e.target.value)} /></Field>
            <Field label="Working Hours" className="sm:col-span-2" hint="Shown on the contact page and homepage map section">
              <input className="input" value={info.working_hours || ''} onChange={(e) => set('working_hours')(e.target.value)} placeholder="Mon – Sat · 9:30 AM – 6:00 PM" />
            </Field>
            <Field label="Google Maps embed URL" className="sm:col-span-2" hint="Embed URL (e.g. https://www.google.com/maps/embed?pb=...)">
              <input className="input" value={info.map_embed || ''} onChange={(e) => set('map_embed')(e.target.value)} />
            </Field>
            <Field label="Google Maps Share / Navigation Link" className="sm:col-span-2" hint="e.g. https://maps.app.goo.gl/QUJr22r9AgJa585Y9">
              <input className="input" value={info.map_url || ''} onChange={(e) => set('map_url')(e.target.value)} placeholder="https://maps.app.goo.gl/QUJr22r9AgJa585Y9" />
            </Field>
            <Field label="Established Year"><input className="input" value={info.established_year || ''} onChange={(e) => set('established_year')(e.target.value)} /></Field>
            <Field label="Employees"><input className="input" value={info.employees || ''} onChange={(e) => set('employees')(e.target.value)} /></Field>
            <Field label="Installations"><input className="input" value={info.installations || ''} onChange={(e) => set('installations')(e.target.value)} /></Field>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">Founder & Story</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Field label="Founder Portrait"><ImageUploader value={info.founder_photo} onChange={set('founder_photo')} preset={MEDIA_PRESETS.founder} label="Upload photo" /></Field>
              <Field label="Founder Name"><input className="input" value={info.founder_name || ''} onChange={(e) => set('founder_name')(e.target.value)} /></Field>
              <Field label="Founder Title"><input className="input" value={info.founder_title || ''} onChange={(e) => set('founder_title')(e.target.value)} /></Field>
            </div>
            <div className="space-y-4 lg:col-span-2">
              <Field label="Company History"><RichTextEditor value={info.history || ''} onChange={set('history')} /></Field>
              <Field label="Founder Bio"><RichTextEditor value={info.founder_bio || ''} onChange={set('founder_bio')} /></Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
