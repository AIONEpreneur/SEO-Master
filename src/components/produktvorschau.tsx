import { LayoutDashboard, FileText, TrendingUp, FolderKanban, KeyRound } from 'lucide-react'

/**
 * Verkleinerte Nachbildung des Arbeitsbereichs für die öffentliche Seite.
 *
 * Bewusst aus Bausteinen gebaut und nicht als Bildschirmfoto: Ein Foto wäre
 * bei jeder Änderung der Oberfläche veraltet, würde auf feinen Bildschirmen
 * unscharf und müsste als Datei mitgeladen werden. Die Zahlen sind
 * Beispielwerte und als solche gekennzeichnet.
 */
export function Produktvorschau() {
  return (
    <div
      className="kante overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_oklch(20%_0.1_295_/_0.7)]"
      aria-label="Beispielansicht des Arbeitsbereichs"
      role="img"
    >
      {/* Fensterleiste */}
      <div className="flex items-center gap-2 border-b border-[var(--linie)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(60%_0.16_25)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(72%_0.14_85)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(70%_0.15_150)]" />
        <span className="ml-3 truncate text-[11px] text-[var(--schrift-leise)]">
          seo-master.aionepreneur.com
        </span>
      </div>

      <div className="flex">
        {/* Seitenleiste */}
        <div className="hidden w-40 shrink-0 border-r border-[var(--linie)] p-3 sm:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--ton)] text-[10px] font-bold text-white">
              S
            </span>
            <span className="text-[11px] font-semibold">SEO-Master</span>
          </div>
          {[
            { icon: LayoutDashboard, label: 'Übersicht', aktiv: true },
            { icon: FileText, label: 'Analysen', aktiv: false },
            { icon: TrendingUp, label: 'Keywords', aktiv: false },
            { icon: FolderKanban, label: 'Projekte', aktiv: false },
            { icon: KeyRound, label: 'Datentresor', aktiv: false },
          ].map((e) => (
            <div
              key={e.label}
              className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                e.aktiv
                  ? 'bg-[oklch(56%_0.244_295_/_0.18)] text-[var(--ton-hell)]'
                  : 'text-[var(--schrift-leise)]'
              }`}
            >
              <e.icon size={12} />
              {e.label}
            </div>
          ))}
        </div>

        {/* Inhalt */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold">kirstenbiema.com</p>
              <p className="text-[10px] text-[var(--schrift-leise)]">
                Beispielansicht · SEO, AEO, GEO, SERP
              </p>
            </div>
            <span className="rounded-full bg-[oklch(56%_0.244_295_/_0.18)] px-2 py-0.5 text-[10px] font-medium text-[var(--ton-hell)]">
              Fertig
            </span>
          </div>

          {/* Bewertungen */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[
              { k: 'SEO', v: '7,4' },
              { k: 'AEO', v: '5,1' },
              { k: 'GEO', v: '4,8' },
              { k: 'SERP', v: '6,2' },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-[var(--linie)] bg-[var(--grund-tief)] p-2">
                <p className="text-[9px] uppercase tracking-wider text-[var(--schrift-leise)]">{s.k}</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Verlauf */}
          <div className="mb-3 rounded-lg border border-[var(--linie)] bg-[var(--grund-tief)] p-3">
            <p className="mb-2 text-[10px] text-[var(--schrift-leise)]">Sichtbarkeit über zwölf Monate</p>
            <svg viewBox="0 0 240 48" className="h-12 w-full" aria-hidden preserveAspectRatio="none">
              <defs>
                <linearGradient id="vorschau-flaeche" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(62% 0.235 295)" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="oklch(62% 0.235 295)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,40 L22,37 L44,38 L66,31 L88,33 L110,26 L132,22 L154,24 L176,16 L198,13 L220,9 L240,6 L240,48 L0,48 Z"
                fill="url(#vorschau-flaeche)"
              />
              <path
                d="M0,40 L22,37 L44,38 L66,31 L88,33 L110,26 L132,22 L154,24 L176,16 L198,13 L220,9 L240,6"
                fill="none"
                stroke="oklch(72% 0.19 295)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Befunde */}
          <div className="space-y-1.5">
            {[
              { stufe: 'Sofort', text: 'Meta Description fehlt auf der Startseite', ton: 'bad' },
              { stufe: 'Schneller Hebel', text: 'FAQ-Auszeichnung ergänzen', ton: 'warn' },
              { stufe: 'Langfristig', text: 'Zitierfähige Fachseite zum Kernthema', ton: 'matt' },
            ].map((b) => (
              <div
                key={b.text}
                className="flex items-center gap-2 rounded-lg border border-[var(--linie)] bg-[var(--grund-tief)] px-2.5 py-1.5"
              >
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    b.ton === 'bad'
                      ? 'bg-[oklch(60%_0.16_25_/_0.2)] text-[oklch(76%_0.14_25)]'
                      : b.ton === 'warn'
                        ? 'bg-[oklch(72%_0.14_85_/_0.18)] text-[oklch(82%_0.13_85)]'
                        : 'bg-[oklch(100%_0_0_/_0.06)] text-[var(--schrift-leise)]'
                  }`}
                >
                  {b.stufe}
                </span>
                <span className="truncate text-[10px] text-[var(--schrift-matt)]">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
