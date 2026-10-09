const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

require('dotenv').config();

// Konfigurasi Koneksi ke Database MySQL / MariaDB (mendukung Docker & Local)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'db_filmolic',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verifikasi koneksi database dengan retry jika MariaDB masih inisialisasi
function initDatabase(retries = 10, delay = 3000) {
    db.getConnection((err, connection) => {
        if (err) {
            console.error(`Koneksi database belum siap (${err.message}). Menghubungi ulang dalam ${delay / 1000}s... (sisa coba: ${retries})`);
            if (retries > 0) {
                setTimeout(() => initDatabase(retries - 1, delay), delay);
            }
            return;
        }
        console.log('Berhasil terhubung ke Database MySQL/MariaDB!');
        connection.release();

        // Inisialisasi otomatis: Jika tabel movies kosong, isi dari movies.json
        db.query('SELECT COUNT(*) AS count FROM movies', (qErr, results) => {
            if (!qErr && results && results[0] && results[0].count === 0) {
                console.log('Tabel movies kosong. Mengisi 60 data film dari movies.json...');
                const filePath = path.join(__dirname, 'movies.json');
                fs.readFile(filePath, 'utf8', (readErr, data) => {
                    if (readErr) return;
                    try {
                        const movies = JSON.parse(data);
                        const values = movies.map(m => [
                            m.id, m.title, m.year, m.genre, m.rating, m.poster, m.backdrop, m.overview, m.is_premium, JSON.stringify(m.cast)
                        ]);
                        const insertQuery = 'INSERT INTO movies (id, title, year, genre, rating, poster, backdrop, overview, is_premium, cast) VALUES ?';
                        db.query(insertQuery, [values], (insErr) => {
                            if (!insErr) {
                                console.log('Semua film berhasil di-restore ke Database!');
                            } else {
                                console.error('Gagal restore film ke DB:', insErr.message);
                            }
                        });
                    } catch (e) {
                        console.error('Gagal membaca movies.json:', e);
                    }
                });
            }
        });
    });
}
initDatabase();


// 2. API Endpoint untuk Login User
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM users WHERE email = ? AND password = ?';

    db.query(query, [email, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const user = results[0];
            res.json({
                success: true,
                message: 'Login Berhasil',
                user: { id: user.id, username: user.username, role: user.role, is_premium: user.is_premium }
            });
        } else {
            res.status(401).json({ success: false, message: 'Email atau Password salah!' });
        }
    });
});

// 3. API Endpoint untuk Register User
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkQuery, [email], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) return res.status(400).json({ success: false, message: 'Email sudah terdaftar!' });

        const insertQuery = 'INSERT INTO users (username, email, password, role, is_premium) VALUES (?, ?, ?, "user", false)';
        db.query(insertQuery, [username, email, password], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
        });
    });
});

// 4. API Endpoint Upgrade Premium
app.post('/api/upgrade', (req, res) => {
    const { id } = req.body;
    const updateQuery = 'UPDATE users SET is_premium = true WHERE id = ?';

    db.query(updateQuery, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Akun berhasil di-upgrade menjadi Premium!' });
    });
});

// 5. API Endpoint untuk Mengambil Favorit User
app.get('/api/favorites/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = 'SELECT movie_id FROM favorites WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const movieIds = results.map(row => row.movie_id);
        res.json(movieIds);
    });
});

// 6. API Endpoint untuk Toggle (Tambah/Hapus) Favorit
app.post('/api/favorites/toggle', (req, res) => {
    const { userId, movieId } = req.body;
    
    const checkQuery = 'SELECT * FROM favorites WHERE user_id = ? AND movie_id = ?';
    db.query(checkQuery, [userId, movieId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        if (results.length > 0) {
            const deleteQuery = 'DELETE FROM favorites WHERE user_id = ? AND movie_id = ?';
            db.query(deleteQuery, [userId, movieId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, action: 'removed' });
            });
        } else {
            const insertQuery = 'INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)';
            db.query(insertQuery, [userId, movieId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, action: 'added' });
            });
        }
    });
});

// Endpoint untuk Membatalkan Premium (Downgrade ke Reguler)
app.post('/api/downgrade', (req, res) => {
    const { id } = req.body;
    // Set is_premium menjadi false (0)
    const updateQuery = 'UPDATE users SET is_premium = false WHERE id = ?';

    db.query(updateQuery, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Paket Premium berhasil dibatalkan!' });
    });
});


// ==========================================
// ENDPOINT ADMIN DASHBOARD
// ==========================================

// 1. Ambil Ringkasan Statistik
app.get('/api/admin/stats', (req, res) => {
    const stats = {};
    
    // Hitung total user & user premium (untuk simulasi pendapatan)
    db.query('SELECT COUNT(*) AS total_users, SUM(is_premium) AS premium_users FROM users', (err, userRes) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.total_users = userRes[0].total_users;
        // Asumsi harga premium Rp 49.000
        stats.revenue = (userRes[0].premium_users || 0) * 49000; 

        // Hitung total film
        db.query('SELECT COUNT(*) AS total_movies FROM movies', (err, movRes) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.total_movies = movRes[0].total_movies;
            res.json(stats);
        });
    });
});

// 2. Ambil Data Semua Pengguna
app.get('/api/admin/users', (req, res) => {
    db.query('SELECT id, username, email, is_premium, role FROM users ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 3. Ubah Hak Akses Pengguna (Premium / Reguler)
app.put('/api/admin/users/:id/role', (req, res) => {
    const { is_premium } = req.body;
    db.query('UPDATE users SET is_premium = ? WHERE id = ?', [is_premium, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Hak akses berhasil diperbarui' });
    });
});

// 4. Hapus Pengguna
app.delete('/api/admin/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Pengguna berhasil dihapus' });
    });
});

// 5. Ambil Data Semua Film dari Database
app.get('/api/admin/movies', (req, res) => {
    db.query('SELECT * FROM movies ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ==========================================
// ENDPOINT FILM (Baca dari Database dengan fallback ke movies.json)
// ==========================================
app.get('/api/movies', (req, res) => {
    db.query('SELECT * FROM movies ORDER BY id DESC', (err, results) => {
        if (err || !results || results.length === 0) {
            const filePath = path.join(__dirname, 'movies.json');
            return fs.readFile(filePath, 'utf8', (readErr, data) => {
                if (readErr) return res.status(500).json({ error: 'Gagal memuat data film' });
                try {
                    res.json(JSON.parse(data));
                } catch (parseErr) {
                    res.status(500).json({ error: 'Gagal parsing data film' });
                }
            });
        }
        
        // Format ulang data agar 100% sama dengan format JSON
        const formattedMovies = results.map(m => ({
            ...m,
            is_premium: m.is_premium === 1 || m.is_premium === true,
            cast: typeof m.cast === 'string' ? JSON.parse(m.cast) : m.cast
        }));
        
        res.json(formattedMovies);
    });
});

// ==========================================
// ENDPOINT ADMIN KELOLA FILM
// ==========================================

// Hapus Film Spesifik
app.delete('/api/admin/movies/:id', (req, res) => {
    db.query('DELETE FROM movies WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Film berhasil dihapus!' });
    });
});

// RESTORE 60 FILM DARI JSON KE DATABASE
app.post('/api/admin/movies/sync', (req, res) => {
    const filePath = path.join(__dirname, 'movies.json');
    
    // Baca file movies.json
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Gagal membaca file movies.json' });
        
        const movies = JSON.parse(data);
        
        // Kosongkan tabel movies
        db.query('DELETE FROM movies', (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Siapkan array data untuk di-insert sekaligus
            const values = movies.map(m => [
                m.id, m.title, m.year, m.genre, m.rating, m.poster, m.backdrop, m.overview, m.is_premium, JSON.stringify(m.cast)
            ]);

            const insertQuery = 'INSERT INTO movies (id, title, year, genre, rating, poster, backdrop, overview, is_premium, cast) VALUES ?';
            
            db.query(insertQuery, [values], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: '60 Film berhasil di-restore ke Database!' });
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Backend berjalan di port ${PORT}`);
});