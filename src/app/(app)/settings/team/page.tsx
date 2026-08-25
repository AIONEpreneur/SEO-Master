import { requireSession, hasRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, Button } from '@/components/ui'
import { Einladen } from './einladen'
import { ziehZurueckAction } from './actions'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, { label: string; description: string }> = {
  OWNER: { label: 'Inhaberin', description: 'Vollzugriff einschliesslich Abrechnung' },
  ADMIN: { label: 'Verwaltung', description: 'Darf Datentresor und Team verwalten' },
  MEMBER: { label: 'Mitglied', description: 'Darf Analysen starten und Projekte pflegen' },
  VIEWER: { label: 'Lesend', description: 'Sieht Ergebnisse, startet keine Läufe' },
}

export default async function TeamPage() {
  const session = await requireSession()
  const [memberships, organization, offeneEinladungen] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: session.organizationId },
      include: { user: { select: { email: true, name: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId } }),
    db.invitation.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        OR: [{ organizationId: session.organizationId }, { invitedById: session.id }],
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {organization.name} · Tarif {organization.plan}
        </p>
      </header>

      <Card>
        <CardHeader title="Mitglieder" description={`${memberships.length} Personen in diesem Arbeitsbereich`} />
        <ul className="divide-y divide-border">
          {memberships.map((membership) => (
            <li key={membership.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {membership.user.name ?? membership.user.email}
                  {membership.userId === session.id && (
                    <span className="ml-2 text-[12px] font-normal text-ink-subtle">(Sie)</span>
                  )}
                </p>
                <p className="truncate text-[12px] text-ink-subtle">
                  {membership.user.email}
                  {membership.user.lastLoginAt &&
                    ` · zuletzt aktiv ${membership.user.lastLoginAt.toLocaleDateString('de-DE')}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-medium">{ROLE_LABELS[membership.role]?.label ?? membership.role}</p>
                <p className="text-[12px] text-ink-subtle">{ROLE_LABELS[membership.role]?.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {offeneEinladungen.length > 0 && (
        <Card>
          <CardHeader
            title="Offene Einladungen"
            description="Noch nicht eingelöst. Der Link wird aus Sicherheitsgründen nicht erneut angezeigt."
          />
          <ul className="divide-y divide-border">
            {offeneEinladungen.map((einladung) => (
              <li key={einladung.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{einladung.email}</p>
                  <p className="truncate text-[12px] text-ink-subtle">
                    {einladung.organizationId ? 'Ins eigene Team' : 'Eigener Arbeitsbereich'} · gültig bis{' '}
                    {einladung.expiresAt.toLocaleDateString('de-DE')}
                  </p>
                </div>
                <form action={ziehZurueckAction}>
                  <input type="hidden" name="id" value={einladung.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Zurückziehen
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasRole(session, 'ADMIN') ? (
        <Einladen />
      ) : (
        <Card className="p-5">
          <p className="text-[13px] text-ink-muted">
            Personen einladen darf, wer Verwaltungsrechte in diesem Arbeitsbereich hat.
          </p>
        </Card>
      )}
    </div>
  )
}
