import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  light?: boolean;
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' ? 'mx-auto text-center' : 'text-left')}>
      {eyebrow ? (
        <span className={cn('eyebrow', light && 'bg-white/10 text-accent-300')}>{eyebrow}</span>
      ) : null}
      <h2 className={cn('heading-lg text-balance', light ? 'text-white' : 'text-slate-900')}>{title}</h2>
      {description ? (
        <p className={cn('mt-4 text-base leading-relaxed sm:text-lg', light ? 'text-slate-200' : 'text-slate-600')}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
