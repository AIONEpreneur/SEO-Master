import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Fortschritt eines laufenden Auftrags. Die Detailseite fragt diesen Endpunkt
 * ab, solange der Lauf nicht abgeschlossen ist, und lädt sich danach einmal neu.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { id } = await context.params
  const analysis = await db.analysis.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { status: true, progress: true, currentStep: true, error: true },
  })

  if (!analysis) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(analysis, { headers: { 'cache-control': 'no-store' } })
}
