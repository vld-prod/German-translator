// Cloudflare Worker — Übersetzungs-Proxy mit automatischem Ersatzübersetzer.
//
// 1) DeepL (Hauptübersetzer)  →  2) Cloudflare Workers AI m2m100 (kostenloser Ersatz)
//
// Nötig:
//   Secret   DEEPL_KEY       – dein DeepL-API-Schlüssel
//   Binding  AI              – Workers AI (Settings → Bindings → Add → Workers AI, Variablenname: AI)
// Optional:
//   Variable ALLOWED_ORIGIN  – z. B. https://translator.pages.dev (nur diese Seite darf den Proxy nutzen)

const AI_MODEL = "@cf/meta/m2m100-1.2b";

// DeepL-Code → m2m100-Code. Sprachen, die fehlen (z. B. Kurdisch), kann der Ersatz nicht übersetzen.
const FALLBACK_LANG = {
  "EN-GB":"en","EN-US":"en","EN":"en","RU":"ru","UK":"uk","ES":"es","ES-419":"es","AR":"ar","FA":"fa","TR":"tr",
  "FR":"fr","IT":"it","PT-BR":"pt","PT-PT":"pt","PT":"pt","NL":"nl","PL":"pl","CS":"cs","SK":"sk","SL":"sl","HU":"hu",
  "RO":"ro","BG":"bg","EL":"el","HE":"he","SV":"sv","DA":"da","NB":"no","FI":"fi","ET":"et","LV":"lv","LT":"lt",
  "ID":"id","VI":"vi","JA":"ja","KO":"ko","ZH":"zh","ZH-HANS":"zh","ZH-HANT":"zh","HI":"hi","BN":"bn","KK":"kk",
  "UZ":"uz","AZ":"az","KA":"ka","BE":"be","HR":"hr","BS":"bs","SQ":"sq","SW":"sw","TA":"ta","MR":"mr","NE":"ne",
  "MN":"mn","TL":"tl","AF":"af","CA":"ca","GL":"gl","GA":"ga","CY":"cy","YI":"yi","HA":"ha","ZU":"zu",
  "BA":"ba","BR":"br","CEB":"ceb","GU":"gu","HT":"ht","IS":"is","LB":"lb","LN":"ln","MG":"mg","MK":"mk","MY":"my",
  "OC":"oc","PS":"ps","SU":"su","TH":"th","WO":"wo","XH":"xh","UR":"ur",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply({ error: "Nur POST erlaubt" }, 405, cors);
    if (allowed !== "*" && origin !== allowed) return reply({ error: "Zugriff verweigert" }, 403, cors);

    let body;
    try { body = await request.json(); } catch { return reply({ error: "Ungültiges JSON" }, 400, cors); }
    const text = typeof body.text === "string" ? body.text : "";
    const target = typeof body.target_lang === "string" ? body.target_lang.toUpperCase() : "";
    if (!text.trim() || !target || text.length > 5000) return reply({ error: "Ungültige Anfrage" }, 400, cors);

    // 1) DeepL
    const d = await viaDeepL(env, text, target);
    if (d.ok) return reply({ translations: [{ text: d.text }], provider: "deepl" }, 200, cors);

    // 2) Ersatzübersetzer
    const f = await viaFallback(env, text, target);
    if (f.ok) return reply({ translations: [{ text: f.text }], provider: "fallback", reason: d.reason }, 200, cors);

    return reply({ error: f.error || d.reason || "Übersetzung fehlgeschlagen" }, 502, cors);
  },
};

async function viaDeepL(env, text, target) {
  if (!env.DEEPL_KEY) return { ok: false, reason: "DEEPL_KEY fehlt" };
  // Free-Schlüssel enden auf ":fx"
  const host = env.DEEPL_KEY.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";

  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`https://${host}/v2/translate`, {
        method: "POST",
        headers: { "Authorization": `DeepL-Auth-Key ${env.DEEPL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: [text], source_lang: "DE", target_lang: target,
          model_type: "prefer_quality_optimized", // nötig für neuere Sprachen (Persisch, Kurdisch …)
        }),
        signal: ctrl.signal,
      });
      if (r.ok) {
        const data = await r.json();
        const out = data && data.translations && data.translations[0] && data.translations[0].text;
        if (typeof out === "string" && out) return { ok: true, text: out };
        return { ok: false, reason: "DeepL: ungültige Antwort" };
      }
      // 429 (zu viele Anfragen) und 5xx (Serverfehler): einmal kurz warten und wiederholen
      if ((r.status === 429 || r.status >= 500) && attempt === 0) { await sleep(500); continue; }
      // 456 = Kontingent aufgebraucht, 403 = Schlüssel ungültig, usw.
      return { ok: false, reason: "DeepL HTTP " + r.status };
    } catch (e) {
      if (attempt === 0) { await sleep(300); continue; }
      return { ok: false, reason: "DeepL nicht erreichbar" };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: "DeepL: unbekannter Fehler" };
}

async function viaFallback(env, text, target) {
  if (!env.AI) return { ok: false, error: "Ersatzübersetzer nicht eingerichtet (Binding „AI“ fehlt)" };
  const code = FALLBACK_LANG[target];
  if (!code) return { ok: false, error: "Diese Sprache kann der Ersatzübersetzer nicht" };
  try {
    const parts = await Promise.all(chunk(text, 400).map(async c => {
      const lead = c.match(/^\s*/)[0], trail = c.match(/\s*$/)[0], core = c.trim();
      if (!core) return c;
      const r = await env.AI.run(AI_MODEL, { text: core, source_lang: "de", target_lang: code });
      const t = r && r.translated_text;
      if (typeof t !== "string" || !t || t.startsWith("ERROR")) throw new Error("leere Antwort");
      return lead + t + trail;
    }));
    return { ok: true, text: parts.join("") };
  } catch (e) {
    return { ok: false, error: "Ersatzübersetzer fehlgeschlagen" };
  }
}

// Text in Stücke (~max Zeichen) an Satz-/Zeilengrenzen teilen, Leerraum bleibt erhalten
function chunk(text, max) {
  const segs = text.match(/[^.!?\n]+[.!?]*\s*|\n+|[.!?]+\s*/g) || [text];
  const out = []; let cur = "";
  for (const s of segs) {
    if (cur && (cur + s).length > max) { out.push(cur); cur = ""; }
    cur += s;
  }
  if (cur) out.push(cur);
  return out;
}

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
