<script setup>
// Opens one ghul-examples program in the playground, framed on its page. The page already shows
// the source and what it prints; the frame adds running and changing it. It is the playground's
// own page for the program, found by the same path any other link to it uses, so there is one
// playground rather than a second editor built here.
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import { PLAYGROUND_BASE } from '../playground'

const props = defineProps({ id: { type: String, required: true } })

const { isDark } = useData()
const open = ref(false)

const url = computed(() =>
  `${PLAYGROUND_BASE}ghul-examples/${props.id}?panel&theme=${isDark.value ? 'dark' : 'light'}`)
</script>

<template>
  <div class="example-run">
    <button v-if="!open" class="example-run-open" type="button" @click="open = true">
      run this in the playground
    </button>
    <iframe
      v-else
      class="example-run-frame"
      :src="url"
      title="the playground, running this program"
      loading="lazy" />
  </div>
</template>

<style scoped>
.example-run-open {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  color: var(--vp-c-brand-1);
  font-size: 14px;
}

.example-run-open:hover {
  background: var(--vp-c-brand-soft);
}

.example-run-frame {
  width: 100%;
  height: 70vh;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
</style>
