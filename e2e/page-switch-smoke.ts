// The page-switch fit (the ninth pass): switching canvas tabs fits
// the new page's content — the cull can hide a whole page that sits
// outside the previous page's window, so the fit reads the RAW
// children. Round trip: Root → Second (centered) → Root.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "multi"
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 120 }
    Done { x 0 y 240 }
  }
  process_flow {
    E1 { from Start to P1 }
    E2 { from P1 to Done }
  }
}

canvas Second {
  elements {
    A { x 900 y 900 }
    B { x 900 y 1050 }
  }
  process_flow {
    E9 { from A to B }
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

const fail = async (why: string) => { console.log('PAGE-SWITCH FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 900))
const root = await page.evaluate(`(() => ({ n: document.querySelectorAll('.node-group').length }))()`)
if (root.n !== 3) await fail(`Root rendered ${root.n} nodes`)

await page.evaluate(`(() => { [...document.querySelectorAll('.canvas-tab')].find((t) => t.textContent?.includes('Second'))?.click() })()`)
await new Promise((r) => setTimeout(r, 700))
const second = await page.evaluate(`(() => {
  const rect = document.querySelector('.canvas-svg').getBoundingClientRect()
  const nodes = [...document.querySelectorAll('.node-group')].map((n) => {
    const r = n.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  })
  return {
    n: nodes.length,
    centered: nodes.length > 0 && Math.abs(nodes.reduce((a, p) => a + p.cx, 0) / nodes.length - (rect.left + rect.width / 2)) < 120,
  }
})()`)
console.log('second:', JSON.stringify(second))
if (second.n !== 2) await fail(`Second rendered ${second.n} nodes (the cull hid the page)`)
if (!second.centered) await fail('the switched page is not centered')

await page.evaluate(`(() => { [...document.querySelectorAll('.canvas-tab')].find((t) => t.textContent?.includes('Root'))?.click() })()`)
await new Promise((r) => setTimeout(r, 700))
const back = await page.evaluate(`(() => ({ n: document.querySelectorAll('.node-group').length }))()`)
if (back.n !== 3) await fail(`Root did not restore (${back.n})`)

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('PAGE-SWITCH OK')
await browser.close()
