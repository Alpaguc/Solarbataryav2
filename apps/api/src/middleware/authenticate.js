const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

function authenticate(req, _res, next) {
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
  } catch (_err) {
    const err = new Error("Oturum gecersiz veya suresi dolmus.");
    err.statusCode = 401;
    return next(err);
  }
}

module.exports = {
  authenticate
};
