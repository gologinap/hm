const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
