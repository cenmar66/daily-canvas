"use client";

export function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="dc-card p-4 md:p-5">
      <h2 className="dc-serif mb-3 text-xl">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && (
          <p className="text-xs" style={{ color: "var(--dc-muted)" }}>
            {hint}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative h-7 w-12 rounded-full transition-colors" style={{ background: on ? "var(--dc-ink)" : "var(--dc-rule)" }}>
      <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 26 : 4 }} />
    </button>
  );
}
