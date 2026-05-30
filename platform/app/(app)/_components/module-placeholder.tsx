export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  phase,
}: {
  eyebrow: string
  title: string
  description: string
  phase: string
}) {
  return (
    <div className="px-8 py-10">
      <div className="flex h-16 items-center" />
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-[var(--gold)]">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--subtle)]">
        {description}
      </p>
      <div className="mt-8 inline-block border border-[var(--border)] bg-[var(--mid)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
        {phase}
      </div>
    </div>
  )
}
