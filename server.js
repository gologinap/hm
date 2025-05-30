const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

let APP_URL = null; // Render App URL nếu dùng để tự ping

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// API route
app.post("/api/get-code", async (req, res) => {
  try {
    const { email, token, client_id } = req.body;
    const response = await axios.post("https://tools.dongvanfb.net/api/get_code_oauth2", {
      email,
      refresh_token: token,
      client_id,
      type: "tiktok "
    });
    res.json({ code: response.data.code || "OK" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
