const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const LEGACY_INDEX = path.join(PROJECT_ROOT, "index.html");
const LEGACY_SCRIPT = path.join(PROJECT_ROOT, "script.js");
const LEGACY_LOGO_SVG = path.join(PROJECT_ROOT, "solar-logo.svg");
const LEGACY_LOGO_PNG = path.join(PROJECT_ROOT, "Logo.png");

function verifyLegacyToken(req, res, next) {
  const token = String(req.query.token || "");
  if (!token) {
    res.status(401).send("Legacy arayuz icin token zorunludur.");
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
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
