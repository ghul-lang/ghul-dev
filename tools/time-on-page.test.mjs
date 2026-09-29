// Time on a page is counted in the playground's bands, once per page view and
// for visible time only, so a report can compare the two. The playground's own
// copy of the bands is checked against these, since the comparison is only
// worth anything while the two agree.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { timeBand, timeFamily, pageTimer } from '../src/.vitepress/theme/time-on-page.js'

test('the bands', () => {
  assert.equal(timeBand(0), 'under-10s')
  assert.equal(timeBand(9999), 'under-10s')
  assert.equal(timeBand(10000), '10-30s')
  assert.equal(timeBand(29999), '10-30s')
  assert.equal(timeBand(30000), '30s-2m')
  assert.equal(timeBand(119999), '30s-2m')
  assert.equal(timeBand(120000), '2-10m')
  assert.equal(timeBand(599999), '2-10m')
  assert.equal(timeBand(600000), 'over-10m')
})

// Read from a playground checkout beside this one where there is one; a
// checkout of this repository on its own has nothing to compare with.
const playgroundEvents = new URL('../../ghul-playground/web/wwwroot/events.js', import.meta.url)

test('the bands are the playground\'s', { skip: !existsSync(playgroundEvents) }, () => {
  const source = readFileSync(playgroundEvents, 'utf8')
  const body = /export function timeBand\(ms\) \{([\s\S]*?)\n\}/.exec(source)?.[1]

  assert.ok(body, 'the playground has a timeBand')

  const theirs = new Function('ms', body)

  for (const ms of [0, 9999, 10000, 29999, 30000, 119999, 120000, 599999, 600000, 3600000]) {
    assert.equal(timeBand(ms), theirs(ms), `${ms} ms`)
  }
})

test('the family a page is counted under', () => {
  assert.equal(timeFamily('/'), 'site-time')
  assert.equal(timeFamily('/control-flow'), 'site-time')
  assert.equal(timeFamily('/rosetta'), 'rosetta-time')
  assert.equal(timeFamily('/rosetta/100-doors'), 'rosetta-time')
  assert.equal(timeFamily('/rosetta-code-notes'), 'site-time')
  assert.equal(timeFamily('/examples/control-flow-04-while'), 'examples-time')
})

function harness() {
  let clock = 0
  let visible = true
  const sent = []

  const timer = pageTimer({ now: () => clock, visible: () => visible, send: path => sent.push(path) })

  return {
    timer,
    sent,
    advance(ms) { clock += ms },
    hide() { visible = false; timer.hidden() },
    show() { visible = true; timer.shown() },
  }
}

test('moving to another page counts the one left', () => {
  const h = harness()

  h.timer.start('/control-flow')
  h.advance(45000)
  h.timer.start('/rosetta/100-doors')

  assert.deepEqual(h.sent, ['site-time/30s-2m'])
})

test('hiding the page counts the view once, and coming back adds nothing', () => {
  const h = harness()

  h.timer.start('/examples/control-flow-04-while')
  h.advance(5000)
  h.hide()
  h.advance(60000)
  h.show()
  h.advance(60000)
  h.hide()

  assert.deepEqual(h.sent, ['examples-time/under-10s'])
})

test('time hidden before the first look is not counted', () => {
  const h = harness()

  h.hide()
  h.timer.start('/rosetta/100-doors')
  h.advance(600000)
  h.show()
  h.advance(12000)
  h.timer.start('/')

  assert.deepEqual(h.sent, ['rosetta-time/10-30s'])
})

test('a new page after a counted one is counted in its turn', () => {
  const h = harness()

  h.timer.start('/')
  h.advance(1000)
  h.hide()
  h.show()
  h.timer.start('/control-flow')
  h.advance(200000)
  h.hide()

  assert.deepEqual(h.sent, ['site-time/under-10s', 'site-time/2-10m'])
})
