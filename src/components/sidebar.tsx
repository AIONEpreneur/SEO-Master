'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FolderKanban, ScanSearch, FileText, Users2,
  KeyRound, Receipt, Menu, X, LogOut, Swords, TrendingUp, Coins, ShieldCheck, Puzzle, ListOrdered,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { logoutAction } from '@/lib/auth/actions'
import { ThemeToggle } from '@/components/theme-toggle'
import type { SessionUser } from '@/lib/auth/session'
import type { Theme } from '@/lib/theme'
import { verwaltetEigeneZugaenge, siehtAbrechnung, verbleibendeAnalysen } from '@/lib/billing/zugaenge'
import { KOSTEN_ANALYSE } from '@/lib/billing/guthaben'

const NAVIGATION = [
  {
    label: 'Analyse',
    items: [
      { href: '/dashboard', label: 'Übersicht', icon: LayoutDashboard },
      { href: '/analyses/new', label: 'Neue Analyse', icon: ScanSearch },
      { href: '/analyses', label: 'Analysen', icon: FileText },
      { href: '/keywords', label: 'Keyword-Recherche', icon: TrendingUp },
      { href: '/rankings', label: 'Ranking-Abfragen', icon: ListOrdered },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { href: '/projects', label: 'Projekte', icon: FolderKanban },
      { href: '/competitors', label: 'Wettbewerb', icon: Swords },
    ],
  },
  {
    label: 'Einstellungen',
    items: [
      { href: '/settings/team', label: 'Team', icon: Users2 },
      { href: '/settings/extension', label: 'Extension', icon: Puzzle },
    ],
  },
]

const TRESOR = { href: '/settings/vault', label: 'Datentresor', icon: KeyRound }
/** Verbrauch heisst Anbieterkosten – das ist die Rechnung des Betriebs. */
const VERBRAUCH = { href: '/settings/usage', label: 'Verbrauch', icon: Receipt }



/**
 * Nur für den Betrieb der Instanz. Wird ausschliesslich eingeblendet, wenn das
 * Konto die Betriebsverwaltung hat – eine Kundin soll nicht einmal sehen, dass
 * es diesen Bereich gibt.
 */
const BETRIEB = {
  label: 'Betrieb',
  items: [{ href: '/admin', label: 'Betriebsübersicht', icon: ShieldCheck }],
}

export function Sidebar({ session, theme }: { session: SessionUser; theme: Theme }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Kopfzeile für schmale Bildschirme */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b-2 border-border bg-surface px-4 lg:hidden">
        <span className="rounded-full border-2 border-border bg-creme px-3.5 py-1 text-[13px] font-bold text-tinte">
          seo-master
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="lift rounded-full border-2 border-border bg-surface p-2"
          aria-label={open ? 'Menü schliessen' : 'Menü öffnen'}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 bg-tinte/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r-2 border-border bg-surface transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        {/* Der Name als Pille mit Kontur — wie das Logo der Vorlage. */}
        <div className="flex h-16 shrink-0 items-center border-b-2 border-border px-4">
          <span className="rounded-full border-2 border-border bg-creme px-4 py-1.5 text-[14px] font-bold text-tinte shadow-[2px_2px_0_var(--color-border)]">
            seo-master
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[
            ...NAVIGATION.map((group) =>
              group.label === 'Einstellungen'
                ? {
                    ...group,
                    // Datentresor und Verbrauch erscheinen nur dort, wo sie
                    // hingehoeren: beim Betrieb.
                    items: [
                      ...(verwaltetEigeneZugaenge(session) ? [TRESOR] : []),
                      ...group.items,
                      ...(siehtAbrechnung(session) ? [VERBRAUCH] : []),
                    ],
                  }
                : group,
            ),
            ...(session.isSuperAdmin ? [BETRIEB] : []),
          ].map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-2 font-display text-[11px] uppercase tracking-wider text-ink-subtle">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  // "/analyses" darf nicht mitleuchten, wenn "/analyses/new" aktiv ist.
                  const active =
                    pathname === item.href ||
                    (item.href !== '/analyses' && item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)) ||
                    (item.href === '/analyses' && pathname.startsWith('/analyses/') && !pathname.startsWith('/analyses/new'))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] transition-colors',
                        // Der aktive Eintrag ist eine gefüllte Pille mit
                        // Kontur — dieselbe Form wie die Marken-Pillen der
                        // Vorlage, nur umgedreht.
                        active
                          ? 'border-2 border-border bg-tinte font-bold text-creme'
                          : 'border-2 border-transparent font-medium text-ink-muted hover:border-border hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <item.icon size={16} className="shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t-2 border-border p-3">
          {/*
            Der Fuss der Leiste stand bisher weitgehend leer. Das Guthaben
            gehört an eine Stelle, die immer sichtbar ist: Es entscheidet
            darüber, ob der nächste Lauf überhaupt startet.
          */}
          {siehtAbrechnung(session) ? (
            <Link
              href="/settings/usage"
              className="lift mb-3 flex items-center justify-between rounded-xl border-2 border-border bg-limette px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-[12px] font-bold text-tinte">
                <Coins size={14} />
                Guthaben
              </span>
              <span className="font-display text-[13px] text-tinte tabular-nums">
                {session.credits >= 100000 ? '∞' : session.credits.toLocaleString('de-DE')}
              </span>
            </Link>
          ) : (
            // Fuer Kundinnen dieselbe Information in ihrer Sprache: Credits
            // sind Cent an Anbieterkosten, Analysen sind das, was sie gekauft
            // haben.
            <div className="mb-3 flex items-center justify-between rounded-xl border-2 border-border bg-limette px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-bold text-tinte">
                <ScanSearch size={14} />
                Analysen frei
              </span>
              <span className="font-display text-[13px] text-tinte tabular-nums">
                {verbleibendeAnalysen(session.credits, KOSTEN_ANALYSE).toLocaleString('de-DE')}
              </span>
            </div>
          )}

          <div className="mb-3 px-0.5">
            <ThemeToggle initial={theme} />
          </div>
          <div className="mb-2 px-2">
            <p className="truncate text-[13px] font-bold">{session.name ?? session.email}</p>
            <p className="truncate text-[12px] text-ink-subtle">{session.organizationName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-full border-2 border-transparent px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:border-border hover:bg-surface-muted hover:text-ink"
            >
              <LogOut size={16} />
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <div className="h-14 lg:hidden" />
    </>
  )
}
