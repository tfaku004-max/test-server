const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

/* ==========================
   ENVIRONMENT VARIABLES
========================== */
const SECRET_KEY = process.env.SECRET_KEY || "testservertest666";
const ROBLOX_API = process.env.ROBLOX_API || "";
const PORT = process.env.PORT || 3000;

console.log("🔑 SECRET_KEY:", SECRET_KEY);
console.log("🎮 ROBLOX_API:", ROBLOX_API || "(disabled)");

/* ==========================
   STORAGE (MEMORY)
========================== */
let donations = [];            // semua donasi
let sentToRoblox = new Set();  // anti double kirim

/* ==========================
   HELPER: SEND TO ROBLOX
========================== */
async function sendToRoblox(donation) {
  if (!ROBLOX_API) return;

  if (sentToRoblox.has(donation.id)) return;

  try {
    const resp = await axios.post(
      `${ROBLOX_API}/${SECRET_KEY}`,
      donation,
      { headers: { "Content-Type": "application/json" } }
    );

    sentToRoblox.add(donation.id);
    console.log("✅ Sent to Roblox:", donation.platform, donation.donor, donation.amount);
  } catch (err) {
    console.error("❌ Roblox send failed:", err.response?.data || err.message);
  }
}

/* ==========================
   WEBHOOK: SAWERIA
========================== */
app.post("/api/webhook/saweria", async (req, res) => {
  console.log("📥 Saweria webhook:", req.body);

  const data = req.body || {};
  const amount = Number(data.amount || data.amount_raw || 0);
  if (amount <= 0) return res.json({ ok: false, reason: "Invalid amount" });

  const donation = {
    id: "saweria_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    donor: data.donator_name || "Anonymous",
    amount,
    message: data.message || "",
    platform: "saweria",
    matchedUsername: data.donator_name || "",
    ts: Date.now()
  };

  donations.push(donation);
  await sendToRoblox(donation);

  res.json({ ok: true });
});

/* ==========================
   WEBHOOK: SOCIABUZZ
========================== */
app.post("/api/webhook/sociabuzz", async (req, res) => {
  try {
    console.log("📥 Sociabuzz webhook:", req.body);

    const payload = req.body || {};
    const amount = Number(payload.amount_settled || payload.price || 0);
    if (amount <= 0) return res.json({ ok: false, reason: "Invalid amount" });

    const donation = {
      id: "sociabuzz_" + (payload.id || Date.now()),
      donor: payload.supporter || "Anonymous",
      amount,
      message: payload.message || "",
      platform: "sociabuzz",
      matchedUsername: payload.supporter || "",
      ts: Date.now()
    };

    donations.push(donation);
    await sendToRoblox(donation);

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Sociabuzz error:", err);
    res.status(500).json({ ok: false });
  }
});

/* ==========================
   FETCH DONATIONS (ROBLOX)
========================== */
app.get("/api/donations/:secret", (req, res) => {
  if (req.params.secret !== SECRET_KEY) {
    return res.status(403).json({ ok: false, error: "Invalid secret key" });
  }

  const since = Number(req.query.since || 0);
  const result = donations.filter(d => d.ts > since);

  res.json({
    ok: true,
    donations: result.slice(0, 50)
  });
});

/* ==========================
   REGISTER PLAYER (OPTIONAL)
========================== */
app.post("/api/register/:secret", (req, res) => {
  if (req.params.secret !== SECRET_KEY) {
    return res.status(403).json({ ok: false, error: "Invalid secret key" });
  }

  console.log("📌 Register from Roblox:", req.body);
  res.json({ ok: true, registered: true });
});

/* ==========================
   START SERVER
========================== */
app.listen(PORT, () => {
  console.log(`🚀 Donation API running on port ${PORT}`);
});
