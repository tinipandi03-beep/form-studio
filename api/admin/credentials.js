const {
  db, send, body, requireAdmin, bcrypt
} = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Metode tidak diizinkan." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    const input = body(req);
    const currentPassword = String(input.currentPassword || "");
    const newUsername = input.newUsername === undefined
      ? undefined : String(input.newUsername).trim();
    const newPassword = input.newPassword === undefined
      ? undefined : String(input.newPassword);

    if (!currentPassword) {
      return send(res, 400, {
        error: "Password saat ini wajib diisi."
      });
    }

    if (newUsername !== undefined &&
        !/^[a-zA-Z0-9_.-]{3,32}$/.test(newUsername)) {
      return send(res, 400, {
        error: "Username harus 3–32 karakter: huruf, angka, titik, _ atau -."
      });
    }

    if (newPassword !== undefined &&
        (newPassword.length < 10 || newPassword.length > 128)) {
      return send(res, 400, {
        error: "Password baru harus 10–128 karakter."
      });
    }

    if (newUsername === undefined && newPassword === undefined) {
      return send(res, 400, {
        error: "Isi username baru atau password baru."
      });
    }

    const database = db();
    const { data: account, error } = await database
      .from("admin_account")
      .select("id,password_hash")
      .eq("id", session.sub)
      .maybeSingle();

    if (error) throw error;
    if (!account ||
        !(await bcrypt.compare(currentPassword, account.password_hash))) {
      return send(res, 401, {
        error: "Password saat ini salah."
      });
    }

    const updates = {};
    if (newUsername !== undefined) updates.username = newUsername;
    if (newPassword !== undefined) {
      updates.password_hash = await bcrypt.hash(newPassword, 12);
    }

    const result = await database.from("admin_account")
      .update(updates).eq("id", account.id);

    if (result.error) {
      if (result.error.code === "23505") {
        return send(res, 409, {
          error: "Username tersebut sudah dipakai."
        });
      }
      throw result.error;
    }

    return send(res, 200, {
      ok: true,
      message: "Username/password berhasil diperbarui."
    });
  } catch (error) {
    console.error("Credentials:", error.message);
    return send(res, 500, {
      error: "Gagal memperbarui akun."
    });
  }
};
