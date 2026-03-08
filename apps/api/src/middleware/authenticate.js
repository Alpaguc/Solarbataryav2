const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { getUserBySupabaseId, upsertSupabaseUser } = require("../repositories/authRepository");

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

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || "user"
    };
    return next();
  } catch (_localErr) {
    // Local JWT dogrulanamadi, Supabase token dene
  }

  try {
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub || !decoded.email) {
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
      const err = new Error("Oturum gecersiz veya suresi dolmus.");
      err.statusCode = 401;
      return next(err);
    }

    const localUser = await upsertSupabaseUser({
      supabaseId: decoded.sub,
      email: decoded.email,
      fullName: decoded.user_metadata?.full_name || decoded.email.split("@")[0]
    });

    req.user = {
      id: localUser.id,
      email: localUser.email,
      role: localUser.role || "user"
    };
    return next();
  } catch (err) {
    const hata = new Error("Oturum dogrulanamadi.");
    hata.statusCode = 401;
    return next(hata);
  }
}

module.exports = {
  authenticate
};
