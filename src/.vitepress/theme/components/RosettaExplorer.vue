<script setup>
import { ref, computed, shallowRef, watch, onMounted, nextTick } from 'vue'
import GhulExample from './GhulExample.vue'
import PlaygroundFrame from './PlaygroundFrame.vue'
import RosettaControls from './RosettaControls.vue'
import RosettaOnward from './RosettaOnward.vue'
import RosettaList from './RosettaList.vue'
import { countEvent } from '../events'
import { tokenise } from '../rosetta-highlight'
import { shownSlug, shownFilter, showAt, replaceAt } from '../rosetta-route'
import { corpus, query, chosen, toggleTag } from '../rosetta-filter'
import { loadCorpus, taskBySlug, matching, draw, addressOf, filterFromSearch, platformLabel } from '../rosetta-corpus'

// The whole Rosetta Code section. The section's own address is the corpus, searchable and
// filterable; a task's address, /rosetta/<slug>, shows that task whole and ready to run, with the
// filter beside it.
//
// Nothing here is copied into the site. The corpus is read from ghul-rosetta-code when the page
// opens and each solution's source when its task is shown, so a task solved there this morning is
// here this morning, and the site stops growing a page per task. What that costs is a section that
// needs GitHub to be reachable, which is what the failure state below is for.

// The corpus and the filter live in rosetta-filter.js, because the page's aside draws the same
// controls on a wide screen.
const failure = ref(null)

const shown = computed(() =>
  corpus.value && shownSlug.value ? taskBySlug(corpus.value, shownSlug.value) : null)

// The section itself, with no task: the filter and its results across the page. Never true
// before the corpus has loaded, so the prerender and the first client render agree - a class the
// prerender wrote that the client did not would stay on the element unpatched.
const browsing = computed(() => corpus.value !== null && shownSlug.value === null)

const missing = computed(() =>
  corpus.value !== null && shownSlug.value !== null && shown.value === null)

const matches = computed(() => corpus.value
  ? matching(corpus.value, { query: query.value, tags: [...chosen.value], runnableOnly: true })
  : [])

// --- the shown task's source -------------------------------------------------------------------

// Each part's source and its syntax colour, in the shape <GhulExample> takes: the same fields the
// build writes into an example artifact, minus the hovers and diagnostics only a compile produces
// and the recorded output `run-to-see` would hide anyway.
const parts = shallowRef([])
const partsFailure = ref(null)

async function text(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

  return response.text()
}

async function part(entry) {
  const code = (await text(entry.source)).replace(/\n+$/, '')

  return {
    ...entry,
    data: {
      name: entry.name,
      code,
      fullSource: code,
      tokens: await tokenise(code),
      output: '',
      images: [],
      hovers: [],
      diagnostics: [],
      playground: entry.playground,
      playgroundPath: entry.id,
    },
    // Only where it will not run: one line saying what it needs that a browser cannot give it.
    reason: entry.playground ? null : await text(entry.unsupported).then(
      line => line.trim(), () => null),
  }
}

// The part shown, one at a time: framing every part would start a run per part against a service
// that admits six at once. The first runnable one on arrival, and any other when chosen from the
// strip above the panel, which replaces the panel where it stands.
const selected = ref(null)

watch(parts, list => {
  selected.value = (list.find(entry => entry.playground) ?? list[0])?.id ?? null
})

const current = computed(() => parts.value.find(entry => entry.id === selected.value) ?? null)

const framed = computed(() => current.value?.playground ? current.value : null)

// The section's own introduction sits above the explorer, in the page's markdown, and it is what a
// reader of the section reads first. A task's page is the task: the introduction stands down
// whenever one is shown, and comes back on the section itself.
const root = ref(null)

function introduction() {
  const items = []

  for (let node = root.value?.parentElement?.firstElementChild; node && node !== root.value;
       node = node.nextElementSibling) {
    items.push(node)
  }

  return items
}

function showIntroduction(shown) {
  for (const node of introduction()) node.style.display = shown ? '' : 'none'
}

watch(shownSlug, slug => showIntroduction(slug === null))

// The task whose parts `parts` holds, so a fetch that finishes after the reader has moved on is
// dropped rather than shown under the wrong heading.
let loading = null

watch(shown, async task => {
  loading = task?.slug ?? null
  parts.value = []
  partsFailure.value = null

  if (!task) return

  try {
    const loaded = await Promise.all(task.parts.map(part))

    if (loading === task.slug) parts.value = loaded
  } catch (error) {
    if (loading === task.slug) partsFailure.value = error.message
  }
}, { immediate: true })

// Each task used to be a page, and a page was counted. They are shown in place now, so a task
// chosen on the page is counted here, or the section reads as one visit however many tasks
// somebody works through. The task a reader arrived at is the page load's own count, which
// records its address rather than the section's.
watch([() => shownSlug.value, shown], ([slug, task], previous) => {
  if (!slug) return

  document.title = `${task?.title ?? 'Rosetta Code'} | ghūl programming language`

  if (slug !== previous?.[0]) {
    if (previous) window.goatcounter?.count?.()

    // The task as well as the pageview: every task answers from this one page,
    // and the slug is the only thing that says which one a reader was shown.
    if (slug) countEvent(`rosetta-open/${slug}`, 'rosetta task opened')
  }
}, { immediate: true })

// --- choosing ----------------------------------------------------------------------------------

// A task drawn at random from the ones the filter leaves, weighted towards the ones worth a
// stranger's time. The address names it, so what is on the page is what a reader can link to.
function another() {
  const next = draw(matches.value, shown.value?.slug)

  if (next) {
    showAt(addressOf({ slug: next.slug }))
    reveal()
  }
}

function show(task) {
  showAt(addressOf({ slug: task.slug }))
  reveal()
}

// A task is chosen from a list the reader may have scrolled a long way down, and what it shows is
// at the top of the page: without this the task loads where nobody can see it. Once now, and again
// when the page has been redrawn for it, since the page is shorter by then.
function reveal() {
  window.scrollTo({ top: 0, behavior: 'instant' })

  nextTick(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}

// Two or three tasks sharing a tag with this one, so somebody who liked what they just watched has
// somewhere to go that is not the list of nine hundred. Runnable only: an onward path to something
// that cannot run here would undo the point of offering it.
const alike = computed(() => {
  const task = shown.value

  if (!task || !corpus.value) return []

  const tags = new Set(task.tags ?? [])

  return corpus.value.tasks
    .filter(other => other.slug !== task.slug
      && other.playground
      && (other.tags ?? []).some(tag => tags.has(tag)))
    .sort((a, b) =>
      (b.tags ?? []).filter(tag => tags.has(tag)).length - (a.tags ?? []).filter(tag => tags.has(tag)).length
      || (b.interest ?? 0) - (a.interest ?? 0)
      || a.title.localeCompare(b.title))
    .slice(0, 3)
})

// The onward controls are counted apart from the list's, because where a reader was when they took
// one is the thing worth knowing: they sit under the result, where somebody who has just watched a
// program run is looking.
function showOnward(task) {
  countEvent(`rosetta-more/tag/${alike.value.findIndex(other => other.slug === task.slug)}`,
    'onward to a like task')

  show(task)
}

function anotherOnward() {
  countEvent('rosetta-more/another/0', 'onward to another task')

  another()
}

onMounted(async () => {
  showIntroduction(shownSlug.value === null)

  // The address of a task reached from outside was handed to the router as the section's, so that
  // it had a page to load. Put it back, now that there is an explorer to show the task.
  if (shownSlug.value) replaceAt(addressOf({ slug: shownSlug.value }))

  const filter = filterFromSearch(shownFilter.value || location.search)

  query.value = filter.query
  chosen.value = new Set(filter.tags)

  try {
    corpus.value = await loadCorpus()
  } catch (error) {
    failure.value = error.message
  }
})

// The filter is part of the address while the section itself is shown, so a search or a set of
// tags is a link. Replaced rather than pushed: typing a word is not a place to go back to.
watch([query, chosen], () => {
  if (shownSlug.value) return

  replaceAt(addressOf({ query: query.value, tags: [...chosen.value] }))
})

// Following a link back to the section restores the filter that link carried.
watch(shownFilter, search => {
  if (shownSlug.value) return

  const filter = filterFromSearch(search)

  if (filter.query !== query.value) query.value = filter.query

  if (filter.tags.join(',') !== [...chosen.value].sort().join(',')) {
    chosen.value = new Set(filter.tags)
  }
})

// The section, reached from beside a task: the filter as it stands, across the page.
const browseAddress = computed(() => addressOf({ query: query.value, tags: [...chosen.value] }))

function browse() {
  showAt(browseAddress.value)
}
</script>

<template>
  <div ref="root" class="rosetta-explorer" :class="{ 'is-browsing': browsing }">
    <p v-if="failure" class="rosetta-failure">
      The solutions are read from
      <a href="https://github.com/ghul-lang/ghul-rosetta-code" target="_blank" rel="noreferrer">
        ghul-rosetta-code</a>
      when this page opens, and that did not answer ({{ failure }}). Reloading is worth a try.
    </p>

    <p v-else-if="!corpus" class="rosetta-loading">reading the solutions ...</p>

    <template v-else>
      <p v-if="missing" class="rosetta-failure">
        There is no task called <code>{{ shownSlug }}</code>. Here is everything there is.
      </p>

      <section v-if="shown" class="rosetta-featured">
        <header>
          <h2 :id="shown.slug">{{ shown.title }}</h2>

          <a class="rosetta-wiki" :href="shown.url" target="_blank" rel="noreferrer">on Rosetta Code</a>
        </header>

        <p v-if="shown.aheadOfWiki" class="rosetta-newer">The solution here is newer than the one on Rosetta Code.</p>

        <p class="rosetta-featured-tags">
          <button
            v-for="tag in shown.tags"
            :key="tag"
            type="button"
            class="rosetta-tag"
            :class="{ 'is-chosen': chosen.has(tag) }"
            :title="corpus.tags[tag]"
            @click="toggleTag(tag)"
          >{{ tag }}</button>

          <button
            v-for="platform in shown.runsOn"
            :key="platform"
            type="button"
            class="rosetta-tag"
            :class="{ 'is-chosen': chosen.has(platform) }"
            :title="corpus.platforms[platform]"
            @click="toggleTag(platform)"
          >{{ platformLabel(platform) }}</button>
        </p>

        <p v-if="partsFailure" class="rosetta-failure">
          The solution itself did not load ({{ partsFailure }}).
        </p>

        <p v-else-if="parts.length === 0" class="rosetta-loading">reading the solution ...</p>

        <!-- A task solved more than one way: the ways, one of them shown below. -->
        <div v-if="parts.length > 1" class="rosetta-parts" role="tablist" aria-label="ways of solving it">
          <button
            v-for="(entry, at) in parts"
            :key="entry.name"
            type="button"
            role="tab"
            class="rosetta-part"
            :aria-selected="entry === current"
            @click="selected = entry.id"
          >{{ entry.heading ?? `part ${at + 1}` }}</button>
        </div>

        <template v-if="current">
          <p v-if="current.reason" class="rosetta-unsupported">{{ current.reason }}</p>

          <!-- The playground itself, as a panel on the page; keyed on the part, so choosing
               another loads its page in place. A part that cannot run in a browser is shown as
               it is recorded. -->
          <PlaygroundFrame
            v-if="framed"
            :key="framed.id"
            :path="`rosetta-code/${framed.id}`"
            host="rosetta-task-page"
            :title="`${shown.title} in the playground`"
          />

          <GhulExample v-else :key="current.id" :name="current.name" :data="current.data" />
        </template>

        <!-- Under the result, where somebody who has just watched a program run is looking - on a
             screen without an aside. On a wide one the same paths sit beside the playground. -->
        <RosettaOnward
          class="rosetta-inline"
          :alike="alike"
          @another="anotherOnward"
          @show="showOnward"
        />
      </section>

      <!-- The same controls and list the aside shows on a wide screen, for a screen without one. -->
      <RosettaControls class="rosetta-inline" />

      <RosettaList class="rosetta-inline" :matches="matches" :current="shown?.slug" @show="show" />

      <!-- Beside the playground on a wide screen, where the column is the one place a reader can
           see without scrolling past a panel as tall as the window: where to go next first, then
           the filter, with the tasks it leaves listed under it and scrolling within the column. -->
      <Teleport v-if="shown" defer to="#rosetta-aside">
        <RosettaOnward
          stacked
          :alike="alike"
          @another="anotherOnward"
          @show="showOnward"
        />

        <RosettaControls stacked />

        <p class="rosetta-browse">
          <a :href="browseAddress" @click.prevent="browse">all tasks</a>
        </p>

        <RosettaList stacked :matches="matches" :current="shown?.slug" @show="show" />
      </Teleport>
    </template>
  </div>
</template>
<style scoped>
.rosetta-loading,
.rosetta-failure {
  margin: 1.5rem 0;
  color: var(--vp-c-text-2);
}

/* Why a solution is here to read rather than run, in the words written beside it. */
.rosetta-unsupported {
  margin: 0.5rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.rosetta-parts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 0.75rem;
}

.rosetta-part {
  padding: 0.2rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}

.rosetta-part:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.rosetta-part[aria-selected="true"] {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

/* The aside shows at 1280px and up (the site's own breakpoint), and carries these from there -
   except on the section's own page, which has no task and so nothing in the aside. */
@media (min-width: 1280px) {
  .rosetta-explorer:not(.is-browsing) .rosetta-inline {
    display: none;
  }
}

.rosetta-browse {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.8rem;
}

.rosetta-newer {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.rosetta-featured-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.rosetta-tag {
  padding: 0.1rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  line-height: 1.5;
}

.rosetta-tag span {
  color: var(--vp-c-text-3);
}

.rosetta-tag:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.rosetta-tag.is-chosen {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.rosetta-featured {
  margin-top: 1rem;
  /* Clear of the site's fixed header when a task chosen from the list is scrolled to. */
  scroll-margin-top: calc(var(--vp-nav-height) + 1rem);
}

.rosetta-featured header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.rosetta-featured h2 {
  flex: 1;
  margin: 0;
  padding: 0;
  border: none;
}

.rosetta-wiki {
  font-size: 0.85rem;
  font-weight: 400;
  white-space: nowrap;
}

.rosetta-featured-tags {
  margin: 0.5rem 0 1rem;
}


</style>
