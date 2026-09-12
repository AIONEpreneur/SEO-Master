import type { Plan } from '@prisma/client'

/**
 * Wie viele Websites ein Tarif trägt.
 *
 * Die zweite Achse neben den Plätzen — und für diese Zielgruppe die
 * wichtigere. Plätze zählen Personen, und die meisten Kundinnen hier
 * arbeiten allein; eine Grenze, die sie nie erreichen, ist keine Leiter.
 * Was bei ihnen tatsächlich wächst, sind Websites: die Hauptseite, dann
 * der Shop, dann das zweite Angebot.
 *
 * Sie ist ausserdem die ehrliche Achse. Jedes Projekt löst eine
 * automatische Monatsprüfung aus — mehr Websites heissen also wirklich
 * mehr Kosten, nicht nur mehr Zahlungsbereitschaft.
 *
 * Der Regelsatz dahinter, damit die Leiter verständlich bleibt:
 * **Der kleine Tarif ist vollständig für eine Website. Der grosse fügt
 * weitere Websites und den Wettbewerbsvergleich hinzu.** Der Solo-Kundin
 * wird nichts weggenommen — sonst kauft sie gar nichts.
 */
export const WEBSITES: Record<Plan, number> = {
  INTERNAL: Number.POSITIVE_INFINITY,
  // Zum Umschauen genügt eine. Ohne Monatsguthaben entsteht daraus ohnehin
  // kein Verlauf, die Grenze tut hier niemandem weh.
  FREE: 1,
  STARTER: 1,
  PRO: 5,
  // Bei der Agentur zählt nicht diese Achse, sondern die Zahl der
  // Kundenbereiche. Der Wert steht hier nur, damit ein von Hand gesetzter
  // Bereich nicht bei einer Website landet.
  AGENCY: 25,
}

export function websitesGrenze(plan: Plan): number {
  return WEBSITES[plan] ?? 1
}

export function passtNochEineWebsite(input: { plan: Plan; angelegt: number }): boolean {
  return input.angelegt < websitesGrenze(input.plan)
}

/**
 * Die Absage beim Anlegen der zweiten Website.
 *
 * Der häufigste Umstiegsmoment überhaupt — und er passiert nicht auf der
 * Preisseite, sondern hier im Formular. Deshalb steht hier kein Fehler,
 * sondern der Grund und der Weg.
 */
export function websiteVollHinweis(plan: Plan): string {
  const grenze = websitesGrenze(plan)
  const websites = grenze === 1 ? 'eine Website' : `${grenze} Websites`
  if (plan === 'PRO') {
    return (
      `Dieser Tarif trägt ${websites}, und alle sind angelegt. ` +
      'Betreust du mehr — etwa für Kundinnen —, melde dich gern: Dafür gibt es einen eigenen Weg.'
    )
  }
  return (
    `Dieser Tarif trägt ${websites}. Mit dem grossen Tarif sind es ${websitesGrenze('PRO')} — ` +
    'dazu kommt der Vergleich mit deinen Wettbewerbern. Ein Projekt zu löschen gibt auch wieder Platz.'
  )
}

/** Wie die Grenze in der Preisliste steht. */
export function websitesLeistung(plan: Plan): string {
  const grenze = websitesGrenze(plan)
  return grenze === 1 ? 'Eine Website, vollständig gemessen' : `Bis zu ${grenze} Websites`
}

/**
 * Trägt dieser Tarif den Wettbewerbsvergleich?
 *
 * Die zweite Grenze zum grossen Tarif, und die einzige, die eine Funktion
 * betrifft. Zwei Gründe sprechen dafür, genau diese zu wählen: Sie ist mit
 * Abstand die teuerste Abfrage der ganzen Anwendung — Wettbewerber
 * ermitteln, dann je Wettbewerber die Keyword-Überschneidung und das
 * Verlinkungsprofil. Und sie ist ein Reifezeichen: Wer sich mit anderen
 * vergleicht, ist über den Anfang hinaus.
 *
 * Der Verlauf gehört ausdrücklich NICHT hierher. Er ist der Grund, warum
 * jemand im nächsten Monat wiederkommt — ihn einzusperren, würde die
 * Bindung zerstören, um ein paar Euro zu retten.
 */
export function traegtWettbewerb(plan: Plan): boolean {
  return plan === 'PRO' || plan === 'AGENCY' || plan === 'INTERNAL'
}

export const WETTBEWERB_HINWEIS =
  'Der Vergleich mit deinen Wettbewerbern gehört zum grossen Tarif.'
