const { send } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Metode tidak diizinkan." });
  }

  res.setHeader(
    "Set-Cookie",
    "fs_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
  );

  return send(res, 200, { ok: true });
};
