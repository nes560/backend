const express = require('express');
const mysql = require('mysql2');
const cors = require('cors'); 
const bodyParser = require('body-parser');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); 

const app = express();
// Gunakan environment variable untuk PORT jika ada, default ke 3000
const PORT = process.env.PORT || 3000;

// --- PERBAIKAN CORS (SOLUSI FINAL) ---
// Cukup gunakan ini. Baris app.options('*'...) dihapus karena bikin error di Node.js terbaru.
// Ini sudah otomatis mengizinkan semua domain & menangani preflight request.
app.use(cors()); 

// --- MIDDLEWARE ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- KONFIGURASI FOLDER UPLOAD ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// --- KONFIGURASI MULTER (UPLOAD FOTO) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'foto-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- KONEKSI DATABASE ---
const db = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'tukang_db', 
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Cek koneksi saat awal (Hanya Log)
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal koneksi Database:', err.message);
    } else {
        console.log('✅ Berhasil koneksi Database MySQL');
        connection.release();
    }
});

// ================= RUTE API LENGKAP =================

// Route Test (Untuk Cek Server Hidup)
app.get('/', (req, res) => {
    res.send("Backend Tukang Siap!");
});

// --- 1. REGISTER USER BARU ---
app.post('/api/register', (req, res) => {
    const { nama_depan, nama_belakang, email, password, alamat, tipe_pengguna } = req.body;
    const sql = `INSERT INTO users (nama_depan, nama_belakang, email, password, alamat, tipe_pengguna) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nama_depan, nama_belakang, email, password, alamat, tipe_pengguna], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Registrasi Berhasil' });
    });
});

// --- 2. LOGIN USER ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    db.query(sql, [email, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.status(401).json({ success: false, message: 'Email atau Password salah' });
        }
    });
});

// --- 3. AMBIL DATA TUKANG ---
app.get('/api/tukang', (req, res) => {
    const sql = "SELECT id, nama_depan, nama_belakang, alamat, email, tipe_pengguna FROM users WHERE tipe_pengguna = 'tukang'";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const dataFormatted = results.map(user => ({
            ...user,
            keahlian: ['Umum'] 
        }));
        res.json({ success: true, data: dataFormatted });
    });
});

// --- 4. BUAT PESANAN BARU ---
app.post('/api/pesanan', upload.single('foto'), (req, res) => {
    const { nama_user, kategori, deskripsi, alamat } = req.body;
    const fotoPath = req.file ? req.file.filename : null; 
    const sql = "INSERT INTO pesanan (nama_user, kategori_jasa, deskripsi_masalah, alamat, foto_masalah) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [nama_user, kategori, deskripsi, alamat, fotoPath], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Pesanan berhasil dibuat!', orderId: result.insertId });
    });
});

// --- 5. AMBIL SEMUA PESANAN ---
app.get('/api/pesanan', (req, res) => {
    const sql = "SELECT * FROM pesanan ORDER BY id DESC"; 
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const dataFormatted = results.map(item => ({
            ...item,
            foto_url: item.foto_masalah ? `${req.protocol}://${req.get('host')}/uploads/${item.foto_masalah}` : null
        }));
        res.json({ success: true, data: dataFormatted });
    });
});

// --- 6. DETAIL PESANAN ---
app.get('/api/pesanan/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM pesanan WHERE id = ?";
    db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) res.json({ success: true, data: results[0] });
        else res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    });
});

// --- 7. UPDATE STATUS PESANAN ---
app.put('/api/pesanan/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = "UPDATE pesanan SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Status berhasil diupdate' });
    });
});

// --- 8. QRIS SETTINGS ---
app.get('/api/qris-settings', (req, res) => {
    res.json({
        success: true,
        data: {
            merchant_name: "HandyMan Official",
            merchant_phone: "0812-3456-7890",
            qris_image: "qris-default.png"
        }
    });
});

// --- 9. UPDATE PROFIL USER ---
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { nama_depan, nama_belakang, email, alamat } = req.body;
    const sql = "UPDATE users SET nama_depan = ?, nama_belakang = ?, email = ?, alamat = ? WHERE id = ?";
    db.query(sql, [nama_depan, nama_belakang, email, alamat, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        db.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
             res.json({ success: true, message: 'Profil berhasil diperbarui!', user: results[0] });
        });
    });
});

// --- 10. AMBIL CHAT ---
app.get('/api/chats', (req, res) => {
    const sql = "SELECT * FROM chats ORDER BY created_at ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// --- 11. KIRIM PESAN CHAT ---
app.post('/api/chats', (req, res) => {
    const { sender_id, receiver_id, message } = req.body;
    if (!message || message.trim() === "") {
        return res.status(400).json({ success: false, message: "Pesan kosong" });
    }
    const sql = "INSERT INTO chats (sender_id, receiver_id, message) VALUES (?, ?, ?)";
    db.query(sql, [sender_id, receiver_id, message], (err, result) => { 
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ 
            success: true, 
            data: { 
                id: result.insertId, 
                sender_id, 
                receiver_id, 
                message,
                created_at: new Date() 
            } 
        });
    });
});

// --- 12. ADMIN: AMBIL SEMUA USER ---
app.get('/api/users/all', (req, res) => {
    const sql = "SELECT * FROM users ORDER BY id DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// --- 13. ADMIN: HAPUS USER ---
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM users WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'User berhasil dihapus' });
    });
});

// --- 14. ADMIN: UPDATE STATUS ORDER ---
app.put('/api/pesanan/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = "UPDATE pesanan SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
        res.json({ success: true, message: 'Status pesanan diperbarui' });
    });
});

// --- JALANKAN SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port: ${PORT}`);
    console.log(`📂 Folder upload: ${uploadDir}`);
});