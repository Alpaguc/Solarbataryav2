const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const authRepository = require("../repositories/authRepository");
const settingsRepository = require("../repositories/adminSettingsRepository");

class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

function tokenUret(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role || "user" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function register({ fullName, email, password }) {
  const adSoyad = String(fullName || "").trim();
  const temizEmail = normalizeEmail(email);
  const sifre = String(password || "");

  if (adSoyad.length < 2) {
    throw new AuthError("Ad soyad en az 2 karakter olmalidir.", 400);
  }
  if (!temizEmail.includes("@")) {
    throw new AuthError("Gecerli bir e-posta giriniz.", 400);
  }
  if (sifre.length < 6) {
    throw new AuthError("Sifre en az 6 karakter olmalidir.", 400);
  }

  const registrationSetting = await settingsRepository.getSettingByKey("allow_registration");
  if (registrationSetting && String(registrationSetting.settingValue).toLowerCase() === "false") {
    throw new AuthError("Yeni kayitlar admin tarafindan gecici olarak kapatildi.", 403);
  }

  const mevcut = await authRepository.getUserByEmail(temizEmail);
  if (mevcut) {
    throw new AuthError("Bu e-posta zaten kayitli.", 409);
  }

  const passwordHash = await bcrypt.hash(sifre, 10);
  const userId = await authRepository.createUser({
    fullName: adSoyad,
    email: temizEmail,
    role: "user",
    passwordHash
  });
  const user = await authRepository.getUserById(userId);
  const token = tokenUret(user);

  return { token, user };
}

async function login({ email, password }) {
  const temizEmail = normalizeEmail(email);
  const sifre = String(password || "");

  const user = await authRepository.getUserByEmail(temizEmail);
  if (!user) {
    throw new AuthError("E-posta veya sifre hatali.", 401);
  }

  const sifreUygun = await bcrypt.compare(sifre, user.password_hash);
  if (!sifreUygun) {
    throw new AuthError("E-posta veya sifre hatali.", 401);
  }

  const guvenliUser = await authRepository.getUserById(user.id);
  const token = tokenUret(guvenliUser);
  return { token, user: guvenliUser };
}

async function getMe(userId) {
  const user = await authRepository.getUserById(userId);
  if (!user) {
    throw new AuthError("Kullanici bulunamadi.", 404);
  }
  return user;
}

module.exports = {
  register,
  login,
  getMe,
  AuthError
};
