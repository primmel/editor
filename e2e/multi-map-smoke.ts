import puppeteer from 'puppeteer'

const REF_A = `root Root

version "v1.0.0-dev1"

metadata {
  title "Quality"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

process MakeGood {
  name "Make good product"
  actor q1
}

process CheckGood {
  name "Check it is good"
  actor q1
}

canvas Root {
  elements {
    MakeGood { x 0 y 0 }
    CheckGood { x 0 y 150 }
  }
  process_flow {
    E1 { from MakeGood to CheckGood }
  }
}`

const REF_B = `root Root

version "v1.0.0-dev1"

metadata {
  title "Security"
  schema "Primmel 0.1"
  namespace "ISMS"
}

role s1 { name "ISMS Auditor" }

process CheckGood {
  name "Check it is good"
  actor s1
}

process GuardSecrets {
  name "Guard the secrets"
  actor s1
}

canvas Root {
  elements {
    CheckGood { x 0 y 0 }
    GuardSecrets { x 0 y 150 }
  }
  process_flow {
    E1 { from CheckGood to GuardSecrets }
  }
}`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The mapping view + both references (QMS lens active first).
await page.evaluate(`((a, b) => {
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadRefText(a)
})('${REF_A.replace(/`/g, '\\`').replace(/\n/g, '\\n')}')`)
await new Promise(r => setTimeout(r, 600))

// 2. Map Manufacturing ⇒ QMS#MakeGood and ⇒ QMS#CheckGood (store path).
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'seed QMS pairs',
    apply(ast) {
      const profile = { namespace: 'QMS', description: '', mappings: {
        Manufacturing: [
          { target: 'QMS#MakeGood', description: '', justification: '', coverage: '' },
          { target: 'QMS#CheckGood', description: '', justification: '', coverage: '' },
        ],
      }, coverage: {} }
      ast.mapProfiles.push(profile)
    },
    revert(ast) { ast.mapProfiles = ast.mapProfiles.filter((p) => p.namespace !== 'QMS') },
  })
})()`)
await new Promise(r => setTimeout(r, 500))

// 3. Load the second reference — the lens swaps to ISMS.
await page.evaluate(`((b) => {
  window.__stores.mapping.loadRefText(b)
})('${REF_B.replace(/`/g, '\\`').replace(/\n/g, '\\n')}')`)
await new Promise(r => setTimeout(r, 600))

let state = await page.evaluate(`(() => ({
  ns: document.querySelector('[data-testid="ref-namespace"]')?.textContent ?? null,
  badges: Array.from(document.querySelectorAll('.switcher-badge')).map((b) => b.textContent.trim().replace('✕', '').trim()),
  refHasCheckGood: !!document.querySelector('[data-testid="ref-pane"] [data-node-id="CheckGood"]'),
  refHasMakeGood: !!document.querySelector('[data-testid="ref-pane"] [data-node-id="MakeGood"]'),
}))()`)
console.log('two lenses:', JSON.stringify(state))
if (state.ns !== 'ISMS' || state.badges.length !== 2 || !state.refHasCheckGood || state.refHasMakeGood) {
  console.log('MULTI FAILED'); await browser.close(); process.exit(1)
}

// 4. Swap the lens back to QMS — the REF pane follows.
await page.evaluate(`(() => { document.querySelector('[data-testid="lens-QMS"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
state = await page.evaluate(`(() => ({
  ns: document.querySelector('[data-testid="ref-namespace"]')?.textContent ?? null,
  refHasMakeGood: !!document.querySelector('[data-testid="ref-pane"] [data-node-id="MakeGood"]'),
  refHasGuard: !!document.querySelector('[data-testid="ref-pane"] [data-node-id="GuardSecrets"]'),
  qmsActive: document.querySelector('[data-testid="lens-QMS"]')?.className.includes('active') ?? false,
}))()`)
console.log('swapped:', JSON.stringify(state))
if (state.ns !== 'QMS' || !state.refHasMakeGood || state.refHasGuard || !state.qmsActive) {
  console.log('MULTI FAILED'); await browser.close(); process.exit(1)
}

// 5. Swap to ISMS and seed its profile from QMS.
await page.evaluate(`(() => { document.querySelector('[data-testid="lens-ISMS"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
await page.evaluate(`(() => {
  const sel = document.querySelector('[data-testid="seed-source"]')
  sel.value = 'QMS'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="seed-run"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

state = await page.evaluate(`(() => {
  const s = window.__stores
  const seeded = s.model.standard.mapProfiles.find((p) => p.namespace === 'ISMS')
  return {
    review: document.querySelector('[data-testid="seed-review"]')?.textContent ?? null,
    seededPairs: seeded ? Object.entries(seeded.mappings).map(([k, v]) => k + ':' + v.map((x) => x.target).join(',')) : null,
    badgeQMS: !!document.querySelector('[data-testid="party-badge-Manufacturing-QMS"]'),
    badgeISMS: !!document.querySelector('[data-testid="party-badge-Manufacturing-ISMS"]'),
  }
})()`)
console.log('seeded:', JSON.stringify(state))

const ok = state.review?.includes('1 carried') && state.review?.includes('1 to review')
  && state.review?.includes('Manufacturing ⇒ QMS#MakeGood')
  && state.seededPairs?.length === 1 && state.seededPairs[0].includes('ISMS#CheckGood')
  && state.badgeQMS && state.badgeISMS
console.log(ok ? 'MULTI OK' : 'MULTI FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
