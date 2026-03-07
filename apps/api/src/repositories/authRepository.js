const { get, run } = require("../db/connection");

async function getUserByEmail(email) {
  return get("SELECT * FROM users WHERE email = ?", [email]);
}

async function getUserById(id) {
  return get("SELECT id, full_name as fullName, email, role, created_at as createdAt FROM users WHERE id = ?", [id]);
}

async function createUser({ fullName, email, role = "user", passwordHash }) {
  const sonuc = await run("INSERT INTO users (full_name, email, role, password_hash) VALUES (?, ?, ?, ?)", [
    fullName,
    email,
    role,
    passwordHash
  ]);
  return sonuc.lastID;
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser
};
