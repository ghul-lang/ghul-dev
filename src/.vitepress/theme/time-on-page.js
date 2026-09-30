// How long a reader had a page in front of them, in bands, counted once per
// page view. The bands and the rule are the playground's (its events.js), so a
// report can set the two side by side.
//
// Time the page spent hidden does not count: a tab left open behind others for
// an hour says nothing about whether anyone read it. The count for a view is
// taken when the reader moves to another page, or the first time the page goes
// away, whichever comes first, so a reader who leaves and comes back to the
// same view is not added to it.

// The bands themselves. Coarse on purpose: a path is a name, and the question
// is whether somebody read the page rather than how many seconds they took.
export function timeBand(ms) {
  if (ms < 10000) return 'under-10s'
  if (ms < 30000) return '10-30s'
  if (ms < 120000) return '30s-2m'
  if (ms < 600000) return '2-10m'
  return 'over-10m'
}

// The family a page's time is counted under.
export function timeFamily(path) {
  if (path === '/rosetta' || path.startsWith('/rosetta/')) return 'rosetta-time'
  if (path.startsWith('/examples/')) return 'example-page-time'
  return 'site-time'
}

// Visible time for one page view after another. `send(path)` is handed the
// event path, family and band, at most once per view.
export function pageTimer({ now, visible, send }) {
  let family = null
  let visibleSince = null
  let shown = 0
  let counted = true

  const stop = () => {
    if (visibleSince !== null) {
      shown += now() - visibleSince
      visibleSince = null
    }
  }

  const finish = () => {
    stop()

    if (counted) return

    counted = true
    send(`${family}/${timeBand(shown)}`)
  }

  return {
    // A view of the page at `path` begins, ending the one before it.
    start(path) {
      finish()

      family = timeFamily(path)
      shown = 0
      counted = false
      visibleSince = visible() ? now() : null
    },

    // The page went out of sight, or is being left altogether.
    hidden: finish,

    // The page is in sight again. A view already counted stays counted.
    shown() {
      if (!counted) visibleSince ??= now()
    },
  }
}
