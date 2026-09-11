import { cn } from '@/lib/utils/cn'

/**
 * Profilbild oder Initialen.
 *
 * Ohne Bild werden die Initialen gezeigt — nie ein leerer Kreis. Die Form
 * folgt der Vorlage: runder Ausschnitt mit 2-px-Kontur.
 */
export function Avatar({
  datei,
  name,
  email,
  size = 40,
  className,
}: {
  datei: string | null
  name: string | null
  email: string
  size?: number
  className?: string
}) {
  const initialen = (name ?? email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-orange font-bold text-tinte',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.6) }}
    >
      {datei ? (
        // eslint-disable-next-line @next/next/no-img-element -- eigene Route,
        // kein Zuschnitt nötig: Das Bild wird immer im Kreis angezeigt.
        <img
          src={`/api/profilbild/${datei}`}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        initialen || '?'
      )}
    </span>
  )
}
