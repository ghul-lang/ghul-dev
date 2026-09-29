// Counting what a reader does on the site.
//
// One event is one path, because the counter has no properties: everything an
// event says has to be in its path, and the first segment is the family a report
// groups on. Paths stay low-cardinality on purpose, and nothing a reader typed,
// no example source and no message from the compiler ever reaches one.
//
// Counting never matters. Every call is safe during the static build, where
// there is no window at all, when the counter did not load, which includes every
// local build, and when the reader has opted out.

import { pageTimer } from './time-on-page.js'

// Two ways to not be counted, and both are the reader's rather than ours.
//
// `skipgc` is the counter's own opt-out, set by visiting #toggle-goatcounter, and
// count.js honours it by itself; reading it here only avoids the call.
//
// `?notrack` on the URL is for tests that drive a real browser against the real
// site and would otherwise count themselves.
function suppressed() {
  if (typeof window === 'undefined') return true

  try {
    if (new URLSearchParams(location.search).has('notrack')) return true
  } catch {
    return true
  }

  try {
    return localStorage.getItem('skipgc') === 't'
  } catch {
    // Storage can throw rather than answer, in a private window or with site
    // data blocked. Not being able to read the opt-out is not consent to count.
    return true
  }
}

// Events sent before the counter's script has loaded, which is common early in a
// page load: the script is fetched asynchronously, and a page can know what it
// is showing first. They are held until the script's element reports that it
// has loaded or failed, then sent or dropped, so a counter that never arrives -
// blocked by an extension, say - leaves nothing waiting. The cap bounds what one
// page can hold before then.
const HELD_LIMIT = 20

let held: { path: string, title: string }[] | null = null

// Whether the script has settled. Its element fires load or error once, so once
// it has, an event that still finds no counter is dropped at once rather than
// held for an element that will fire nothing more.
let counter: 'pending' | 'waiting' | 'settled' = 'pending'

function send(path: string, title: string) {
  try {
    ;(window as any).goatcounter?.count?.({ path, title, event: true })
  } catch {
    // A counter that fails is not a reason for the page to.
  }
}

function hold(path: string, title: string) {
  if (counter === 'settled') return

  if (held) {
    if (held.length < HELD_LIMIT) held.push({ path, title })

    return
  }

  const script = document.querySelector<HTMLScriptElement>('script[data-goatcounter]')

  if (!script) return

  held = [{ path, title }]
  counter = 'waiting'

  const settle = (loaded: boolean) => {
    const waiting = held ?? []

    held = null
    counter = 'settled'

    if (loaded) for (const event of waiting) send(event.path, event.title)
  }

  script.addEventListener('load', () => settle(true), { once: true })
  script.addEventListener('error', () => settle(false), { once: true })
}

export function countEvent(path: string, title = path) {
  if (suppressed()) return

  if ((window as any).goatcounter?.count) {
    send(path, title)
  } else {
    hold(path, title)
  }
}

// An event sent as the page may be going away, which the counter's own script
// cannot carry: it sends an image request, and a browser tearing a page down
// abandons those. sendBeacon is the one request a browser promises to finish,
// and the counter accepts a POST to its endpoint for exactly this.
function beacon(path: string, title: string) {
  if (suppressed() || !navigator.sendBeacon) return

  const endpoint = document.querySelector<HTMLElement>('script[data-goatcounter]')?.dataset.goatcounter

  if (!endpoint) return

  try {
    const url = new URL(endpoint, location.href)

    url.searchParams.set('p', path)
    url.searchParams.set('e', 'true')
    url.searchParams.set('t', title)

    navigator.sendBeacon(url.toString())
  } catch {
    // A page on its way out is not a place to report anything.
  }
}

// Visible time on each page a reader views, as `site-time`, `rosetta-time` or
// `examples-time` and a band - see time-on-page.js. Answers the function to
// call when the reader moves to another page.
export function countTimeOnPages(path: string): (path: string) => void {
  if (typeof document === 'undefined' || suppressed()) return () => {}

  const timer = pageTimer({
    now: () => performance.now(),
    visible: () => document.visibilityState === 'visible',
    send: (event: string) => beacon(event, event.slice(0, event.indexOf('/'))),
  })

  timer.start(path)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') timer.shown()
    else timer.hidden()
  })

  // Both, because neither fires everywhere: a tab being closed may only report
  // pagehide, and a phone switching away may only report the other.
  window.addEventListener('pagehide', () => timer.hidden())

  return next => timer.start(next)
}

// Where a link goes, for the handful of destinations worth knowing about. The
// host rather than the URL, so one event stands for every link to that place and
// no path a reader visited is recorded.
const DESTINATIONS: [RegExp, string][] = [
  [/(^|\.)codespaces\.new$/, 'codespace'],
  [/(^|\.)marketplace\.visualstudio\.com$/, 'vscode-marketplace'],
  [/(^|\.)nuget\.org$/, 'nuget'],
  [/(^|\.)rosettacode\.org$/, 'rosetta-wiki'],
  [/(^|\.)github\.com$/, 'github']
]

export function destination(href: string): string | null {
  let host: string

  try {
    host = new URL(href, location.href).host
  } catch {
    return null
  }

  // A Codespace is opened by a github.com URL as often as by codespaces.new, so
  // it is recognised by its path before the host decides.
  if (/(^|\.)github\.com$/.test(host) && /\/codespaces\/new/.test(href)) return 'codespace'

  for (const [pattern, name] of DESTINATIONS) if (pattern.test(host)) return name

  return null
}

// One delegated listener for every outward link on the site, rather than a
// handler per page: the links live in Markdown and have nowhere to hang one.
// Only the destinations above are counted, so an ordinary link to anywhere else
// records nothing.
export function countOutboundLinks() {
  if (typeof document === 'undefined') return

  document.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]')

    if (!anchor) return

    const name = destination(anchor.getAttribute('href') ?? '')

    if (name) countEvent(`outbound/${name}`, 'outbound link')
  })
}
