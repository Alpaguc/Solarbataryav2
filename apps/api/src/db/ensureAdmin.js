const bcrypt = require("bcryptjs");
const { ADMIN_EMAIL, ADMIN_FULL_NAME, ADMIN_PASSWORD } = require("../config/env");
const authRepository = require("../repositories/authRepository");

async function ensureAdminUser() {
  const email = String(ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email || !ADMIN_PASSWORD) {
    return null;
  }

  const mevcut = await authRepository.getUserByEmail(email);
  if (mevcut) {
    if (mevcut.role !== "admin") {
      const { run } = require("./connection");
      await run("UPDATE users SET role = 'admin' WHERE id = ?", [mevcut.id]);
    }
    return mevcut.id;
  }

  const passwordHash = await bcrypt.hash(String(ADMIN_PASSWORD), 10);
  const userId = await authRepository.createUser({
    fullName: String(ADMIN_FULL_NAME || "Local Admin"),
    email,
    role: "admin",
    passwordHash
  });

  return userId;
}

module.exports = {
  ensureAdminUser
};
