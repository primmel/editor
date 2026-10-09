// The public-sites leg (TODO.editor/52, the fifth pass): the
// organization's public surfaces — primmel.org and oimlsmart.org —
// probed read-only at desktop and 390×844: mount, no horizontal
// overflow at mobile width.
import puppeteer from 'puppeteer'

const SITES = (process.env.PUBLIC_SITES ?? 'https://www.primmel.org/,https://www.oimlsmart.org/').split(',')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
let failed = false

for (const url of SITES) {
  const trimmed = url.trim()
  if (!trimmed) continue
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await page.goto(trimmed, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 2000))
    const mobile = await page.evaluate(`(() => ({
      title: document.title,
      bodyText: (document.body.innerText ?? '').length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }))()`)
    console.log(`mobile ${trimmed}: ${JSON.stringify(mobile)}`)
    if (mobile.bodyText < 20 || mobile.overflow) {
      console.log(`PUBLIC-SITES FAILED: ${trimmed} ${mobile.overflow ? 'horizontal overflow' : 'empty body'}`)
      failed = true
    }
    await page.close()
  } catch (e) {
    console.log(`PUBLIC-SITES FAILED: ${trimmed} ${(e as Error).message.slice(0, 80)}`)
    failed = true
  }
}

await browser.close()
if (failed) process.exit(1)
console.log('PUBLIC-SITES OK')
