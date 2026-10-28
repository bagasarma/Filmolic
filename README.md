# Filmolic - Catalog Movies

Proyek website streaming dan ulasan film yang dibangun dengan arsitektur 3-tier dan dikontainerisasi menggunakan **Docker Compose**.

---

## 🏛️ Arsitektur Kontainer

Proyek ini menggunakan **Docker Compose** dengan 3 layanan utama:

| Layanan | Container Name | Base Image | Port Host | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | `db_filmolic_container` | `mariadb:10.4` | `3306` | Database MariaDB, inisialisasi awal via `db_filmolic.sql` dengan volume persistent `mariadb_data`. Dilengkapi *healthcheck*. |
| **Backend** | `backend_filmolic_container` | `node:18-alpine` | `3000` | REST API Express.js, terhubung ke MariaDB, auto-seed data film dari `movies.json`. Menunggu MariaDB *healthy* sebelum start. |
| **Frontend** | `frontend_filmolic_container` | `nginx:alpine` | `80` | Web server & Reverse Proxy Nginx untuk menyajikan file statis (`pages/`, `css/`) dan me-routing endpoint `/api/` ke Backend. |

Semua kontainer terhubung ke network terisolasi: `filmolic_network` (`bridge`).

---

## 🚀 Cara Menjalankan dengan Docker Compose

### 1. Menjalankan Seluruh Kontainer
Buka terminal pada direktori proyek dan jalankan:
```bash
docker compose up -d
```
Flag `-d` menjalankan kontainer di latar belakang (*detached mode*).

### 2. Memeriksa Status Kontainer
```bash
docker compose ps
```

### 3. Melihat Log Kontainer
```bash
# Log seluruh layanan
docker logs -f

# Log backend
docker logs -f backend_filmolic_container

# Log database
docker logs -f db_filmolic_container

# Log frontend
docker logs -f frontend_filmolic_container
```

### 4. Menghentikan Kontainer
```bash
# Menghentikan kontainer (data database tetap tersimpan di volume)
docker compose down

# Menghentikan kontainer beserta penghapusan volume database
docker compose down -v
```

### 5. Membangun Ulang (*Rebuild*) Kontainer
Jika melakukan perubahan kode pada backend atau frontend:
```bash
docker compose up -d --build
```

---

## 🌐 Akses Aplikasi

- **Website Utama (Frontend Nginx)**: [http://localhost](http://localhost) (atau port 80)
- **Halaman Login**: [http://localhost/login.html](http://localhost/login.html)
- **Halaman Register**: [http://localhost/register.html](http://localhost/register.html)
- **Halaman Dashboard Admin**: [http://localhost/admin.html](http://localhost/admin.html)
- **Backend API**: [http://localhost:3000/api/movies](http://localhost:3000/api/movies) atau via Nginx [http://localhost/api/movies](http://localhost/api/movies)

### Akun Bawaan (Default):
- **Admin**:
  - Email: `admin@filmolic.com`
  - Password: `admin123`
- **User Reguler**:
  - Email: `bagas@gmail.com`
  - Password: `bagas123`

---

## ⚙️ Konfigurasi Environment (`.env`)

Konfigurasi database dan port dapat disesuaikan pada file `.env`:
```env
# Database
DB_HOST=db_filmolic_container
DB_PORT=3306
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=db_filmolic

# Port Host Mapping
FRONTEND_PORT=80
BACKEND_PORT=3000
DB_PORT_MAPPING=3306
```
