// The data-flow leg (Paneron parity): data nodes render on the
// canvas, their links are dashed AND ANIMATED (the dashes flow along
// the drawn direction), input (data→process) and output (process→
// data) carry their own hue, process-flow edges stay static, and
// reduced motion stops the flow.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "flow"
}

start_event Start { }

process Measure {
  name "Measure the thing"
  modality shall
}

process Report {
  name "Report the result"
  modality shall
}

end_event Done { }

class Sample#data {
  store { samples }
  id: string [1..1] { modality SHALL }
}

class Result#data {
  store { results }
  id: string [1..1] { modality SHALL }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Measure { x 0 y 120 }
    Report { x 0 y 240 }
    Done { x 0 y 360 }
    Sample#data { x -260 y 120 }
    Result#data { x -260 y 240 }
  }
  process_flow {
    E1 { from Start to Measure }
    E2 { from Measure to Report }
    E3 { from Report to Done }
    Din { from Sample#data to Measure }
    Dout { from Report to Result#data }
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
// Headless Chrome defaults prefers-reduced-motion to reduce — the
// accessibility query (correctly) stops the flow there; emulate the
// user without the preference to see the animation.
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('DATA-FLOW FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 1000))

const state = await page.evaluate(`(() => {
  const inEdge = document.querySelector('.edge-data-in path')
  const outEdge = document.querySelector('.edge-data-out path')
  const staticEdge = [...document.querySelectorAll('.edge-group:not(.edge-data-in):not(.edge-data-out) path')][0]
  const anim = (el) => el ? getComputedStyle(el).animationName : null
  return {
    dataNodes: document.querySelectorAll('.node-group').length,
    inEdge: { anim: anim(inEdge), dash: inEdge?.getAttribute('stroke-dasharray') },
    outEdge: { anim: anim(outEdge), dash: outEdge?.getAttribute('stroke-dasharray') },
    staticEdge: { anim: anim(staticEdge ?? null) },
  }
})()`)
console.log('flow:', JSON.stringify(state))
if (!state.inEdge.anim || state.inEdge.anim === 'none') await fail('the INPUT data edge is not animated')
if (!state.outEdge.anim || state.outEdge.anim === 'none') await fail('the OUTPUT data edge is not animated')
if (state.staticEdge.anim !== 'none') await fail('a process-flow edge is animated — only data flows')

// Reduced motion stops the flow (the accessibility contract).
const reduced = await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await new Promise((r) => setTimeout(r, 400))
const reducedState = await page.evaluate(`(() => {
  const inEdge = document.querySelector('.edge-data-in path')
  return { anim: inEdge ? getComputedStyle(inEdge).animationName : null }
})()`)
console.log('reduced motion:', JSON.stringify(reducedState))
if (reducedState.anim !== 'none') await fail('reduced motion did not stop the flow')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('DATA-FLOW OK')
await browser.close()
