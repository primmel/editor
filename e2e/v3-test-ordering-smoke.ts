import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 test-ordering leg (TODO.editor wave 03) — test sequences +
// test point sets on the live app: the tree sections, the inspectors,
// edits through the command path, and the in-tree creates. The corpus
// text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `test_sequence mdlo-creep-dr {
  name "MDLO → Creep → DR sequence"
  description "The three performance tests must run in this order on the same sample"
  step 1 {
    test "/conf/metrological-tests/mdlo"
    role baseline
  }
  step 2 {
    test "/conf/metrological-tests/creep"
    role follow_up
    depends_on 1
  }
  sample_applicability all
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
}

test_point_set span-points {
  description "Points within the measuring range for error determination"
  ref derives-from "urn:oiml:pub:r:144-2:2013#clause-1.2"
  cardinality {
    linear { min_points 3 rule "min +10 %, mid ±10 %, max −10 % of the measuring range" }
  }
  repetitions_per_point 3
  points {
    point min-10pct { fraction 0.1 anchor range_min offset "+10 % of range" }
    point max-10pct { fraction 0.9 anchor range_max offset "−10 % of range" }
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-TEST-ORDERING FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; both tree sections render.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Test')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (!state.groups.includes('Test Sequences (1) +') || !state.groups.includes('Test Point Sets (1) +'))
  await fail('the test-ordering tree sections did not render')

// 2. The sequence inspector: steps with role + depends_on, the source list.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'mdlo-creep-dr')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="test-sequence-inspector"]'),
  name: document.querySelector('[data-testid="seq-name"]')?.value ?? null,
  steps: document.querySelectorAll('.step-row').length,
  step1role: document.querySelector('[data-testid="seq-step-role-1"]')?.value ?? null,
  step1depends: document.querySelector('[data-testid="seq-step-depends-1"]')?.value ?? null,
  step1test: document.querySelector('[data-testid="seq-step-test-1"]')?.value ?? null,
  sourceClause: document.querySelector('[data-testid="seq-source-clause-0"]')?.value ?? null,
  applicability: document.querySelector('[data-testid="seq-sample-applicability"]')?.value ?? null,
}))()`)
console.log('sequence inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'MDLO → Creep → DR sequence' || state.steps !== 2
  || state.step1role !== 'follow_up' || state.step1depends !== '1'
  || state.step1test !== '/conf/metrological-tests/creep'
  || state.sourceClause !== '2.10' || state.applicability !== 'all')
  await fail('the test sequence inspector did not open with the facets')

// 3. A step add lands (order mints to 3).
await page.evaluate(`(() => { document.querySelector('[data-testid="seq-step-add"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  steps: window.__stores.model.standard.testSequences[0].steps.map((s) => s.order),
  serialized: window.__stores.model.serialize().includes('step 3'),
}))()`)
if (JSON.stringify(state.steps) !== JSON.stringify([1, 2, 3]) || !state.serialized) await fail('the step add did not land')

// 4. The point set inspector: cardinality, repetitions, points.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'span-points')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="test-point-set-inspector"]'),
  reps: document.querySelector('[data-testid="tps-repetitions"]')?.value ?? null,
  cardMin: document.querySelector('[data-testid="tps-card-min-linear"]')?.value ?? null,
  points: Array.from(document.querySelectorAll('.point-row .point-id')).map((n) => n.textContent),
  fraction: document.querySelector('[data-testid="tps-point-fraction-min-10pct"]')?.value ?? null,
  sourceDoc: document.querySelector('[data-testid="tps-source-doc"]')?.value ?? null,
}))()`)
console.log('point set inspector:', JSON.stringify(state))
if (!state.inspector || state.reps !== '3' || state.cardMin !== '3'
  || JSON.stringify(state.points) !== JSON.stringify(['min-10pct', 'max-10pct'])
  || state.fraction !== '0.1' || state.sourceDoc !== 'urn:oiml:pub:r:144-2:2013')
  await fail('the test point set inspector did not open with the facets')

// 5. A point edit lands through the command path.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="tps-point-fraction-min-10pct"]')
  el.value = '0.15'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  fraction: window.__stores.model.standard.testPointSets[0].points[0].fraction,
  serialized: window.__stores.model.serialize().includes('fraction 0.15'),
}))()`)
if (state.fraction !== 0.15 || !state.serialized) await fail('the point edit did not land')

// 6. The in-tree creates mint + select.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-testSequence"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-testPointSet"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  seqs: window.__stores.model.standard.testSequences.map((s) => s.id),
  tps: window.__stores.model.standard.testPointSets.map((t) => t.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.seqs.includes('Seq1') || !state.tps.includes('TPS1') || state.selection?.id !== 'TPS1')
  await fail('the in-tree creates did not mint + select')

console.log('V3-TEST-ORDERING OK')
await browser.close()
process.exit(0)
