// NekoBT torrent source for Hayase.
// The old mapping file (data/nbt-mapping.json) was removed upstream. The current one is
// cache/nbt.json, keyed by NekoBT ID: { m: { m1: {tmdbId, imdbId} }, s: { s1: {tmdbId, imdbId, tvdbId} } }.
// It is inverted here into lookup tables. Manifest `url` must be base64("https://nekobt.to").

const MAPPING_URL = "https://raw.githubusercontent.com/ThaUnknown/anime-lists-ts/main/cache/nbt.json"
const API = "https://nekobt.to/api/v1/"
const EPOCH = BigInt("1735689600000")

function idToTime(id) {
  try { return new Date(Number((BigInt(id) >> 8n) + EPOCH)) } catch { return new Date(0) }
}

function buildIndex(group) {
  const idx = { tvdb: new Map(), tmdb: new Map(), imdb: new Map() }
  for (const [nekoID, ids] of Object.entries(group ?? {})) {
    if (ids.tvdbId && !idx.tvdb.has(String(ids.tvdbId))) idx.tvdb.set(String(ids.tvdbId), nekoID)
    if (ids.tmdbId && !idx.tmdb.has(String(ids.tmdbId))) idx.tmdb.set(String(ids.tmdbId), nekoID)
    if (ids.imdbId && !idx.imdb.has(ids.imdbId)) idx.imdb.set(ids.imdbId, nekoID)
  }
  return idx
}

let indexPromise = null
function getIndex() {
  if (!indexPromise) {
    indexPromise = fetch(MAPPING_URL)
      .then(res => {
        if (!res.ok) throw new Error(`mapping HTTP ${res.status}`)
        return res.json()
      })
      .then(data => ({ series: buildIndex(data.s), movies: buildIndex(data.m) }))
      .catch(err => { indexPromise = null; throw err })
  }
  return indexPromise
}

function lookup(idx, { tvdbId, tmdbId, imdbId }) {
  return (tvdbId && idx.tvdb.get(String(tvdbId))) ||
    (tmdbId && idx.tmdb.get(String(tmdbId))) ||
    (imdbId && idx.imdb.get(imdbId)) ||
    null
}

export default new class NekoBT {
  async _media(query, kind) {
    const index = await getIndex()
    // TMDB IDs for movies and TV shows overlap, so search the matching group first.
    const order = kind === "movie" ? [index.movies, index.series] : [index.series, index.movies]
    let nekoID = null
    for (const idx of order) {
      nekoID = lookup(idx, query)
      if (nekoID) break
    }
    if (!nekoID) return null
    const fetchFn = query.fetchFn
    const res = await fetchFn(`${API}media/${nekoID}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.error) return null
    return { nekoID, data: json.data }
  }

  _map(json) {
    return json?.data?.results?.map(entry => ({
      title: entry.title,
      link: `${API}torrents/${entry.id}/download?public=true`,
      seeders: Number(entry.seeders) || 0,
      leechers: Number(entry.leechers) || 0,
      downloads: Number(entry.completed) || 0,
      hash: entry.infohash,
      size: Number(entry.filesize) || 0,
      accuracy: "high",
      type: (entry.level ?? 0) >= 3 ? "alt" : undefined,
      date: idToTime(entry.id)
    })) ?? []
  }

  async _torrents(nekoID, episodeId, fetchFn) {
    let url = `${API}torrents/search?media_id=${nekoID}&fansub_lang=en%2Cenm&sub_lang=en%2Cenm`
    if (episodeId) url += `&episode_ids=${episodeId}`
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`NekoBT returned HTTP ${res.status}`)
    const json = await res.json()
    if (json.error) return []
    return this._map(json)
  }

  async single(query) {
    const fetchFn = query.fetch ?? fetch
    const media = await this._media({ ...query, fetchFn }, "series")
    if (!media) return []
    const eps = media.data?.episodes ?? []
    const ep = eps.find(e => query.tvdbEId && e.tvdbId === query.tvdbEId) ??
      eps.find(e => e.episode === query.episode)
    // Without a matching episode the search would return the whole show, so skip it.
    if (!ep?.id) return []
    return this._torrents(media.nekoID, ep.id, fetchFn)
  }

  async movie(query) {
    const fetchFn = query.fetch ?? fetch
    const media = await this._media({ ...query, fetchFn }, "movie")
    if (!media) return []
    return this._torrents(media.nekoID, null, fetchFn)
  }

  batch() { return [] }

  async test(query) {
    const f = query?.fetch ?? fetch
    let res
    try {
      res = await f(`${API}announcements`)
    } catch (err) {
      throw new Error(`Could not reach NekoBT. (${err.message})`)
    }
    if (!res.ok) throw new Error(`NekoBT returned HTTP ${res.status}. The site may be down.`)
    try {
      await getIndex()
    } catch (err) {
      throw new Error(`Could not load the NekoBT ID mapping from GitHub. (${err.message})`)
    }
    return true
  }
}()
