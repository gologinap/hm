// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, "emails.json");

// Middleware
app.use(express.json());

// Tạo file email nếu chưa có
if (!fs.existsSync(EMAIL_FILE)) fs.writeFileSync(EMAIL_FILE, JSON.stringify([]));

// --------- API SERVER --------- //

// Lấy email tiếp theo chưa dùng
app.get("/api/next-email", (req, res) => {
  const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
  const next = emails.find(e => !e.used);
  if (!next) return res.status(404).json({ error: "Không còn email nào chưa dùng" });

  next.used = true;
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(emails, null, 2));
  res.json({ email: next.email, code: next.code || null });
});

// Lấy code từ API ngoài
app.post("/api/get-code", async (req, res) => {
  const { email, token, client_id } = req.body;
  try {
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

// Lưu email + code vào file
app.post("/api/save-email", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

  const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
  emails.push({ email, code, createdAt: new Date().toISOString(), used: false });
  fs.writeFileSync(EMAIL_FILE, JSON.stringify(emails, null, 2));

  res.json({ status: "saved" });
});

// --------- FRONT-END --------- //
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Clipboard Copy App</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
<style>
* { box-sizing: border-box; }
body { margin:0; font-family:system-ui, sans-serif; background:#121212; color:#fff; padding:16px; }
h2 { text-align:center; font-size:1.5rem; margin-bottom:16px; }
button { padding:12px; font-size:1rem; font-weight:bold; margin:6px 4px; border:none; border-radius:8px; cursor:pointer; width:48%; }
.copy-btn { background-color:#0a84ff; color:#fff; } .copy-btn:hover { background-color:#006fd6; }
.nav-btn { background-color:#333; color:#fff; } .nav-btn:hover { background-color:#555; }
.save-btn { background-color:#28a745; color:#fff; } .save-btn:hover { background-color:#1e7e34; }
.status, .info { margin-top:12px; text-align:center; } .info { font-size:0.95rem; color:#bbb; }
@media (max-width:600px){button{width:100%;}}
</style>
</head>
<body>
<div id="root"></div>

<script type="text/babel">
const { useState } = React;
function App() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentCode, setCurrentCode] = useState(null);
  const [status, setStatus] = useState("🕓 Chưa có hành động");

  const getNextEmail = async () => {
    try {
      const res = await fetch("/api/next-email");
      const data = await res.json();
      if (data.error) { setStatus(data.error); setCurrentEmail(""); setCurrentCode(null); return; }
      setCurrentEmail(data.email);
      setCurrentCode(data.code || null);
      setStatus("⏳ Email mới: " + data.email);
      await navigator.clipboard.writeText(data.email);
    } catch (err) { setStatus("❌ Lỗi: " + err.message); }
  };

  const fetchCode = async () => {
    if (!currentEmail) return setStatus("⚠️ Chưa có email nào");
    const token = prompt("Nhập token cho email: " + currentEmail);
    const client_id = prompt("Nhập client_id cho email: " + currentEmail);
    try {
      setStatus("⏳ Đang lấy code...");
      const res = await fetch("/api/get-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail, token, client_id })
      });
      const data = await res.json();
      if (data.code) { setCurrentCode(data.code); setStatus("✅ Mã đã nhận: " + data.code); }
      else { setCurrentCode(null); setStatus("❌ Không nhận được mã"); }
    } catch (err) { setCurrentCode(null); setStatus("❌ Lỗi: " + err.message); }
  };

  const saveCode = async () => {
    if (!currentEmail || !currentCode) return setStatus("⚠️ Chưa có email hoặc code");
    try {
      const res = await fetch("/api/save-email", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:currentEmail, code:currentCode })
      });
      const data = await res.json();
      setStatus(data.status ? "💾 Đã lưu mã cho "+currentEmail : data.error);
    } catch(err) { setStatus("❌ Lỗi khi lưu: "+err.message); }
  };

  return (
    <div>
      <h2>📋 Auto Copy & Get Code</h2>
      <div className="info">✉️ Email hiện tại: <strong>{currentEmail||"N/A"}</strong></div>
      {currentCode && <div className="info">🔑 Code hiện tại: <strong>{currentCode}</strong></div>}
      <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',marginTop:12}}>
        <button className="nav-btn" onClick={getNextEmail}>⏭ Next Email</button>
        <button className="copy-btn" onClick={fetchCode}>📤 Lấy mã</button>
      </div>
      {currentCode && (
        <button className="save-btn" onClick={saveCode} style={{marginTop:12,width:'100%'}}>
          💾 Save Mã
        </button>
      )}
      <div className="status">{status}</div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
</script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
