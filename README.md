# Deutsch → Welt

Statischer Übersetzer für GitHub Pages: Deutsch → viele Sprachen.

Es gibt **keinen Server und keinen Worker**. Die ganze Logik läuft im Browser.

## Was der Translator macht

- Deutsche Texte werden pro Zielsprache übersetzt.
- DeepL wird verwendet, wenn im Browser ein DeepL-Key gespeichert wurde.
- Fallback ist MyMemory, also auch ohne DeepL-Key nutzbar.
- Wenn DeepL fehlschlägt, wird automatisch MyMemory verwendet und oben ein Banner angezeigt:
  `DeepL funktioniert nicht mehr. Es wird ein anderer Übersetzer verwendet.`
- Sprachen sind erweiterbar, Ergebnisse werden kurzzeitig im Arbeitsspeicher/Browser force-verwaltet. Der DeepL-Key bleibt nur in `localStorage`.

## Verwendung

1. Seite öffnen.
2. Text eingeben und Enter drücken.
3. Optional in `DeepL-Einstellungen` einen DeepL-Key eintragen.

## DeepL-Key lokal speichern

Der Key wird nur im aktuellen Browser gespeichert. Auf öffentlichen Geräten nicht speichern.

## GitHub Pages

Der Standalone-Stand kann direkt von `main` / root veröffentlicht werden.
Die Dateien sind:

- `index.html`
- `.gitignore`

Dann genügt:

```text
Settings → Pages → Deploy from a branch → main → /(root)
```

Keine Umgebungsvariablen, kein Worker, kein Cloudflare und keine Paketinstallationen nötig.
