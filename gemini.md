# BUILD PROMPT — ORENS SOLUTION MVP

Buat aplikasi web bernama Orens Solution Management System berdasarkan PRD berikut.

**Prioritas utama: langsung implementasikan aplikasi yang berfungsi. Jangan menghabiskan waktu hanya untuk membuat perencanaan atau dokumentasi.**

## A. Stack

Gunakan:
- React + TypeScript + Vite.
- Tailwind CSS.
- Supabase Auth.
- PostgreSQL melalui Supabase.
- Supabase RLS.
- Supabase Edge Functions untuk operasi QR yang sensitif.
- Pustaka QR Code untuk pembuatan dan pemindaian QR.

Gunakan Supabase lokal melalui Docker jika lingkungan mendukungnya.

## B. Tampilan

Buat desain sederhana, modern, responsif, dan konsisten.

Warna utama:
- Oranye: #EA580C.
- Putih: #FFFFFF.
- Abu-abu gelap: #111827.

Gunakan Bahasa Indonesia untuk seluruh antarmuka.

Buat:
- Halaman login.
- Dashboard.
- Sidebar desktop.
- Navigasi smartphone.
- Halaman anggota.
- Halaman divisi.
- Halaman absensi.
- Halaman materi.
- Halaman tugas.
- Halaman nilai.
- Halaman laporan.

Hindari animasi berlebihan dan komponen yang tidak diperlukan.

## C. Hak akses

Implementasikan role:
- Pembina.
- Ketua.
- Wakil Ketua.
- Sekretaris.
- Ketua Divisi.
- Mentor.
- Member.

Pembina dan Ketua harus memiliki permission yang sama persis.

Wakil Ketua hanya mengakses absensi, anggota, dan materi.

Sekretaris mengakses absensi, anggota, materi, dan administrasi terkait.

Ketua Divisi dan Mentor dibatasi pada divisi yang menjadi tanggung jawabnya.

Member hanya dapat melihat informasi pribadinya, materi, tugas, jadwal, dan absensi.

Gunakan pemeriksaan akses backend dan RLS. Jangan hanya menyembunyikan menu di frontend.

## D. Database

Buat migrasi SQL untuk tabel:
- users atau profil pengguna yang terhubung dengan Supabase Auth.
- roles dan permissions bila diperlukan.
- divisions.
- member_divisions.
- activities.
- attendance_sessions.
- attendance_qr_tokens.
- attendance_records.
- learning_materials.
- assignments.
- assignment_grades.
- grading_policies.
- audit_logs.

Tambahkan foreign key, indeks, dan batasan unik yang diperlukan.

Gunakan struktur relasional yang sederhana. Jangan membuat tabel atau lapisan abstraksi yang tidak diperlukan.

## E. Anggota dan divisi

Buat lima divisi awal:
UI/UX, Web Development, Game Development, Esport, dan Cybersecurity.

Admin dapat menambah, mengubah, serta menonaktifkan anggota.

Anggota dapat mengikuti maksimal dua divisi:
- Wajib.
- Opsional.

Validasi agar satu anggota tidak mempunyai lebih dari dua keanggotaan aktif.

## F. Absensi QR

Implementasikan absensi QR yang benar-benar berfungsi.

- Admin membuat dan membuka sesi.
- QR berisi token acak yang diterbitkan server.
- Token berlaku lima menit menurut waktu server.
- QR otomatis diperbarui.
- Token kedaluwarsa ditolak.
- Member harus login sebelum absen.
- Server memvalidasi sesi, token, peserta, dan status akun.
- Database mencegah absensi ganda.
- Sesi yang ditutup menolak absensi baru.
- Dashboard admin menampilkan jumlah peserta yang hadir.

Jangan menganggap perubahan QR di frontend saja sudah cukup.

## G. Rumus penilaian

Gunakan:
- Kehadiran wajib = 40%.
- Nilai tugas = 60%.

Kehadiran = (Hadir + Terlambat) / Total Sesi Wajib Selesai × 100%.

Nilai Akhir = (Kehadiran × 0,4) + (Nilai Tugas × 0,6).

Izin dan sakit yang disetujui tidak dianggap Alfa, tetapi tidak dihitung sebagai hadir dalam rumus default.

Kegiatan Opsional tidak mengurangi nilai kehadiran Wajib.

Jangan menghitung data yang belum tersedia sebagai nol otomatis. Tampilkan status penilaian yang belum lengkap.

## H. Materi dan tugas

Ketua Divisi dan Mentor dapat mengelola materi dan tugas dalam divisi masing-masing.

Member dapat melihat materi dan tugas yang ditujukan kepadanya.

Simpan nilai dan umpan balik tugas di database.

Jika waktu pengembangan terbatas, prioritaskan pembuatan tugas dan pemberian nilai sebelum menambahkan fitur pengumpulan file yang kompleks.

## I. Laporan

Buat rekap absensi dan nilai yang dapat difilter.

Prioritaskan ekspor CSV. Tambahkan Excel dan PDF jika implementasi fitur utama sudah selesai.

Pastikan laporan menggunakan data aktual, bukan data contoh.

## J. Urutan pengerjaan

1. Periksa lingkungan dan struktur proyek.
2. Siapkan konfigurasi dan database.
3. Buat autentikasi dan role.
4. Buat dashboard serta manajemen anggota.
5. Implementasikan absensi QR.
6. Buat materi dan tugas.
7. Buat penilaian otomatis.
8. Buat laporan.
9. Jalankan aplikasi dan pengujian.
10. Perbaiki kesalahan yang ditemukan.

Jangan berhenti setelah membuat struktur folder atau tampilan statis. Lanjutkan hingga alur inti bisa digunakan.

Jika suatu fitur gagal karena layanan eksternal belum dikonfigurasi, selesaikan fitur lain yang tidak bergantung padanya dan jelaskan konfigurasi yang diperlukan.

Jangan membuat tombol palsu atau menyatakan fitur berfungsi jika belum diimplementasikan.

## K. Hasil akhir

Berikan:
- Source code lengkap.
- Migrasi SQL.
- Kebijakan RLS.
- Edge Functions yang diperlukan.
- Berkas `.env.example`.
- Panduan instalasi singkat.
- Cara menjalankan aplikasi.
- Cara menyiapkan akun admin pertama secara aman.
- Daftar fitur yang sudah berfungsi.
- Daftar konfigurasi yang masih diperlukan.

Fokus pada MVP yang sederhana, rapi, dan dapat dijalankan. Verifikasi lanjutan dan fitur tambahan dapat dikembangkan setelah versi pertama selesai, tetapi jangan menonaktifkan autentikasi, pemeriksaan role, atau validasi QR dasar.