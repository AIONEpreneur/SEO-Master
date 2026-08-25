import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Rahmen für die Rechtstexte.
 *
 * Sie gehören zum Aussenauftritt und übernehmen dessen Erscheinungsbild,
 * bleiben aber bewusst schlicht: Hier wird gelesen, nicht geworben.
 */
export function Rechtstext({ titel, stand, children }: { titel: string; stand: string; children: React.ReactNode }) {
  return (
    <div className="aussenauftritt min-h-dvh">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-1.5 text-[13px] text-[var(--schrift-matt)] transition-colors hover:text-[var(--schrift)]"
        >
          <ArrowLeft size={14} />
          Zur Startseite
        </Link>

        <h1 className="kopf text-4xl font-bold tracking-tight" style={{ fontFamily: '"Space Grotesk", "IBM Plex Sans", sans-serif' }}>
          {titel}
        </h1>
        <p className="mono mt-3 text-[11px] uppercase tracking-[0.15em] text-[var(--schrift-leise)]">
          Stand: {stand}
        </p>

        <div className="rechtstext mt-12">{children}</div>
      </div>
    </div>
  )
}
