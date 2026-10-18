const {
  db, send, body, bcrypt, sign,
  setSessionCookie, initializeAdmin
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Metode tidak diizinkan." });
  }

  try {
    const { username, password } = body(req);
    if (!username || !password) {
      return send(res, 400, {
        error: "Username dan password wajib diisi."
      });
    }

    const database = db();
    await initializeAdmin(database);

    const { data: account, error } = await database
      .from("admin_account")
      .select("id,username,password_hash")
      .eq("username", String(username).trim())
      .maybeSingle();

    if (error) throw error;

    if (!account ||
        !(await bcrypt.compare(String(password), account.password_hash))) {
      return send(res, 401, {
        error: "Username atau password salah."
      });
    }

    const now = Date.now();
    const token = sign({
      role: "admin",
      sub: account.id,
      exp: now + 12 * 60 * 60 * 1000
    });

    setSessionCookie(res, token);
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error("Login:", error.message);
    return send(res, 500, { error: error.message || "Login gagal." });
  }
};
