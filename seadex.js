export default new class SeaDex {
  url = "https://releases.moe/api/collections/entries/records"

  async _search({ anilistId, titles, episodeCount }) {
    if (!navigator.onLine) return []
    if (!anilistId) return []
    if (!titles?.length) return []

    const res = await fetch(
      `${this.url}?page=1&perPage=1&filter=alID%3D%22${anilistId}%22&skipTotal=1&expand=trs`
    )
    if (!res.ok) return []
    const { items } = await res.json()
    if (!items?.[0]?.expand?.trs?.length) return []

    return items[0].expand.trs
      .filter(({ infoHash, files }) =>
        infoHash !== "<redacted>" &&
        (!episodeCount || episodeCount === 1 || files.length !== 1)
      )
      .map(torrent => ({
        hash: torrent.infoHash,
        link: torrent.infoHash,
        title: torrent.files.length === 1
          ? torrent.files[0].name
          : `[${torrent.releaseGroup}] ${titles[0]}${torrent.dualAudio ? " Dual Audio" : ""}`,
        size: torrent.files.reduce((sum, f) => sum + f.length, 0),
        type: torrent.isBest ? "best" : "alt",
        date: new Date(torrent.created),
        seeders: 0,
        leechers: 0,
        downloads: 0,
        accuracy: "high"
      }))
  }

  single = (query) => this._search(query)
  batch = (query) => this._search(query)
  movie = (query) => this._search(query)

  async test() {
    const res = await fetch(this.url)
    return res.ok
  }
}()export default new class SeaDex {
  url = "https://releases.moe/api/collections/entries/records";

  async _search({ anilistId, titles, episodeCount }) {
    if (!navigator.onLine) return [];
    if (!anilistId) throw new Error("SeaDex: No anilistId provided");
    if (!titles?.length) throw new Error("SeaDex: No titles provided");

    const res = await fetch(
      `${this.url}?page=1&perPage=1&filter=alID%3D%22${anilistId}%22&skipTotal=1&expand=trs`
    );
    if (!res.ok) throw new Error(`SeaDex: HTTP ${res.status}`);
    const { items } = await res.json();

    if (!items?.[0]?.expand?.trs?.length) return [];
    const { trs } = items[0].expand;

    return trs
      .filter(({ infoHash, files }) =>
        infoHash !== "<redacted>" &&
        (!episodeCount || episodeCount === 1 || files.length !== 1)
      )
      .map(torrent => ({
        hash: torrent.infoHash,
        link: torrent.infoHash,
        title:
          torrent.files.length === 1
            ? torrent.files[0].name
            : `[${torrent.releaseGroup}] ${titles[0]}${torrent.dualAudio ? " Dual Audio" : ""}`,
        size: torrent.files.reduce((sum, f) => sum + f.length, 0),
        type: torrent.isBest ? "best" : "alt",
        date: new Date(torrent.created),
        seeders: 0,
        leechers: 0,
        downloads: 0,
        accuracy: "high",
      }));
  }

  single = this._search.bind(this);
  batch = this._search.bind(this);
  movie = this._search.bind(this);

  async test() {
    try {
      const res = await fetch(this.url);
      if (!res.ok) throw new Error(`SeaDex: HTTP ${res.status} — is the site down?`);
      return true;
    } catch (error) {
      throw new Error(`SeaDex: Could not reach releases.moe. ${error.message}`);
    }
  }
};
