<script setup>
// Where an example page lists its neighbours on a wide screen: the page's aside, where other pages
// keep their outline. An example page has no outline, and beside a playground as tall as the window
// the column is the one place a reader can see without scrolling. The list comes with the page,
// built from the same index as the page itself, so it has as many entries as the topic has
// programs.
import { useData } from 'vitepress'
import { computed } from 'vue'

const { params, page } = useData()

const aside = computed(() =>
  page.value.relativePath.startsWith('examples/') ? params.value?.aside ?? null : null)
</script>

<template>
  <nav v-if="aside" class="examples-aside" aria-label="examples">
    <template v-if="aside.pieces.length > 1">
      <p class="examples-aside-heading">{{ aside.topic }}</p>
      <ul>
        <li v-for="piece in aside.pieces" :key="piece.link">
          <a :href="piece.link" :class="{ current: piece.current }"
             :aria-current="piece.current ? 'page' : undefined">{{ piece.text }}</a>
        </li>
      </ul>
    </template>

    <p class="examples-aside-heading">examples</p>
    <ul>
      <li v-for="topic in aside.topics" :key="topic.link">
        <a :href="topic.link" :class="{ current: topic.current }">{{ topic.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.examples-aside {
  padding-bottom: 2rem;
  font-size: 13px;
  line-height: 1.6;
}

.examples-aside-heading {
  margin: 0 0 0.25rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.examples-aside ul {
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;
}

.examples-aside a {
  color: var(--vp-c-text-2);
  text-decoration: none;
}

.examples-aside a:hover {
  color: var(--vp-c-brand-2);
}

.examples-aside a.current {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}
</style>
