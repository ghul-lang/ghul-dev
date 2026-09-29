import { EXAMPLES_SECTION } from './examples'

// The site's pages, grouped into sidebar sections and in reading order
// within each. The sidebar is built from SECTIONS, and the plain-text
// rendering under /text from the flattened PAGES, so the two can't drift
// apart.
//
// The groups separate the site's registers: "ghūl" is the front door
// (the overview and how to install), "tour" shows what the language can
// express - one page per paradigm, read in order or dipped into - "guides"
// are practical how-tos, "reference" is for looking things up, "examples"
// are whole programs from ghul-examples, one per page, and "about"
// is the project itself: its story, and how the site treats its readers.
export const SECTIONS = [
  {
    text: 'ghūl',
    items: [
      { text: 'overview', link: '/' },
      { text: 'getting started', link: '/getting-started' },
    ],
  },
  {
    text: 'tour',
    items: [
      { text: 'expression oriented programming', link: '/expression-oriented-programming' },
      { text: 'functional programming', link: '/functional-programming' },
      { text: 'object oriented programming', link: '/object-oriented-programming' },
      { text: 'unions and pattern matching', link: '/unions-and-pattern-matching' },
      { text: 'generics', link: '/generics' },
      { text: 'optional types and narrowing', link: '/optionals-and-narrowing' },
      { text: 'async and generators', link: '/async-and-generators' },
      { text: '.NET integration', link: '/dotnet-integration' },
    ],
  },
  {
    text: 'guides',
    items: [
      { text: 'runtime library', link: '/runtime-library' },
      { text: 'scripts, the REPL and notebooks', link: '/scripts-and-repl' },
      { text: 'tooling', link: '/tooling' },
    ],
  },
  {
    text: 'reference',
    items: [
      { text: 'language basics', link: '/language-basics' },
      { text: 'syntax', link: '/syntax' },
      { text: 'definitions', link: '/definitions' },
      { text: 'expressions', link: '/expressions' },
      { text: 'control flow', link: '/control-flow' },
      { text: 'optional types', link: '/optional-types' },
      { text: 'type narrowing', link: '/type-narrowing' },
      { text: 'type inference', link: '/type-inference' },
      { text: 'grammar', link: '/grammar' },
      { text: 'known issues', link: '/known-issues' },
    ],
  },
  EXAMPLES_SECTION,
  {
    text: 'rosetta code',
    items: [
      { text: 'tasks', link: '/rosetta/' },
    ],
  },
  {
    text: 'about',
    items: [
      { text: 'implementation', link: '/implementation' },
      { text: 'history', link: '/history' },
      { text: 'resources', link: '/resources' },
      { text: 'privacy', link: '/privacy' },
    ],
  },
]

// Every page in sidebar order, ignoring the grouping - the reading order the
// /text rendering follows. A group can hold groups, as the examples section does.
type Entry = { text: string, link?: string, items?: Entry[] }

const pagesOf = (entries: Entry[]): { text: string, link: string }[] =>
  entries.flatMap(entry => entry.items ? pagesOf(entry.items) : entry.link ? [{ text: entry.text, link: entry.link }] : [])

export const PAGES = pagesOf(SECTIONS)

// The markdown file backing a page, without its extension. A link ending in a
// slash is a directory's index, so `/rosetta/` is backed by `rosetta/index.md`.
export function pageSlug(link: string) {
  if (link === '/') {
    return 'index'
  }

  const path = link.replace(/^\//, '')

  return path.endsWith('/') ? `${path}index` : path
}
