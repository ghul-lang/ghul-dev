<script setup>
// The playground's own page for one program, framed on a page of this site. It runs the program on
// arrival and has the editor, the output pane and the pictures a drawing produces, so the site
// frames it rather than rebuilding any of it, and there is one playground whichever route a reader
// takes to it. Same origin as the site, which is what lets the page be framed at all.
//
// `path` names the program the way the playground's own address does: rosetta-code/<task>, or
// ghul-examples/<topic>/<part>.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PLAYGROUND_BASE, PLAYGROUND_ORIGIN } from '../playground'

const props = defineProps({
  path: { type: String, required: true },
  title: { type: String, required: true },
})

const frame = ref(null)

// `panel` tells the playground it is on a page that already names the program, so it leaves out
// the links that would say so again. The theme goes in the address too, so the panel paints in it
// first time rather than switching to it once its script has asked.
const url = `${PLAYGROUND_BASE}${props.path}?panel&theme=${
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'}`

// As tall as the window has room for below the frame's top, so that the whole playground is on the
// screen on arrival rather than its output pane below the fold; never shorter than an editor is
// worth, never taller than a program's output needs. Measured, because what sits above the frame is
// not a fixed height.
const height = ref('clamp(28rem, calc(100vh - 14rem), 60rem)')

function size() {
  if (!frame.value) return

  const top = frame.value.getBoundingClientRect().top + window.scrollY

  height.value = `clamp(28rem, calc(100vh - ${Math.round(top) + 24}px), 60rem)`
}

// Escape reaches the framed playground only once the reader has clicked into it; until then the
// key is this page's, and the playground is told so that it can close its pictures.
function forwardEscape(event) {
  if (event.key !== 'Escape') return

  frame.value?.contentWindow?.postMessage({ ghul: 'escape' }, PLAYGROUND_ORIGIN)
}

// The site's light or dark setting, which the framed playground cannot see: it is told on asking,
// once its page has loaded, and again whenever the switch moves.
function sendTheme() {
  frame.value?.contentWindow?.postMessage(
    { ghul: 'theme', dark: document.documentElement.classList.contains('dark') },
    PLAYGROUND_ORIGIN)
}

function onFrameMessage(event) {
  if (event.origin === PLAYGROUND_ORIGIN && event.data?.ghul === 'theme?') sendTheme()
}

const themeWatch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(sendTheme)

onMounted(() => {
  size()
  window.addEventListener('resize', size)
  window.addEventListener('keydown', forwardEscape)
  window.addEventListener('message', onFrameMessage)
  themeWatch?.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', size)
  window.removeEventListener('keydown', forwardEscape)
  window.removeEventListener('message', onFrameMessage)
  themeWatch?.disconnect()
})
</script>

<template>
  <iframe
    ref="frame"
    class="playground-frame"
    :src="url"
    :title="title"
    :style="{ height }"
    loading="eager"
    allow="clipboard-write"
  ></iframe>
</template>

<style scoped>
/* The playground fills whatever it is given, so the frame decides the panel: tall enough to hold
   an editor over its output pane, bounded by the viewport so the whole of it is on the first
   screen, and never so tall that a wide window turns it into a wall. */
.playground-frame {
  display: block;
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}
</style>
