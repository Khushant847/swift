import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Associate the label with the control when the child is a native form
  // element (input/textarea/select); composite children are left untouched.
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : hint && !error ? hintId : undefined,
        })
      : children;
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="label">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={hintId} className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span className={cn('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand-700' : 'bg-slate-300')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
      {label ? <span className="text-sm text-slate-600">{label}</span> : null}
    </button>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('badge', className)}>{children}</span>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}
