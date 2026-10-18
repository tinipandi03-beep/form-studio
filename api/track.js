const crypto = require("node:crypto");
const { db, send, body, cookie } = require("./_lib");

const allowed = new Set([
  "home", "services", "portfolio",
  "process", "pricing", "contact"
]);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Metode tidak diizinkan." });
  }

  try {
    const page = String(body(req).page || "");
    if (!allowed.has(page)) {
      return send(res, 400, { error: "Halaman tidak valid." });
    }

    let visitor = cookie(req, "fs_visitor");
    if (!/^[a-f0-9-]{36}$/i.test(visitor)) {
      visitor = crypto.randomUUID();
    }

    res.setHeader(
      "Set-Cookie",
      `fs_visitor=${visitor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
    );

    const database = db();

    const saved = await database.from("visitor_events").insert({
      visitor_id: visitor,
      page
    });
    if (saved.error) throw saved.error;

    const updated = await database.from("visitors").upsert({
      visitor_id: visitor,
      last_seen: new Date().toISOString()
    }, { onConflict: "visitor_id" });

    if (updated.error) throw updated.error;

    return send(res, 200, { ok: true });
  } catch (error) {
    console.error("Track:", error.message);
    return send(res, 500, {
      error: "Statistik belum dapat disimpan."
    });
  }
};
