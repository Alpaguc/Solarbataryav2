const { get, run } = require("../db/connection");

async function getUserByEmail(email) {
  return get("SELECT * FROM users WHERE email = ?", [email]);
}

async function getUserById(id) {
  return get(
    "SELECT id, full_name as fullName, email, role, created_at as createdAt FROM users WHERE id = ?",
    [id]
  );
}

async function createUser({ fullName, email, role = "user", passwordHash }) {
  const sonuc = await run(
    "INSERT INTO users (full_name, email, role, password_hash) VALUES (?, ?, ?, ?)",
    [fullName, email, role, passwordHash]
  );
  return sonuc.lastID;
}

async function getUserBySupabaseId(supabaseId) {
  return get(
    "SELECT id, full_name as fullName, email, role, supabase_id as supabaseId FROM users WHERE supabase_id = ?",
    [supabaseId]
  );
}

async function upsertSupabaseUser({ supabaseId, email, fullName }) {
  let kullanici = await getUserBySupabaseId(supabaseId);

  if (kullanici) {
    return kullanici;
  }

  const emailKullanici = await get("SELECT id, full_name as fullName, email, role FROM users WHERE email = ?", [email]);

  if (emailKullanici) {
    await run("UPDATE users SET supabase_id = ? WHERE id = ?", [supabaseId, emailKullanici.id]);
    return { ...emailKullanici, supabaseId };
  }

  const placeholder = `supabase_${supabaseId}`;
  const sonuc = await run(
    "INSERT INTO users (full_name, email, role, password_hash, supabase_id) VALUES (?, ?, ?, ?, ?)",
    [fullName || email.split("@")[0], email, "user", placeholder, supabaseId]
  );

  return {
    id: sonuc.lastID,
    fullName: fullName || email.split("@")[0],
    email,
    role: "user",
    supabaseId
  };
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  getUserBySupabaseId,
  upsertSupabaseUser
};
