import puppeteer from 'puppeteer'

const REF_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "QMS Reference"
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

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// Load REF and map Manufacturing → MakeGood with a WRONG assertion on CheckGood.
await page.evaluate((text: string) => {
  const s = (window as any).__stores
  s.ui.view = 'mapping'
  s.mapping.loadRefText(text)
}, REF_TEXT)
await new Promise(r => setTimeout(r, 700))

// Map via the store (the click path is proven by mapper-smoke). The
// STRING form — tsx injects __name() into named functions/methods,
// which does not exist in the browser.
await page.evaluate(`(() => {
  const s = window.__stores
  const ns = 'QMS'
  s.model.execute({
    label: 'map Manufacturing ⇒ QMS#MakeGood',
    apply(ast) {
      let profile = ast.mapProfiles.find((p) => p.namespace === ns)
      if (!profile) {
        profile = { namespace: ns, description: '', mappings: {}, coverage: {} }
        ast.mapProfiles.push(profile)
      }
      if (!profile.mappings['Manufacturing']) profile.mappings['Manufacturing'] = []
      profile.mappings['Manufacturing'].push({ target: 'QMS#MakeGood', description: '', justification: '', coverage: '' })
      profile.coverage = { CheckGood: 'full' }
    },
    revert(ast) {
      const profile = ast.mapProfiles.find((p) => p.namespace === ns)
      if (profile) { delete profile.mappings['Manufacturing']; profile.coverage = {} }
    },
  })
})()`)
await new Promise(r => setTimeout(r, 700))

const state = await page.evaluate(`(() => {
  const pick = function (pane, id) {
    const el = document.querySelector('[data-testid="' + pane + '"] [data-node-id="' + id + '"]')
    return el ? el.style.filter : null
  }
  return {
    legend: !!document.querySelector('[data-testid="coverage-legend"]'),
    makeGoodTint: pick('ref-pane', 'MakeGood'),
    checkGoodTint: pick('ref-pane', 'CheckGood'),
    mfgTint: pick('imp-pane', 'Manufacturing'),
    startTint: pick('imp-pane', 'Start'),
  }
})()`)
console.log(JSON.stringify(state, null, 1))

// MakeGood: computed full → green glow (#7a9e5e).
// CheckGood: asserted full but computed none → conflict red (#b85555).
// Manufacturing (IMP): mapped → green. Start (IMP): never a source → untinted.
const ok = state.legend
  && !!state.makeGoodTint?.includes('rgb(122, 158, 94)')
  && !!state.checkGoodTint?.includes('rgb(184, 85, 85)')
  && !!state.mfgTint?.includes('rgb(122, 158, 94)')
  && !state.startTint
console.log(ok ? 'COVERAGE OK' : 'COVERAGE FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
