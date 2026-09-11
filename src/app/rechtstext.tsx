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
          className="lift mb-10 inline-flex items-center gap-2 rounded-full border-2 border-tinte bg-creme px-5 py-2.5 text-[14px] font-bold"
        >
          <ArrowLeft size={15} />
          Zur Startseite
        </Link>

        <h1 className="text-[32px] sm:text-[40px]">{titel}</h1>
        <span className="mt-4 inline-block rounded-full border-2 border-tinte bg-creme px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em]">
          Stand: {stand}
        </span>

        <div className="rechtstext mt-10 rounded-3xl border-2 border-tinte bg-creme p-7 shadow-[6px_6px_0_#161616] sm:p-10">
          {children}
        </div>
      </div>
    </div>
  )
}
