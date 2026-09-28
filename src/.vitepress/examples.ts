// The examples section: one page per program in ghul-examples, generated when the site is built.
//
// examples-index.json is ghul-examples' own index, copied here by `npm run pull-examples`. It
// lists the topics in reading order, and each topic's programs in order, with each program's
// source and the output its test expects. The sidebar, the pages under /examples and their
// plain-text rendering under /text are all built from it, so they list the same programs in the
// same order.

import index from './examples-index.json'

export interface ExamplePiece {
  id: string
  title: string
  path: string
  source: string
  output: string
}

export interface ExampleTopic {
  slug: string
  title: string
  intro: string | null
  pieces: ExamplePiece[]
}

export interface ExamplePage {
  slug: string
  link: string
  heading: string
  sidebarText: string
  topic: ExampleTopic
  piece: ExamplePiece
  first: boolean
}

// The branch the index was generated from, which is also where the sources and the programs the
// playground runs are read from.
export const EXAMPLES_REF: string = (index as { ref?: string }).ref ?? 'main'

export const EXAMPLE_TOPICS: ExampleTopic[] = (index as { topics: ExampleTopic[] }).topics

const REPOSITORY = 'https://github.com/ghul-lang/ghul-examples'

// A topic's first program is at /examples/<topic>, so a link to a topic stays the same however
// the topic is divided; the others are at /examples/<topic>-<part>.
function pageSlug(topic: ExampleTopic, piece: ExamplePiece, position: number) {
  if (position === 0) return topic.slug

  return `${topic.slug}-${piece.id.slice(topic.slug.length + 1)}`
}

export const EXAMPLE_PAGES: ExamplePage[] = EXAMPLE_TOPICS.flatMap(topic =>
  topic.pieces.map((piece, position) => {
    const slug = pageSlug(topic, piece, position)
    const whole = topic.pieces.length === 1

    return {
      slug,
      link: `/examples/${slug}`,
      heading: whole ? topic.title : `${topic.title}: ${piece.title}`,
      sidebarText: whole ? topic.title : piece.title,
      topic,
      piece,
      first: position === 0,
    }
  }))

// The sidebar group: a topic with one program is a single entry, and a topic divided into several
// is a collapsible group of them.
export const EXAMPLES_SECTION = {
  text: 'examples',
  collapsed: true,
  items: EXAMPLE_TOPICS.map(topic => {
    const pages = EXAMPLE_PAGES.filter(page => page.topic === topic)

    if (pages.length === 1) {
      return { text: topic.title, link: pages[0].link }
    }

    return {
      text: topic.title,
      collapsed: true,
      items: pages.map(page => ({ text: page.sidebarText, link: page.link })),
    }
  }),
}

// A page's Markdown. `runnable` adds the button that opens the program in the playground, which
// only the site has; the plain-text rendering leaves it out.
export function exampleMarkdown(page: ExamplePage, runnable: boolean): string {
  const { piece, topic } = page
  const source = `${REPOSITORY}/blob/${EXAMPLES_REF}/${piece.path}`
  const output = piece.output.trimEnd()

  const lines = [`# ${page.heading}`, '']

  if (page.first && topic.intro) {
    lines.push(topic.intro.trim(), '')
  }

  if (runnable) {
    lines.push(`<ExampleRun id="${piece.id}" />`, '')
  }

  lines.push('```ghul', piece.source.trimEnd(), '```', '')

  if (output) {
    lines.push('It prints:', '', '```plaintext', output, '```', '')
  } else {
    lines.push("It doesn't print anything.", '')
  }

  lines.push(`The source is [${piece.path}](${source}) in ghul-examples.`, '')

  return lines.join('\n')
}
