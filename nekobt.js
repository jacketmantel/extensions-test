const mappings = fetch(
  "https://raw.githubusercontent.com/ThaUnknown/anime-lists-ts/refs/heads/main/data/nbt-mapping.json"
).then(res => res.json());

const EPOCH = BigInt("1735689600000");

function idToInfo(id) {
  const r = BigInt(id);
  return {
    time: Number((r >> 8n) + EPOCH),
    type: Number((r >> 4n) & 15n),
    increment: Number(r & 15n),
  };
}

export default new class NekoBT {
  url = "https://nekobt.to/api/v1/";

  async _media({ tvdbId, tmdbId, imdbId, fetch: f }) {
    const map = await mappings;
    const nekoID = map.tvdb?.[tvdbId] ?? map.tmdb?.[tmdbId] ?? map.imdb?.[imdbId];
    if (!nekoID) throw new Error("NekoBT: No mapping found for this anime.");
    const res = await f(`${this.url}media/${nekoID}`);
    const json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    return { nekoID, data: json.data };
  }

  _map(entries, batch = false, high = true) {
    return entries?.data?.results?.map(entry => ({
      title: entry.title,
      link: `${this.url}torrents/${entry.id}/download?public=true`,
      seeders: Number(entry.seeders),
      leechers: Number(entry.leechers),
      downloads: Number(entry.completed),
      hash: entry.infohash,
      size: Number(entry.filesize),
      accuracy: high ? "high" : "medium",
      type: (entry.level ?? 0) >= 3 ? "alt" : undefined,
      date: new Date(idToInfo(entry.id).time),
    })) ?? [];
  }

  async single({ tvdbId, tvdbEId, tmdbId, imdbId, episode, fetch: f }, _options) {
    if (!navigator.onLine) return [];
    const { data, nekoID } = await this._media({ tvdbId, tmdbId, imdbId, fetch: f });
    const ep =
      data?.episodes?.find(e => e.tvdbId === tvdbEId) ??
      data?.episodes?.find(e => e.episode === episode);

    let searchURL = `${this.url}torrents/search?media_id=${nekoID}&fansub_lang=en%2Cenm&sub_lang=en%2Cenm`;
    if (ep?.id) searchURL += `&episode_ids=${ep.id}`;

    const res = await f(searchURL);
    const json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    return this._map(json, !!tvdbEId);
  }

  batch = () => [];
  movie = () => [];

  async test() {
    try {
      const res = await fetch(`${this.url}announcements`);
      if (!res.ok) throw new Error(`NekoBT: HTTP ${res.status} — is the site down?`);
      return true;
    } catch (error) {
      throw new Error(`NekoBT: Could not reach nekobt.to. ${error.message}`);
    }
  }
};
