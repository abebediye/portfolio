# Abebe Bediye — portfolio

Bilingual (Norwegian at `/`, English at `/en/`) static site built from a single source.

- `src/templates/` — one HTML template per page
- `src/partials/` — shared head, header, footer, back link
- `src/i18n/no.json`, `src/i18n/en.json` — all translatable text (keys must match; tests enforce it)
- `styles.css`, `subpage.css`, `assets/` — copied as-is

```sh
npm test         # tests + build into a temp dir
npm run build    # writes dist/
npm run serve    # build and preview at http://127.0.0.1:4173
```

To change text, edit both JSON files. To add a language, add `src/i18n/<code>.json` and an entry in `LANGUAGES` in `build.js`.

Deployment: pushes to `main` run `.github/workflows/pages.yml`, which tests, builds and publishes `dist/` to GitHub Pages (Settings → Pages → Source: GitHub Actions). `CNAME` holds the custom domain.
