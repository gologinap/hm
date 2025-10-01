// app.js - Phiên bản tái cấu trúc, an toàn và đầy đủ tính năng

const express = require("express");
const axios = require("axios");
const mongoose =require("mongoose");

// ==================== CẤU HÌNH VÀ KHỞI TẠO ====================
const app = express();
const PORT = process.env.PORT || 3000;
const DB_URL = process.env.DB_URL || "mongodb+srv://bulshim889_db_user:47v8XuDHPQdewoxO@hotmailinbox.mmqwgmw.mongodb.net/hotmailinbox?retryWrites=true&w=majority";

// ==================== KẾT NỐI DATABASE ====================
mongoose.connect(DB_URL)
  .then(() => console.log("✅ Đã kết nối thành công tới MongoDB Atlas!"))
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
    process.exit(1);
  });

// ==================== ĐỊNH NGHĨA MODELS ====================
const emailAccountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  refreshToken: { type: String, required: true },
  clientId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false, index: true } // Thêm lại trường trạng thái
});
const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== HÀM LOGIC (SERVICES) ====================

async function fetchAndExtractCode(account) {
  const response = await axios.post(
    "https://tools.dongvanfb.net/api/get_messages_oauth2",
    {
      email: account.email,
      refresh_token: account.refreshToken,
      client_id: account.clientId
    }
  );

  if (response.data.status && response.data.messages?.length > 0) {
    for (const message of response.data.messages) {
      if (message.code) return message.code;
      const match = message.subject?.match(/\b\d{5,6}\b/);
      if (match) return match[0];
    }
  }
  return null;
}

// ==================== API ROUTES ====================

app.get("/api/get-code-by-email", async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Vui lòng cung cấp email." });
    
    const account = await EmailAccount.findOne({ email: email.toLowerCase() });
    if (!account) return res.status(404).json({ error: "Không tìm thấy tài khoản." });

    const extractedCode = await fetchAndExtractCode(account);

    if (extractedCode) {
      res.json({ email: account.email, code: extractedCode });
    } else {
      res.status(404).json({ error: "Không tìm thấy code." });
    }
  } catch (err) {
    next(err);
  }
});

app.post("/api/add-account", async (req, res, next) => {
  try {
    const { accountData } = req.body;
    if (!accountData) return res.status(400).send("Dữ liệu không được để trống.");

    const lines = accountData.split('\n').map(line => line.trim()).filter(Boolean);
    let successCount = 0, errorCount = 0;

    for (const line of lines) {
      const [email, password, refreshToken, clientId] = line.split('|');
      if (email && refreshToken && clientId) {
        // Khi thêm hoặc cập nhật, reset trạng thái `used` về false
        await EmailAccount.findOneAndUpdate(
          { email: email.toLowerCase() },
          { password, refreshToken, clientId, used: false },
          { upsert: true }
        );
        successCount++;
      } else {
        errorCount++;
      }
    }
    res.redirect(`/?message=Đã lưu thành công ${successCount} tài khoản. Lỗi: ${errorCount}.`);
  } catch (err) {
    next(err);
  }
});

app.get("/api/get-next-email", async (req, res, next) => {
    try {
        const account = await EmailAccount.findOneAndUpdate(
            { used: false }, 
            { $set: { used: true } }
        ).sort({ createdAt: 1 });

        if (account) { 
            res.json({ email: account.email }); 
        } else { 
            res.status(404).json({ error: "Đã hết email chưa sử dụng." }); 
        }
    } catch (err) { 
        next(err);
    }
});

app.post("/api/reset-all-emails", async (req, res, next) => {
    try {
        const result = await EmailAccount.updateMany({}, { $set: { used: false } });
        const message = `✅ Đã reset thành công ${result.modifiedCount} email.`;
        res.json({ status: "success", message });
    } catch (err) { 
        next(err);
    }
});

app.delete("/api/delete-all-emails", async (req, res, next) => {
    try {
        console.log("🔥 Yêu cầu xóa TẤT CẢ email...");
        const result = await EmailAccount.deleteMany({});
        const message = `✅ Đã xóa thành công ${result.deletedCount} email khỏi database.`;
        res.json({ status: "success", message });
    } catch (err) { 
        next(err);
    }
});

// ==================== FRONT-END ROUTE ====================
app.get("/", (req, res, next) => {
  try {
    const message = req.query.message || '';
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quản lý tài khoản Email</title>
      <style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 2em; text-align: center; }
        h1, h2 { color: #4dffc9; }
        textarea { width: 90%; max-width: 600px; height: 200px; background: #1e1e1e; color: #fff; border: 1px solid #333; border-radius: 8px; padding: 1em; font-size: 1rem; }
        button { background: #0a84ff; color: #fff; border: none; padding: 1em 2em; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-top: 1em; }
        button:hover { background: #006fd6; }
        .message { margin-top: 1em; font-size: 1.1rem; color: #4dffc9; }
        .api-info { margin-top: 3em; background: #1e1e1e; padding: 1.5em; border-radius: 8px; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; }
        .api-info h2 { margin-top: 0; text-align: center;}
        .api-info code { background: #333; padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; word-break: break-all; }
        .api-info hr { border-color: #333; margin: 1em 0; }
      </style>
    </head>
    <body>
      <h1>Thêm tài khoản vào Database</h1>
      <p>Dán danh sách tài khoản theo định dạng: <strong>email|password|refreshToken|clientId</strong></p>
      <form action="/api/add-account" method="POST">
        <textarea name="accountData" placeholder="anomispa9141@hotmail.com|Pass123|M.C548_...|9e5f94bc-..."></textarea>
        <br>
        <button type="submit">Lưu vào Database</button>
      </form>
      ${message ? `<div class="message">${message}</div>` : ''}
      <div class="api-info">
        <h2>Cách dùng API</h2>
        <p><strong>Lấy code của một email:</strong> <code>GET https://code-hotmail-ebay.onrender.com/api/get-code-by-email?email=EMAIL</code></p>
        <hr>
        <p><strong>Lấy 1 email chưa sử dụng:</strong> <code>GET https://code-hotmail-ebay.onrender.com/api/get-next-email</code></p>
        <hr>
        <p><strong>Reset tất cả email về "chưa sử dụng":</strong> <code>POST https://code-hotmail-ebay.onrender.com/api/reset-all-emails</code></p>
        <hr>
        <p style="color: #ff5555;"><strong>Xóa TẤT CẢ email:</strong> <code>DELETE https://code-hotmail-ebay.onrender.com/api/delete-all-emails</code></p>
      </div>
    </body>
    </html>
  `);
  } catch (err) {
    next(err);
  }
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("💥 Đã xảy ra lỗi không xác định:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Có lỗi xảy ra phía server." });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại cổng ${PORT}`);
});
