const BASE = "https://nyaa.si";
// Category codes: 1_2 = Anime/English-translated, 1_0 = Anime/All
const CAT_SINGLE = "1_2";
const CAT_ALL    = "1_0";

// Parse nyaa's human-readable size string into bytes
function parseSize(str) {
  if (!str) return 0;
  const m = str.trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/i);
  if (!m) return 0;
  const units = { b: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
  return Math.round(parseFloat(m[1]) * (units[m[2].toLowerCase()] ?? 1));
}

// Extract text content of a tag from an XML string
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : "";
}

function parseRSS(text) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRx.exec(text)) !== null) {
    const block = m[1];
    const title     = tag(block, "title");
    const link      = tag(block, "link") || tag(block, "guid");
    const pubDate   = tag(block, "pubDate");
    const seeders   = parseInt(tag(block, "nyaa:seeders"),   10) || 0;
    const leechers  = parseInt(tag(block, "nyaa:leechers"),  10) || 0;
    const downloads = parseInt(tag(block, "nyaa:downloads"), 10) || 0;
    const sizeStr   = tag(block, "nyaa:size");
    const infoHash  = tag(block, "nyaa:infoHash");
    const trusted   = tag(block, "nyaa:trusted");
    // magnet link is in <link> for nyaa RSS
    const magnetM   = block.match(/magnet:[^<"\s]+/);
    const magnet    = magnetM ? magnetM[0] : null;

    if (!title || (!magnet && !infoHash)) continue;
    items.push({
      title,
      link: magnet || link,
      hash: infoHash || (magnet?.match(/btih:([a-f0-9]+)/i)?.[1] ?? ""),
      seeders:   seeders  >= 30000 ? 0 : seeders,
      leechers:  leechers >= 30000 ? 0 : leechers,
      downloads,
      size: parseSize(sizeStr),
      date: pubDate ? new Date(pubDate) : new Date(0),
      trusted: trusted === "Yes",
    });
  }
  return items;
}

function buildQuery(titles, episode, resolution, exclusions, cat) {
  // Build the search string: best title + episode number + optional resolution
  const title = titles?.[0] ?? "";
  const epStr = episode != null ? ` ${String(episode).padStart(2, "0")}` : "";
  const resStr = resolution ? ` ${resolution}p` : "";
  let q = `${title}${epStr}${resStr}`.trim();
  if (exclusions?.length) {
    q += ` -${exclusions.join(" -")}`;
  }
  return `${BASE}/?page=rss&q=${encodeURIComponent(q)}&c=${cat}&f=0`;
}

function mapEntries(items, batch = false) {
  return items.map(entry => ({
    title:     entry.title,
    link:      entry.link,
    hash:      entry.hash,
    seeders:   entry.seeders,
    leechers:  entry.leechers,
    downloads: entry.downloads,
    size:      entry.size,
    date:      entry.date,
    accuracy:  entry.trusted ? "high" : "medium",
    type:      batch ? "batch" : undefined,
  }));
}

export default new class Nyaa {
  url = BASE;

  async _search(url) {
    const res = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!res.ok) throw new Error(`Nyaa: HTTP ${res.status}`);
    return parseRSS(await res.text());
  }

  async single({ titles, episode, resolution, exclusions }, _options) {
    if (!navigator.onLine) return [];
    if (!titles?.length) throw new Error("Nyaa: No titles provided");
    const url = buildQuery(titles, episode, resolution, exclusions, CAT_SINGLE);
    const items = await this._search(url);
    return mapEntries(items, false);
  }

  async batch({ titles, episode, resolution, exclusions }, _options) {
    if (!navigator.onLine) return [];
    if (!titles?.length) throw new Error("Nyaa: No titles provided");
    // Batch: search without episode number, filter to multi-file hints in title
    const url = buildQuery(titles, null, resolution, exclusions, CAT_ALL);
    const items = await this._search(url);
    // Heuristic: batch releases often say "Batch", "Vol", "Complete", or have episode ranges like "01-12"
    const batchKeywords = /batch|vol\.|complete|\d{2}-\d{2}/i;
    const batches = items.filter(e => batchKeywords.test(e.title));
    return mapEntries(batches.length ? batches : items.slice(0, 5), true);
  }

  async movie({ titles, resolution, exclusions }, _options) {
    if (!navigator.onLine) return [];
    if (!titles?.length) throw new Error("Nyaa: No titles provided");
    const url = buildQuery(titles, null, resolution, exclusions, CAT_SINGLE);
    const items = await this._search(url);
    return mapEntries(items, false);
  }

  async test() {
    try {
      const res = await fetch(`${this.url}/?page=rss&c=1_2&f=0`);
      if (!res.ok) throw new Error(`Nyaa: HTTP ${res.status} — is the site down?`);
      return true;
    } catch (error) {
      throw new Error(`Nyaa: Could not reach nyaa.si. ${error.message}`);
    }
  }
};
