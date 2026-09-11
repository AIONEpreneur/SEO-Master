import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { rechercheAlsCsv } from '@/lib/keywords/export'
import { dateiname } from '@/app/api/export/route'
import type { KeywordZeile } from '@/lib/keywords/research'

export const dynamic = 'force-dynamic'

/** Eine gespeicherte Keyword-Recherche als CSV – für die Tabellenkalkulation. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response('Nicht angemeldet', { status: 401 })

  const { id } = await params
  const research = await db.keywordResearch.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!research) return new Response('Nicht gefunden', { status: 404 })

  const csv = rechercheAlsCsv(research.rows as unknown as KeywordZeile[])
  const name = `keyword-recherche-${dateiname(research.seed)}-${research.createdAt.toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}
