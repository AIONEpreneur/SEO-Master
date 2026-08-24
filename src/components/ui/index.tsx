import { cn } from '@/lib/utils/cn'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)}>{children}</div>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-hover',
        variant === 'secondary' && 'border border-border-strong bg-surface hover:bg-surface-muted',
        variant === 'ghost' && 'hover:bg-surface-muted',
        variant === 'danger' && 'bg-bad text-white hover:opacity-90',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm',
        'placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-ink-muted', className)} {...props} />
}

/** Bewertungsplakette: Farbe folgt dem Wert, nicht dem Modul. */
export function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) {
    return <span className="text-sm text-ink-subtle">–</span>
  }
  const tone = score >= 6.5 ? 'good' : score >= 4 ? 'warn' : 'bad'
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold tabular-nums',
        size === 'sm' && 'h-6 min-w-11 px-1.5 text-[12px]',
        size === 'md' && 'h-8 min-w-14 px-2 text-sm',
        size === 'lg' && 'h-12 min-w-20 px-3 text-lg',
        tone === 'good' && 'bg-good-subtle text-good',
        tone === 'warn' && 'bg-warn-subtle text-warn',
        tone === 'bad' && 'bg-bad-subtle text-bad',
      )}
    >
      {score.toFixed(1)}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    QUEUED: { label: 'In Warteschlange', className: 'bg-surface-muted text-ink-muted' },
    RUNNING: { label: 'Läuft', className: 'bg-brand-subtle text-brand animate-pulse-soft' },
    COMPLETED: { label: 'Fertig', className: 'bg-good-subtle text-good' },
    FAILED: { label: 'Fehlgeschlagen', className: 'bg-bad-subtle text-bad' },
    CANCELLED: { label: 'Abgebrochen', className: 'bg-surface-muted text-ink-subtle' },
  }
  const entry = map[status] ?? { label: status, className: 'bg-surface-muted text-ink-muted' }
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium', entry.className)}>
      {entry.label}
    </span>
  )
}

export function SeverityPill({ severity }: { severity: 'critical' | 'quickwin' | 'longterm' }) {
  const map = {
    critical: { label: 'Sofort', className: 'bg-bad-subtle text-bad' },
    quickwin: { label: 'Schneller Hebel', className: 'bg-warn-subtle text-warn' },
    longterm: { label: 'Langfristig', className: 'bg-surface-muted text-ink-muted' },
  }
  const entry = map[severity]
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium', entry.className)}>
      {entry.label}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-ink-subtle">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Waagerechter Balken für einen Wert von 0–10. */
export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone = score >= 6.5 ? 'bg-good' : score >= 4 ? 'bg-warn' : 'bg-bad'
  return (
    <div className="flex items-center gap-3">
      {label && <span className="w-44 shrink-0 truncate text-[13px] text-ink-muted">{label}</span>}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[13px] font-medium tabular-nums">{score.toFixed(1)}</span>
    </div>
  )
}
