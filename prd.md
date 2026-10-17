# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Orens Solution Management System — MVP v1.0

### 1. Informasi Produk

- **Nama:** Orens Solution Management System
- **Jenis:** Aplikasi web manajemen ekstrakurikuler
- **Target pengguna:** Pembina, pengurus, Ketua Divisi, Mentor, dan Member
- **Tujuan:** Mempermudah absensi, pengelolaan anggota, materi, tugas, dan penilaian.
- **Platform:** Web responsif untuk desktop dan smartphone.
- **Bahasa antarmuka:** Bahasa Indonesia.

### 2. Tujuan MVP

Membangun aplikasi sederhana yang bisa langsung dicoba untuk kegiatan Orens Solution.

Prioritas:
1. Login dan dashboard sesuai jabatan.
2. Manajemen anggota dan lima divisi.
3. Absensi QR dinamis setiap lima menit.
4. Pengaturan divisi Wajib dan Opsional.
5. Materi dan tugas.
6. Penilaian otomatis.
7. Rekap absensi dan nilai.

Fitur tambahan seperti notifikasi kompleks, analitik lanjutan, dan sistem verifikasi identitas tingkat lanjut ditunda.

### 3. Pengguna dan Hak Akses

**Pembina**
- Akses seluruh fitur.

**Ketua**
- Akses identik dengan Pembina.

**Wakil Ketua**
- Absensi, anggota, dan materi.

**Sekretaris**
- Absensi, anggota, materi, jadwal, dan administrasi laporan.

**Ketua Divisi**
- Mengelola anggota, absensi, materi, tugas, dan nilai pada divisinya.

**Mentor**
- Mengelola materi, absensi, tugas, dan nilai pada divisi yang dibimbing.

**Member**
- Scan QR, melihat materi, tugas, jadwal, nilai, dan riwayat absensi pribadi.

### 4. Divisi

Sediakan lima divisi:
- UI/UX
- Web Development
- Game Development
- Esport
- Cybersecurity

Anggota dapat mengikuti maksimal dua divisi. Setiap relasi keanggotaan memiliki status Wajib atau Opsional.

### 5. Fitur Utama

#### A. Autentikasi
- Login menggunakan email dan kata sandi.
- Logout.
- Pengelolaan akun oleh admin.
- Role ditentukan dari data database.
- Akun awal admin disiapkan melalui proses konfigurasi yang terdokumentasi.

#### B. Dashboard
- Statistik anggota.
- Statistik per divisi.
- Sesi absensi aktif.
- Jumlah anggota hadir dan belum absen.
- Ringkasan nilai.
- Materi dan tugas terbaru.

Informasi yang ditampilkan harus mengikuti hak akses pengguna.

#### C. Manajemen Anggota
- Tambah, edit, lihat, dan nonaktifkan anggota.
- Cari anggota berdasarkan nama.
- Filter berdasarkan divisi dan jabatan.
- Atur divisi Wajib dan Opsional.
- Lihat riwayat absensi dan nilai.

#### D. Absensi QR
- Admin membuat sesi absensi.
- Sistem menghasilkan QR dinamis yang berganti setiap lima menit.
- QR ditampilkan dengan penghitung waktu.
- Member memindai QR menggunakan kamera smartphone.
- Token diperiksa berdasarkan waktu server.
- Satu anggota hanya dapat tercatat satu kali per sesi.
- Admin melihat rekap kehadiran secara langsung.
- Admin dapat menutup sesi.

Status absensi: Hadir, Terlambat, Izin, Sakit, Alfa, dan Belum Absen.

#### E. Materi
- Buat, edit, lihat, dan arsipkan materi.
- Materi dikelompokkan berdasarkan divisi.
- Materi dapat berisi deskripsi dan tautan atau lampiran.

#### F. Tugas
- Buat tugas dan tenggat waktu.
- Tentukan divisi serta peserta.
- Simpan nilai dan umpan balik.
- Member dapat melihat tugas dan nilai pribadinya.

Pengumpulan file dapat dibuat sederhana atau ditunda jika waktu pengembangan terbatas.

#### G. Penilaian
Bobot awal:
- Kehadiran wajib: 40%.
- Nilai tugas: 60%.

Persentase kehadiran:

Kehadiran = (Hadir + Terlambat) / Total Sesi Wajib Selesai × 100%.

Nilai tugas menggunakan rata-rata berbobot.

Nilai akhir:

Nilai Akhir = (Kehadiran × 0,4) + (Nilai Tugas × 0,6).

Izin dan sakit yang disetujui tidak dianggap Alfa, tetapi tidak dihitung sebagai hadir dalam rumus awal.

Kegiatan Opsional tidak mengurangi nilai kehadiran Wajib.

Jika data belum cukup, tampilkan "Belum ada data" atau "Penilaian belum lengkap", bukan nilai nol otomatis.

#### H. Laporan
- Rekap kehadiran per sesi.
- Rekap kehadiran per anggota.
- Rekap per divisi.
- Rekap nilai tugas dan nilai akhir.
- Filter berdasarkan tanggal, anggota, dan divisi.
- Ekspor CSV sebagai prioritas awal.

Ekspor Excel dan PDF dapat ditambahkan setelah fitur utama selesai.

### 6. Teknologi

- Frontend: React, TypeScript, Vite.
- Tampilan: Tailwind CSS.
- Database: PostgreSQL.
- Backend: Supabase.
- Login: Supabase Auth.
- File: Supabase Storage jika diperlukan.
- QR: Pustaka QR Code.
- Pembaruan langsung: Supabase Realtime jika diperlukan.

### 7. Desain

- Oranye utama: #EA580C.
- Putih: #FFFFFF.
- Abu-abu gelap: #111827.
- Tampilan minimalis, sederhana, dan mudah digunakan.
- Navigasi desktop menggunakan sidebar.
- Navigasi smartphone dibuat ringkas.
- Prioritaskan tombol absensi dan informasi penting.

### 8. Kriteria Keberhasilan

MVP dianggap berhasil apabila:
1. Pengguna bisa login dan melihat panel sesuai role.
2. Pembina dan Ketua memiliki akses yang sama.
3. Admin dapat mengelola anggota dan divisi.
4. Anggota dapat mengikuti dua divisi.
5. QR berubah setiap lima menit dan token lama ditolak.
6. Absensi tidak tercatat dua kali.
7. Kegiatan Opsional tidak memengaruhi perhitungan kehadiran Wajib.
8. Nilai dihitung sesuai rumus.
9. Materi dan tugas tersimpan dalam database.
10. Data tetap tersedia setelah halaman dimuat ulang.
11. Aplikasi dapat digunakan pada smartphone.
12. Fitur utama sudah diuji sebelum dinyatakan selesai.

### 9. Di Luar Cakupan MVP

- Notifikasi WhatsApp.
- Aplikasi Android/iOS native.
- Pengenalan wajah.
- Verifikasi identitas tingkat lanjut.
- Analitik prediktif.
- Sistem penghargaan kompleks.
- Integrasi sistem sekolah eksternal.

Fitur di luar cakupan dapat dikembangkan pada versi berikutnya.