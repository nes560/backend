const mysql = require('mysql2');

// Buat koneksi pool (lebih efisien daripada createConnection biasa)
const db = mysql.createPool({
    host: 'localhost',      // Server database (biasanya localhost)
    user: 'root',           // User default XAMPP adalah 'root'
    password: '',           // Password default XAMPP biasanya kosong
    database: 'tukang_db',  // GANTI DENGAN NAMA DATABASE KAMU YANG ASLI
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Cek koneksi saat aplikasi jalan (Opsional, untuk memastikan saja)
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal terkoneksi ke Database:', err.message);
    } else {
        console.log('✅ Berhasil terkoneksi ke Database MySQL!');
        connection.release(); // Kembalikan koneksi ke pool
    }
});

// Export dengan promise() agar bisa pakai async/await di controller nanti
module.exports = db.promise();