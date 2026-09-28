// Renders the site as plain Markdown, published alongside the HTML under
// /text. Each page becomes /text/<page>.md and the whole site, in sidebar
// order, becomes /text/all.md.
//
// The point is a version of the site that can be read straight through
// without a browser. The source markdown can't serve that purpose on its own:
// its examples are `<GhulExample name="..." />` tags naming build artifacts,
// so a reader of the raw file sees the prose with every code sample missing.
// Here each tag is replaced by the code the page actually displays, followed
// by whatever the example printed or the compiler reported.
//
// What is dropped is the interactive layer only - hover tooltips, diagnostic
// squiggles, syntax colour, the copy and expand buttons. What a reader sees
// at rest is kept, including the ellipsis rows marking hidden scaffold and
// the narrowing inlay sigils.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PAGES, pageSlug } from './pages'
import { EXAMPLE_PAGES, exampleMarkdown } from './examples'

const SITE = 'https://ghul.dev'

type Example = {
  name: string
  code: string
  output?: string
  diagnostics?: { severity: string, message: string }[]
  inlayHints?: { line: number, column: number, label: string }[]
  hiddenBefore?: boolean
  hiddenAfter?: boolean
  hiddenGapsAfterLine?: number[]
}

function loadExample(dataDir: string, name: string): Example | null {
  const path = join(dataDir, `${name}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// Splice a line's inlay hints in as ghost text, at the column each renders
// before, right to left so earlier columns aren't shifted by later ones. The
// site sets each sigil apart from the code with padding and a background;
// here a space either side does that job, so `►` reads as a marker rather
// than as part of the expression beside it.
function withInlays(line: string, hints: { column: number, label: string }[]) {
  let result = line
  for (const hint of [...hints].sort((a, b) => b.column - a.column)) {
    const at = Math.min(Math.max(hint.column, 1), result.length + 1) - 1
    const before = at > 0 && !/\s$/.test(result.slice(0, at)) ? ' ' : ''
    const after = /^\S/.test(result.slice(at)) ? ' ' : ''
    result = result.slice(0, at) + before + hint.label + after + result.slice(at)
  }
  return result
}

// The code as displayed: the visible slice, with an ellipsis row wherever the
// component shows one and the narrowing inlays spliced in. A `signature`
// example is a declaration-only stub with no surrounding source, so it gets
// no ellipsis rows - matching the component, which suppresses them there.
function renderCode(example: Example, signature: boolean) {
  const inlaysByLine = new Map<number, { column: number, label: string }[]>()
  for (const hint of example.inlayHints ?? []) {
    if (!inlaysByLine.has(hint.line)) inlaysByLine.set(hint.line, [])
    inlaysByLine.get(hint.line)!.push(hint)
  }

  const gaps = new Set(signature ? [] : example.hiddenGapsAfterLine ?? [])
  const lines: string[] = []

  if (!signature && example.hiddenBefore) lines.push('…')

  example.code.split('\n').forEach((line, i) => {
    const hints = inlaysByLine.get(i + 1)
    lines.push(hints ? withInlays(line, hints) : line)
    if (gaps.has(i + 1)) lines.push('…')
  })

  if (!signature && example.hiddenAfter) lines.push('…')

  return lines.join('\n')
}

function renderExample(example: Example | null, name: string, signature: boolean) {
  if (!example) return `> no generated artifact for example "${name}"`

  const parts = ['```ghul', renderCode(example, signature), '```']

  const diagnostics = example.diagnostics ?? []
  if (diagnostics.length) {
    parts.push('', 'diagnostics:', '')
    for (const d of diagnostics) parts.push(`- ${d.severity}: ${d.message}`)
  }

  if (example.output) {
    parts.push('', 'output:', '', '```', example.output.replace(/\n+$/, ''), '```')
  }

  return parts.join('\n')
}

// VitePress custom containers (`::: tip title` … `:::`) become blockquotes,
// which is the closest plain-Markdown equivalent of a callout.
function renderContainers(markdown: string) {
  return markdown.replace(
    /^::: *(tip|info|warning|danger|details)([^\n]*)\n([\s\S]*?)^:::[ \t]*$/gm,
    (_all, kind: string, title: string, body: string) => {
      const heading = title.trim() || kind
      const quoted = body.trimEnd().split('\n').map(line => (line ? `> ${line}` : '>')).join('\n')
      return `> **${heading}**\n>\n${quoted}`
    },
  )
}

export function renderPage(markdown: string, dataDir: string) {
  let text = markdown

  // frontmatter is site metadata, not content
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')

  // A switcher is one card at a time on the page; in a linear rendering each
  // card is shown in turn under the label the reader would click.
  text = text.replace(
    /<GhulExampleSwitcher\s+([\s\S]*?)\/>/g,
    (_all, attributes: string) => {
      const names = /names="([^"]*)"/.exec(attributes)?.[1] ?? ''
      const labels = /labels="([^"]*)"/.exec(attributes)?.[1] ?? ''
      const labelList = labels.split(',').map(s => s.trim())
      return names.split(',').map(s => s.trim()).filter(Boolean).map((name, i) => {
        const label = labelList[i] || name
        return `**${label}**\n\n${renderExample(loadExample(dataDir, name), name, false)}`
      }).join('\n\n')
    },
  )

  text = text.replace(
    /<GhulExample\s+([^>]*?)\/>/g,
    (_all, attributes: string) => {
      const name = /name="([^"]*)"/.exec(attributes)?.[1] ?? ''
      const signature = /\bsignature\b/.test(attributes)
      return renderExample(loadExample(dataDir, name), name, signature)
    },
  )

  text = renderContainers(text)

  // `` `x`{:xml} `` picks a highlighting language for one inline span; the
  // suffix is markup for the site's own renderer, not part of the text.
  text = text.replace(/(`[^`\n]+`)\{:[\w+-]+\}/g, '$1')

  // Root-relative links only resolve inside the site, so make them absolute.
  text = text.replace(/\]\((\/[^)\s]*)\)/g, `](${SITE}$1)`)

  return text.trimEnd() + '\n'
}

export function renderText(srcDir: string, outDir: string) {
  const dataDir = join(srcDir, '.vitepress', 'example-data')
  const textDir = join(outDir, 'text')
  mkdirSync(textDir, { recursive: true })

  // The Rosetta Code section is one page, and its contents is fetched from ghul-rosetta-code when
  // a reader opens it rather than being in this repository, so there is nothing to render here
  // beyond a line saying where the tasks are. The solutions themselves are on the wiki and in
  // that repository; they were never this site's to publish as text.
  const expandRosetta = (body: string) =>
    body.replace(
      /<RosettaExplorer\s*\/>/g,
      `The tasks, searchable: ${SITE}/rosetta/ - one page, which reads them from`
        + ' https://github.com/ghul-lang/ghul-rosetta-code',
    )

  // An examples page is generated from ghul-examples' index when the site is built, so it has no
  // Markdown file of its own; its text comes from the same function as the page.
  const rendered = PAGES.map(page => {
    const slug = pageSlug(page.link)
    const example = EXAMPLE_PAGES.find(candidate => candidate.link === page.link)

    if (example) {
      return { ...page, slug, body: exampleMarkdown(example, false) }
    }

    const source = readFileSync(join(srcDir, `${slug}.md`), 'utf-8')
    return { ...page, slug, body: expandRosetta(renderPage(source, dataDir)) }
  })

  mkdirSync(join(textDir, 'rosetta'), { recursive: true })
  mkdirSync(join(textDir, 'examples'), { recursive: true })

  for (const page of rendered) {
    writeFileSync(join(textDir, `${page.slug}.md`), page.body)
  }

  const contents = rendered
    .map(page => `- [${page.text}](#${page.slug}) - ${SITE}${page.link}`)
    .join('\n')

  const preamble = [
    '# the ghūl programming language',
    '',
    `Every page of [${SITE}](${SITE}), in sidebar order, as plain Markdown.`,
    'Each page is also published on its own, as',
    `\`${SITE}/text/<page>.md\`.`,
    '',
    'Code samples are the ones the site displays. An example that produced',
    'output or compiler diagnostics carries them beneath it. `…` marks',
    'surrounding scaffolding the page hides, and `►` / `◄` are the narrowing',
    'hints the site shows inline. Syntax colour and hover tooltips are the',
    'only things dropped.',
    '',
    '## contents',
    '',
    contents,
  ].join('\n')

  const all = [preamble, ...rendered.map(page =>
    `<a id="${page.slug}"></a>\n\n${page.body}`)].join('\n\n---\n\n')

  writeFileSync(join(textDir, 'all.md'), all)

  return rendered.length
}
