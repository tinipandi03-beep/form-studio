const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

function db() {
  if (!process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Environment Supabase belum diatur.");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function send(res, status, data) {
  return res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .send(JSON.stringify(data));
}

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); }
  catch { return {}; }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET harus minimal 32 karakter.");
  }

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret)
    .update(data).digest("base64url");

  return data + "." + signature;
}

function verify(token) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const expected = crypto.createHmac(
    "sha256", process.env.SESSION_SECRET || ""
  ).update(parts[0]).digest("base64url");

  if (!safeEqual(expected, parts[1])) return null;

  try {
    const p = JSON.parse(
      Buffer.from(parts[0], "base64url").toString()
    );
    if (p.role !== "admin" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

function cookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i >= 0 && part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return "";
}

function requireAdmin(req, res) {
  const session = verify(cookie(req, "fs_admin_session"));
  if (!session) {
    send(res, 401, {
      error: "Sesi berakhir. Silakan login kembali."
    });
    return null;
  }
  return session;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `fs_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
  );
}

async function initializeAdmin(database) {
  const { data, error } = await database
    .from("admin_account").select("id").limit(1);

  if (error) throw new Error(
    "Tabel admin_account belum siap. Jalankan SQL database dahulu."
  );

  if (data && data.length) return;

  const username = process.env.INITIAL_ADMIN_USERNAME || "admin";
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error(
      "Atur INITIAL_ADMIN_PASSWORD minimal 10 karakter di Vercel."
    );
  }

  const password_hash = await bcrypt.hash(password, 12);
  const result = await database.from("admin_account").insert({
    username,
    password_hash
  });

  if (result.error) {
    const check = await database.from("admin_account")
      .select("id").limit(1);
    if (!check.data || !check.data.length) throw result.error;
  }
}

module.exports = {
  db, send, body, bcrypt, sign, cookie, requireAdmin,
  setSessionCookie, initializeAdmin
};
