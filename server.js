// app.js - Phiên bản nâng cấp với MongoDB

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== KẾT NỐI DATABASE MONGODB ====================
const DB_URL = "mongodb+srv://bulshim889_db_user:47v8XuDHPQdewoxO@hotmailinbox.mmqwgmw.mongodb.net/";

mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Đã kết nối thành công tới MongoDB Atlas!"))
  .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// Định nghĩa cấu trúc (Schema) cho một tài khoản email trong DB
const emailAccountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  refreshToken: { type: String, required: true },
  clientId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Tạo Model từ Schema
const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Để xử lý form submission

// ==================== API ====================

/**
 * API MỚI: Tự động lấy code khi có yêu cầu bằng email
 * Đây là API chính bạn cần.
 */
app.get("/api/get-code-by-email", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Vui lòng cung cấp email." });
  }

  try {
    console.log(`🔍 Tìm kiếm thông tin cho email: ${email}`);
    // 1. Tìm thông tin tài khoản trong Database
    const account = await EmailAccount.findOne({ email: email.toLowerCase() });

    if (!account) {
      console.log(`❌ Không tìm thấy tài khoản ${email} trong DB.`);
      return res.status(404).json({ error: "Không tìm thấy thông tin tài khoản trong database." });
    }

    console.log(`👍 Đã tìm thấy tài khoản. Bắt đầu gọi API ngoài để lấy code...`);
    // 2. Kích hoạt API ngoài để lấy tin nhắn
    const response = await axios.post(
      "https://tools.dongvanfb.net/api/get_messages_oauth2",
      {
        email: account.email,
        refresh_token: account.refreshToken,
        client_id: account.clientId
      }
    );
    
    let extractedCode = null;

    // 3. Xử lý response và trích xuất code (logic từ trước)
    if (response.data.status && response.data.messages && response.data.messages.length > 0) {
      for (const message of response.data.messages) {
        if (message.code) {
          extractedCode = message.code;
          break;
        }
        const regex = /\b\d{5,6}\b/;
        if (message.subject) {
            const match = message.subject.match(regex);
            if (match) {
              extractedCode = match[0];
              break;
            }
        }
      }
    }

    // 4. Trả code về cho client
    if (extractedCode) {
      console.log(`✅ Đã trích xuất thành công code: ${extractedCode} cho email ${email}`);
      res.json({ email: account.email, code: extractedCode });
    } else {
      console.log(`🤷 Không tìm thấy code nào trong các email nhận được cho ${email}`);
      res.status(404).json({ error: "Lấy được email nhưng không tìm thấy code nào." });
    }

  } catch (err) {
    console.error(`💥 Lỗi nghiêm trọng khi xử lý cho email ${email}:`, err.response ? err.response.data : err.message);
    res.status(500).json({ error: "Có lỗi xảy ra phía server." });
  }
});

/**
 * API để thêm tài khoản vào Database từ giao diện
 */
app.post("/api/add-account", async (req, res) => {
    const { accountData } = req.body;
    if (!accountData) {
        return res.status(400).send("Dữ liệu không được để trống.");
    }

    const lines = accountData.split('\n').map(line => line.trim()).filter(line => line);
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
        const [email, password, refreshToken, clientId] = line.split('|');
        if (email && refreshToken && clientId) {
            try {
                // Lệnh findOneAndUpdate với upsert=true sẽ tự động tạo mới nếu chưa có, hoặc cập nhật nếu đã có email
                await EmailAccount.findOneAndUpdate(
                    { email: email.toLowerCase() },
                    { password, refreshToken, clientId },
                    { upsert: true, new: true }
                );
                successCount++;
            } catch (error) {
                console.error("Lỗi khi lưu email:", email, error);
                errorCount++;
            }
        } else {
            errorCount++;
        }
    }
    // Chuyển hướng về trang chủ với thông báo
    res.redirect(`/?message=Đã lưu thành công ${successCount} tài khoản. Lỗi: ${errorCount}.`);
});


// ==================== FRONT-END ====================

// Giao diện đơn giản để thêm tài khoản vào DB
app.get("/", (req, res) => {
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
            h1 { color: #4dffc9; }
            textarea { width: 90%; max-width: 600px; height: 200px; background: #1e1e1e; color: #fff; border: 1px solid #333; border-radius: 8px; padding: 1em; font-size: 1rem; }
            button { background: #0a84ff; color: #fff; border: none; padding: 1em 2em; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-top: 1em; }
            button:hover { background: #006fd6; }
            .message { margin-top: 1em; font-size: 1.1rem; color: #4dffc9; }
            .api-info { margin-top: 3em; background: #1e1e1e; padding: 1.5em; border-radius: 8px; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; }
            .api-info h2 { margin-top: 0; text-align: center;}
            .api-info code { background: #333; padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; word-break: break-all; }
        </style>
    </head>
    <body>
        <h1>Thêm tài khoản vào Database</h1>
        <p>Dán danh sách tài khoản theo định dạng: <strong>email|password|refreshToken|clientId</strong> (mỗi tài khoản một dòng)</p>
        <form action="/api/add-account" method="POST">
            <textarea name="accountData" placeholder="anomispa9141@hotmail.com|Pass123|M.C548_...|9e5f94bc-..."></textarea>
            <br>
            <button type="submit">Lưu vào Database</button>
        </form>
        ${message ? `<div class="message">${message}</div>` : ''}

        <div class="api-info">
            <h2>Cách dùng API lấy code</h2>
            <p>Sau khi đã lưu tài khoản, bạn có thể gọi API để lấy code bất cứ lúc nào.</p>
            <p><strong>Endpoint:</strong></p>
            <p><code>GET /api/get-code-by-email</code></p>
            <p><strong>Cách gọi mẫu:</strong></p>
            <p><code>https://your-app-url.onrender.com/api/get-code-by-email?email=anomispa9141@hotmail.com</code></p>
            <p><strong>Kết quả trả về:</strong></p>
            <p><code>{ "email": "anomispa9141@hotmail.com", "code": "519891" }</code></p>
        </div>
    </body>
    </html>
  `);
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại cổng ${PORT}`);
});
