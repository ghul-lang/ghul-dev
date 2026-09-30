<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import DiagnosticIcon from './DiagnosticIcon.vue'
import {
  PLAYGROUND_ORIGIN, PLAYGROUND_BASE, CHANNEL, playgroundAvailable, currentTheme, watchTheme,
  editingExample, retainedEdit, retainEdit
} from '../playground'
import { countEvent } from '../events'

// Renders a verified ghūl example from its generated artifact: the visible
// (sliced, de-indented) code, syntax-coloured and with VSCE-style hover
// tooltips, IDE-style red/yellow squiggles under any compiler diagnostics,
// and — when the example produced output or diagnostics — a panel below.
//
// The artifact carries plain `code`, `hovers` and `diagnostics`; the
// build-time ghul-example-data Vite plugin folds in syntax-colour `tokens`
// for the code and each hover's description. Colour tokens, hover spans and
// diagnostic spans are all character ranges — merged here into one run of
// spans per line.
// `data` is the example's build-time artifact, imported per page and passed
// in by the ghul-example-page-split plugin so each artifact rides in the
// chunk of the one page that uses it rather than a folder-wide glob.
// `signature` marks a reference-entry card: a declaration-only stub with no
// runnable body (see the runtime-library page), rather than code the reader
// would copy and run. It suppresses the copy button and the hidden-scaffold
// ellipsis rows - neither makes sense when there's no full source worth
// copying.
const props = defineProps({
  name: { type: String, required: true },
  data: { type: Object, default: null },
  signature: { type: Boolean, default: false },
  // Show nothing the example is recorded as producing: its output and pictures
  // appear only once the reader runs it. For a page of programs to try, where
  // output that is there before anything has run reads as a run that happened.
  runToSee: { type: Boolean, default: false },
})

const example = computed(() => props.data)

// Set by the example tool on artifacts built from `snippets/` rather than
// `examples/`: illustrative ghūl that was never compiled and cannot be.
const isSnippet = computed(() => example.value?.snippet === true)

const diagnostics = computed(() => example.value?.diagnostics ?? [])
const semanticTokens = computed(() => example.value?.semanticTokens ?? [])
const inlayHints = computed(() => example.value?.inlayHints ?? [])

// The compiler reports some diagnostics over a whole multi-line declaration.
// A wavy underline spanning many lines is noisy, so a multi-line diagnostic
// squiggle is clamped to its first line (start column to end of line); the
// panel and hover still carry the full diagnostic. Single-line diagnostics
// are underlined exactly.
const squiggleDiagnostics = computed(() =>
  diagnostics.value.map(d =>
    d.endLine > d.startLine
      ? { ...d, endLine: d.startLine, endColumn: 100000 }
      : d))

const lines = computed(() => {
  const ex = example.value
  if (!ex) return []

  const tokenLines = ex.tokens
    ?? ex.code.split('\n').map(text => [{ text, style: '' }])

  return tokenLines.map((tokens, i) =>
    mergeLine(tokens, i + 1, ex.hovers ?? [], squiggleDiagnostics.value, semanticTokens.value, inlayHints.value))
})

// Merge one line's colour tokens with the hovers, diagnostics and semantic
// tokens that cover it, producing runs of text that each carry a colour
// style and, optionally, a hover, a diagnostic and a semantic-token class.
//
// When a character is covered by a semantic token the TextMate-derived
// Shiki colour is dropped — the semantic class colours it via CSS — so an
// identifier reliably reflects what the compiler resolved it to (`class`,
// `method`, `property`, `parameter`, …) rather than the regex-based guess.
function mergeLine(colourTokens, lineNumber, hovers, diags, semantic, inlays) {
  const chars = []
  const styles = []
  for (const token of colourTokens) {
    for (const ch of token.text) {
      chars.push(ch)
      styles.push(token.style || '')
    }
  }
  const length = chars.length

  // For each 1-based column, the innermost (shortest) span covering it.
  const hoverAt = pickSpans(hovers, lineNumber, length)
  const diagAt = pickSpans(diags, lineNumber, length)
  const semanticAt = pickSpans(semantic, lineNumber, length)

  // Narrowing inlay hints anchored on this line, keyed by the 1-based column
  // they render before. An inlay renders as dimmed ghost text immediately
  // before the character at its column (clamped to the line's end).
  const inlayByColumn = new Map()
  for (const hint of inlays) {
    if (hint.line !== lineNumber) continue
    const at = Math.min(Math.max(hint.column, 1), length + 1)
    if (!inlayByColumn.has(at)) inlayByColumn.set(at, [])
    inlayByColumn.get(at).push(hint)
  }

  // Group consecutive characters sharing the same colour, hover, diagnostic
  // and semantic token — breaking a run wherever an inlay must be spliced in —
  // and interleave the inlay markers between segments.
  const items = []
  const flushInlays = column1 => {
    const hints = inlayByColumn.get(column1)
    if (hints) for (const hint of hints) items.push({ inlay: hint })
  }

  flushInlays(1)
  let column = 0
  while (column < length) {
    const style = styles[column]
    const hover = hoverAt[column]
    const diagnostic = diagAt[column]
    const sem = semanticAt[column]
    let end = column + 1
    while (
      end < length &&
      styles[end] === style &&
      hoverAt[end] === hover &&
      diagAt[end] === diagnostic &&
      semanticAt[end] === sem &&
      !inlayByColumn.has(end + 1)
    ) end++
    items.push({
      text: chars.slice(column, end).join(''),
      // A semantic token's CSS class supplies the colour; drop the Shiki
      // style on that range so the class isn't fighting an inline `color`.
      style: sem ? null : style,
      hover,
      diagnostic,
      semantic: sem,
    })
    column = end
    flushInlays(column + 1)
  }
  return items
}

// For one line, return a per-column array of the innermost span covering
// each column. Spans are {startLine, startColumn, endLine, endColumn}.
function pickSpans(spans, lineNumber, length) {
  const at = new Array(length).fill(null)
  const width = new Array(length).fill(Infinity)

  for (const span of spans) {
    if (span.startLine > lineNumber || span.endLine < lineNumber) continue

    const from = span.startLine < lineNumber ? 1 : span.startColumn
    const to = span.endLine > lineNumber ? length : span.endColumn
    const size = (span.endLine - span.startLine) * 100000
      + (span.endColumn - span.startColumn)

    for (let column = from; column <= to && column <= length; column++) {
      if (size < width[column - 1]) {
        width[column - 1] = size
        at[column - 1] = span
      }
    }
  }
  return at
}

// A single shared tooltip, teleported to <body> and positioned fixed, so it
// is never clipped by the code box's overflow. A hover tooltip shows the
// signature rendered ghūl-coloured (over one or more pretty-printed lines,
// including a narrowed variable's narrowed-to line) with the classifier in
// italics beneath; a diagnostic tooltip shows the plain diagnostic message;
// an inlay tooltip shows the narrowing hint's plain explanation.
const tip = ref({
  show: false,
  diagText: '',
  severity: '',
  signatureLines: [],
  kindLabel: '',
  detailText: '',
  style: {},
})

function place(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  // Keep in step with the tooltip's CSS max-width.
  const maxWidth = 640

  const style = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - maxWidth - 16)) + 'px'
  }
  if (rect.bottom + 220 > window.innerHeight) {
    style.bottom = (window.innerHeight - rect.top + 6) + 'px'
  } else {
    style.top = (rect.bottom + 6) + 'px'
  }
  return style
}

// Like VSCode, a token carrying both a diagnostic and hover info shows
// both — the diagnostic on top, the signature and classifier below.
function onEnter(event, segment) {
  if (!segment.diagnostic && !segment.hover) {
    return
  }

  tip.value = {
    show: true,
    diagText: segment.diagnostic?.message ?? '',
    severity: segment.diagnostic?.severity ?? '',
    signatureLines: segment.hover?.signatureLines ?? [],
    kindLabel: segment.hover?.kindLabel ?? '',
    detailText: '',
    style: place(event),
  }
}

function onLeave(segment) {
  if (segment.hover || segment.diagnostic) {
    tip.value = { ...tip.value, show: false }
  }
}

// A narrowing inlay marker: on hover, show its plain explanation — the same
// text VSCode surfaces behind the inlay hint.
function onInlayEnter(event, inlay) {
  tip.value = {
    show: true,
    diagText: '',
    severity: '',
    signatureLines: [],
    kindLabel: '',
    detailText: inlay.detail ?? '',
    style: place(event),
  }
}

function onInlayLeave() {
  tip.value = { ...tip.value, show: false }
}

// record that a reader did something with this particular example.
//
// examples are not pages - a reference page carries over a hundred of them - so
// a pageview says only which page was open, and nothing about which example was
// worth using. These are recorded as GoatCounter events instead, keyed on the
// example's name, so the question "which examples do people actually run?" has
// an answer.
//
// only acts the reader chose: running, editing, copying. Scrolling an example
// into view is not one of them, and counting that would mostly measure how long
// the page is. Silent and optional by design - `count` is absent whenever the
// analytics script did not load, which includes every local build.
//
// A docs code example counts as the inline mini-IDE, under the host
// docs-code-example: opening its editor is an open and running it a run, as in
// the full mini-IDE. Copying is the code block's own and no part of the editor.
const RECORDED = {
  edit: name => `mini-ide-open/docs-code-example/${name}`,
  run: name => `mini-ide-run/docs-code-example/manual/${name}`,
  copy: name => `code-copy/${name}`,
}

function record(action) {
  const path = RECORDED[action](props.name)

  countEvent(path, path.slice(0, path.indexOf('/')))
}

// How the run ended, one event per run, named by outcome rather than by example:
// which example was run is already the run event's business, and a path per
// example per outcome would multiply the two for nothing.
function recordResult(state, detail) {
  if (state === 'done') countEvent(`mini-ide-result/docs-code-example/${detail?.threw ? 'threw' : 'ok'}`, 'mini-ide-result')
  else if (state === 'failed') countEvent(`mini-ide-result/docs-code-example/${detail?.timedOut ? 'timeout' : detail?.tooBig ? 'too-big' : 'compile-error'}`, 'mini-ide-result')
  else if (state === 'error') countEvent('mini-ide-result/docs-code-example/error', 'mini-ide-result')
}

const copied = ref(false)

function copy() {
  if (!example.value) return
  // `fullSource` is the original example file with the `// >>>` / `// <<<`
  // region markers stripped — what the user actually wants to paste into
  // their own project. `code` is the slice displayed on the page.
  navigator.clipboard?.writeText(
    retainedEdit(props.name) ?? example.value.fullSource ?? example.value.code)
  copied.value = true
  record('copy')
  setTimeout(() => { copied.value = false }, 2000)
}

// `hiddenBefore` / `hiddenAfter` come from the example artifact and flag
// whether non-blank scaffold exists outside the displayed slice. A faint
// ellipsis row marks the corresponding edge so the reader can tell the
// code is part of a larger source. Seeing what is behind the ellipsis means
// opening the example in the editor, which shows the whole source and can
// run it - there was once a button that swapped the slice for `fullSource`
// as plain text, and the editor does the same job and more.
const hiddenBefore = computed(() => !props.signature && example.value?.hiddenBefore === true)
const hiddenAfter = computed(() => !props.signature && example.value?.hiddenAfter === true)
const hiddenGaps = computed(() => {
  if (props.signature) return new Set()
  const raw = example.value?.hiddenGapsAfterLine
  return Array.isArray(raw) ? new Set(raw) : new Set()
})
// Interleave the visible-code lines with faint ellipsis rows wherever
// the artifact says scaffold is hidden. Edges follow the
// hiddenBefore/hiddenAfter content-based rule; gaps between visible
// regions are driven by hiddenGapsAfterLine and are present whenever
// the author wrote a // <<< / // >>> pair, regardless of content.
const displayItems = computed(() => {
  const items = []
  if (hiddenBefore.value) items.push({ type: 'ellipsis', key: 'top' })
  const gaps = hiddenGaps.value
  lines.value.forEach((segments, i) => {
    items.push({ type: 'line', segments, key: 'l' + i })
    if (gaps.has(i + 1)) items.push({ type: 'ellipsis', key: 'g' + (i + 1) })
  })
  if (hiddenAfter.value) items.push({ type: 'ellipsis', key: 'bot' })
  return items
})

// The panel below the code can be toggled fully collapsed or expanded. It
// defaults to expanded for a diagnostic example (the diagnostics are the
// point) or one or two lines of output, collapsed for longer output.
function isShortOutput(output) {
  if (!output) return false
  return output.replace(/\n+$/, '').split('\n').length <= 2
}

const outputExpanded = ref(
  diagnostics.value.length > 0 || isShortOutput(props.runToSee ? '' : example.value?.output)
)

function toggleOutput() {
  outputExpanded.value = !outputExpanded.value
}

const panelLabel = computed(() =>
  diagnostics.value.length > 0 && !example.value?.output ? 'diagnostics' : 'output')

// --- editing in the playground ---------------------------------------------
//
// The static example above is rendered from a build-time artifact and is
// complete on its own: code, colouring, hovers, diagnostics and output. Editing
// is strictly additional, so none of what follows may affect the page when the
// back end is absent - in that case no pencil appears and this is all inert.
//
// Editing swaps the code block for an iframe served from the playground's own
// origin. The frame owns only the editor; its output and diagnostics are posted
// back and shown in the panel this component already has, rather than the frame
// growing a second one that would have to be styled to match.

const canEdit = ref(false)
const editing = ref(false)
const frame = ref(null)
const frameHeight = ref(0)
const frameReady = ref(false)
const analyser = ref('connecting')
const runState = ref(null)
const liveOutput = ref('')
const liveDiagnostics = ref([])

// What a running program drew, as { name, url } with a data URL each, and
// whether it is waiting for a line. The frame owns only the editor, so both
// are rendered here, in the same panel as the text the program writes.
const liveImages = ref([])
const inputWanted = ref(false)
const inputLine = ref('')

function sendInput() {
  post('input', { line: inputLine.value })
  inputLine.value = ''
  inputWanted.value = false
}

// No line at all: the program sees the end of its input.
function endInput() {
  post('input', {})
  inputWanted.value = false
}

// filling the window rather than the article column. The site's content is a
// narrow centre strip with sidebars either side, which is far less room than a
// reader editing code actually has. Distinct from `filling`, which gives an
// example's hidden scaffolding.
const filling = ref(false)

function toggleFilling() {
  filling.value = !filling.value
  document.body.classList.toggle('ghul-example-expanded-open', filling.value)
}

function onKey(event) {
  if (event.key === 'Escape' && filling.value) toggleFilling()
}

// true once this example has been edited, so the copy button offers the
// reader's version rather than the original and the pencil says as much.
const edited = ref(retainedEdit(props.name) !== null)

// A signature card is a declaration stub with no runnable body, so there is
// nothing to edit or run. A snippet is a syntax skeleton written with
// placeholders (`if condition then`, `catch e: SomeExceptionType`) rather
// than a program, so opening one in the editor would only produce a wall of
// errors about the placeholders.
if (!props.signature && !isSnippet.value && example.value?.playground !== false) {
  playgroundAvailable().then(available => { canEdit.value = available })
}

const embedUrl = `${PLAYGROUND_BASE}embed.html`

// What the panel shows: the recorded output of the verified example, or what
// the reader's own edit produced.
const shownDiagnostics = computed(() => editing.value ? liveDiagnostics.value : diagnostics.value)
const recordedOutput = computed(() => props.runToSee ? '' : example.value?.output ?? '')
const recordedImages = computed(() => props.runToSee ? [] : example.value?.images ?? [])

const shownOutput = computed(() => editing.value ? liveOutput.value : recordedOutput.value)

// The pictures follow the same rule: what the example is recorded as drawing,
// until the reader runs their own version.
const shownImages = computed(() => editing.value ? liveImages.value : recordedImages.value)

const runLabel = computed(() => {
  if (!editing.value) return null

  return runState.value === 'compiling' ? 'compiling ...'
    : runState.value === 'starting runtime' ? 'starting the runtime ...'
      : runState.value === 'running' ? 'running ...'
        : null
})

function post(type, payload = {}) {
  frame.value?.contentWindow?.postMessage(
    { channel: CHANNEL, type, ...payload }, PLAYGROUND_ORIGIN)
}

function onFrameMessage(event) {
  if (event.origin !== PLAYGROUND_ORIGIN) return
  if (event.data?.channel !== CHANNEL) return
  if (event.source !== frame.value?.contentWindow) return

  const message = event.data

  // postMessage is not queued, so the source cannot be sent until the frame
  // says it is listening.
  if (message.type === 'loaded') {
    post('init', {
      source: retainedEdit(props.name)
        ?? example.value?.fullSource ?? example.value?.code ?? '',
      theme: currentTheme()
    })
    return
  }

  if (message.type === 'ready') { frameReady.value = true; return }

  // Escape pressed with the editor focused: the key never reaches this page,
  // so the frame forwards it.
  if (message.type === 'escape') {
    if (filling.value) toggleFilling()
    return
  }

  if (message.type === 'source') {
    retainEdit(props.name, message.source)
    edited.value = true
    return
  }
  if (message.type === 'height') { frameHeight.value = message.height; return }
  if (message.type === 'analyser') { analyser.value = message.state; return }
  if (message.type === 'output') { liveOutput.value = message.text ?? ''; return }
  if (message.type === 'images') { liveImages.value = message.images ?? []; return }
  if (message.type === 'input-wanted') {
    inputWanted.value = true
    outputExpanded.value = true
    return
  }
  if (message.type === 'diagnostics') {
    // The compiler says `warn`; the artifact and the icon component both say
    // `warning`. Normalise here rather than teaching the icon a second spelling.
    liveDiagnostics.value = (message.diagnostics ?? []).map(d => ({
      ...d,
      severity: d.severity === 'warn' ? 'warning' : d.severity
    }))
    return
  }

  if (message.type === 'status') {
    recordResult(message.state, message.detail)

    runState.value = message.state
    if (message.state !== 'running') inputWanted.value = false
    if (message.state === 'done' || message.state === 'failed' || message.state === 'error') {
      // Leave the last state visible only while it is interesting.
      setTimeout(() => { if (runState.value === message.state) runState.value = null }, 1500)
    }
  }
}

let stopWatchingTheme = null

function startEditing() {
  record('edit')

  window.addEventListener('keydown', onKey)

  // Claiming the page-wide slot closes whichever example held it.
  editingExample.value = props.name

  editing.value = true
  outputExpanded.value = true

  // Start from the recorded output, so the panel is not empty before the
  // reader has run anything.
  liveOutput.value = recordedOutput.value
  liveImages.value = recordedImages.value
  liveDiagnostics.value = diagnostics.value

  window.addEventListener('message', onFrameMessage)
  stopWatchingTheme = watchTheme(theme => post('theme', { theme }))
}

function stopEditing() {
  window.removeEventListener('keydown', onKey)

  if (filling.value) toggleFilling()

  if (editingExample.value === props.name) editingExample.value = null

  editing.value = false
  frameReady.value = false
  frameHeight.value = 0
  runState.value = null
  liveImages.value = []
  inputWanted.value = false

  window.removeEventListener('message', onFrameMessage)
  stopWatchingTheme?.()
  stopWatchingTheme = null
}

function run() {
  record('run')
  post('run')
}

// Another example taking the slot closes this one, which also releases its
// analyser session rather than leaving it held by a hidden editor.
watch(editingExample, name => {
  if (editing.value && name !== props.name) stopEditing()
})

onBeforeUnmount(() => {
  // releases the page-wide slot as well as the listeners. A deck rekeys and
  // unmounts this card when the reader uses its prev/next controls, which can
  // happen while the editor is open; leaving the slot claimed would name a
  // card that no longer exists and pause that deck for good.
  if (editing.value) stopEditing()

  window.removeEventListener('message', onFrameMessage)
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('ghul-example-expanded-open')
  stopWatchingTheme?.()
})
</script>

<template>
  <div v-if="example" class="ghul-example" :class="{ 'is-filling': filling }">
    <span v-if="!canEdit" class="ghul-example-lang">ghul</span>

    <div class="ghul-example-tools" :class="{ 'is-editing': editing }">
    <button
      v-if="!signature"
      type="button"
      class="ghul-example-tool ghul-example-copy"
      :class="{ copied }"
      :title="copied ? 'copied' : 'copy code'"
      @click="copy"
    >
      <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
    <button
      v-if="editing"
      type="button"
      class="ghul-example-tool ghul-example-fill"
      :class="{ 'is-active': filling }"
      :title="filling ? 'back to the page (Esc)' : 'fill the window'"
      :aria-pressed="filling"
      @click="toggleFilling"
    >
      <svg v-if="!filling" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </button>
    <button
      v-if="canEdit && !editing"
      type="button"
      class="ghul-example-tool ghul-example-edit"
      :class="{ 'has-edit': edited }"
      :title="edited ? 'resume editing this example' : 'edit and run this example'"
      @click="startEditing"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      <span>{{ edited ? 'resume' : 'edit & run' }}</span>
    </button>
    <button
      v-if="editing"
      type="button"
      class="ghul-example-tool ghul-example-edit is-active"
      title="stop editing and show the original"
      @click="stopEditing"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    </div>

    <!-- Editing replaces the rendered code with the playground, framed from
         its own origin so the reader's program never runs on this one. -->
    <!-- v-if, not v-show: the frame must be created when the reader asks for
         it. Rendered up front it would load a playground for every example on
         the page, and would announce itself before anything was listening. -->
    <div v-if="editing" class="ghul-example-frame-wrap" :class="{ 'is-ready': frameReady }">
      <iframe
        ref="frame"
        class="ghul-example-frame"
        :src="embedUrl"
        :style="filling ? {} : { height: Math.max(frameHeight, 120) + 'px' }"
        title="ghūl playground"
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="cross-origin-isolated"
      ></iframe>
    </div>

    <div v-show="!editing || !frameReady" class="ghul-example-code">
      <template v-for="item in displayItems" :key="item.key">
        <div v-if="item.type === 'ellipsis'" class="ghul-example-ellipsis" aria-hidden="true">&hellip;</div>
        <div v-else class="ghul-example-line">
          <template v-for="(segment, j) in item.segments" :key="j">
            <span
              v-if="segment.inlay"
              class="ghul-example-inlay"
              :class="{ 'ghul-example-inlay-killed': segment.inlay.code === 'narrowing-killed' }"
              @mouseenter="onInlayEnter($event, segment.inlay)"
              @mouseleave="onInlayLeave()"
            >{{ segment.inlay.label }}</span>
            <span
              v-else
              :style="segment.style"
              :class="[
                'ghul-example-tok',
                segment.semantic ? 'ghul-sem-' + segment.semantic.tokenType : null,
                segment.semantic && segment.semantic.modifiers && segment.semantic.modifiers.includes('static') ? 'ghul-sem-mod-static' : null,
                {
                  'ghul-example-hover': segment.hover,
                  'ghul-example-squiggle-error': segment.diagnostic && segment.diagnostic.severity === 'error',
                  'ghul-example-squiggle-warning': segment.diagnostic && segment.diagnostic.severity === 'warning',
                }
              ]"
              @mouseenter="onEnter($event, segment)"
              @mouseleave="onLeave(segment)"
            >{{ segment.text }}</span>
          </template>
        </div>
      </template>
    </div>
    <div v-if="recordedOutput || recordedImages.length || diagnostics.length || editing" class="ghul-example-output">
      <button
        type="button"
        class="ghul-example-output-toggle"
        :aria-expanded="outputExpanded"
        @click="toggleOutput"
      >
        <svg
          class="ghul-example-chevron"
          :class="{ 'is-open': outputExpanded }"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span>{{ panelLabel }}</span>

        <template v-if="editing">
          <span class="ghul-example-run-state">{{ runLabel }}</span>

          <!-- The analyser is what serves diagnostics and hover while typing.
               Compiling and running work without it, so its absence is worth
               saying quietly rather than presenting as a failure. -->
          <!-- `disconnected` before `connecting`: a session still being
               established has not failed, and must not be reported as one that
               has. -->
          <span
            v-if="frameReady && analyser === 'disconnected'"
            class="ghul-example-analyser-note"
            title="the editor still compiles and runs; only live diagnostics and hover are unavailable"
          >no analyser available</span>
          <span
            v-else-if="frameReady && analyser === 'refused'"
            class="ghul-example-analyser-note"
            title="the analyser allows a few editors at a time from one network address, and that many are already open. This one still compiles and runs; errors as you type and hovers come back by themselves once another editor is closed"
          >analyser limit reached</span>
          <span
            v-else-if="frameReady && analyser === 'connecting'"
            class="ghul-example-analyser-note"
          >connecting ...</span>

          <span
            class="ghul-example-run"
            role="button"
            tabindex="0"
            :aria-disabled="!frameReady"
            title="compile and run (Ctrl+Enter)"
            @click.stop="frameReady && run()"
            @keydown.enter.stop="frameReady && run()"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>run</span>
          </span>
        </template>
      </button>
      <div v-show="outputExpanded" class="ghul-example-output-body">
        <div
          v-for="(d, k) in shownDiagnostics"
          :key="k"
          class="ghul-example-diag"
        >
          <DiagnosticIcon :severity="d.severity" />
          <span class="ghul-example-diag-text">{{ d.message }}</span>
        </div>
        <pre v-if="shownOutput">{{ shownOutput }}</pre>
        <form
          v-if="editing && inputWanted"
          class="ghul-example-input"
          @submit.prevent="sendInput"
        >
          <input
            v-model="inputLine"
            type="text"
            aria-label="a line of input for the program"
            placeholder="the program is waiting for a line"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit">send</button>
          <button type="button" title="no more input" @click="endInput">end</button>
        </form>
        <div v-if="shownImages.length" class="ghul-example-images">
          <figure v-for="image in shownImages" :key="image.name">
            <img :src="image.url" :alt="image.name" />
            <figcaption>{{ image.name }}</figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="ghul-example ghul-example-missing">
    no generated artifact for example "{{ name }}"
  </div>

  <Teleport to="body">
    <div
      v-if="tip.show"
      class="ghul-example-tooltip"
      :style="tip.style"
    >
      <div v-if="tip.diagText" class="ghul-example-tooltip-diagnostic">
        <DiagnosticIcon :severity="tip.severity" />
        <span>{{ tip.diagText }}</span>
      </div>
      <div v-if="tip.signatureLines.length" class="ghul-example-tooltip-hover">
        <div
          v-for="(line, k) in tip.signatureLines"
          :key="k"
          class="ghul-example-tooltip-sig-line"
        >
          <span
            v-for="(token, t) in line"
            :key="t"
            :style="token.style"
            class="ghul-example-tok"
          >{{ token.text }}</span>
        </div>
        <div v-if="tip.kindLabel" class="ghul-example-tooltip-kind">{{ tip.kindLabel }}</div>
      </div>
      <div v-if="tip.detailText" class="ghul-example-tooltip-inlay">{{ tip.detailText }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
.ghul-example {
  position: relative;
  margin: 1rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.ghul-example-code {
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-feature-settings: 'calt' 1, 'liga' 1, 'ss07' 1;
  font-size: 0.875em;
  line-height: 1.6;
  padding: 1rem 1.25rem;
  background: var(--vp-code-block-bg);
  white-space: pre;
  overflow-x: auto;
}

.ghul-example-line {
  min-height: 1.6em;
}

.ghul-example-tok {
  color: var(--shiki-light);
}

.dark .ghul-example-tok {
  color: var(--shiki-dark);
}

/* Semantic-token colours — what the compiler resolved each identifier to.
   Light+ / Dark+ values come from VS Code's stock themes so a ghul.dev
   example reads the same as it would in the editor. The TextMate-derived
   Shiki colour is dropped on these ranges in mergeLine, so these classes
   colour them directly. */
.ghul-sem-namespace      { color: #267F99; }
.ghul-sem-class          { color: #267F99; }
.ghul-sem-interface      { color: #267F99; }
.ghul-sem-struct         { color: #267F99; }
.ghul-sem-enum           { color: #267F99; }
.ghul-sem-typeParameter  { color: #267F99; }
.ghul-sem-enumMember     { color: #0070C1; }
.ghul-sem-method         { color: #795E26; }
.ghul-sem-function       { color: #795E26; }
.ghul-sem-property       { color: #001080; }
.ghul-sem-variable       { color: #001080; }
.ghul-sem-parameter      { color: #001080; }

.dark .ghul-sem-namespace      { color: #4EC9B0; }
.dark .ghul-sem-class          { color: #4EC9B0; }
.dark .ghul-sem-interface      { color: #B8D7A3; }
.dark .ghul-sem-struct         { color: #4EC9B0; }
.dark .ghul-sem-enum           { color: #4EC9B0; }
.dark .ghul-sem-typeParameter  { color: #4EC9B0; }
.dark .ghul-sem-enumMember     { color: #4FC1FF; }
.dark .ghul-sem-method         { color: #DCDCAA; }
.dark .ghul-sem-function       { color: #DCDCAA; }
.dark .ghul-sem-property       { color: #9CDCFE; }
.dark .ghul-sem-variable       { color: #9CDCFE; }
.dark .ghul-sem-parameter      { color: #9CDCFE; }

/* The `static` modifier — visible cue without changing colour. */
.ghul-sem-mod-static {
  font-style: italic;
}

.ghul-example-hover:hover {
  background: var(--vp-c-default-soft);
}

/* Narrowing inlay hints: dimmed ghost text spliced inline, the way VS Code
   renders an inlay hint. The sigil marks where a value is narrowed (►) or
   where a narrowing is dropped (◄); the narrowed-to type and explanation show
   on hover. A hair of side padding and a faint chip keep it distinct from the
   surrounding code without stealing weight from it. */
.ghul-example-inlay {
  display: inline-block;
  margin: 0 0.15em;
  padding: 0 0.25em;
  border-radius: 4px;
  font-size: 0.85em;
  line-height: 1.2;
  color: var(--vp-c-text-3);
  background: var(--vp-c-default-soft);
  cursor: default;
  user-select: none;
  vertical-align: baseline;
}

.ghul-example-inlay:hover {
  color: var(--vp-c-text-1);
}

.ghul-example-inlay-killed {
  color: var(--vp-c-warning-1);
}

/* IDE-style squiggles: a wavy underline under the diagnostic range. */
.ghul-example-squiggle-error,
.ghul-example-squiggle-warning {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
}

.ghul-example-squiggle-error {
  text-decoration-color: var(--vp-c-danger-1);
}

.ghul-example-squiggle-warning {
  text-decoration-color: var(--vp-c-warning-1);
}

/* Language tag and copy button — top-right, swapping on hover, matching
   VitePress's own fenced code blocks. */
.ghul-example-lang {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-feature-settings: 'calt' 1, 'liga' 1, 'ss07' 1;
  font-size: 12px;
  color: var(--vp-c-text-3);
  transition: opacity 0.2s;
}

/* Rightmost is whatever is always shown - the way in to editing, or the way
   out of it - so nothing visible is ever left standing off from the corner by
   the width of buttons that are waiting for a pointer. Copying is the one tool
   that waits, and it appears to the left. While editing every tool is shown:
   the reader is working in the example, so there is nothing to keep quiet. */
/* One row rather than per-button offsets, so buttons appearing and
   disappearing cannot collide or leave gaps. */
.ghul-example-tools {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: flex;
  gap: 4px;
}

.ghul-example-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s, color 0.2s;
}

.ghul-example:hover .ghul-example-lang {
  opacity: 0;
}

.ghul-example:hover .ghul-example-tool,
.ghul-example-tools.is-editing .ghul-example-tool {
  opacity: 1;
}

.ghul-example-tool:hover {
  color: var(--vp-c-text-1);
}

.ghul-example-copy.copied,
.ghul-example-tool.is-active {
  color: var(--vp-c-brand-1);
  opacity: 1;
}

/* While editing, the way back out must not depend on hovering to find it. */
.ghul-example-edit.is-active {
  opacity: 1;
}

.ghul-example-tool svg {
  width: 16px;
  height: 16px;
}

.ghul-example-frame-wrap {
  background: var(--vp-code-block-bg);
}

/* Filling the window. The article column is a narrow strip between two
   sidebars, which is much less room than someone editing code wants, so this
   lifts the card out of the page entirely rather than trying to widen it in
   place. */
.ghul-example.is-filling {
  position: fixed;
  inset: 1rem;
  z-index: 200;
  margin: 0;
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-4, 0 8px 32px rgba(0, 0, 0, 0.3));
}

/* The editor takes what is left after the output pane, rather than the height
   its content happens to need. */
.ghul-example.is-filling .ghul-example-frame-wrap {
  flex: 1;
  min-height: 0;
}

.ghul-example.is-filling .ghul-example-frame {
  height: 100%;
}

.ghul-example.is-filling .ghul-example-output {
  display: flex;
  flex-direction: column;
  max-height: 45%;
  min-height: 2.2rem;
}

.ghul-example.is-filling .ghul-example-output-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* The rendered example stays put until the editor has loaded, so the card does
   not collapse to nothing while the frame boots. Once it is ready the frame
   takes over and the rendered copy is hidden rather than removed, so returning
   to it costs nothing. */
.ghul-example-frame-wrap:not(.is-ready) {
  position: absolute;
  inset: 0;
  visibility: hidden;
}

/* A dot on the pencil: this example has edits waiting behind it. */
.ghul-example-edit.has-edit::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}

/* The way in to editing is shown all the time and says what it does: the other
   tools can wait for a pointer, but a reader who never hovers, or cannot, would
   otherwise never learn that the example runs. */
.ghul-example-edit {
  position: relative;
}

.ghul-example-edit:not(.is-active) {
  gap: 0.35rem;
  width: auto;
  padding: 0 0.55rem;
  opacity: 1;
  font-size: 0.75rem;
}

.ghul-example-edit:not(.is-active):hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.ghul-example-frame {
  display: block;
  width: 100%;
  border: 0;
  /* The frame reports what its content needs and the height follows, so the
     editor never gets its own scrollbar inside the page's. */
  transition: height 0.15s ease-out;
}

.ghul-example-run {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
  padding: 0.15rem 0.7rem 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white, #fff);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s;
}

.ghul-example-run:hover {
  background: var(--vp-c-brand-2, var(--vp-c-brand-1));
}

.ghul-example-run svg {
  width: 14px;
  height: 14px;
}

.ghul-example-run[aria-disabled="true"] {
  opacity: 0.45;
  cursor: default;
}

.ghul-example-run-state,
.ghul-example-analyser-note {
  color: var(--vp-c-text-3);
  font-style: italic;
}

.ghul-example-analyser-note {
  margin-left: auto;
}

.ghul-example-ellipsis {
  color: var(--vp-c-text-3);
  opacity: 0.55;
  letter-spacing: 0.15em;
  user-select: none;
  min-height: 1.6em;
}

.ghul-example-output {
  border-top: 1px solid var(--vp-c-divider);
}

.ghul-example-output-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 1.25rem;
  background: transparent;
  border: 0;
  font-family: inherit;
  font-size: 12px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.ghul-example-output-toggle:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.ghul-example-chevron {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}

.ghul-example-chevron.is-open {
  transform: rotate(90deg);
}

.ghul-example-output-body pre {
  margin: 0;
  padding: 0.4rem 1.25rem 0.9rem;
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-feature-settings: 'calt' 1, 'liga' 1, 'ss07' 1;
  font-size: 0.875em;
  white-space: pre-wrap;
}

/* The line a running program is waiting for. */
.ghul-example-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.2rem 1.25rem 0.9rem;
}

.ghul-example-input input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-size: 0.875em;
}

.ghul-example-input input:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

.ghul-example-input button {
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 0.85em;
}

.ghul-example-input button:hover {
  border-color: var(--vp-c-brand-1);
}

/* What the program drew. Pixel art stays sharp: most of these are small
   rasters scaled up, where smoothing turns a fractal into a smear. */
.ghul-example-images {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.4rem 1.25rem 0.9rem;
}

.ghul-example-images figure {
  margin: 0;
  max-width: 100%;
}

.ghul-example-images img {
  display: block;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
  border: 1px solid var(--vp-c-divider);
}

.ghul-example-images figcaption {
  margin-top: 0.25rem;
  color: var(--vp-c-text-2);
  font-size: 0.8em;
}

/* One diagnostic line in the panel: a severity icon and the message. */
.ghul-example-diag {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.2rem 1.25rem;
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-feature-settings: 'calt' 1, 'liga' 1, 'ss07' 1;
  font-size: 0.8125em;
  line-height: 1.5;
}

.ghul-example-diag:first-child {
  padding-top: 0.5rem;
}

.ghul-example-diag-text {
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
}

.ghul-example-missing {
  padding: 0.75rem 1.25rem;
  color: var(--vp-c-danger-1);
  font-size: 0.9em;
}

.ghul-example-tooltip {
  position: fixed;
  z-index: 100;
  font-family: 'Fira Code', var(--vp-font-family-mono);
  font-feature-settings: 'calt' 1, 'liga' 1, 'ss07' 1;
  font-size: 0.8125em;
  line-height: 1.5;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-3);
  max-width: min(640px, calc(100vw - 16px));
  pointer-events: none;
  overflow: hidden;
}

/* The diagnostic half: severity icon and a plain, uncoloured message. */
.ghul-example-tooltip-diagnostic {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  padding: 6px 10px;
  white-space: pre-wrap;
  color: var(--vp-c-text-1);
}

/* The hover half: the signature as a ghūl code block (one div per
   pretty-printed line, exact indentation preserved) with the classifier in
   italics beneath — mirroring the VS Code hover's fenced block plus its
   `_classifier_` line. */
.ghul-example-tooltip-hover {
  padding: 6px 10px;
}

/* Wrap rather than clip: a signature wider than the tooltip continues on the
   next line, hanging-indented so the continuation reads as one signature. */
.ghul-example-tooltip-sig-line {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding-left: 2em;
  text-indent: -2em;
}

.ghul-example-tooltip-kind {
  margin-top: 4px;
  font-style: italic;
  color: var(--vp-c-text-2);
}

/* The inlay half: the narrowed-to type lines and explanation. The compiler
   hands this over as a small block that VS Code fences as ghūl code, so the
   sigils and type names read monospace, one per line. */
.ghul-example-tooltip-inlay {
  padding: 6px 10px;
  white-space: pre-wrap;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85em;
  color: var(--vp-c-text-1);
}

/* When both halves show, a divider sits between them. */
.ghul-example-tooltip-diagnostic + .ghul-example-tooltip-hover {
  border-top: 1px solid var(--vp-c-divider);
}
</style>
