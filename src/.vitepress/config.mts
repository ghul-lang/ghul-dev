import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative } from 'node:path'
import { defineConfig } from 'vitepress'
import { createHighlighter } from 'shiki'
import { FALLBACK_VERSIONS, fetchLatestStable } from './nuget-versions'
import { SECTIONS } from './pages'
import { renderText } from './render-text'
import { INDEX_URL } from './theme/rosetta-corpus.js'

// src/, the directory the pages live in: this file sits in src/.vitepress/.
const SRC_DIR = fileURLToPath(new URL('..', import.meta.url))

const ghulInlineHighlighter = await createHighlighter({
  themes: ['light-plus', 'dark-plus'],
  langs: [
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL('./ghul.tmLanguage.json', import.meta.url)),
        'utf-8',
      ),
    ),
    'shell',
    'xml',
  ],
})

// ghūl syntax highlighting uses the same TextMate grammar as the VS Code
// extension, vendored from ghul-vsce/syntaxes/ghul.tmLanguage.json.
const ghulGrammar = JSON.parse(
  readFileSync(fileURLToPath(new URL('./ghul.tmLanguage.json', import.meta.url)), 'utf-8'),
)

// example-data/*.json artifacts carry plain `code`; the <GhulExample>
// component needs it syntax-coloured. Rather than ship Shiki to the client,
// this Vite plugin tokenises each artifact's code at build time, with the
// ghūl grammar and the same VS Code Light+/Dark+ themes VitePress uses for
// fenced code, and folds a `tokens` field into the imported JSON.
let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

function getGhulHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['light-plus', 'dark-plus'],
      langs: [ghulGrammar],
    })
  }
  return highlighterPromise
}

function ghulExampleDataPlugin() {
  return {
    name: 'ghul-example-data',
    enforce: 'pre' as const,
    async transform(source: string, id: string) {
      const path = id.split('?')[0]
      if (!path.endsWith('.json') || !path.includes('/example-data/')) {
        return null
      }

      const data = JSON.parse(source)
      const highlighter = await getGhulHighlighter()

      // defaultColor:false gives each token an htmlStyle of
      // { '--shiki-light': '#..', '--shiki-dark': '#..' } — the component's
      // CSS maps those custom properties to `color` per light/dark mode.
      const tokenise = (text: string) => {
        const { tokens } = highlighter.codeToTokens(text, {
          lang: 'ghul',
          themes: { light: 'light-plus', dark: 'dark-plus' },
          defaultColor: false,
        })
        return tokens.map(line =>
          line.map(token => ({ text: token.content, style: token.htmlStyle ?? {} })),
        )
      }

      // The code is multi-line. A hover's `signature` is itself ghūl and is
      // coloured the same way the VSCE renders it in the hover code block —
      // and it can span several lines (a narrowed variable's hover carries
      // its declared type and, beneath, its narrowed type), so every line is
      // tokenised. `kindLabel` is the plain classifier shown in italics
      // beneath the block. Older artifacts without the signature/kindLabel
      // split fall back to the flat `text`.
      data.tokens = tokenise(data.code)
      data.hovers = (data.hovers ?? []).map(hover => ({
        ...hover,
        signatureLines: tokenise(hover.signature ?? hover.text ?? ''),
      }))

      return { code: JSON.stringify(data), map: null }
    },
  }
}

// Each <GhulExample name="x" /> used to read its data from a folder-wide
// eager glob in the component, so every page bundled all ~220 examples'
// artifacts. This plugin instead gives each page a `<script setup>` that
// statically imports only the examples it uses and passes each one to the
// component as a prop. Vite then puts an example's artifact in the chunk of
// the one page it appears on, and the value is still present at prerender
// so the example stays in the static HTML.
function ghulExamplePagePlugin() {
  return {
    name: 'ghul-example-page-split',
    enforce: 'pre' as const,
    transform(src: string, id: string) {
      if (!id.split('?')[0].endsWith('.md')) return null

      const names: string[] = []
      // A single <GhulExample name="x"> and a rotating
      // <GhulExampleSwitcher names="a,b,..."> both pull in the named JSON
      // artifacts. A name referenced by either is imported once; the
      // switcher's comma-separated names are spread so each rides in its
      // own import. (The single-tag regex needs whitespace after
      // `GhulExample`, so it can't match `GhulExampleSwitcher`.)
      for (const m of src.matchAll(/<GhulExample\s+name="([^"]+)"/g)) {
        if (!names.includes(m[1])) names.push(m[1])
      }
      for (const m of src.matchAll(/<GhulExampleSwitcher\s+names="([^"]+)"/g)) {
        for (const n of m[1].split(',')) {
          const t = n.trim()
          if (t && !names.includes(t)) names.push(t)
        }
      }
      if (names.length === 0) return null

      // The import is relative to the page, and a page is not always at the root of src: the
      // Rosetta Code section is a directory of them. SRC_DIR is this file's own parent's parent,
      // so the depth is however many directories separate the page from it.
      const depth = relative(SRC_DIR, id.split('?')[0]).split('/').length - 1

      const up = depth === 0 ? './' : '../'.repeat(depth)

      const imports = names
        .map((name, i) => `import __ghulExample${i} from '${up}.vitepress/example-data/${name}.json'`)
        .join('\n')
      const entries = names
        .map((name, i) => `  ${JSON.stringify(name)}: __ghulExample${i},`)
        .join('\n')
      const script = `<script setup>\n${imports}\nconst __ghulExamples = {\n${entries}\n}\n</script>\n\n`

      // single-quote the key: the binding sits inside a double-quoted attribute
      let body = src.replace(
        /<GhulExample\s+name="([^"]+)"/g,
        (tag, name) => `${tag} :data="__ghulExamples['${name}']"`,
      )

      // Inject the switcher's `:examples` array, built from the same
      // __ghulExamples map. `names` and `labels` stay as plain string
      // attributes for the component to split.
      body = body.replace(
        /<GhulExampleSwitcher\s+names="([^"]+)"/g,
        (tag, namesStr) => {
          const arr = '[' + namesStr.split(',').map(n => `{name:'${n.trim()}',data:__ghulExamples['${n.trim()}']}`).join(',') + ']'
          return `${tag} :examples="${arr}"`
        },
      )

      // a `<script setup>` must follow any frontmatter, not precede it
      const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(body)
      const at = frontmatter ? frontmatter[0].length : 0
      return { code: body.slice(0, at) + '\n' + script + body.slice(at), map: null }
    },
  }
}

// Install instructions spell a package version as the placeholder
// `0.0.0-latest.<package id>` rather than a literal. The placeholder is
// shaped like a version, so it survives syntax highlighting as a single
// token and can be substituted in the rendered code block.
const LATEST_VERSION_PLACEHOLDER = /0\.0\.0-latest\.([a-z][a-z0-9.-]*)/g

const resolvedVersions = Object.fromEntries(
  await Promise.all(
    Object.entries(FALLBACK_VERSIONS).map(async ([packageId, fallback]) =>
      [packageId, (await fetchLatestStable(packageId)) ?? fallback] as const,
    ),
  ),
)

// The substituted version is only as current as the last deploy, so the span
// doubles as a marker the client script re-resolves and updates in place. The
// copy button reads the code block's text content at click time, so whatever
// the span holds then is what a reader copies.
function substituteVersions(html: string) {
  return html.replace(LATEST_VERSION_PLACEHOLDER, (placeholder, packageId) => {
    const version = resolvedVersions[packageId]
    if (!version) return placeholder

    return `<span class="package-version" data-package="${packageId}">${version}</span>`
  })
}

// What the deployed site sends on the playground, sent by the dev server too.
// The runner inside the embed needs its document to be cross-origin isolated,
// and a frame is only isolated when the page holding it is, so without these a
// previewed page loads the editor and then waits for a run that never starts.
//
// A middleware rather than `vite.server.headers`, which VitePress does not pass
// through to its dev server. Development only: `configureServer` is not called
// by a build, and the deployed headers come from nginx.
function isolationHeadersPlugin() {
  return {
    name: 'ghul-isolation-headers',
    configureServer(server) {
      server.middlewares.use((_request, response, next) => {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      })
    },
  }
}

export default defineConfig({
  title: 'ghūl programming language',
  description: 'documentation for the ghūl programming language',
  lang: 'en-US',
  cleanUrls: true,

  // The Rosetta Code tasks are shown in place by one page, so the site's own
  // pages do not include them, and a crawler finds a task only by following a
  // link to it. Their addresses are read from the published index when the site
  // is built. A build that cannot reach it still succeeds, with a sitemap of the
  // site's own pages: the deploy is not worth losing over one.
  sitemap: {
    hostname: 'https://ghul.dev',
    async transformItems(items) {
      try {
        const response = await fetch(INDEX_URL)

        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

        const { tasks } = await response.json()

        return [...items, ...tasks.map(task => ({ url: `rosetta/${task.slug}` }))]
      } catch (error) {
        console.warn(`sitemap: no Rosetta Code tasks (${error.message})`)

        return items
      }
    },
  },

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['meta', { name: 'keywords', content: 'ghul, ghul programming language, ghoul, ghoul programming language, ghūl, ghūl programming language' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    // self-hosted GoatCounter, proxied by this site at /stats/. Both halves
    // have to be the same origin as each other: count.js reads the endpoint
    // out of the data attribute, and pointing one at a host that is not
    // serving the other silently records nothing.
    ['script', { 'data-goatcounter': 'https://ghul.dev/stats/count', async: '', src: 'https://ghul.dev/stats/count.js' }],
  ],

  markdown: {
    languages: [ghulGrammar as any],
    theme: { light: 'light-plus', dark: 'dark-plus' },

    // Highlight inline `code` spans as ghūl by default. Almost every
    // inline code mention on this site is a ghūl snippet (keyword, type,
    // expression), so defaulting to ghūl avoids the bare-monospace look
    // the brand-green default gave them.
    //
    // A trailing `{:lang}` suffix overrides the language for one span —
    // `` `dotnet tool restore`{:text} `` opts out of highlighting, and
    // `` `<Project>`{:xml} `` highlights as XML. The pre-rule walks the
    // inline token stream, lifts the suffix off the following text token,
    // and stashes it on the `code_inline` token as `data-lang`.
    config(md) {
      const fence = md.renderer.rules.fence!
      md.renderer.rules.fence = (...args) => substituteVersions(fence(...args))

      md.core.ruler.after('inline', 'ghul-inline-lang', state => {
        for (const block of state.tokens) {
          if (block.type !== 'inline' || !block.children) continue
          const children = block.children
          for (let i = 0; i < children.length - 1; i++) {
            if (children[i].type !== 'code_inline') continue
            const next = children[i + 1]
            if (next.type !== 'text') continue
            const m = /^\{:([\w+-]+)\}/.exec(next.content)
            if (!m) continue
            children[i].attrSet('data-lang', m[1])
            next.content = next.content.slice(m[0].length)
          }
        }
      })

      md.renderer.rules.code_inline = (tokens, idx) => {
        const token = tokens[idx]
        const text = token.content
        const lang = token.attrGet('data-lang') ?? 'ghul'
        if (lang === 'text') {
          return substituteVersions(
            `<code class="ghul-inline-plain">${md.utils.escapeHtml(text)}</code>`,
          )
        }
        const html = ghulInlineHighlighter.codeToHtml(text, {
          lang,
          themes: { light: 'light-plus', dark: 'dark-plus' },
          defaultColor: false,
          structure: 'inline',
        })
        return substituteVersions(`<code class="ghul-inline">${html}</code>`)
      }
    },
  },

  vite: {
    plugins: [ghulExamplePagePlugin(), ghulExampleDataPlugin(), isolationHeadersPlugin()],
  },

  themeConfig: {
    // The Rosetta Code section grows without limit and its pages are not read in order, so the
    // site needs a way to find one by name.
    search: { provider: 'local' },

    outline: { level: [2, 3], label: 'on this page' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ghul-lang/ghul' },
    ],

    sidebar: SECTIONS,
  },

  // The plain-text rendering under /text is written straight into the built
  // site, so it ships and stays current with the pages it is rendered from.
  buildEnd(siteConfig) {
    const count = renderText(siteConfig.srcDir, siteConfig.outDir)
    siteConfig.logger.info(`rendered ${count} pages to text/`)
  },
})
