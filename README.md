# extensions-test

Torrent source extensions for [Hayase](https://hayase.watch): AnimeTosho, SeaDex, Nyaa and NekoBT.

## Install

In Hayase, open Settings > Extensions > Repositories. Paste this URL and import:

```
https://raw.githubusercontent.com/jacketmantel/extensions-test/main/index.json
```

## Notes for editing

- Each manifest entry needs a `url` field. It is the base64 of the site the script calls, for example `btoa('https://nyaa.si')`. Hayase blocks requests to any other site, which shows up as "Failed to fetch".
- `description` is required.
- Bump `version` after any change so Hayase picks up the update.
- Use `query.fetch` inside `single`, `batch` and `movie`.
- `test()` should return `true` or throw an error message the user can read.
