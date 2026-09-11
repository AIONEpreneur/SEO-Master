import { Funke } from '@/components/ui'

/**
 * Das Bild im Aufmacher: gestapelte Karten, die leicht schweben.
 *
 * Aufbau und Bewegung stammen aus der Vorlage — eine Datenkarte mit
 * wachsenden Balken, darunter eine Bestätigungskarte und eine Pille, dazu
 * zwei blinzelnde Sterne. Der Inhalt ist auf die Anwendung übersetzt: Die
 * Balken sind die Bewertungen einer Analyse, kein Zierrat.
 *
 * Die Werte sind bewusst erfunden und als Beispiel beschriftet — eine
 * Landingpage, die echte Zahlen vortäuscht, wäre eine Lüge.
 */
const BALKEN = [
  { hoehe: '62%', farbe: 'bg-blau', titel: 'SEO' },
  { hoehe: '88%', farbe: 'bg-limette', titel: 'AEO' },
  { hoehe: '45%', farbe: 'bg-rosa', titel: 'GEO' },
  { hoehe: '74%', farbe: 'bg-blau', titel: 'SERP' },
  { hoehe: '95%', farbe: 'bg-limette', titel: 'Gesamt' },
]

export function HeroVisual() {
  return (
    <div className="relative h-[430px] w-full sm:h-[520px]">
      <Funke size={40} className="twinkle absolute -top-2 right-6 sm:right-10" fill="#FFFDF8" />
      <Funke size={28} className="twinkle twinkle-2 absolute bottom-16 left-0" fill="#F6A44B" />

      {/* Datenkarte */}
      <div
        className="float-a schatten absolute left-2 top-3 w-[300px] rounded-2xl border-2 border-tinte bg-sand p-6 sm:left-8 sm:w-[360px] sm:p-7"
        style={{ transform: 'rotate(-3deg)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-bold text-rot sm:text-[20px]">Deine Sichtbarkeit</span>
          <span className="rounded-full border-2 border-tinte bg-creme px-3 py-1 text-[11px] font-bold sm:text-[13px]">
            Beispiel
          </span>
        </div>
        <div className="bars mt-5 flex h-[118px] items-end gap-2.5 sm:h-[150px] sm:gap-3.5">
          {BALKEN.map((b) => (
            <div
              key={b.titel}
              title={b.titel}
              className={`flex-1 rounded-t-[10px] rounded-b-[5px] border-2 border-tinte ${b.farbe}`}
              style={{ height: b.hoehe }}
            />
          ))}
        </div>
        <p className="mt-4 text-[13px] font-medium sm:text-[14px]">
          aus echten Google-Daten — nicht aus dem Bauch
        </p>
      </div>

      {/* Bestätigungskarte */}
      <div
        className="float-b schatten absolute left-10 top-[268px] flex w-[270px] items-center gap-4 rounded-2xl border-2 border-tinte bg-orange p-5 sm:left-28 sm:top-[310px] sm:w-[330px] sm:p-6"
        style={{ transform: 'rotate(2.5deg)' }}
      >
        <svg className="pop shrink-0" width="46" height="46" viewBox="0 0 52 52" aria-hidden>
          <circle cx="26" cy="26" r="24" fill="#FFFDF8" stroke="#161616" strokeWidth="2.5" />
          <path
            d="M15 27 L23 34 L37 18"
            fill="none"
            stroke="#161616"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <p className="text-[17px] font-bold sm:text-[20px]">Platz 3 bei Google</p>
          <p className="text-[13px] font-medium sm:text-[15px]">gemessen, nicht geschätzt</p>
        </div>
      </div>

      {/* Pille */}
      <div
        className="float-c absolute left-16 top-[392px] rounded-full bg-tinte px-6 py-3 text-[14px] font-bold text-creme sm:left-24 sm:top-[462px] sm:text-[16px]"
        style={{ transform: 'rotate(-2deg)' }}
      >
        SEO · AEO · GEO in einem Lauf
      </div>
    </div>
  )
}
