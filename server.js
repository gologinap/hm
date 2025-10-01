// app.js
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, "emails.json");

let APP_URL = null;

// Middleware
app.use(express.json());

// Tạo file email nếu chưa tồn tại
if (!fs.existsSync(EMAIL_FILE)) fs.writeFileSync(EMAIL_FILE, JSON.stringify([]));

// -------------------- API --------------------

// Lấy code từ API bên ngoài
app.post("/api/get-code", async (req, res) => {
  try {
    const { email, token, client_id } = req.body;
    console.log(`📨 Lấy code cho email: ${email}`);

    const response = await axios.post(
      "https://tools.dongvanfb.net/api/get_code_oauth2",
      { email, refresh_token: token, client_id }
    );

    console.log("📥 Response raw:", response.data);

    let code = response.data.code || null;

    // Nếu chưa có code, parse từ email message
    if (!code && response.data.email_message) {
      const match = response.data.email_message.match(/- (\d{5,6}) -/);
      if (match) code = match[1];
      console.log("🔍 Parsed code từ email:", code);
    }

    console.log("✅ Code cuối cùng:", code || "OK");
    res.json({ code: code || "OK" });
  } catch (err) {
    console.error("❌ Lỗi lấy code:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lưu email + code vào file
app.post("/api/save-email", (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Thiếu email hoặc code" });

    const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
    emails.push({ email, code, createdAt: new Date().toISOString(), used: false });
    fs.writeFileSync(EMAIL_FILE, JSON.stringify(emails, null, 2));

    res.json({ status: "saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy email tiếp theo chưa dùng
app.get("/api/next-email", (req, res) => {
  try {
    const emails = JSON.parse(fs.readFileSync(EMAIL_FILE, "utf-8"));
    const next = emails.find(e => !e.used);
    if (!next) return res.status(404).json({ error: "Không còn email nào chưa dùng" });

    next.used = true;
    fs.writeFileSync(EMAIL_FILE, JSON.stringify(emails, null, 2));

    res.json({ email: next.email, code: next.code || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ping để tránh Render ngủ
setInterval(async () => {
  if (!APP_URL) return;
  try {
    await axios.get(APP_URL);
    console.log("Pinged self to keep alive");
  } catch (err) {
    console.log("Ping error:", err.message);
  }
}, 4 * 60 * 1000);

// -------------------- FRONT-END --------------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Clipboard Copy App</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
<style>
*{box-sizing:border-box} body{margin:0;font-family:system-ui,sans-serif;background:#121212;color:#fff;padding:16px} h2{text-align:center;font-size:1.5rem;margin-bottom:16px} textarea{width:100%;height:150px;padding:12px;font-size:1rem;border-radius:8px;border:1px solid #333;background:#1e1e1e;color:#fff;resize:vertical;margin-bottom:12px} button{padding:12px;font-size:1rem;font-weight:bold;margin:6px 4px;border:none;border-radius:8px;cursor:pointer;width:48%} .copy-btn{background:#0a84ff;color:#fff} .copy-btn:hover{background:#006fd6} .nav-btn{background:#333;color:#fff} .nav-btn:hover{background:#555} .save-btn{background:#28a745;color:#fff} .save-btn:hover{background:#1e7e34} .status,.info{margin-top:12px;text-align:center} .info{font-size:0.95rem;color:#bbb} @media(max-width:600px){button{width:100%}}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState } = React;
function App() {
  const [rawData, setRawData] = useState("");
  const [lines, setLines] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCode, setCurrentCode] = useState(null);
  const [status, setStatus] = useState("🕓 Chưa có hành động");

  const parseData = (text) => {
    const parsed = text.split("\\n").map(l => l.trim()).filter(Boolean);
    setLines(parsed);
    setCurrentIndex(0);
    setCurrentCode(null);
    setStatus("🕓 Chưa có hành động");
  };

  const currentLine = lines[currentIndex] || "";
  const [currentEmail, currentPass, currentToken, currentClient] = currentLine.split("|");

  const copyEmail = async () => {
    if (!currentEmail) return setStatus("⚠️ Chưa có email");
    await navigator.clipboard.writeText(currentEmail);
    setStatus("✅ Đã copy email: " + currentEmail);
  };

  const fetchCode = async () => {
    if (!currentEmail || !currentToken || !currentClient) return setStatus("⚠️ Thiếu dữ liệu");
    try {
      setStatus("⏳ Đang lấy code...");
      const res = await fetch("/api/get-code", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:currentEmail,token:currentToken,client_id:currentClient})
      });
      const data = await res.json();
      if(data.code){setCurrentCode(data.code);setStatus("✅ Mã đã nhận: "+data.code)}
      else {setCurrentCode(null);setStatus("❌ Không nhận được mã")}
    } catch(err){setCurrentCode(null);setStatus("❌ Lỗi: "+err.message)}
  };

  const saveCode = async () => {
    if(!currentEmail||!currentCode) return setStatus("⚠️ Chưa có email hoặc code");
    try{
      const res = await fetch("/api/save-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:currentEmail,code:currentCode})});
      const data = await res.json();
      setStatus(data.status?"💾 Đã lưu mã cho "+currentEmail:data.error);
    }catch(err){setStatus("❌ Lỗi khi lưu: "+err.message)}
  };

  const handleNext = () => {
    if(currentIndex<lines.length-1){setCurrentIndex(currentIndex+1);setCurrentCode(null);setStatus("⏭ Đang xử lý dòng tiếp...")}
    else setStatus("✅ Đã hết danh sách");
  };

  const handleBack = () => {
    if(currentIndex>0){setCurrentIndex(currentIndex-1);setCurrentCode(null);setStatus("🔙 Quay lại dòng trước")}
    else setStatus("⚠️ Đang ở dòng đầu tiên");
  };

  return(
    <div>
      <h2>📋 Auto Copy & Get Code</h2>
      <textarea placeholder="Dán dữ liệu: email|pass|token|client_id mỗi dòng" value={rawData} onChange={e=>{setRawData(e.target.value);parseData(e.target.value)}}/>
      <div className="info">📄 Tổng dòng: {lines.length}</div>
      <div className="info">▶️ Đang xử lý dòng {currentIndex+1} / {lines.length}</div>
      <div className="info">✉️ Email: <strong>{currentEmail||"N/A"}</strong></div>

      <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',marginTop:12}}>
        <button className="nav-btn" onClick={handleBack}>🔙 Back Mail</button>
        <button className="nav-btn" onClick={handleNext}>⏭ Next Mail</button>
      </div>

      <button className="copy-btn" onClick={()=>{copyEmail();fetchCode()}} style={{marginTop:10}}>📤 Copy & Lấy mã</button>

      {currentCode && <button className="copy-btn" onClick={()=>navigator.clipboard.writeText(currentCode)} style={{marginTop:12,width:'100%'}}>📋 Copy Mã</button>}
      {!currentCode && status.startsWith("❌") && <button className="copy-btn" onClick={fetchCode} style={{marginTop:12,backgroundColor:"#e03b3b"}}>🔄 Kiểm tra lại mã</button>}

      {currentCode && <button className="save-btn" onClick={saveCode} style={{marginTop:12,width:'100%'}}>💾 Save Mã</button>}

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

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`✅ Server running on port ${PORT}`);
});
