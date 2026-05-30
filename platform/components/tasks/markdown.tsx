import React from 'react'
import Link from 'next/link'

// Map of lowercased mention handle (name without spaces, or email local-part)
// → userId, so @mentions can link to profiles. Set per-render in MarkdownBody.
type MentionMap = Record<string, string>
let activeMentions: MentionMap | null = null

function resolveMention(handle: string): string | null {
  if (!activeMentions) return null
  const h = handle.toLowerCase()
  if (activeMentions[h]) return activeMentions[h]
  // Prefix match (mirrors the server-side resolver), first hit wins.
  for (const key of Object.keys(activeMentions)) {
    if (key.startsWith(h) || h.startsWith(key)) return activeMentions[key]
  }
  return null
}

/**
 * Minimal, dependency-free Markdown renderer for comment/chat bodies.
 *
 * Agents (and people) write Markdown — this renders the common subset as real
 * React elements (never dangerouslySetInnerHTML, so it's XSS-safe). It also
 * keeps the existing @mention highlight. Supported: headings, bold, italic,
 * inline code, fenced code blocks, blockquotes, ordered/unordered lists, links,
 * and horizontal rules.
 */

const MENTION_RE = /(@[\w.+-]+)/g

// Only allow safe link schemes; anything else renders as plain text.
function safeHref(url: string): string | null {
  try {
    const u = new URL(url, 'https://x.invalid')
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) return url
  } catch {
    /* not a URL */
  }
  return null
}

/** Render a run of text with @mention chips (linked to profiles when resolved). */
function renderText(text: string, keyBase: string): React.ReactNode[] {
  return text.split(MENTION_RE).map((p, i) => {
    if (!MENTION_RE.test(p)) return <React.Fragment key={`${keyBase}-t${i}`}>{p}</React.Fragment>
    const cls = 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded px-1 py-0.5 text-[0.95em] font-medium'
    const userId = resolveMention(p.slice(1))
    return userId ? (
      <Link key={`${keyBase}-m${i}`} href={`/u/${userId}`} className={`${cls} hover:underline`}>{p}</Link>
    ) : (
      <span key={`${keyBase}-m${i}`} className={cls}>{p}</span>
    )
  })
}

// Earliest-match inline tokenizer. Order matters only for the scan; each branch
// recurses on its inner text (except code, which is literal).
const INLINE = [
  { type: 'code', re: /`([^`]+)`/ },
  { type: 'bold', re: /\*\*([^*]+)\*\*|__([^_]+)__/ },
  { type: 'italic', re: /\*([^*]+)\*|_([^_]+)_/ },
  { type: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
] as const

function renderInline(text: string, keyBase = 'i'): React.ReactNode[] {
  let earliest: { idx: number; len: number; node: React.ReactNode } | null = null

  for (const { type, re } of INLINE) {
    const m = re.exec(text)
    if (!m || (earliest && m.index >= earliest.idx)) continue
    const k = `${keyBase}-${type}-${m.index}`
    let node: React.ReactNode
    if (type === 'code') {
      node = <code key={k} className="font-mono text-[0.9em] bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">{m[1]}</code>
    } else if (type === 'bold') {
      node = <strong key={k} className="font-semibold">{renderInline(m[1] ?? m[2] ?? '', k)}</strong>
    } else if (type === 'italic') {
      node = <em key={k}>{renderInline(m[1] ?? m[2] ?? '', k)}</em>
    } else {
      const href = safeHref(m[2])
      node = href
        ? <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline break-words">{renderInline(m[1], k)}</a>
        : <React.Fragment key={k}>{m[0]}</React.Fragment>
    }
    earliest = { idx: m.index, len: m[0].length, node }
  }

  if (!earliest) return renderText(text, keyBase)
  return [
    ...renderText(text.slice(0, earliest.idx), `${keyBase}-pre`),
    earliest.node,
    ...renderInline(text.slice(earliest.idx + earliest.len), `${keyBase}-post`),
  ]
}

// ── GFM tables ────────────────────────────────────────────────────────────
function splitRow(line: string): string[] {
  // Drop optional leading/trailing pipe, then split. (Escaped \| kept literal.)
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'))
}
function isDelimiterRow(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitRow(line)
  return cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c))
}
type Align = 'left' | 'center' | 'right'
function alignOf(cell: string): Align {
  const l = cell.startsWith(':')
  const r = cell.endsWith(':')
  return l && r ? 'center' : r ? 'right' : 'left'
}
const ALIGN_CLASS: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }

export function MarkdownBody({ text, mentions }: { text: string; mentions?: MentionMap }) {
  // Synchronous render — safe to stash the map module-side for renderText.
  activeMentions = mentions ?? null
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (/^```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      if (i < lines.length) i++ // closing fence
      blocks.push(
        <pre key={key++} className="bg-gray-100 dark:bg-gray-800 rounded-md p-2 my-1 overflow-x-auto text-[0.85em]">
          <code className="font-mono">{body.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Blank line
    if (/^\s*$/.test(line)) { i++; continue }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(<div key={key++} className="font-semibold text-gray-1 mt-1">{renderInline(h[2], `h${key}`)}</div>)
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-2 border-line" />)
      i++
      continue
    }

    // GFM table: a header row followed by a delimiter row.
    if (line.includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      const header = splitRow(line)
      const aligns = splitRow(lines[i + 1]).map(alignOf)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i++]))
      }
      const tk = key++
      blocks.push(
        <div key={tk} className="my-1 overflow-x-auto">
          <table className="border-collapse text-[0.9em] w-full">
            <thead>
              <tr>
                {header.map((c, j) => (
                  <th key={j} className={`border border-line px-2 py-1 font-semibold text-gray-1 ${ALIGN_CLASS[aligns[j] ?? 'left']}`}>
                    {renderInline(c, `th${tk}-${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {header.map((_, j) => (
                    <td key={j} className={`border border-line px-2 py-1 align-top ${ALIGN_CLASS[aligns[j] ?? 'left']}`}>
                      {renderInline(r[j] ?? '', `td${tk}-${ri}-${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-line pl-3 my-1 text-gray-3">
          {renderInline(body.join(' '), `q${key}`)}
        </blockquote>,
      )
      continue
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''))
      blocks.push(
        <ul key={key++} className="list-disc ml-5 my-1 space-y-0.5">
          {items.map((it, j) => <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>)}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''))
      blocks.push(
        <ol key={key++} className="list-decimal ml-5 my-1 space-y-0.5">
          {items.map((it, j) => <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>)}
        </ol>,
      )
      continue
    }

    // Paragraph: gather consecutive plain lines
    const para: string[] = []
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1]))
    ) {
      para.push(lines[i++])
    }
    blocks.push(
      <p key={key++} className="my-1 break-words">
        {para.map((ln, j) => (
          <React.Fragment key={j}>
            {renderInline(ln, `p${key}-${j}`)}
            {j < para.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>,
    )
  }

  return <div className="text-sm text-gray-2 leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>
}
