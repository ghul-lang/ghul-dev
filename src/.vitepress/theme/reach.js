// How far down a page a reader got, and which part of it they left from.
//
// A page that is counted this way names its parts. A part is counted once per
// page view, the first time any of it comes into sight, so a report can say how
// many of the readers who opened the page reached each part. A link followed to
// another page on the site is counted under the part it was in.
//
// The names are fixed by the page, never by what a reader did, so paths stay as
// few as the parts there are.

// Once per page view for each part. `view()` begins a new view, so a reader who
// comes back to the page is counted again.
export function reachTracker(send) {
  let reached = new Set()

  return {
    view() {
      reached = new Set()
    },

    seen(path) {
      if (reached.has(path)) return

      reached.add(path)
      send(path)
    },
  }
}

// The part of the home page an element sits in: the id of the last section
// heading before it, or `lead` above the first. `headings` are in page order,
// and `before(heading)` says whether a heading comes before the element.
export function partOf(headings, before) {
  let part = 'lead'

  for (const heading of headings) {
    if (!before(heading)) break

    part = heading.id
  }

  return part
}

// Whether a link stays on this site, which a report already sees as the next
// page view, rather than going elsewhere, which the outbound count covers.
export function isInSite(href, origin) {
  try {
    return new URL(href, origin).origin === origin
  } catch {
    return false
  }
}
