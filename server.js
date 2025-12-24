const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); 

const app = express();
const PORT = 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- KONFIGURASI FOLDER UPLOAD ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// --- KONFIGURASI MULTER ---
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
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'tukang_db',
    waitForConnections: true,
    connectionLimit: 10
});

db.getConnection((err) => {
    if (err) console.error('❌ Gagal koneksi Database:', err.message);
    else console.log('✅ Berhasil koneksi Database: tukang_db');
});

// ================= RUTE API LENGKAP =================

// 1. REGISTER (VERSI YANG SUDAH DIBERSIHKAN)
app.post('/api/register', (req, res) => {
    // Kita hapus 'keahlian' dari sini
    const { nama_depan, nama_belakang, email, password, alamat, tipe_pengguna } = req.body;
    
    const sql = `INSERT INTO users (nama_depan, nama_belakang, email, password, alamat, tipe_pengguna) VALUES (?, ?, ?, ?, ?, ?)`;
    
    // Kita hapus 'keahlianStr' dari list values
    db.query(sql, [nama_depan, nama_belakang, email, password, alamat, tipe_pengguna], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Registrasi Berhasil' });
    });
});

// 2. LOGIN
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    db.query(sql, [email, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) res.json({ success: true, user: results[0] });
        else res.status(401).json({ success: false, message: 'Email atau Password salah' });
    });
});

// 3. AMBIL DATA TUKANG
app.get('/api/tukang', (req, res) => {
    const sql = "SELECT id, nama_depan, nama_belakang, alamat, email, keahlian FROM users WHERE tipe_pengguna = 'tukang'";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const dataFormatted = results.map(user => ({
            ...user,
            keahlian: user.keahlian ? user.keahlian.split(',') : ['Umum']
        }));
        res.json({ success: true, data: dataFormatted });
    });
});

// 4. PESANAN BARU (+UPLOAD FOTO)
app.post('/api/pesanan', upload.single('foto'), (req, res) => {
    const { nama_user, kategori, deskripsi, alamat } = req.body;
    const fotoPath = req.file ? req.file.filename : null;
    const sql = "INSERT INTO pesanan (nama_user, kategori_jasa, deskripsi_masalah, alamat, foto_masalah) VALUES (?, ?, ?, ?, ?)";
    
    db.query(sql, [nama_user, kategori, deskripsi, alamat, fotoPath], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Pesanan berhasil dibuat!', orderId: result.insertId });
    });
});

// 4.5. AMBIL SEMUA DATA PESANAN (UNTUK LIST ORDER)
app.get('/api/pesanan', (req, res) => {
    // Mengambil semua data dari tabel pesanan, diurutkan dari yang terbaru (DESC)
    const sql = "SELECT * FROM pesanan ORDER BY id DESC"; 
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        // Kita format datanya sedikit agar URL fotonya lengkap
        const dataFormatted = results.map(item => ({
            ...item,
            foto_url: item.foto_masalah ? `http://localhost:3000/uploads/${item.foto_masalah}` : null
        }));

        res.json({ success: true, data: dataFormatted });
    });
});

// 5. DETAIL PESANAN
app.get('/api/pesanan/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM pesanan WHERE id = ?";
    db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) res.json({ success: true, data: results[0] });
        else res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    });
});

// 6. UPDATE STATUS BAYAR
app.put('/api/pesanan/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = "UPDATE pesanan SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Status berhasil diupdate' });
    });
});

// 7. QRIS SETTINGS
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

// 8. UPDATE PROFIL
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

// --- FITUR CHAT (YANG BARU DITAMBAHKAN) ---

// 9. AMBIL SEMUA CHAT
app.get('/api/chats', (req, res) => {
    const sql = "SELECT * FROM chats ORDER BY created_at ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// 10. KIRIM PESAN CHAT (PERBAIKAN)
app.post('/api/chats', (req, res) => {
    const { sender_id, receiver_id, message } = req.body;
    
    // Validasi input
    if (!message || message.trim() === "") {
        return res.status(400).json({ success: false, message: "Pesan kosong" });
    }

    const sql = "INSERT INTO chats (sender_id, receiver_id, message) VALUES (?, ?, ?)";
    
    // PERHATIKAN DISINI: Jangan pakai angka 0 lagi, pakai variabel 'receiver_id'
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

// --- FITUR KHUSUS ADMIN ---

// 11. AMBIL SEMUA USER (Untuk halaman Admin User)
app.get('/api/users/all', (req, res) => {
    const sql = "SELECT * FROM users ORDER BY id DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// 12. HAPUS USER
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM users WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'User berhasil dihapus' });
    });
});

// 13. UPDATE STATUS ORDER (Admin bisa paksa selesai/batal)
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
    console.log(`🚀 Server berjalan di: http://localhost:${PORT}`);
});