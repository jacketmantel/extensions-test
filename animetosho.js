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

  async single({ anidbEid, resolution, exclusions, fetch }, options) {
    if (!anidbEid) return []
    const query = this._buildQuery({ resolution, exclusions })
    const res = await fetch(`${this.url}?eid=${anidbEid}${query}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.length ? this._map(data, false, options?.useTorrent) : []
  }

  async batch({ anidbAid, resolution, exclusions, episode, fetch }, options) {
    if (!anidbAid) return []
    const query = this._buildQuery({ resolution, exclusions })
    const res = await fetch(`${this.url}?order=size-d&aid=${anidbAid}${query}`)
    if (!res.ok) return []
    const data = (await res.json()).filter(
      entry => entry.num_files >= Math.min(24, Math.max(2, episode ?? 1))
    )
    return data.length ? this._map(data, true, options?.useTorrent) : []
  }

  async movie({ anidbAid, resolution, exclusions, fetch }, options) {
    if (!anidbAid) return []
    const query = this._buildQuery({ resolution, exclusions })
    const res = await fetch(`${this.url}?aid=${anidbAid}${query}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.length ? this._map(data, false, options?.useTorrent) : []
  }

  async test() {
    const res = await fetch(this.url)
    return res.ok
  }
}()
