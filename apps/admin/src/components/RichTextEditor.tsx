import { useEffect, useRef } from 'react';
import { Bold, Heading2, Italic, List, ListOrdered, Underline } from 'lucide-react';

/**
 * Lightweight WYSIWYG editor built on contentEditable. Output HTML is sanitized
 * server-side (DOMPurify) before persistence, so this provides a safe rich-text
 * surface without pulling a heavyweight editor dependency.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML || '');
  };

  const tools = [
    { icon: Bold, cmd: 'bold', title: 'Bold' },
    { icon: Italic, cmd: 'italic', title: 'Italic' },
    { icon: Underline, cmd: 'underline', title: 'Underline' },
    { icon: Heading2, cmd: 'formatBlock', arg: 'H2', title: 'Heading' },
    { icon: List, cmd: 'insertUnorderedList', title: 'Bullet list' },
    { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered list' },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd, t.arg)}
            className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-brand-800"
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[140px] px-3 py-2 text-sm text-slate-800 outline-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)] [&_h2]:mb-2 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
      />
    </div>
  );
}
