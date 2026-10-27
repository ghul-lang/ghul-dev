// The parts of a page are counted once per view, and a link is counted under
// the part it sits in.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { reachTracker, partOf, isInSite } from '../src/.vitepress/theme/reach.js'

test('a part is counted once per view', () => {
  const sent = []
  const tracker = reachTracker(path => sent.push(path))

  tracker.view()
  tracker.seen('home-reach/examples')
  tracker.seen('home-reach/examples')
  tracker.seen('home-reach/end')

  assert.deepEqual(sent, ['home-reach/examples', 'home-reach/end'])
})

test('a new view counts every part again', () => {
  const sent = []
  const tracker = reachTracker(path => sent.push(path))

  tracker.view()
  tracker.seen('home-reach/end')
  tracker.view()
  tracker.seen('home-reach/end')

  assert.deepEqual(sent, ['home-reach/end', 'home-reach/end'])
})

test('a link is in the part of the last heading above it', () => {
  const headings = [{ id: 'what-is-distinctive', at: 10 }, { id: 'choosing-a-target', at: 20 }, { id: 'where-to-go-next', at: 30 }]
  const at = position => partOf(headings, heading => heading.at < position)

  assert.equal(at(5), 'lead')
  assert.equal(at(15), 'what-is-distinctive')
  assert.equal(at(25), 'choosing-a-target')
  assert.equal(at(35), 'where-to-go-next')
})

test('only a link to this site is in-site', () => {
  const origin = 'https://ghul.dev'

  assert.equal(isInSite('/getting-started', origin), true)
  assert.equal(isInSite('https://ghul.dev/rosetta/', origin), true)
  assert.equal(isInSite('https://github.com/ghul-lang', origin), false)
  assert.equal(isInSite('#what-is-distinctive', origin), true)
})
