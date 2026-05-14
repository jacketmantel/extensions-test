const BASE = "https://nyaa.si"
const CAT_ENG = "1_2"
const CAT_ALL = "1_0"

function parseSize(str) {
  if (!str) return 0
  const m = str.trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/i)
  if (!m) return 0
  const units = { b: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }
  return Math.round(parseFloat(m[1]) * (units[m[2].toLowerCase()] ?? 1))
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : ""
}

function parseRSS(text) {
  const items = []
  const itemRx = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRx.exec(text)) !== null) {
    const block = m[1]
    const title     = tag(block, "title")
    const pubDate   = tag(block, "pubDate")
    const seeders   = parseInt(tag(block, "nyaa:seeders"),   10) || 0
    const leechers  = parseInt(tag(block, "nyaa:leechers"),  10) || 0
    const downloads = parseInt(tag(block, "nyaa:downloads"), 10) || 0
    const sizeStr   = tag(block, "nyaa:size")
    const infoHash  = tag(block, "nyaa:infoHash")
    const trusted   = tag(block, "nyaa:trusted")
    const magnetM   = block.match(/magnet:[^<"\s]+/)
    const magnet    = magnetM ? magnetM[0] : null
    if (!title || (!magnet && !infoHash)) continue
    items.push({
      title,
      link: magnet || "",
      hash: infoHash || magnet?.match(/btih:([a-f0-9]+)/i)?.[1] || "",
      seeders:   seeders  >= 30000 ? 0 : seeders,
      leechers:  leechers >= 30000 ? 0 : leechers,
      downloads,
      size: parseSize(sizeStr),
      date: pubDate ? new Date(pubDate) : new Date(0),
      trusted: trusted === "Yes"
    })
  }
  return items
}

function buildQuery(title, episode, resolution, exclusions, cat) {
  const epStr  = episode    ? ` ${String(episode).padStart(2, "0")}` : ""
  const resStr = resolution ? ` ${resolution}p` : ""
  let q = `${title}${epStr}${resStr}`.trim()
  if (exclusions?.length) q += ` -${exclusions.join(" -")}`
  return `${BASE}/?page=rss&q=${encodeURIComponent(q)}&c=${cat}&f=0`
}

function mapEntries(items, batch = false) {
  return items.map(e => ({
    title:     e.title,
    link:      e.link,
    hash:      e.hash,
    seeders:   e.seeders,
    leechers:  e.leechers,
    downloads: e.downloads,
    size:      e.size,
    date:      e.date,
    accuracy:  e.trusted ? "high" : "medium",
    type:      batch ? "batch" : undefined
  }))
}

export default new class Nyaa {
  async _fetch(url) {
    const res = await fetch(url)
    if (!res.ok) return []
    return parseRSS(await res.text())
  }

  async single({ titles, episode, resolution, exclusions }) {
    if (!navigator.onLine || !titles?.length) return []
    const url = buildQuery(titles[0], episode, resolution, exclusions, CAT_ENG)
    return mapEntries(await this._fetch(url), false)
  }

  async batch({ titles, episode, resolution, exclusions }) {
    if (!navigator.onLine || !titles?.length) return []
    const url = buildQuery(titles[0], null, resolution, exclusions, CAT_ALL)
    const items = await this._fetch(url)
    const batches = items.filter(e => /batch|vol\.|complete|\d{2}-\d{2}/i.test(e.title))
    return mapEntries(batches.length ? batches : items.slice(0, 5), true)
  }

  async movie({ titles, resolution, exclusions }) {
    if (!navigator.onLine || !titles?.length) return []
    const url = buildQuery(titles[0], null, resolution, exclusions, CAT_ENG)
    return mapEntries(await this._fetch(url), false)
  }

  async test() {
    const res = await fetch(`${BASE}/?page=rss&c=1_2&f=0`)
    return res.ok
  }
}()
