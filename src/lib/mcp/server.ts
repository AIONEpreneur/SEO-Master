import { db } from '@/lib/db'
import { env } from '@/lib/env'
import type { TokenKontext } from '@/lib/auth/api-token'
import { fuehreRecherche, fuehreRankingAbfrage } from '@/lib/extension/abfragen'
import { verbleibendeAbfragen } from '@/lib/extension/abrechnung'

/**
 * MCP-Anbindung: SEO-Master als Werkzeugkasten für Claude und ChatGPT.
 *
 * Das Model Context Protocol ist JSON-RPC über HTTP. Hier ist bewusst kein
 * Rahmenwerk im Spiel: Der Server ist zustandslos (keine Sitzungen, kein
 * Ereignisstrom), beantwortet jede Anfrage mit einer JSON-Antwort und
 * braucht dafür genau drei Methoden – initialize, tools/list, tools/call.
 * Ausgewiesen wird sich mit demselben persönlichen Zugangsschlüssel wie in
 * der Browser-Extension; er steht in der Adresse, weil die
 * Verbindungs-Dialoge der KI-Werkzeuge nur eine Adresse entgegennehmen.
 *
 * Jede Recherche und jede Ranking-Abfrage läuft über dieselbe Logik und
 * Abrechnung wie App und Extension – und wird genauso gespeichert.
 */

/** Die Protokollfassungen, mit denen dieser Server umgehen kann. */
const PROTOKOLLE = ['2024-11-05', '2025-03-26', '2025-06-18']

type JsonRpcAnfrage = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const WERKZEUGE = [
  {
    name: 'keyword_recherche',
    description:
      'Startet eine neue Keyword-Recherche (Google Deutschland): Suchvolumen, Klickpreis, Schwierigkeit und Suchabsicht ' +
      'verwandter Suchanfragen zu einem Begriff. Der vollständige Lauf wird in SEO-Master gespeichert und die Antwort ' +
      'nennt den Link dorthin. Verbraucht eine Abfrage vom Kontingent – für bereits gelaufene Recherchen stattdessen ' +
      'recherchen_auflisten und recherche_abrufen verwenden.',
    inputSchema: {
      type: 'object',
      properties: {
        suchbegriff: { type: 'string', description: 'Der Ausgangsbegriff, z. B. "ki beratung" (2–80 Zeichen).' },
      },
      required: ['suchbegriff'],
    },
  },
  {
    name: 'recherchen_auflisten',
    description:
      'Listet die gespeicherten Keyword-Recherchen dieses Arbeitsbereichs (neueste zuerst): id, Suchbegriff, Datum und ' +
      'Kennzahlen. Kostenlos – die Daten sind bereits erhoben.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'recherche_abrufen',
    description:
      'Ruft eine gespeicherte Keyword-Recherche vollständig ab: alle Begriffe mit Suchvolumen, Klickpreis, Werbewert, ' +
      'Wettbewerb, Schwierigkeit, Suchabsicht, Jahrestrend und dem Zwölfmonatsverlauf des Suchvolumens. Kostenlos.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Die id aus recherchen_auflisten.' } },
      required: ['id'],
    },
  },
  {
    name: 'ranking_abfrage',
    description:
      'Fragt die echten Google-DE-Rankings einer Domain oder einer exakten Unterseite ab: Keyword, Position, ' +
      'Suchvolumen und rankende Seite (die besten 30, sortiert nach Position). Wird in SEO-Master gespeichert. ' +
      'Verbraucht eine Abfrage vom Kontingent – für bereits gelaufene Abfragen ranking_abfragen_auflisten verwenden.',
    inputSchema: {
      type: 'object',
      properties: {
        ziel: {
          type: 'string',
          description: 'Domain (beispiel.de) oder vollständige Adresse einer Unterseite (https://beispiel.de/blog/artikel).',
        },
      },
      required: ['ziel'],
    },
  },
  {
    name: 'ranking_abfragen_auflisten',
    description:
      'Listet die gespeicherten Ranking-Abfragen dieses Arbeitsbereichs (neueste zuerst): id, Ziel, Umfang und Datum. Kostenlos.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ranking_abfrage_abrufen',
    description: 'Ruft eine gespeicherte Ranking-Abfrage vollständig ab: alle Platzierungen mit Keyword, Position, Suchvolumen und rankender Seite. Kostenlos.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Die id aus ranking_abfragen_auflisten.' } },
      required: ['id'],
    },
  },
  {
    name: 'konto_status',
    description: 'Zeigt, mit welchem Arbeitsbereich diese Verbindung spricht und wie viele Abfragen noch frei sind. Kostenlos.',
    inputSchema: { type: 'object', properties: {} },
  },
]

/** Eine JSON-RPC-Anfrage beantworten. Notifications ergeben null (HTTP 202). */
export async function beantworteMcp(
  kontext: TokenKontext,
  anfrage: JsonRpcAnfrage,
): Promise<Record<string, unknown> | null> {
  const { id = null, method, params = {} } = anfrage

  // Notifications tragen keine id und erwarten keine Antwort.
  if (method?.startsWith('notifications/')) return null

  if (method === 'initialize') {
    const gewuenscht = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
    return ergebnis(id, {
      protocolVersion: PROTOKOLLE.includes(gewuenscht) ? gewuenscht : PROTOKOLLE[PROTOKOLLE.length - 1],
      capabilities: { tools: {} },
      serverInfo: { name: 'SEO-Master', title: 'SEO-Master', version: '1.0.0' },
      instructions:
        `SEO-Master-Arbeitsbereich "${kontext.organization.name}": Keyword-Recherche und Google-Rankings mit echten ` +
        'DataForSEO-Daten (Google Deutschland). Gespeicherte Läufe zuerst über die auflisten/abrufen-Werkzeuge holen – ' +
        'das ist kostenlos; neue Abfragen (keyword_recherche, ranking_abfrage) verbrauchen Kontingent.',
    })
  }

  if (method === 'ping') return ergebnis(id, {})

  if (method === 'tools/list') return ergebnis(id, { tools: WERKZEUGE })

  if (method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : ''
    const args = (params.arguments ?? {}) as Record<string, unknown>
    try {
      return ergebnis(id, await rufeWerkzeug(kontext, name, args))
    } catch (error) {
      return werkzeugText(
        id,
        `Die Ausführung ist fehlgeschlagen: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`,
        true,
      )
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unbekannte Methode: ${method ?? '(keine)'}` },
  }
}

async function rufeWerkzeug(
  kontext: TokenKontext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const orgId = kontext.organization.id

  switch (name) {
    case 'konto_status':
      return textInhalt({
        arbeitsbereich: kontext.organization.name,
        benutzer: kontext.userName,
        abfragenFrei: verbleibendeAbfragen(kontext.organization) ?? 'unbegrenzt',
      })

    case 'keyword_recherche': {
      const ausgang = await fuehreRecherche({
        organization: kontext.organization,
        userId: kontext.userId,
        seed: String(args.suchbegriff ?? ''),
        operation: 'mcp-research',
      })
      if (!ausgang.ok) return fehlerInhalt(ausgang.message)
      return textInhalt({
        ...ausgang,
        hinweis: `Gekürzt auf die stärksten ${ausgang.rows.length} von ${ausgang.total} Begriffen. Vollständige Daten inklusive Verlauf über recherche_abrufen mit der id aus appUrl, oder in der App: ${ausgang.appUrl}`,
      })
    }

    case 'recherchen_auflisten': {
      const liste = await db.keywordResearch.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, seed: true, createdAt: true, summary: true },
      })
      return textInhalt(
        liste.map((r) => {
          const s = r.summary as { begriffe?: number; suchenGesamt?: number; anzeigenwertGesamt?: number } | null
          return {
            id: r.id,
            suchbegriff: r.seed,
            datum: r.createdAt.toISOString().slice(0, 10),
            begriffe: s?.begriffe ?? null,
            suchenImMonat: s?.suchenGesamt ?? null,
            werbewertEuro: s?.anzeigenwertGesamt ?? null,
          }
        }),
      )
    }

    case 'recherche_abrufen': {
      const research = await db.keywordResearch.findFirst({
        where: { id: String(args.id ?? ''), organizationId: orgId },
      })
      if (!research) return fehlerInhalt('Keine Recherche mit dieser id in diesem Arbeitsbereich.')
      return textInhalt({
        suchbegriff: research.seed,
        datum: research.createdAt.toISOString().slice(0, 10),
        markt: 'Google Deutschland',
        zusammenfassung: research.summary,
        spaltenHinweis:
          'begriff, suchvolumen (Suchen/Monat), klickpreis (€), anzeigenwert (€/Monat), wettbewerb, schwierigkeit (0–100), absicht, trendJahr (%), verlauf (12 Monatswerte, ältester zuerst)',
        begriffe: research.rows,
        appUrl: `${env().APP_URL}/keywords/${research.id}`,
      })
    }

    case 'ranking_abfrage': {
      const ausgang = await fuehreRankingAbfrage({
        organization: kontext.organization,
        userId: kontext.userId,
        target: String(args.ziel ?? ''),
        operation: 'mcp-rankings',
      })
      if (!ausgang.ok) return fehlerInhalt(ausgang.message)
      return textInhalt(ausgang)
    }

    case 'ranking_abfragen_auflisten': {
      const liste = await db.rankingLookup.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, target: true, scope: true, totalCount: true, createdAt: true },
      })
      return textInhalt(
        liste.map((l) => ({
          id: l.id,
          ziel: l.target,
          umfang: l.scope === 'seite' ? 'eine Unterseite' : 'ganze Domain',
          rankendeKeywords: l.totalCount,
          datum: l.createdAt.toISOString().slice(0, 10),
        })),
      )
    }

    case 'ranking_abfrage_abrufen': {
      const lookup = await db.rankingLookup.findFirst({
        where: { id: String(args.id ?? ''), organizationId: orgId },
      })
      if (!lookup) return fehlerInhalt('Keine Ranking-Abfrage mit dieser id in diesem Arbeitsbereich.')
      return textInhalt({
        ziel: lookup.target,
        umfang: lookup.scope === 'seite' ? 'eine Unterseite' : 'ganze Domain',
        datum: lookup.createdAt.toISOString().slice(0, 10),
        markt: 'Google Deutschland',
        rankendeKeywordsGesamt: lookup.totalCount,
        platzierungen: lookup.items,
        appUrl: `${env().APP_URL}/rankings/${lookup.id}`,
      })
    }

    default:
      return fehlerInhalt(`Unbekanntes Werkzeug: ${name}`)
  }
}

// --- Antwortformen ----------------------------------------------------------

function ergebnis(id: JsonRpcAnfrage['id'], result: Record<string, unknown>): Record<string, unknown> {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function textInhalt(daten: unknown): Record<string, unknown> {
  return { content: [{ type: 'text', text: JSON.stringify(daten, null, 1) }] }
}

function fehlerInhalt(nachricht: string): Record<string, unknown> {
  return { content: [{ type: 'text', text: nachricht }], isError: true }
}

function werkzeugText(id: JsonRpcAnfrage['id'], nachricht: string, istFehler: boolean): Record<string, unknown> {
  return ergebnis(id, { content: [{ type: 'text', text: nachricht }], isError: istFehler })
}
