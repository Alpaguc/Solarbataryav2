const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY } = require("../config/env");

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const LEGACY_INDEX = path.join(PROJECT_ROOT, "index.html");
const LEGACY_SCRIPT = path.join(PROJECT_ROOT, "script.js");
const LEGACY_LOGO_SVG = path.join(PROJECT_ROOT, "solar-logo.svg");
const LEGACY_LOGO_PNG = path.join(PROJECT_ROOT, "Logo.png");
const tokenDogrulamaCache = new Map();

function getTokenCacheSure(token) {
  const decoded = jwt.decode(token);
  if (decoded && decoded.exp) {
    return Number(decoded.exp) * 1000;
  }
  return Date.now() + 5 * 60 * 1000;
}

function cachedeTokenGecerliMi(token) {
  const sonKullanma = tokenDogrulamaCache.get(token);
  if (!sonKullanma) {
    return false;
  }
  if (sonKullanma <= Date.now()) {
    tokenDogrulamaCache.delete(token);
    return false;
  }
  return true;
}

async function supabaseTokenDogrula(token) {
  if (!SUPABASE_URL) {
    return false;
  }

  const headers = {
    Authorization: `Bearer ${token}`
  };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
  }

  const cevap = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  return cevap.ok;
}

async function verifyLegacyToken(req, res, next) {
  const token = String(req.query.token || "");
  if (!token) {
    res.status(401).send("Legacy arayuz icin token zorunludur.");
    return;
  }

  if (cachedeTokenGecerliMi(token)) {
    next();
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    tokenDogrulamaCache.set(token, getTokenCacheSure(token));
    next();
    return;
  } catch (_err) {
    // Supabase tokeni olma ihtimaline karsi ikinci dogrulama
  }

  try {
    const supabaseGecerli = await supabaseTokenDogrula(token);
    if (supabaseGecerli) {
      tokenDogrulamaCache.set(token, getTokenCacheSure(token));
      next();
      return;
    }
    res.status(401).send("Token gecersiz.");
  } catch (_err) {
    res.status(401).send("Token gecersiz.");
  }
}

router.get("/legacy", verifyLegacyToken, (req, res) => {
  if (!fs.existsSync(LEGACY_INDEX)) {
    res.status(404).send("Legacy index bulunamadi.");
    return;
  }

  const token = String(req.query.token || "");
  const safeToken = encodeURIComponent(token);
  let html = fs.readFileSync(LEGACY_INDEX, "utf8");

  // Legacy dosyayi yeni API sunucusuna baglamak icin yollari duzenle
  html = html.replace('src="script.js"', `src="/legacy-assets/script.js?token=${safeToken}"`);
  html = html.replace('src="Logo.png"', `src="/legacy-assets/Logo.png?token=${safeToken}"`);

  const tokenBootstrap = `<script>localStorage.setItem('authToken', ${JSON.stringify(token)});</script>`;
  html = html.replace("</head>", `${tokenBootstrap}</head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/legacy-assets/script.js", verifyLegacyToken, (_req, res) => {
  if (!fs.existsSync(LEGACY_SCRIPT)) {
    res.status(404).send("script.js bulunamadi.");
    return;
  }
  res.sendFile(LEGACY_SCRIPT);
});

router.get("/legacy-assets/solar-logo.svg", verifyLegacyToken, (_req, res) => {
  if (!fs.existsSync(LEGACY_LOGO_SVG)) {
    res.status(404).send("solar-logo.svg bulunamadi.");
    return;
  }
  res.sendFile(LEGACY_LOGO_SVG);
});

router.get("/legacy-assets/Logo.png", verifyLegacyToken, (_req, res) => {
  if (fs.existsSync(LEGACY_LOGO_PNG)) {
    res.sendFile(LEGACY_LOGO_PNG);
    return;
  }
  if (fs.existsSync(LEGACY_LOGO_SVG)) {
    res.sendFile(LEGACY_LOGO_SVG);
    return;
  }
  res.status(404).send("Logo bulunamadi.");
});

module.exports = router;
