// The Rosetta Code section's filter, shared between the two places it is shown. The explorer draws
// its controls under the framed task on a narrow screen, and the page's aside draws the same
// controls beside it on a wide one, where the column would otherwise stand empty; either place
// changes the one filter, and the list under the task answers to it.

import { ref, shallowRef, computed } from 'vue'
import { tagCounts, platformCounts } from './rosetta-corpus'

// Set by the explorer once the corpus has loaded. Null until then, and the aside shows nothing.
export const corpus = shallowRef(null)

export const query = ref('')
export const chosen = ref(new Set())

export const tags = computed(() => corpus.value ? tagCounts(corpus.value) : [])

export const platforms = computed(() => corpus.value ? platformCounts(corpus.value) : [])

export function toggleTag(tag) {
  const next = new Set(chosen.value)

  if (!next.delete(tag)) next.add(tag)

  chosen.value = next
}
