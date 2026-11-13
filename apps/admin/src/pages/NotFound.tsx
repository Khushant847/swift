import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-800"><Compass className="h-8 w-8" /></span>
      <h1 className="mt-5 text-3xl font-bold text-slate-800">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">The page you are looking for doesn’t exist or has been moved within the admin console.</p>
      <Link to="/" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
