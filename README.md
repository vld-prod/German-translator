# German → World Translator

Статический фронтенд (`index.html`) + Cloudflare Worker (`worker.js`) как прокси для DeepL.

- DeepL используется как основной переводчик.
- Cloudflare Workers AI (`m2m100`) используется как бесплатный fallback, если DeepL недоступен или ключ не настроен.
- DeepL API key **не хранится в фронтенде и не попадает в репозиторий**. Он задаётся только как Secret в Cloudflare Worker.

## Файлы

- `index.html` — интерфейс и логика фронтенда.
- `worker.js` — Cloudflare Worker API, CORS, DeepL, fallback.
- `wrangler.toml` — конфигурация Worker.
- `.dev.vars.example` — пример локальных переменных для `wrangler dev`.
- `package.json` — скрипты для локальной разработки и деплоя.

## Локальная разработка

```bash
npm install
cp .dev.vars.example .dev.vars
# заполни .dev.vars
npm run dev
```

`wrangler dev` запустит локальный Worker, обычно на `http://127.0.0.1:8787`.

Во фронтенде в footer укажи этот URL как Proxy-URL.

## Деплой Worker

```bash
npx wrangler secret put DEEPL_KEY
npm run deploy
```

Обязательные Cloudflare-ресурсы:

- Secret: `DEEPL_KEY`
- Binding: `AI` → Workers AI, переменное имя `AI`
- Variable: `ALLOWED_ORIGIN` → URL фронтенда или `*`

Рекомендуется задать `ALLOWED_ORIGIN` на URL сайта, иначе любой может использовать прокси.

## Деплой фронтенда

Фронтенд можно хостить на GitHub Pages. В footer нужно вписать URL задеплоенного Worker.

## Как работает перевод

1. Браузер отправляет `{ text, target_lang }` в Worker.
2. Worker вызывает DeepL `/v2/translate`, source_lang фиксирован `DE`.
3. Если DeepL возвращает 429/5xx/timeout/сеть — один повтор.
4. При ошибках Worker использует Cloudflare Workers AI по чанкам текста.
5. Ответ содержит `provider: "deepl"` или `provider: "fallback"`.

## Безопасность

- Не добавляй `DEEPL_KEY` в `index.html`, `.dev.vars`, логи или коммиты.
- deep-free ключи оканчиваются на `:fx`; остальные считаются pro.
- `ALLOWED_ORIGIN = "*" удобен для теста, но для продакшена лучше указать конкретный origin.
- Workers сохраняют секрет изолированно в Cloudflare; репозиторий содержит только код.
