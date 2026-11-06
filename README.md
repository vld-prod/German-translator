# Deutsch → Welt

Deutsch → viele Sprachen.

Diese Version nutzt einen **Cloudflare Worker** als Proxy für DeepL. Der DeepL-Key bleibt in Cloudflare, nicht im Browser.

## Architektur

- Frontend: GitHub Pages (`index.html`)
- Backend: Cloudflare Worker (`worker.js`)
- DeepL: Workers-Secret `DEEPL_KEY`
- Fallback: Cloudflare Workers AI (`m2m100`)

## GitHub Secrets für autodeploy

In GitHub: `Settings → Secrets and variables → Actions` anlegen:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DEEPL_KEY`

### Cloudflare API Token Rechte
Erstelle ein API Token mit mindestens:
- Account → Workers Scripts → Edit
- Account → Workers AI → Use
- Account → Workers R2? nicht nötig
- Falls Worker unter einer Zone läuft: Zone → Workers Routes → Edit, kann nötig sein.

### DeepL Key
Setze ihn als Secret `DEEPL_KEY` mit dem Wert, z. B. einem Free-Key `...:fx`.

## Lokale Entwicklung

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars ausfüllen
npm run dev
```

## Frontend-URL Worker eintragen

Nach dem ersten successful GitHub Action:
1. In Actions-Log die Worker-URL kopieren (meistens `https://german-translator-proxy.<subdomain>.workers.dev`).
2. Auf der Website unten `Proxy-Einstellungen` öffnen.
3. URL eintragen und Enter drücken.

## Arbeitsablauf nach dem Setup

1. Du schreibst: Ändere etwas.
2. Der Agent ändert Code und pusht.
3. GitHub Actions deployt Worker automatisch.
4. Die Website ruft Worker auf und nutzt DeepL, bei Fehlern Workers-AI-Fallback.

## CORS

`ALLOWED_ORIGIN` ist in `wrangler.toml` auf `"*"` gesetzt. Für Produktion kannst du es später auf `https://vld-prod.github.io` beschränken.
