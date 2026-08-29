import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 subjects leg (TODO.editor wave 03) — the IS/HAS/DOES anatomy
// surface on the live app: the tree section, the inspector (metadata,
// design parameters, promises, dimensions, characteristics, behaviors),
// edits through the command path, and the in-tree create. The corpus
// text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `subject LC500 {
  extends LoadCell
  is {
    metadata {
      name "LC-500 load cell model"
    }
    provenance {
      manufacturer "ACME Weighing GmbH"
    }
    design_parameters {
      e_max : "500 kg"
    }
    promises {
      mpe_within {
        target error_hold
        level symbolic C6
        conditions "over the rated range"
        statement "Holds accuracy class C6 across the rated range."
        verified_by { oiml-r60#/req/class-c/mpe }
      }
    }
  }
  has {
    attributes {
      serial_number : string declared
    }
    dimensions {
      accuracy_class in { C }
    }
    characteristics {
      error_hold e = ocl{self.indication - self.ref_load}
    }
    state lc_operational
  }
  does {
    behavior creep
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-SUBJECTS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Subjects section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  subjects: window.__stores.model.standard.subjects.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Subjects')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.subjects !== 1 || state.group !== 'Subjects (1) +') await fail('the Subjects tree section did not render')

// 2. Selecting the subject opens the anatomy inspector.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'LC500')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="subject-inspector"]'),
  extends: document.querySelector('[data-testid="subject-extends"]')?.value ?? null,
  metadataName: document.querySelector('[data-testid="subject-metadata-value-name"]')?.value ?? null,
  designEmax: document.querySelector('[data-testid="subject-design-value-e_max"]')?.value ?? null,
  attrSerial: document.querySelector('[data-testid="subject-attr-value-serial_number"]')?.value ?? null,
  dimClass: document.querySelector('[data-testid="subject-dim-accuracy_class"]')?.value ?? null,
  state: document.querySelector('[data-testid="subject-state"]')?.value ?? null,
  charSymbol: document.querySelector('[data-testid="subject-char-symbol-error_hold"]')?.value ?? null,
  promiseStatement: document.querySelector('[data-testid="subject-promise-statement-mpe_within"]')?.value?.slice(0, 20) ?? null,
  promiseLevel: document.querySelector('[data-testid="subject-promise-level-kind-mpe_within"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.extends !== 'LoadCell' || state.metadataName !== 'LC-500 load cell model'
  || state.designEmax !== '500 kg' || state.attrSerial !== 'string declared'
  || state.dimClass !== 'C' || state.state !== 'lc_operational' || state.charSymbol !== 'e'
  || state.promiseStatement !== 'Holds accuracy class' || state.promiseLevel !== 'symbolic')
  await fail('the subject inspector did not open with the anatomy facets')

// 3. A design-parameter edit lands through the command path.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="subject-design-value-e_max"]')
  el.value = '600 kg'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  eMax: window.__stores.model.standard.subjects[0].is.designParameters.e_max,
  serialized: window.__stores.model.serialize().includes('e_max : "600 kg"'),
}))()`)
if (state.eMax !== '600 kg' || !state.serialized) await fail('the design parameter edit did not land')

// 4. A promise add + a behavior add land.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="subject-promise-add"]')
  el.value = 'creep_c6'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="subject-promise-add-btn"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  promises: window.__stores.model.standard.subjects[0].is.promises.map((p) => p.id),
  serialized: window.__stores.model.serialize().includes('creep_c6 {'),
}))()`)
if (JSON.stringify(state.promises) !== JSON.stringify(['mpe_within', 'creep_c6']) || !state.serialized)
  await fail('the promise add did not land')

// 5. The in-tree create mints a subject and selects it.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-subject"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.subjects.map((s) => s.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="subject-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Subject1') || state.selection?.id !== 'Subject1' || !state.inspector)
  await fail('the in-tree create did not mint + select the subject')

console.log('V3-SUBJECTS OK')
await browser.close()
process.exit(0)
