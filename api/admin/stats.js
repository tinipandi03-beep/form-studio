const { db, send, requireAdmin } = require("../_lib");

const dayKey = d => d.toISOString().slice(0, 10);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Metode tidak diizinkan." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    const database = db();
    const now = new Date();
    const today = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    const start = new Date(today.getTime() - 6 * 86400000);

    const total = await database.from("visitors")
      .select("visitor_id", { count: "exact", head: true });
    if (total.error) throw total.error;

    const result = await database.from("visitor_events")
      .select("visitor_id,page,created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(10000);
    if (result.error) throw result.error;

    const rows = result.data || [];
    const todayRows = rows.filter(r =>
      dayKey(new Date(r.created_at)) === dayKey(today)
    );

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start.getTime() + i * 86400000);
      const key = dayKey(date);
      const daily = rows.filter(r =>
        dayKey(new Date(r.created_at)) === key
      );

      days.push({
        date: key,
        label: date.toLocaleDateString("id-ID", {
          day: "2-digit", month: "short", timeZone: "UTC"
        }),
        unique: new Set(daily.map(r => r.visitor_id)).size
      });
    }

    const counts = {};
    rows.forEach(r => {
      counts[r.page] = (counts[r.page] || 0) + 1;
    });

    const popularPages = Object.entries(counts)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return send(res, 200, {
      totalUnique: total.count || 0,
      todayUnique: new Set(todayRows.map(r => r.visitor_id)).size,
      todayViews: todayRows.length,
      days,
      popularPages,
      recent: rows.slice(0, 12).map(r => ({
        page: r.page,
        created_at: r.created_at
      }))
    });
  } catch (error) {
    console.error("Stats:", error.message);
    return send(res, 500, {
      error: "Gagal mengambil statistik. Periksa konfigurasi database."
    });
  }
};
