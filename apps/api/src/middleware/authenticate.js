const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { getOrCreateUserByEmail } = require("../repositories/authRepository");

function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));
}

async function authenticate(req, _res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    const err = new Error("Bu endpoint icin giris yapmaniz gerekiyor.");
    err.statusCode = 401;
    return next(err);
  }

  // Once lokal JWT dene
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || "user"
    };
    return next();
  } catch (_localErr) {
    // Lokal JWT gecersiz, Supabase token akisina gec
  }

  // Supabase JWT decode et (imza dogrulamasi olmadan)
  let decoded;
  try {
    decoded = jwt.decode(token);
  } catch (_e) {
    const err = new Error("Token parse edilemedi.");
    err.statusCode = 401;
    return next(err);
  }

  if (!decoded || !decoded.sub) {
    const err = new Error("Oturum gecersiz.");
    err.statusCode = 401;
    return next(err);
  }

  const simdi = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < simdi) {
    const err = new Error("Oturum suresi dolmus. Lutfen tekrar giris yapin.");
    err.statusCode = 401;
    return next(err);
  }

  if (!isUuid(decoded.sub)) {
    const err = new Error("Oturum token formati gecersiz.");
    err.statusCode = 401;
    return next(err);
  }

  const email = String(decoded.email || decoded.user_metadata?.email || "").toLowerCase().trim();
  if (!email) {
    const err = new Error("Token icerisinde e-posta bulunamadi.");
    err.statusCode = 401;
    return next(err);
  }

  try {
    const fullName =
      decoded.user_metadata?.full_name ||
      decoded.user_metadata?.name ||
      email.split("@")[0];

    const localUser = await getOrCreateUserByEmail(email, fullName, decoded.sub);

    req.user = {
      id: localUser.id,
      email: localUser.email,
      role: localUser.role || "user"
    };
    return next();
  } catch (err) {
    console.error("[authenticate] Kullanici eslesme hatasi:", err.message);
    const hata = new Error("Kimlik dogrulama islemi basarisiz.");
    hata.statusCode = 500;
    return next(hata);
  }
}

module.exports = {
  authenticate
};
