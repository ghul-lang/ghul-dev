// /rosetta/<slug> is still a task's address, but it is no longer a page.
//
// The section is one page that resolves tasks from ghul-rosetta-code when a reader opens it, so
// there is nothing under /rosetta/ for the site's router to load. The server answers every address
// there with the section's page (see ghul-playground's deploy/nginx/ghul.dev.conf), and what
// follows is the same arrangement on the client: the address says which task is shown, and nothing
// is ever loaded for it.
//
// Three moments, and they need different handling. A reader arriving at a task's address has that
// address rewritten to the section before the router sees it, because the router is about to load
// whatever it is pointed at and would find nothing; the explorer puts the address back once it is
// mounted. A task chosen on the page, and the back button afterwards, reach the router through
// hooks it offers for exactly this, and both decline the load.

import { ref } from 'vue'
import { taskSlugFromPath } from './rosetta-corpus'

const SECTION = '/rosetta/'

// The task the address names, or null for the section itself. The explorer watches both of these.
export const shownSlug = ref(null)

export const shownFilter = ref('')

// The task address a reader arrived at, while the section's address stands in for it. The page
// view is counted when the page has loaded, which can fall in that window, and it has to record
// the task rather than the section.
let arrival = null

const within = pathname => pathname.startsWith(SECTION)

function adopt(target) {
  shownSlug.value = taskSlugFromPath(target.pathname)
  shownFilter.value = target.search
}

export function installRosettaRouting(router) {
  if (typeof window === 'undefined') return

  const read = href => new URL(href, location.origin)

  // Installed before the first route is loaded, so this runs before the router has been pointed
  // at anything. An address the router cannot load is turned into one it can, and the explorer
  // restores it: the reader never sees the section's address, and the task's address stays
  // linkable.
  if (taskSlugFromPath(location.pathname)) {
    adopt(new URL(location.href))

    arrival = location.pathname + location.search

    window.goatcounter = window.goatcounter ?? {}
    window.goatcounter.path = path => (arrival && location.pathname === SECTION ? arrival : path)

    history.replaceState(history.state ?? {}, '', SECTION + location.search + location.hash)
  }

  // A link followed on the page. `go` pushes the address itself after this returns, so declining
  // means pushing it here.
  const before = router.onBeforeRouteChange

  router.onBeforeRouteChange = href => {
    const target = read(href)

    if (!within(target.pathname)) return before?.(href)

    // Reached from elsewhere on the site, or on the first load - the router's own first move,
    // made before any page is loaded: there is no explorer mounted to show the section, so let
    // the router load its page, or the browser fetch the page the server answers a task's
    // address with.
    if (!router.route.component || !within(location.pathname)) {
      if (!taskSlugFromPath(target.pathname)) return before?.(href)

      location.assign(href)

      return false
    }

    // Within the section, every move is the explorer changing what it shows: a task, or the
    // section itself, whose link the router would otherwise take for the page already loaded and
    // leave the task standing.
    history.replaceState({ scrollPosition: window.scrollY }, '')
    history.pushState({}, '', href)

    adopt(target)

    if (!taskSlugFromPath(target.pathname)) window.scrollTo(0, 0)

    return false
  }

  // The back and forward buttons, which reach the router through popstate rather than through
  // `go`. Moves within the section are the explorer changing what it shows, including back to the
  // section itself, so none of them reloads the page. The section's page has to be loaded for
  // there to be an explorer to show them, which is what `route.component` says: on the first load
  // there is none yet, and that one is a real page load.
  const load = router.onBeforePageLoad

  router.onBeforePageLoad = href => {
    const target = read(href)

    if (!router.route.component || !within(router.route.path)) return load?.(href)

    if (!within(target.pathname)) return load?.(href)

    adopt(target)

    return false
  }
}

// The explorer's own moves: choosing a task from the list, or changing the filter. The address
// carries the view so that it can be linked to, and nothing is loaded either way. A move the
// reader made is somewhere to go back to; one the page made on their behalf is not.
export function showAt(address, keep = true) {
  arrival = null

  const target = new URL(address, location.origin)
  const here = location.pathname + location.search

  if (target.pathname + target.search !== here) {
    if (keep) {
      history.pushState({}, '', address)
    } else {
      history.replaceState(history.state ?? {}, '', address)
    }
  }

  adopt(target)
}

export const replaceAt = address => showAt(address, false)
