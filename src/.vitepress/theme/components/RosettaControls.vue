<script setup>
// The search box, the platform chips and the tag chips: the whole of the filter, drawn wherever there
// is room for it. `stacked` is the page's aside, a narrow column where the parts
// go one under another.
import { ref, computed } from 'vue'
import { corpus, query, chosen, tags, platforms, toggleTag } from '../rosetta-filter'
import { platformLabel } from '../rosetta-corpus'

const props = defineProps({ stacked: { type: Boolean, default: false } })

// In the narrow column the whole vocabulary would push the results out of sight, so it shows the
// dozen most used - and any chosen one, so the chip that narrowed the list can un-narrow it - with
// the rest a click away.
const FEW = 12
const allTags = ref(false)

const shownTags = computed(() => {
  if (!props.stacked || allTags.value) return tags.value

  return tags.value.filter(([tag], at) => at < FEW || chosen.value.has(tag))
})

const hiddenTags = computed(() => tags.value.length - shownTags.value.length)
</script>

<template>
  <div class="rosetta-filter-controls" :class="{ 'is-stacked': stacked }">
    <div class="rosetta-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        v-model="query"
        class="rosetta-filter"
        type="search"
        placeholder="search by name or tag"
        aria-label="search tasks by name or tag"
      />
    </div>

    <!-- Where a solution runs, apart from what it is about. Choosing both leaves what runs on both. -->
    <div v-if="platforms.length > 0" class="rosetta-platforms" role="group" aria-label="filter by where it runs">
      <span class="rosetta-platforms-label">runs on</span>
      <button
        v-for="[platform, count] in platforms"
        :key="platform"
        type="button"
        class="rosetta-tag"
        :class="{ 'is-chosen': chosen.has(platform) }"
        :aria-pressed="chosen.has(platform)"
        :title="corpus?.platforms[platform]"
        @click="toggleTag(platform)"
      >{{ platformLabel(platform) }} <span>{{ count }}</span></button>
    </div>

    <div class="rosetta-tags" role="group" aria-label="filter by tag">
      <button
        v-for="[tag, count] in shownTags"
        :key="tag"
        type="button"
        class="rosetta-tag"
        :class="{ 'is-chosen': chosen.has(tag) }"
        :aria-pressed="chosen.has(tag)"
        :title="corpus?.tags[tag]"
        @click="toggleTag(tag)"
      >{{ tag }} <span>{{ count }}</span></button>

      <button v-if="hiddenTags > 0" type="button" class="rosetta-more-tags" @click="allTags = true">
        {{ hiddenTags }} more tags
      </button>
      <button v-else-if="stacked && allTags" type="button" class="rosetta-more-tags" @click="allTags = false">
        fewer tags
      </button>
    </div>
  </div>
</template>

<style scoped>
.rosetta-search {
  position: relative;
  margin: 1.5rem 0 0.75rem;
}

.is-stacked .rosetta-search {
  margin: 0 0 0.75rem;
}

.rosetta-search svg {
  position: absolute;
  top: 50%;
  left: 0.7rem;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  color: var(--vp-c-text-3);
  pointer-events: none;
}

.rosetta-filter {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.2rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 1rem;
}

.is-stacked .rosetta-filter {
  font-size: 0.9rem;
}

.rosetta-filter:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

.rosetta-tags,
.rosetta-platforms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.rosetta-platforms {
  margin-bottom: 0.6rem;
}

.rosetta-platforms-label {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}

.is-stacked .rosetta-platforms-label {
  font-size: 0.75rem;
}

.rosetta-tag {
  padding: 0.1rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  line-height: 1.5;
}

.is-stacked .rosetta-tag {
  font-size: 0.75rem;
  padding: 0.05rem 0.5rem;
}

.rosetta-more-tags {
  padding: 0.1rem 0.4rem;
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
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
</style>
