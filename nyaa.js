// Nyaa.si torrent source for Hayase.
// Manifest `url` must be base64("https://nyaa.si") or every request fails with "Failed to fetch".
// Nyaa's RSS feed no longer includes magnet links, so magnets are built from nyaa:infoHash.

const BASE = "https://nyaa.si"
const CAT_ENG = "1_2"
const CAT_ALL = "1_0"

const TRACKERS = [
  "http://nyaa.tracker.wf:7777/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce"
]

function magnet(hash, name) {
  const tr = TRACKERS.map(t => "&tr=" + encodeURIComponent(t)).join("")
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${tr}`
}

function parseSize(str) {
  if (!str) return 0
  const m = str.trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/i)
  if (!m) return 0
  const units = { b: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }
  return Math.round(parseFloat(m[1]) * (units[m[2].toLowerCase()] ?? 1))
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))
  if (!m) return ""
  return m[1]
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim()
}

function parseRSS(text) {
  const items = []
  const itemRx = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRx.exec(text)) !== null) {
    const block = m[1]
    const title = tag(block, "title")
    const hash = tag(block, "nyaa:infoHash").toLowerCase()
    if (!title || !hash) continue
    const seeders = parseInt(tag(block, "nyaa:seeders"), 10) || 0
    const leechers = parseInt(tag(block, "nyaa:leechers"), 10) || 0
    const pubDate = tag(block, "pubDate")
    items.push({
      title,
      link: magnet(hash, title),
      hash,
      seeders: seeders >= 30000 ? 0 : seeders,
      leechers: leechers >= 30000 ? 0 : leechers,
      downloads: parseInt(tag(block, "nyaa:downloads"), 10) || 0,
      size: parseSize(tag(block, "nyaa:size")),
      date: pubDate ? new Date(pubDate) : new Date(0),
      trusted: tag(block, "nyaa:trusted") === "Yes"
    })
  }
  return items
}

function buildUrl(title, episode, resolution, exclusions, cat) {
  const epStr = episode ? ` ${String(episode).padStart(2, "0")}` : ""
  const resStr = resolution ? ` ${resolution}p` : ""
  let q = `${title}${epStr}${resStr}`.trim()
  if (exclusions?.length) q += ` -${exclusions.join(" -")}`
  return `${BASE}/?page=rss&q=${encodeURIComponent(q)}&c=${cat}&f=0`
}

function mapEntries(items, batch = false) {
  return items.map(e => ({
    title: e.title,
    link: e.link,
    hash: e.hash,
    seeders: e.seeders,
    leechers: e.leechers,
    downloads: e.downloads,
    size: e.size,
    date: e.date,
    accuracy: e.trusted ? "medium" : "low",
    type: batch ? "batch" : undefined
  }))
}

export default new class Nyaa {
  async _fetch(url, fetchFn) {
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`Nyaa returned HTTP ${res.status}`)
    return parseRSS(await res.text())
  }

  // Try each title variant (romaji, English, ...) until one returns results.
  async _search(titles, episode, resolution, exclusions, cat, fetchFn) {
    for (const title of (titles ?? []).slice(0, 3)) {
      if (!title) continue
      const items = await this._fetch(buildUrl(title, episode, resolution, exclusions, cat), fetchFn)
      if (items.length) return items
    }
    return []
  }

  async single({ titles, episode, resolution, exclusions, fetch: f }) {
    const items = await this._search(titles, episode, resolution, exclusions, CAT_ENG, f ?? fetch)
    return mapEntries(items, false)
  }

  async batch({ titles, resolution, exclusions, fetch: f }) {
    const items = await this._search(titles, null, resolution, exclusions, CAT_ALL, f ?? fetch)
    const batches = items.filter(e => /batch|complete|\d{2}\s?[-~]\s?\d{2}/i.test(e.title))
    return mapEntries(batches.length ? batches : items.slice(0, 5), true)
  }

  async movie({ titles, resolution, exclusions, fetch: f }) {
    const items = await this._search(titles, null, resolution, exclusions, CAT_ENG, f ?? fetch)
    return mapEntries(items, false)
  }

  async test(query) {
    const f = query?.fetch ?? fetch
    let res
    try {
      res = await f(`${BASE}/?page=rss&c=1_2&f=0`)
    } catch (err) {
      throw new Error(`Could not reach Nyaa. It may be blocked on your network. (${err.message})`)
    }
    if (!res.ok) throw new Error(`Nyaa returned HTTP ${res.status}. The site may be down.`)
    return true
  }
}()
