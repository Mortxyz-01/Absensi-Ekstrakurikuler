# Orens Solution Management System (MVP v1.0)

Aplikasi web terpadu untuk pengelolaan kegiatan ekstrakurikuler Orens Solution, meliputi absensi berbasis QR dinamis 5 menit, manajemen keanggotaan divisi (Wajib dan Opsional), modul materi, tugas, dan penilaian otomatis.

## 1. Stack Teknologi

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend & Database:** PostgreSQL via Supabase (Auth, RLS, RPC, Triggers)
- **QR Engine:** QRCode canvas generator dan verifikasi token server
- **Server:** Node.js, Deno (Supabase Edge Functions)

---

## 2. Cara Menjalankan Aplikasi

### A. Prasyarat
- Node.js (v18+) dan pnpm (atau npm)
- Docker (untuk Supabase lokal jika dijalankan di mesin lokal)

### B. Langkah Menjalankan Frontend
1. Pasang dependensi:
   ```bash
   pnpm install
   ```
2. Pastikan berkas `.env` sudah sesuai (salin dari `.env.example` jika belum ada):
   ```bash
   cp .env.example .env
   ```
3. Jalankan server pengembangan Vite:
   ```bash
   pnpm run dev
   ```
4. Buka peramban di `http://localhost:5173/`.

---

## 3. Akun Demo untuk Pengujian (7 Role)

Seluruh akun demo menggunakan kata sandi: `Orens2026!`

| Peran | Email | Wewenang Utama |
|---|---|---|
| **Pembina** | `pembina@orens.org` | Akses penuh seluruh modul (paritas 100% dengan Ketua) |
| **Ketua** | `ketua@orens.org` | Akses penuh seluruh modul (paritas 100% dengan Pembina) |
| **Wakil Ketua** | `wakil@orens.org` | Presensi, anggota, dan materi |
| **Sekretaris** | `sekretaris@orens.org` | Presensi, anggota, materi, dan laporan |
| **Ketua Divisi** | `ketuadivisi@orens.org` | Kelola materi, tugas, dan nilai pada divisinya |
| **Mentor** | `mentor@orens.org` | Kelola materi, tugas, dan nilai bimbingan divisinya |
| **Member** | `member@orens.org` | Pindai QR, lihat materi, kumpulkan tugas, lihat nilai |

Tersedia tombol pintas (One-Click Quick Switcher) pada halaman login untuk pengujian cepat.

---

## 4. Cara Menyiapkan Akun Admin Pertama Secara Aman

1. Buka Supabase Studio lokal di `http://localhost:54323/` atau jalankan migrasi SQL.
2. Daftarkan email admin di `auth.users` dengan kata sandi terenkripsi (bcrypt).
3. Buat profil pada tabel `public.users` dengan menyertakan `role_id` milik Pembina (`00000000-0000-0000-0000-000000000001`) atau Ketua (`00000000-0000-0000-0000-000000000002`).
4. Berikan data keanggotaan pada tabel `public.members`.
5. Script otomatis tersedia pada `supabase/seed.sql`.

---

## 5. Fitur yang Sudah Berfungsi Penuh

1. **Autentikasi & RBAC:** Login Supabase Auth, pemisahan role dengan validasi hak akses frontend dan RLS backend.
2. **Dashboard Role-Aware:** Kartu statistik anggota, ringkasan 5 divisi, status sesi absensi aktif, dan progres pribadi.
3. **Manajemen Anggota:**
   - Pencarian siswa berdasarkan nama, email, dan NIM.
   - Filter divisi dan filter role.
   - Pengaturan alokasi 2 divisi (1 Wajib dan 1 Opsional).
   - Validasi trigger database: satu anggota tidak dapat memiliki lebih dari 2 divisi aktif.
   - Nonaktifkan atau aktifkan anggota dengan pencatatan log audit wajib.
4. **5 Divisi Ekstrakurikuler:**
   - UI/UX, Web Development, Game Development, Esport, dan Cybersecurity.
   - Tampilan rincian jumlah anggota Wajib dan Opsional per divisi.
5. **Absensi QR Dinamis 5 Menit:**
   - Admin membuat sesi dan membukanya.
   - Server menerbitkan token acak baru setiap 5 menit via RPC `generate_qr_token`.
   - Countdown visual pembaruan token.
   - Kode sesi cadangan 6 digit untuk peserta dengan kendala kamera.
   - Pencegahan absensi ganda pada tingkat database (unique constraint).
   - Status otomatis Hadir atau Terlambat berdasarkan batas toleransi waktu.
6. **Materi Pembelajaran:**
   - Pengelompokan materi berdasarkan divisi dan tingkat kesulitan.
   - Tautan referensi eksternal (GitHub, Google Drive, Figma).
   - Fitur arsip materi.
7. **Tugas & Evaluasi:**
   - Pembuatan tugas dengan bobot penilaian dan tenggat waktu.
   - Pengumpulan jawaban oleh Member.
   - Form penilaian dan umpan balik oleh mentor/staff.
8. **Kalkulasi Nilai Otomatis:**
   - Mengikuti formula: `Nilai Akhir = (Kehadiran Wajib × 0.4) + (Nilai Tugas × 0.6)`.
   - Kehadiran dihitung dari sesi Wajib yang telah selesai.
   - Kegiatan Opsional tidak mengurangi nilai Wajib.
   - Penanganan data belum cukup dengan label "Penilaian belum lengkap".
9. **Laporan & Ekspor:**
   - Rekap absensi aktual dengan filter tanggal dan divisi.
   - Ekspor berkas CSV langsung.
   - Tampilan ramah cetak (Print/PDF).
10. **Log Audit Keamanan:**
    - Tabel audit immutable yang mencatat setiap tindakan sensitif beserta alasannya.
11. **Tampilan & Aksesibilitas:**
    - Palet warna Orens (#EA580C), Abu-abu gelap (#111827), dan Putih (#FFFFFF).
    - Desain responsif mobile dengan target sentuh minimal 44px.
    - Dukungan mode Gelap dan Terang dengan penyimpanan preferensi lokal.

---

## 6. Konfigurasi Lanjutan yang Dapat Ditambahkan Nanti

- Integrasi kamera WebRTC native via perangkat keras smartphone langsung pada lingkungan produksi HTTPS.
- Penyimpanan file attachment menggunakan bucket Supabase Storage jika diperlukan pengunggahan berkas lokal berukuran besar.
- Integrasi notifikasi bot WhatsApp atau pengingat sesi presensi.
