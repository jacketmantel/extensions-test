// AnimeTosho torrent source for Hayase.
// Manifest `url` must be base64("https://feed.animetosho.org") or every request fails with "Failed to fetch".

const QUALITIES = ["2160", "1080", "720", "540", "480"]

export default new class AnimeTosho {
  url = "https://feed.animetosho.org/json"

  _buildQuery({ resolution, exclusions }) {
    const parts = []
    if (exclusions?.length) parts.push(`!("${exclusions.join('"|"')}")`)
    if (resolution && QUALITIES.includes(resolution)) {
      const blocked = QUALITIES.filter(q => q !== resolution)
      if (blocked.length) parts.push(`!(*${blocked.join("*|*")}*)`)
    }
    if (!parts.length) return ""
    return `&qx=1&q=${parts.join("")}`
  }

  _map(entries, batch = false, useTorrent = false) {
    return entries.map(entry => ({
      title: entry.title || entry.torrent_name,
      link: useTorrent ? entry.torrent_url : entry.magnet_uri,
      seeders: (entry.seeders || 0) >= 30000 ? 0 : (entry.seeders || 0),
      leechers: (entry.leechers || 0) >= 30000 ? 0 : (entry.leechers || 0),
      downloads: entry.torrent_downloaded_count || 0,
      hash: entry.info_hash,
      size: entry.total_size,
      accuracy: entry.anidb_fid && !batch ? "high" : "medium",
      type: batch ? "batch" : undefined,
      date: new Date(entry.timestamp * 1000)
    }))
  }

  async single({ anidbEid, titles, episode, resolution, exclusions, fetch: f }, options) {
    if (!anidbEid) {
      // No AniDB episode ID from Hayase, so fall back to a plain title search.
      if (!titles?.[0]) return []
      const ep = episode ? ` ${String(episode).padStart(2, "0")}` : ""
      const res = resolution ? ` ${resolution}p` : ""
      const q = encodeURIComponent(`${titles[0]}${ep}${res}`)
      const r = await (f ?? fetch)(`${this.url}?q=${q}`)
      if (!r.ok) throw new Error(`AnimeTosho returned HTTP ${r.status}`)
      const data = (await r.json()).filter(e =>
        !exclusions?.some(x => (e.title || "").toLowerCase().includes(x.toLowerCase())))
      return this._map(data, false, options?.useTorrent).map(e => ({ ...e, accuracy: "low" }))
    }
    const query = this._buildQuery({ resolution, exclusions })
    const res = await (f ?? fetch)(`${this.url}?eid=${anidbEid}${query}`)
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}`)
    const data = await res.json()
    return data.length ? this._map(data, false, options?.useTorrent) : []
  }

  async batch({ anidbAid, resolution, exclusions, episode, fetch: f }, options) {
    if (!anidbAid) return []
    const query = this._buildQuery({ resolution, exclusions })
    const res = await (f ?? fetch)(`${this.url}?order=size-d&aid=${anidbAid}${query}`)
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}`)
    const data = (await res.json()).filter(
      entry => entry.num_files >= Math.min(24, Math.max(2, episode ?? 1))
    )
    return data.length ? this._map(data, true, options?.useTorrent) : []
  }

  async movie({ anidbAid, resolution, exclusions, fetch: f }, options) {
    if (!anidbAid) return []
    const query = this._buildQuery({ resolution, exclusions })
    const res = await (f ?? fetch)(`${this.url}?aid=${anidbAid}${query}`)
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}`)
    const data = await res.json()
    return data.length ? this._map(data, false, options?.useTorrent) : []
  }

  async test(query) {
    const f = query?.fetch ?? fetch
    let res
    try {
      res = await f(`${this.url}?q=test`)
    } catch (err) {
      throw new Error(`Could not reach AnimeTosho. (${err.message})`)
    }
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}. The site may be down.`)
    return true
  }
}()
