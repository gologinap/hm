const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, "emails.json");

let APP_URL = null; // Render App URL nếu dùng để tự ping

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Tạo file email nếu chưa có
if (!fs.existsSync(EMAIL_FILE)) fs.writeFileSync(EMAIL_FILE, JSON.stringify([]));

// API giữ nguyên
app.post("/api/get-code", async (req, res) => {
  try {
    const { email, token, client_id } = req.body;
    const response = await axios.post("https://tools.dongvanfb.net/api/get_code_oauth2", {
      email,
      refresh_token: token,
      client_id,
      type: "all"
    });
    res.json({ code: response.data.code || "OK" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API thêm email + code vào file
app.post("/api/save-email", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

  const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
  emails.push({ email, code, createdAt: new Date().toISOString() });
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(emails, null, 2));

  res.json({ status: "saved" });
});

// API lấy code từ email
app.get("/email", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email query" });

  const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
  const found = emails.reverse().find(e => e.email === email);
  if (!found) return res.status(404).json({ error: "Email not found" });

  res.json({ code: found.code });
});

// Ping chính app để tránh Render ngủ
setInterval(async () => {
  if (!APP_URL) return;
  try {
    await axios.get(APP_URL);
    console.log("Pinged self to keep alive");
  } catch (err) {
    console.log("Ping error:", err.message);
  }
}, 4 * 60 * 1000); // Mỗi 4 phút

// Start server
app.listen(PORT, () => {
  APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`✅ Server running on port ${PORT}`);
});
