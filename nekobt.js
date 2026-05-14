const mappings = fetch(
  "https://raw.githubusercontent.com/ThaUnknown/anime-lists-ts/refs/heads/main/data/nbt-mapping.json"
).then(res => res.json())

const EPOCH = BigInt("1735689600000")

function idToTime(id) {
  return Number((BigInt(id) >> 8n) + EPOCH)
}

export default new class NekoBT {
  url = "https://nekobt.to/api/v1/"

  async _media({ tvdbId, tmdbId, imdbId, fetch }) {
    const map = await mappings
    const nekoID = map.tvdb?.[tvdbId] ?? map.tmdb?.[tmdbId] ?? map.imdb?.[imdbId]
    if (!nekoID) return null
    const res = await fetch(`${this.url}media/${nekoID}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.error) return null
    return { nekoID, data: json.data }
  }

  _map(entries) {
    return entries?.data?.results?.map(entry => ({
      title:     entry.title,
      link:      `${this.url}torrents/${entry.id}/download?public=true`,
      seeders:   Number(entry.seeders),
      leechers:  Number(entry.leechers),
      downloads: Number(entry.completed),
      hash:      entry.infohash,
      size:      Number(entry.filesize),
      accuracy:  "high",
      type:      (entry.level ?? 0) >= 3 ? "alt" : undefined,
      date:      new Date(idToTime(entry.id))
    })) ?? []
  }

  async single({ tvdbId, tvdbEId, tmdbId, imdbId, episode, fetch }) {
    const media = await this._media({ tvdbId, tmdbId, imdbId, fetch })
    if (!media) return []
    const { data, nekoID } = media
    const ep = data?.episodes?.find(e => e.tvdbId === tvdbEId)
            ?? data?.episodes?.find(e => e.episode === episode)
    let url = `${this.url}torrents/search?media_id=${nekoID}&fansub_lang=en%2Cenm&sub_lang=en%2Cenm`
    if (ep?.id) url += `&episode_ids=${ep.id}`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    if (json.error) return []
    return this._map(json)
  }

  batch = () => []
  movie = () => []

  async test() {
    const res = await fetch(`${this.url}announcements`)
    return res.ok
  }
}()
