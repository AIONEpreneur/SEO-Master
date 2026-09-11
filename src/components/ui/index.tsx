import { cn } from '@/lib/utils/cn'

/**
 * Die Bausteine der Oberfläche — im Stil der Vorlage.
 *
 * Drei Regeln tragen den gesamten Look, und sie stehen hier an einer Stelle:
 * jede Fläche bekommt eine 2-px-Kontur in Tinte, einen harten Schatten ohne
 * Weichzeichner und eine grosszügige Rundung. Knöpfe und Plaketten sind
 * Pillen. Wer den Look ändern will, ändert ihn hier und in globals.css.
 */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flaeche', className)}>{children}</div>
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
    <div className="flex items-start justify-between gap-4 border-b-2 border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[17px]">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

/**
 * Knöpfe sind Pillen mit Kontur.
 *
 * Der Hauptknopf ist Tinte auf Creme wie in der Vorlage; der zweite trägt
 * dieselbe Kontur auf heller Fläche. `lift` gibt ihnen die kleine Bewegung
 * beim Zeigen und Drücken — ohne sie wirkt der Look starr.
 */
function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(
    'lift inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rot focus-visible:ring-offset-2',
    size === 'sm' ? 'h-9 px-4 text-[13px]' : 'h-11 px-6 text-[15px]',
    variant === 'primary' && 'border-2 border-tinte bg-tinte text-creme hover:border-rot hover:bg-rot',
    variant === 'secondary' && 'border-2 border-border bg-surface text-ink hover:bg-surface-muted',
    variant === 'ghost' && 'font-medium text-ink-muted hover:text-ink',
    variant === 'danger' && 'border-2 border-tinte bg-rosa text-rot hover:bg-rot hover:text-creme',
    className,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />
}

/**
 * Ein Link, der wie ein Knopf aussieht.
 *
 * Notwendig, weil ein <button> innerhalb eines <a> ungültiges HTML ist: Der
 * Klick landet dann beim Knopf statt beim Link, und je nach Browser passiert
 * gar nichts – bei Downloads fällt das sofort auf.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return <a className={buttonClasses(variant, size, className)} {...props} />
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border-2 border-border bg-surface px-3.5 text-[15px] font-medium',
        'placeholder:text-ink-subtle focus:border-rot focus:outline-none',
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
        'h-11 w-full rounded-md border-2 border-border bg-surface px-3.5 text-[15px] font-medium',
        'focus:border-rot focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-bold', className)} {...props} />
}

/**
 * Bewertungsplakette: Farbe folgt dem Wert, nicht dem Modul.
 *
 * Limette trägt das Gute, Orange die Warnung, Rosa das Kritische — die drei
 * Akzentfarben der Vorlage, jede mit Kontur.
 */
export function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) {
    return <span className="text-sm text-ink-subtle">–</span>
  }
  const tone = score >= 6.5 ? 'good' : score >= 4 ? 'warn' : 'bad'
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border-2 border-tinte font-bold tabular-nums',
        size === 'sm' && 'h-7 min-w-12 px-2 text-[12px]',
        size === 'md' && 'h-9 min-w-16 px-2.5 text-[15px]',
        size === 'lg' && 'h-12 min-w-20 px-3 text-lg',
        tone === 'good' && 'bg-limette text-tinte',
        tone === 'warn' && 'bg-orange text-tinte',
        tone === 'bad' && 'bg-rosa text-rot',
      )}
    >
      {score.toFixed(1).replace('.', ',')}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    QUEUED: { label: 'In Warteschlange', className: 'bg-creme text-tinte' },
    RUNNING: { label: 'Läuft', className: 'bg-blau text-tinte animate-pulse-soft' },
    COMPLETED: { label: 'Fertig', className: 'bg-limette text-tinte' },
    FAILED: { label: 'Fehlgeschlagen', className: 'bg-rosa text-rot' },
    CANCELLED: { label: 'Abgebrochen', className: 'bg-sand text-ink-muted' },
  }
  const entry = map[status] ?? { label: status, className: 'bg-sand text-ink-muted' }
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full border-2 border-tinte px-3 text-[12px] font-bold',
        entry.className,
      )}
    >
      {entry.label}
    </span>
  )
}

export function SeverityPill({ severity }: { severity: 'critical' | 'quickwin' | 'longterm' }) {
  const map = {
    critical: { label: 'Sofort', className: 'bg-rosa text-rot' },
    quickwin: { label: 'Schneller Hebel', className: 'bg-orange text-tinte' },
    longterm: { label: 'Langfristig', className: 'bg-creme text-tinte' },
  }
  const entry = map[severity]
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-full border-2 border-tinte px-3 text-[12px] font-bold',
        entry.className,
      )}
    >
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
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-surface-muted">
          {icon}
        </div>
      )}
      <p className="font-display text-[17px] uppercase">{title}</p>
      {description && <p className="mt-2 max-w-md text-[14px] text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Bewertung als Ring.
 *
 * Eine Zahl allein muss gelesen und eingeordnet werden; der gefüllte Bogen
 * ist auf einen Blick erfasst. Deshalb steht er dort, wo eine Bewertung die
 * Hauptaussage der Fläche ist – neben Fliesstext bleibt die Plakette.
 *
 * Der Kreisumfang wird aus dem Radius berechnet und über strokeDasharray
 * anteilig gefüllt; so bleibt der Ring bei jeder Grösse exakt. Die kräftige
 * Strichstärke und die beiden Konturlinien folgen dem Look der Vorlage.
 */
export function ScoreRing({
  score,
  label,
  size = 76,
}: {
  score: number | null
  label?: string
  size?: number
}) {
  const strich = size / 8
  const radius = (size - strich) / 2 - 1
  const umfang = 2 * Math.PI * radius
  const anteil = score === null ? 0 : Math.max(0, Math.min(10, score)) / 10

  const ton =
    score === null ? 'var(--color-sand)'
    : score >= 7.5 ? 'var(--color-limette)'
    : score >= 5 ? 'var(--color-orange)'
    : 'var(--color-rosa)'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-surface-muted)" strokeWidth={strich} />
          {score !== null && (
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={ton} strokeWidth={strich}
              strokeDasharray={`${umfang * anteil} ${umfang}`}
              className="transition-[stroke-dasharray] duration-700"
            />
          )}
          <circle cx={size / 2} cy={size / 2} r={radius + strich / 2} fill="none" stroke="var(--color-border)" strokeWidth={2} />
          <circle cx={size / 2} cy={size / 2} r={radius - strich / 2} fill="none" stroke="var(--color-border)" strokeWidth={2} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[15px] leading-none">
            {score === null ? '–' : score.toFixed(1).replace('.', ',')}
          </span>
        </div>
      </div>
      {label && <span className="text-[12px] font-bold">{label}</span>}
    </div>
  )
}

/** Waagerechter Balken für einen Wert von 0–10. */
export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone = score >= 6.5 ? 'bg-limette' : score >= 4 ? 'bg-orange' : 'bg-rosa'
  return (
    <div className="flex items-center gap-3">
      {label && <span className="w-44 shrink-0 truncate text-[13px] text-ink-muted">{label}</span>}
      <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-border bg-surface-muted">
        <div className={cn('h-full transition-all', tone)} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[13px] font-bold tabular-nums">
        {score.toFixed(1).replace('.', ',')}
      </span>
    </div>
  )
}

/**
 * Der Stern aus der Vorlage.
 *
 * Er sitzt als Deko an Kanten und in Ecken; die Klasse `twinkle` lässt ihn
 * blinzeln. Als eigener Baustein, weil er an vielen Stellen auftaucht und
 * überall dieselbe Form haben muss.
 */
export function Funke({
  size = 32,
  fill = 'var(--color-creme)',
  className,
  style,
}: {
  size?: number
  fill?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" className={className} style={style} aria-hidden>
      <path
        d="M22 0 L26 18 L44 22 L26 26 L22 44 L18 26 L0 22 L18 18 Z"
        fill={fill}
        stroke="#161616"
        strokeWidth="2"
      />
    </svg>
  )
}
