'use client';

import { useEffect, useState } from 'react';
import { Phone, MessageCircle, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FloatingActions({ phone, whatsapp }: { phone?: string; whatsapp?: string }) {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tel = (phone || '+911292511671').replace(/[^\d+]/g, '');
  const wa = (whatsapp || tel.replace('+', '')).replace(/[^\d]/g, '');

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 lg:hidden">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition-all',
          showTop ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
      <a
        href={`https://wa.me/${wa}?text=${encodeURIComponent('Hello Swift Instruments, I would like to enquire about your products.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform active:scale-95"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
      <a
        href={`tel:${tel}`}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-800 text-white shadow-xl transition-transform active:scale-95"
        aria-label="Call now"
      >
        <Phone className="h-6 w-6" />
      </a>
    </div>
  );
}
