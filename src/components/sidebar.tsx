'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FolderKanban, ScanSearch, FileText, Users2,
  KeyRound, Receipt, Menu, X, LogOut, Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { logoutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/session'

const NAVIGATION = [
  {
    label: 'Analyse',
    items: [
      { href: '/dashboard', label: 'Übersicht', icon: LayoutDashboard },
      { href: '/analyses/new', label: 'Neue Analyse', icon: ScanSearch },
      { href: '/analyses', label: 'Analysen', icon: FileText },
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
      { href: '/settings/vault', label: 'Datentresor', icon: KeyRound },
      { href: '/settings/team', label: 'Team', icon: Users2 },
      { href: '/settings/usage', label: 'Verbrauch', icon: Receipt },
    ],
  },
]

export function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Kopfzeile für schmale Bildschirme */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <span className="text-sm font-semibold">SEO-Master</span>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 hover:bg-surface-muted"
          aria-label={open ? 'Menü schliessen' : 'Menü öffnen'}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-white">
            S
          </div>
          <span className="text-sm font-semibold tracking-tight">SEO-Master</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAVIGATION.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {group.label}
              </p>
              <div className="space-y-0.5">
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
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active ? 'bg-brand-subtle text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
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

        <div className="shrink-0 border-t border-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-[13px] font-medium">{session.name ?? session.email}</p>
            <p className="truncate text-[12px] text-ink-subtle">{session.organizationName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
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
