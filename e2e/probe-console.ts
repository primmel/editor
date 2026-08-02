import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('pageerror', e => console.log('PAGE ERROR:', (e.stack ?? String(e)).slice(0, 500)))
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300)) })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 4000))
console.log('app html length:', await page.evaluate(() => document.querySelector('#app')?.innerHTML.length ?? -1))
await browser.close()
