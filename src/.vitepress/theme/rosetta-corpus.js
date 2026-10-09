// The Rosetta Code corpus, read from ghul-rosetta-code when a reader opens the section rather than
// copied into this site at build time.
//
// The solutions are written and tested there, and they are only worth showing here because they
// run in the reader's browser - which the playground already does by fetching the source from the
// same place. Reading the corpus the same way keeps one copy: a task solved this morning is here
// this morning, nothing has to be re-pulled, and the site stops growing a page and a chunk per
// task.
//
// index.json is the corpus description: every task with its title, tags, interest, where it runs,
// whether it reads input, whether it draws, and its parts. It also carries the tag vocabulary, so
// the descriptions on the tag chips come from the same fetch, and the platforms a task can run on.
//
// A platform is filtered like a tag but is not one: it says where a solution runs rather than what
// it is about, and every task would be alike on the commonest of them. So it is kept apart in the
// index, and drawn apart in the controls, while a chosen one narrows the list as a tag does.
//
// Everything here is plain data and plain functions: no framework, no fetch of its own beyond the
// two below, so the filtering and the routing can be tested directly.

export const CORPUS_ROOT = 'https://raw.githubusercontent.com/ghul-lang/ghul-rosetta-code/main/'

// raw.githubusercontent.com answers cross-origin requests and, unlike the GitHub API, is not held
// to 60 requests an hour. The playground fetches the same sources from it. The index is generated
// from main and published on a branch of its own, holding nothing else.
export const INDEX_URL = 'https://raw.githubusercontent.com/ghul-lang/ghul-rosetta-code/index/index.json'

// The version of index.json this code reads. A later one is read anyway - the fields used here
// have only ever been added to - but a mismatch is worth saying out loud rather than failing
// somewhere further in.
export const INDEX_VERSION = 1

// The slug a page address names, or null for the section's own page. `/rosetta/` is the section;
// anything under it is a task, whether or not one exists by that name.
export function taskSlugFromPath(pathname) {
  const match = /^\/rosetta\/([^/?#]+)\/?$/.exec(pathname ?? '')

  if (!match) return null

  const slug = decodeURIComponent(match[1])

  // The section's own document, reached by its file name rather than its directory.
  return slug === 'index' || slug === 'index.html' ? null : slug
}

// A part's example name, which is also how the playground addresses it: the task's slug, and the
// part's name where a task is solved more than one way.
export function exampleName(id) {
  return `rosetta-${id.replace(/\//g, '-')}`
}

// One task as the explorer shows it. The parts carry where their source lives rather than the
// source itself, which is fetched when a part is shown.
function task(raw) {
  return {
    slug: raw.slug,
    title: raw.title,
    url: raw.url,
    tags: raw.tags ?? [],
    runsOn: raw.runs_on ?? [],
    interest: raw.interest ?? 1,
    playground: raw.playground !== false,
    input: raw.input === true,
    images: (raw.images ?? []).length > 0,
    lines: raw.lines ?? 0,
    // The solution in the repository has changed since its section was last posted to the wiki.
    aheadOfWiki: raw.ahead_of_wiki === true,
    parts: (raw.parts ?? []).map(part => ({
      id: part.id,
      name: exampleName(part.id),
      heading: part.heading,
      playground: part.playground !== false,
      source: `${CORPUS_ROOT}${part.source}`,
      // Why a solution cannot run here, where it cannot: one line, written beside the solution.
      unsupported: `${CORPUS_ROOT}${part.source.replace(/\/[^/]*$/, '')}/playground-unsupported`,
    })),
  }
}

export function corpusFromIndex(index) {
  return {
    tags: index.tags ?? {},
    platforms: index.platforms ?? {},
    tasks: (index.tasks ?? []).map(task),
  }
}

export function taskBySlug(corpus, slug) {
  return corpus.tasks.find(candidate => candidate.slug === slug) ?? null
}

// Title and tags, because those are the two things a reader knows about a task they are looking
// for. Every word has to match something, so two words narrow rather than widen. A chosen tag can
// be a platform too, and every one chosen has to hold, so choosing both platforms leaves the tasks
// that run on both.
export function matching(corpus, { query = '', tags = [], runnableOnly = false } = {}) {
  const wanted = query.trim().toLowerCase().split(/\s+/).filter(word => word !== '')

  return corpus.tasks.filter(candidate => {
    if (runnableOnly && !candidate.playground) return false

    for (const tag of tags) {
      if (!candidate.tags.includes(tag) && !candidate.runsOn.includes(tag)) return false
    }

    const text = `${candidate.title} ${candidate.tags.join(' ')} ${candidate.runsOn.join(' ')}`.toLowerCase()

    return wanted.every(word => text.includes(word))
  })
}

// Only the tags in use, most used first: a chip that matches nothing is noise.
export function tagCounts(corpus) {
  const counts = new Map()

  for (const candidate of corpus.tasks) {
    for (const tag of candidate.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

// The platforms the index names, in its order, each with how many tasks run on it: the choices a
// reader has for where a solution runs.
export function platformCounts(corpus) {
  return Object.keys(corpus.platforms).map(platform => [
    platform,
    corpus.tasks.filter(candidate => candidate.runsOn.includes(platform)).length,
  ])
}

// How a platform is written for a reader: the index names them as they are in its data.
export function platformLabel(platform) {
  return platform === 'dotnet' ? '.NET' : platform
}

// Interest squared: a 5 is drawn twenty-five times as often as a 1, without a 1 being impossible.
export function draw(tasks, except, random = Math.random) {
  const pool = tasks.length > 1 ? tasks.filter(candidate => candidate.slug !== except) : tasks

  if (pool.length === 0) return null

  const total = pool.reduce((sum, candidate) => sum + candidate.interest ** 2, 0)

  let at = random() * total

  for (const candidate of pool) {
    at -= candidate.interest ** 2

    if (at <= 0) return candidate
  }

  return pool[pool.length - 1]
}

// The address of a view: the task where one is shown, and the filter otherwise, so that a search
// or a set of tags is a link somebody can send. Task pages left the site's own search when they
// stopped being pages, and this is what takes their place.
export function addressOf({ slug = null, query = '', tags = [] } = {}) {
  if (slug) return `/rosetta/${slug}`

  const search = new URLSearchParams()

  if (query.trim() !== '') search.set('q', query.trim())
  if (tags.length > 0) search.set('tags', [...tags].sort().join(','))

  const rest = search.toString()

  return rest === '' ? '/rosetta/' : `/rosetta/?${rest}`
}

export function filterFromSearch(search) {
  const parameters = new URLSearchParams(search ?? '')

  return {
    query: parameters.get('q') ?? '',
    tags: (parameters.get('tags') ?? '').split(',').filter(tag => tag !== ''),
  }
}

// One fetch per session: the corpus is a quarter of a megabyte and does not change while somebody
// is reading. A failed fetch is not remembered, so the reader can try again.
let pending = null

export async function loadCorpus(fetchImpl = fetch) {
  if (!pending) {
    pending = (async () => {
      const response = await fetchImpl(INDEX_URL, { signal: AbortSignal.timeout(15000) })

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

      return corpusFromIndex(await response.json())
    })()

    pending.catch(() => { pending = null })
  }

  return pending
}
