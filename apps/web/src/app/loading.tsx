export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-[68vh] min-h-[420px] w-full bg-slate-200" />
      <div className="container-page space-y-6 py-16">
        <div className="mx-auto h-8 w-56 rounded bg-slate-200" />
        <div className="mx-auto h-4 w-80 max-w-full rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-2xl border border-slate-100 p-5">
              <div className="aspect-[4/3] rounded-xl bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
