<script setup>
import DefaultTheme from 'vitepress/theme'
import RosettaAside from './components/RosettaAside.vue'
import ExamplesAside from './components/ExamplesAside.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #aside-outline-before>
      <RosettaAside />
      <ExamplesAside />
    </template>
  </Layout>
</template>
