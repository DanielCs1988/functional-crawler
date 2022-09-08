export interface NewsEntry {
  readonly title: string
  readonly order: number
  readonly comments: number | null
  readonly score: number | null
}

export interface ProcessedNews {
  readonly longTitles: ReadonlyArray<NewsEntry>
  readonly shortTitles: ReadonlyArray<NewsEntry>
}
