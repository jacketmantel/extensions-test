// SeaDex torrent source for Hayase.
// releases.moe now redirects to seadex.moe, and a cross-domain redirect breaks inside Hayase,
// so this calls seadex.moe directly. Manifest `url` must be base64("https://seadex.moe").

const URL_BASE = "https://seadex.moe/api/collections/entries/records"

export default new class SeaDex {
  async _search({ anilistId, titles, episodeCount, fetch: f }) {
    if (!anilistId) return []
    const fetchFn = f ?? fetch
    const filter = encodeURIComponent(`alID="${anilistId}"`)
    const res = await fetchFn(`${URL_BASE}?page=1&perPage=1&filter=${filter}&skipTotal=1&expand=trs`)
    if (!res.ok) throw new Error(`SeaDex returned HTTP ${res.status}`)
    const { items } = await res.json()
    const trs = items?.[0]?.expand?.trs
    if (!trs?.length) return []

    const name = titles?.[0] ?? "Unknown"
    return trs
      .filter(({ infoHash, files }) =>
        infoHash && infoHash !== "<redacted>" &&
        (!episodeCount || episodeCount === 1 || (files?.length ?? 0) !== 1)
      )
      .map(t => ({
        hash: t.infoHash,
        link: t.infoHash,
        title: t.files?.length === 1
          ? t.files[0].name
          : `[${t.releaseGroup}] ${name}${t.dualAudio ? " Dual Audio" : ""}`,
        size: (t.files ?? []).reduce((sum, file) => sum + (file.length || 0), 0),
        type: t.isBest ? "best" : "alt",
        date: new Date(t.created),
        seeders: 0,
        leechers: 0,
        downloads: 0,
        accuracy: "high"
      }))
  }

  single(query) { return this._search(query) }
  batch(query) { return this._search(query) }
  movie(query) { return this._search(query) }

  async test(query) {
    const f = query?.fetch ?? fetch
    let res
    try {
      res = await f(`${URL_BASE}?perPage=1&skipTotal=1`)
    } catch (err) {
      throw new Error(`Could not reach SeaDex. (${err.message})`)
    }
    if (!res.ok) throw new Error(`SeaDex returned HTTP ${res.status}. The API may be down.`)
    return true
  }
}()
