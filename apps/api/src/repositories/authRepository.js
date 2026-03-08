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

// Supabase ile giris yapan kullanicilari lokal DB ile eslestir.
// supabase_id sutunu olmasa bile calisir — email primary key olarak kullanilir.
async function getOrCreateUserByEmail(email, fullName, supabaseId) {
  const mevcutKullanici = await get(
    "SELECT id, full_name as fullName, email, role FROM users WHERE email = ?",
    [email]
  );

  if (mevcutKullanici) {
    // supabase_id varsa guncelle (sutun yoksa hata yakala ve devam et)
    if (supabaseId) {
      try {
        await run(
          "UPDATE users SET supabase_id = ? WHERE id = ? AND (supabase_id IS NULL OR supabase_id = '')",
          [supabaseId, mevcutKullanici.id]
        );
      } catch (_e) {
        // supabase_id sutunu henuz yoksa sessizce devam et
      }
    }
    return mevcutKullanici;
  }

  // Yeni kullanici olustur (supabase_id sutunu olmasa da calisir)
  const sifre = `supabase_${supabaseId || email}`;
  let yeniId;

  try {
    const sonuc = await run(
      "INSERT INTO users (full_name, email, role, password_hash, supabase_id) VALUES (?, ?, ?, ?, ?)",
      [fullName || email.split("@")[0], email, "user", sifre, supabaseId || ""]
    );
    yeniId = sonuc.lastID;
  } catch (_e) {
    // supabase_id sutunu yoksa supabase_id olmadan ekle
    const sonuc = await run(
      "INSERT INTO users (full_name, email, role, password_hash) VALUES (?, ?, ?, ?)",
      [fullName || email.split("@")[0], email, "user", sifre]
    );
    yeniId = sonuc.lastID;
  }

  return {
    id: yeniId,
    fullName: fullName || email.split("@")[0],
    email,
    role: "user"
  };
}

// Eski fonksiyonlar geriye donuk uyumluluk icin kaliyor
async function getUserBySupabaseId(supabaseId) {
  try {
    return await get(
      "SELECT id, full_name as fullName, email, role FROM users WHERE supabase_id = ?",
      [supabaseId]
    );
  } catch (_e) {
    return null;
  }
}

async function upsertSupabaseUser({ supabaseId, email, fullName }) {
  return getOrCreateUserByEmail(email, fullName, supabaseId);
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  getOrCreateUserByEmail,
  getUserBySupabaseId,
  upsertSupabaseUser
};
