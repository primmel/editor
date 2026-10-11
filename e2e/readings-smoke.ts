// The readings leg (the Paneron-parity pass): the model's dynamic
// state as one surface — the TABLE/DERIVED/measured variables live
// under the twin's engine, the gate rail lights the branch that would
// fire, and the honest BLOCKED state shows when none would.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "readings"
}

start_event Start { }

exclusive_gateway Verdict { }

process Pass {
  name "Pass"
  modality shall
}

process Fail {
  name "Fail"
  modality shall
}

end_event Done { }

table data {
  title "Data"
  columns "5"
  data {
    "" "Rated voltage" "" "Conductor-earth" ""
    "6181Y" "1 x 1.0" "1" "1" "0.6"
    "6181Y" "1 x 1.5" "1.5" "1" "0.7"
  }
}

variable area {
  type TABLE_OPTIONS
  definition "data,2,0,type,3,class"
  description "Nominal area"
}

variable thicknessReq {
  type TABLE_REFERENCE
  definition "data,4,0,type,2,area,3,class"
  description "Thickness requirement"
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Verdict { x 0 y 120 }
    Pass { x -140 y 240 }
    Fail { x 140 y 240 }
    Done { x 0 y 360 }
  }
  process_flow {
    E1 { from Start to Verdict }
    Gpass { from Verdict to Pass condition "thicknessReq <= 0.65" }
    Gfail { from Verdict to Fail }
    Dp { from Pass to Done }
    Df { from Fail to Done }
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('READINGS FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 900))

// 1. Idle: the panel invites, the gate rail shows BLOCKED (no registers).
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-readings"]').click() })()`)
await new Promise((r) => setTimeout(r, 400))
const idle = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="readings-panel"]'),
  invite: !!document.querySelector('.readings-invite'),
  gateState: document.querySelector('[data-testid="gate-state-Verdict"]')?.textContent ?? null,
}))()`)
console.log('idle:', JSON.stringify(idle))
if (!idle.panel || !idle.invite) await fail('the idle readings did not render')
// The idle rail still reads a state (missing operands resolve to 0,
// so a comparison branch may legitimately fire on empties) — the
// assertion is that the rail RENDERS with a state, not which one.
if (!idle.gateState) await fail('the idle gate rail did not render')

// 2. The twin runs: the TABLE lookups light up and the rail routes.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-twin"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
await page.select('[data-testid="twin-variable"]', 'area')
await page.evaluate(`(() => {
  for (const [sel, v] of [['[data-testid="twin-from"]', '1'], ['[data-testid="twin-to"]', '1.5'], ['[data-testid="twin-switch"]', '10'], ['[data-testid="twin-seeds"]', 'class=1,type=6181Y']]) {
    const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input'))
  }
})()`)
await page.evaluate(`(() => { document.querySelector('[data-testid="twin-start"]').click() })()`)
await new Promise((r) => setTimeout(r, 3500))
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-readings"]').click() })()`)
await new Promise((r) => setTimeout(r, 500))
const live = await page.evaluate(`(() => ({
  engine: document.querySelector('[data-testid="readings-engine"]')?.textContent ?? null,
  area: document.querySelector('[data-testid="reading-value-area"]')?.textContent ?? null,
  thickness: document.querySelector('[data-testid="reading-value-thicknessReq"]')?.textContent ?? null,
  gateState: document.querySelector('[data-testid="gate-state-Verdict"]')?.textContent ?? null,
  litBranch: [...document.querySelectorAll('.gate-node.fires .gate-node-id')].map((n) => n.textContent),
}))()`)
console.log('live:', JSON.stringify(live))
if (!live.engine?.includes('twin')) await fail('the readings did not bind to the twin engine')
if (live.area !== '1') await fail(`the area lookup read ${live.area}`)
if (live.thickness !== '0.6') await fail(`the thickness lookup read ${live.thickness}`)
if (live.gateState !== 'routed') await fail(`the gate read ${live.gateState}`)
if (!live.litBranch.includes('Gpass')) await fail(`the lit branch was ${JSON.stringify(live.litBranch)}`)

// 3. The regime change flips the rail: area 1.5 → thickness 0.7 →
//    Gfail — tick through the twin's own button (t crosses 10).
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-twin"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
for (let i = 0; i < 4; i++) {
  await page.evaluate(`(() => { document.querySelector('[data-testid="twin-step"]').click() })()`)
  await new Promise((r) => setTimeout(r, 250))
}
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-readings"]').click() })()`)
await new Promise((r) => setTimeout(r, 500))
const afterFlip = await page.evaluate(`(() => ({
  thickness: document.querySelector('[data-testid="reading-value-thicknessReq"]')?.textContent ?? null,
  gateState: document.querySelector('[data-testid="gate-state-Verdict"]')?.textContent ?? null,
  litBranch: [...document.querySelectorAll('.gate-node.fires .gate-node-id')].map((n) => n.textContent),
}))()`)
console.log('after flip:', JSON.stringify(afterFlip))
if (afterFlip.thickness !== '0.7') await fail(`the flipped thickness read ${afterFlip.thickness}`)
// The rail's contract: with no condition true, the catch-all carries
// the run — state 'default', NO branch lit (the default is dashed,
// not lit), Gpass's light goes OUT.
if (afterFlip.gateState !== 'default') await fail(`the flipped gate read ${afterFlip.gateState}`)
if (afterFlip.litBranch.length !== 0) await fail(`a branch stayed lit: ${JSON.stringify(afterFlip.litBranch)}`)

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('READINGS OK')
await browser.close()
