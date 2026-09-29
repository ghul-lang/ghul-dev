<script setup>
import DefaultTheme from 'vitepress/theme'
import RosettaAside from './components/RosettaAside.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #aside-outline-before>
      <RosettaAside />
    </template>
  </Layout>
</template>
