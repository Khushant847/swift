'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProductCard } from './FeaturedProducts';

export function ProductCatalog({ products, total }: { products: Product[]; total?: number }) {
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = category === 'All' || p.category === category;
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.shortDesc || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, query, category]);

  // Server-side total can exceed the fetched page (capped at 100) — report it
  // honestly instead of implying the fetched list is the whole catalogue.
  const totalCount = total ?? products.length;
  const capped = products.length < totalCount;

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Sidebar filters */}
      <aside className="h-max lg:sticky lg:top-28">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <SlidersHorizontal className="h-4 w-4 text-brand-700" /> Filter Products
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input pl-9"
              aria-label="Search products"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Categories</p>
            <div className="space-y-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                    category === c ? 'bg-brand-800 font-semibold text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {c}
                  <span className={cn('text-xs', category === c ? 'text-white/70' : 'text-slate-400')}>
                    {c === 'All' ? products.length : products.filter((p) => p.category === c).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Results */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {capped ? 'first ' : ''}<span className="font-semibold text-slate-800">{filtered.length}</span> of{' '}
            {totalCount} products
            {category !== 'All' ? ` in ${category}` : ''}
          </p>
        </div>

        {filtered.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center p-16 text-center">
            <Search className="mb-4 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-700">No products found</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search term or category.</p>
            <button
              type="button"
              className="btn-outline mt-5"
              onClick={() => {
                setQuery('');
                setCategory('All');
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
