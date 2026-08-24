import { Fragment } from 'react'

/**
 * Markdown-Darstellung für Berichte.
 *
 * Bewusst als React-Elemente statt über eingefügtes HTML: der Berichtstext
 * enthält URLs und Textausschnitte der analysierten Seite. Als Elemente
 * gerendert kann dort nichts ausgeführt werden, was in der fremden Seite steht.
 * Unterstützt wird der Umfang, den die Berichte tatsächlich nutzen.
 */
export function ReportView({ markdown }: { markdown: string }) {
  return <div className="prose-report">{renderBlocks(markdown)}</div>
}

function renderBlocks(markdown: string): React.ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index++
      continue
    }

    // Überschriften
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const content = renderInline(heading[2])
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level - 1]
      blocks.push(<Tag key={key++}>{content}</Tag>)
      index++
      continue
    }

    // Trennlinie
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key++} />)
      index++
      continue
    }

    // Tabelle: Kopfzeile, Trennzeile, dann Datenzeilen
    if (line.includes('|') && lines[index + 1]?.match(/^\s*\|?[\s:|-]+\|[\s:|-]*$/)) {
      const header = splitRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]))
        index++
      }
      blocks.push(
        <div className="scroll-x" key={key++}>
          <table>
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th key={i}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Listen
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const items: string[] = []
      while (index < lines.length) {
        const current = lines[index]
        const match = ordered ? current.match(/^\s*\d+\.\s+(.*)$/) : current.match(/^\s*[-*+]\s+(.*)$/)
        if (!match) break
        items.push(match[1])
        index++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={key++}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ListTag>,
      )
      continue
    }

    // Absatz: bis zur nächsten Leerzeile oder zum nächsten Blockanfang
    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index++
    }
    if (paragraph.length) {
      blocks.push(<p key={key++}>{renderInline(paragraph.join(' '))}</p>)
    } else {
      index++
    }
  }

  return blocks
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,4}\s/.test(line) ||
    /^\s*[-*+]\s/.test(line) ||
    /^\s*\d+\.\s/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
    line.includes('|')
  )
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Auszeichnungen innerhalb einer Zeile: **fett**, _kursiv_, `Code`, [Text](URL).
 * Alles andere bleibt Text.
 */
function renderInline(text: string): React.ReactNode {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_]+_)/g
  const parts = text.split(pattern).filter((p) => p !== '')

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = link[2]
      // Nur http(s) verlinken – javascript:-URLs und dergleichen bleiben Text.
      if (/^https?:\/\//i.test(href)) {
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">
            {link[1]}
          </a>
        )
      }
      return <Fragment key={i}>{link[1]}</Fragment>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
