import { launch } from 'puppeteer'
import * as TE from 'fp-ts/lib/TaskEither'
import * as RA from 'fp-ts/lib/ReadonlyArray'
import * as N from 'fp-ts/Number'
import { pipe } from 'fp-ts/lib/function'

import {NewsEntry, ProcessedNews} from "./types";
import {contramap} from "fp-ts/Ord";

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
          await pipe(
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
            TE.map(results => {
              console.log(results)
            }),
          )()

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
  )()

  console.log(`[${new Date().toISOString()}] Crawler finished.`)
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

function calculateResults(data: ReadonlyArray<NewsEntry>): ProcessedNews {
  const longTitles = pipe(
    data,
    RA.filter(result => {
      return result.title.split(/\s+/).length > 5
    }),
    RA.sort(
      pipe(
        N.Ord,
        contramap((result: NewsEntry) => result.comments),
      )
    )
  )

  const shortTitles = pipe(
    data,
    RA.filter(result => {
      return result.title.split(/\s+/).length <= 5
    }),
    RA.sort(
      pipe(
        N.Ord,
        contramap((result: NewsEntry) => result.score),
      )
    )
  )

  return {
    longTitles,
    shortTitles,
  }
}

run()
