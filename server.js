// BACKEND FINAL COMPLETE: + FITUR REVIEW
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const multer = require('multer'); 
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. KONFIGURASI CLOUDINARY ---
cloudinary.config({ 
  cloud_name: 'duf9khlya', 
  api_key: '427538359831592', 
  api_secret: 'iBzLd_UekopbMVml8aiUmiA8MLc' 
});

// --- 2. CORS ---
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --- 3. MIDDLEWARE ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 4. KONFIGURASI MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 5. FUNGSI HELPER UPLOAD ---
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "tukang_app_orders" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

// --- 6. KONEKSI DATABASE ---
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_QJj2mwI8cPfT@ep-tiny-butterfly-adtgh2yw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// ================= RUTE API =================

app.get('/', (req, res) => {
    res.send("Backend Tukang (Complete with Reviews) Siap!");
});

// --- REGISTER ---
app.post('/api/register', (req, res) => {
    const { nama_depan, nama_belakang, email, password, alamat, tipe_pengguna } = req.body;
    const sql = `INSERT INTO users (nama_depan, nama_belakang, email, password, alamat, tipe_pengguna) VALUES ($1, $2, $3, $4, $5, $6)`;
    pool.query(sql, [nama_depan, nama_belakang, email, password, alamat, tipe_pengguna], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Registrasi Berhasil' });
    });
});

// --- LOGIN ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = $1 AND password = $2";
    pool.query(sql, [email, password], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Email atau Password salah' });
        }
    });
});

// --- AMBIL DATA TUKANG ---
app.get('/api/tukang', (req, res) => {
    const sql = "SELECT id, nama_depan, nama_belakang, alamat, email, tipe_pengguna FROM users WHERE tipe_pengguna = 'tukang'";
    pool.query(sql, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const dataFormatted = result.rows.map(user => ({
            ...user,
            keahlian: ['Umum'] 
        }));
        res.json({ success: true, data: dataFormatted });
    });
});

// --- FITUR ADMIN ---
app.get('/api/users/all', (req, res) => {
    const sql = "SELECT * FROM users ORDER BY id DESC";
    pool.query(sql, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: result.rows });
    });
});

app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM users WHERE id = $1";
    pool.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'User berhasil dihapus' });
    });
});

// --- BUAT PESANAN ---
app.post('/api/pesanan', upload.single('foto'), async (req, res) => {
    const { nama_user, kategori_jasa, deskripsi_masalah, alamat } = req.body;
    
    try {
        let fotoUrl = null;
        if (req.file) {
            const cloudResult = await uploadToCloudinary(req.file.buffer);
            fotoUrl = cloudResult.secure_url; 
        }

        const sql = "INSERT INTO pesanan (nama_user, kategori_jasa, deskripsi_masalah, alamat, foto_masalah) VALUES ($1, $2, $3, $4, $5) RETURNING id";
        
        pool.query(sql, [nama_user, kategori_jasa, deskripsi_masalah, alamat, fotoUrl], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: 'Pesanan berhasil dibuat!', orderId: result.rows[0].id });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Gagal upload: " + error.message });
    }
});

// --- AMBIL PESANAN ---
app.get('/api/pesanan', (req, res) => {
    const sql = "SELECT * FROM pesanan ORDER BY id DESC"; 
    pool.query(sql, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: result.rows });
    });
});

// --- DETAIL PESANAN ---
app.get('/api/pesanan/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM pesanan WHERE id = $1";
    pool.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.rows.length > 0) res.json({ success: true, data: result.rows[0] });
        else res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    });
});

// --- UPDATE STATUS ---
app.put('/api/pesanan/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = "UPDATE pesanan SET status = $1 WHERE id = $2";
    pool.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Status berhasil diupdate' });
    });
});

// --- SIMPAN REVIEW (INI YANG DITAMBAHKAN) ---
app.post('/api/pesanan/:id/review', (req, res) => {
    const { id } = req.params;
    const { rating, ulasan } = req.body;
    
    // Update kolom rating & ulasan di tabel pesanan
    const sql = "UPDATE pesanan SET rating = $1, ulasan = $2 WHERE id = $3";
    
    pool.query(sql, [rating, ulasan, id], (err, result) => {
        if (err) {
            console.error("Error Review:", err);
            return res.status(500).json({ success: false, message: "Gagal simpan ulasan" });
        }
        res.json({ success: true, message: "Ulasan berhasil disimpan!" });
    });
});

// --- QRIS ---
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

// --- UPDATE PROFIL ---
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { nama_depan, nama_belakang, email, alamat } = req.body;
    const sql = "UPDATE users SET nama_depan = $1, nama_belakang = $2, email = $3, alamat = $4 WHERE id = $5 RETURNING *";
    pool.query(sql, [nama_depan, nama_belakang, email, alamat, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Profil berhasil diperbarui!', user: result.rows[0] });
    });
});

// --- CHAT ---
app.get('/api/chats', (req, res) => {
    const sql = "SELECT * FROM chats ORDER BY created_at ASC";
    pool.query(sql, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: result.rows });
    });
});

app.post('/api/chats', (req, res) => {
    const { sender_id, receiver_id, message } = req.body;
    if (!message || message.trim() === "") {
        return res.status(400).json({ success: false, message: "Pesan kosong" });
    }
    const sql = "INSERT INTO chats (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING id";
    pool.query(sql, [sender_id, receiver_id, message], (err, result) => { 
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ 
            success: true, 
            data: { 
                id: result.rows[0].id, 
                sender_id, 
                receiver_id, 
                message, 
                created_at: new Date() 
            } 
        });
    });
});

// --- JALANKAN SERVER ---
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server berjalan di port: ${PORT}`);
    });
}

module.exports = app;