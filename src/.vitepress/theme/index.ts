import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { nextTick, onMounted, watch } from 'vue'
import GhulExample from './components/GhulExample.vue'
import GhulExampleSwitcher from './components/GhulExampleSwitcher.vue'
import RosettaExplorer from './components/RosettaExplorer.vue'
import ExampleRun from './components/ExampleRun.vue'
import Layout from './Layout.vue'
import { installRosettaRouting } from './rosetta-route'
import { refreshPackageVersions } from './package-versions'
import { countOutboundLinks } from './events'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout,
  setup() {
    const route = useRoute()

    onMounted(refreshPackageVersions)

    // One listener for the whole site: an outward link in Markdown has nowhere
    // of its own to hang a handler, and client-side navigation keeps this page
    // alive across every route.
    onMounted(countOutboundLinks)
    watch(() => route.path, () => nextTick(refreshPackageVersions))

    // In-site navigation is client-side and the counter only records a
    // pageview at script load, so without this a multi-page session shows up
    // as a single-page one. The dedupe keeps a hash-only move on the same
    // page from counting as a pageview.
    let counted_path = typeof location !== 'undefined' ? location.pathname : ''
    watch(() => route.path, () =>
      nextTick(() => {
        if (location.pathname === counted_path) return
        counted_path = location.pathname
        window.goatcounter?.count?.()
      }))
  },
  enhanceApp({ app, router }) {
    // The Rosetta Code section answers every address under it from one page, so those addresses
    // are handled here rather than by loading a page that does not exist. It has to be installed
    // before the first route is loaded, which is why it is here rather than in setup().
    installRosettaRouting(router)

    app.component('GhulExample', GhulExample)
    app.component('GhulExampleSwitcher', GhulExampleSwitcher)
    app.component('RosettaExplorer', RosettaExplorer)
    app.component('ExampleRun', ExampleRun)
  },
}
