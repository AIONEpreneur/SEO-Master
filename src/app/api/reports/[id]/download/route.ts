import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/** Bericht als Markdown-Datei ausliefern. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response('Nicht angemeldet', { status: 401 })

  const { id } = await context.params
  const report = await db.report.findFirst({
    where: { id, analysis: { organizationId: session.organizationId } },
    include: { analysis: { select: { targetUrl: true, createdAt: true } } },
  })

  if (!report) return new Response('Nicht gefunden', { status: 404 })

  const domain = safeDomain(report.analysis.targetUrl)
  const date = report.analysis.createdAt.toISOString().slice(0, 10)
  const filename = `sichtbarkeitsanalyse-${domain}-${date}.md`

  return new Response(report.markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '')
  } catch {
    return 'bericht'
  }
}
