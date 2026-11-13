import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { api, ApiError, qs, mediaSrc } from '../lib/api';
import type { Product } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { MEDIA_PRESETS } from '../lib/mediaPresets';
import { RichTextEditor } from '../components/RichTextEditor';
import { useToast } from '../components/ui/Toast';
import { formatDateShort, slugify } from '../lib/utils';

interface ProductForm {
  title: string;
  slug: string;
  category: string;
  shortDesc: string;
  description: string;
  imageUrl: string;
  specsText: string;
  isFeatured: boolean;
  isActive: boolean;
}

const EMPTY: ProductForm = { title: '', slug: '', category: '', shortDesc: '', description: '', imageUrl: '', specsText: '', isFeatured: false, isActive: true };

function specsToText(specs?: string | null): string {
  if (!specs) return '';
  try {
    const arr = JSON.parse(specs);
    if (Array.isArray(arr)) return arr.map((s: { label: string; value: string }) => `${s.label}: ${s.value}`).join('\n');
  } catch { /* ignore */ }
  return '';
}
function textToSpecs(text: string): string {
  const arr = text
    .split('\n')
    .map((l) => l.split(':'))
    .filter((p) => p.length >= 2 && p[0].trim())
    .map((p) => ({ label: p[0].trim(), value: p.slice(1).join(':').trim() }));
  return JSON.stringify(arr);
}

export function ProductsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [form, setForm] = useState<ProductForm>({ ...EMPTY });
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', debouncedSearch, category],
    queryFn: () => api.get<Product[]>(`/admin/products${qs({ search: debouncedSearch, category })}`),
    placeholderData: keepPreviousData,
  });
  // Unfiltered list so the category dropdown doesn't shrink to only the
  // categories present in the currently filtered results.
  const { data: allProducts } = useQuery({
    queryKey: ['products', 'all-for-categories'],
    queryFn: () => api.get<Product[]>('/admin/products'),
    staleTime: 60_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const categories = useMemo(() => Array.from(new Set((allProducts ?? data ?? []).map((p) => p.category))), [allProducts, data]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProductForm & { id?: string }) => {
      const body = {
        title: payload.title,
        // Empty slug means "auto-generate from title" — only send it when set.
        ...(payload.slug ? { slug: payload.slug } : {}),
        category: payload.category,
        shortDesc: payload.shortDesc,
        description: payload.description,
        imageUrl: payload.imageUrl,
        specs: textToSpecs(payload.specsText),
        isFeatured: payload.isFeatured,
        isActive: payload.isActive,
      };
      return payload.id ? api.put(`/admin/products/${payload.id}`, body) : api.post('/admin/products', body);
    },
    onSuccess: () => { success('Product saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/products/${id}`),
    onSuccess: () => { success('Product deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  function openEdit(p: Product) {
    setForm({ title: p.title, slug: p.slug || '', category: p.category, shortDesc: p.shortDesc || '', description: p.description, imageUrl: p.imageUrl || '', specsText: specsToText(p.specs), isFeatured: p.isFeatured, isActive: p.isActive });
    setEditing(p);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Products & Services Manager"
        description="Add, categorize and feature products shown on the website."
        actions={<button className="btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add product</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No products found" description="Try adjusting filters or add a new product." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">Category</th>
                  <th className="th">Featured</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                  <th className="th sticky right-0 z-10 bg-slate-50 text-right shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((p) => (
                  <tr key={p.id} className="group hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          {p.imageUrl ? (
                            <img src={mediaSrc(p.imageUrl)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{p.title}</p>
                          <p className="truncate text-xs text-slate-400">{p.shortDesc}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">{p.category}</td>
                    <td className="td">{p.isFeatured ? <Star className="h-4 w-4 fill-accent-400 text-accent-400" /> : <span className="text-slate-300">—</span>}</td>
                    <td className="td">{p.isActive ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Hidden</span>}</td>
                    <td className="td text-slate-500">{formatDateShort(p.createdAt)}</td>
                    <td className="td sticky right-0 z-10 bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)] group-hover:bg-slate-50">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost" onClick={() => openEdit(p)} title="Edit product" aria-label={`Edit ${p.title}`}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></button>
                        <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(p)} title="Delete product" aria-label={`Delete ${p.title}`}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit product' : 'Add product'}
        size="xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.title || !form.category || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) })}>
              {saveMutation.isPending ? 'Saving…' : 'Save product'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field
              label="Slug"
              hint={
                form.slug
                  ? `Public URL: /products/${slugify(form.slug) || '…'} — changing this changes the product URL.`
                  : form.title
                    ? `Leave blank to auto-generate. Preview: /products/${slugify(form.title)}`
                    : 'Leave blank to auto-generate from the title.'
              }
            >
              <input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated from title if left blank" />
            </Field>
            <Field label="Category" required hint="e.g. Laboratory Instruments"><input className="input" list="cat-list" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              <datalist id="cat-list">{categories.map((c) => (<option key={c} value={c} />))}</datalist>
            </Field>
          </div>
          <Field label="Short Description" hint="Shown on cards and listings"><input className="input" value={form.shortDesc} onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))} /></Field>
          <Field label="Full Description" required><RichTextEditor value={form.description} onChange={(html) => setForm((f) => ({ ...f, description: html }))} /></Field>
          <Field label="Product Image"><ImageUploader value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} preset={MEDIA_PRESETS.product} /></Field>
          <Field label="Specifications" hint="One per line, format: Label: Value">
            <textarea className="input min-h-[100px] font-mono text-xs" value={form.specsText} onChange={(e) => setForm((f) => ({ ...f, specsText: e.target.value }))} placeholder={'Readability: 0.001 g\nCapacity: 220 g\nWarranty: 2 Years'} />
          </Field>
          <div className="flex flex-wrap gap-6">
            <Switch checked={form.isFeatured} onChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))} label="Featured on homepage" />
            <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete product" message={`Delete "${deleting?.title}"? This cannot be undone.`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
