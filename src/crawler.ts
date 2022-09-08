import { launch } from 'puppeteer'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/function'

import {NewsEntry, ProcessedNews} from "./types";

async function run(): Promise<void> {
  const url = 'https://news.ycombinator.com/'
  console.log(`[${new Date().toISOString()}] Crawler starting...`)

  await pipe(
    TE.tryCatch(
      () => launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
        headless: true,
      }),
      reason => new Error(`Could not launch browser. Reason: ${reason}`),
    ),
    TE.chain(
      browser => TE.tryCatch(
        async () => {
          const results = await pipe(
            TE.tryCatch(
              () => browser.newPage(),
              reason => new Error(`Could not open new page. Reason: ${reason}`),
            ),
            TE.chain(
              page => TE.tryCatch(
                async () => {
                  await page.goto(url, { waitUntil: 'networkidle0' })

                  return page
                },
                reason => new Error(`Could not navigate to Hacker News. Reason: ${reason}`),
              ),
            ),
            TE.chain(
              page => TE.tryCatch(
                () => page.evaluate(crawlPage),
                reason => new Error(`Something went wrong while crawling Hacker News. Reason: ${reason}`),
              ),
            ),
            TE.map(calculateResults),
          )
          console.log(results)

          return browser
        },
        reason => new Error(`Something went wrong. Reason: ${reason}`),
      ),
    ),
    TE.chain(
      browser => TE.tryCatch(
        () => browser.close(),
        reason => new Error(`Could not close browser. Reason: ${reason}`),
      ),
    ),
  )
}

function crawlPage(): NewsEntry[] {
  const news = document.querySelectorAll('.athing')

  return Array.from(news).map(item => {
    const id = item.id
    const titles = item.querySelectorAll('.title')
    const score = document
      .querySelector(`#score_${id}`)
      ?.textContent
      .replace(/\s+points/, '')
    const comments = document
      .querySelectorAll(`a[href="item?id=${id}"]`)[1]
      ?.textContent
      .replace(/\s+comments/, '')

    return {
      comments: Number(comments),
      score: Number(score),
      order: Number(titles[0].textContent.replace('.', '')),
      title: titles[1].querySelector('a').textContent,
    }
  })
}

function calculateResults(data: NewsEntry[]): ProcessedNews {
  const longTitles = data
    .filter(result => {
      return result.title.split(/\s+/).length > 5
    })
    .sort((a, b) => a.comments - b.comments)

  const shortTitles = data
    .filter(result => {
      return result.title.split(/\s+/).length <= 5
    })
    .sort((a, b) => a.score - b.score)

  return {
    longTitles,
    shortTitles,
  }
}

run()
