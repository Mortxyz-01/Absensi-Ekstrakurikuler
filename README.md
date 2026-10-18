# Orens Solution Management System (MVP v1.0)

Aplikasi web pengelolaan kegiatan ekstrakurikuler Orens Solution: absensi berbasis QR dinamis (rotasi token 5 menit), manajemen anggota dan divisi (Wajib dan Opsional), materi, tugas, penilaian otomatis, laporan, dan log audit.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Auth, PostgreSQL + RLS, RPC, Trigger)
- **Scanner:** `html5-qrcode` (kamera in-app, butuh HTTPS) + jalur tempel token/kode cadangan

## 1. Menjalankan di Lokal

Prasyarat: Node.js 18+ dan Docker (untuk Supabase lokal).

```bash
# 1. Dependensi
pnpm install        # atau npm install

# 2. Supabase lokal (API di 54321, DB di 54322, Studio di 54323)
supabase start

# 3. Terapkan semua migrasi secara berurutan (daftar di bagian 5; atau 'supabase db reset' jalankan otomatis)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/<nama-file>.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql

# 4. Isi .env (dua variabel ini yang dibaca frontend)
VITE_SUPABASE_URL=http://127.0.0.1:54321   # atau http://192.168.1.11:8899 (deploy LAN, lihat bagian 7)
VITE_SUPABASE_ANON_KEY=<anon key dari 'supabase start'>

# 5. Jalankan
pnpm run dev        # http://localhost:5173
pnpm run preview    # serve hasil build di http://localhost:4173
pnpm run build      # verifikasi wajib sebelum deploy: tsc + vite build
```

Peringatan CSP: `index.html` memakai `script-src 'self'` sehingga **halaman dev di 5173 blank** di browser perangkat lain karena skrip inline React Refresh diblokir. Untuk pengujian di perangkat lain (HP) gunakan `pnpm run build` lalu `pnpm run preview`, atau deploy ke server LAN (bagian 7).

## 2. Akun untuk Pengujian

Semua akun memakai password yang sama: `Orens2026!` (bcrypt). Login via REST terverifikasi. **Jangan membuat akun secara manual via SQL ke `auth.users` tanpa mengisi kolom token: Supabase GoTrue menolak baris dengan `confirmation_token`, `email_change`, `recovery_token`, dst. bernilai NULL (error "Database error querying schema"). Isi dengan string kosong `''`.**

Akun pengurus (roster riil):

| Peran | Nama | Email |
|---|---|---|
| Pembina | Budi Santoso, M.Kom. | `pembina@orens.org` |
| Ketua | Gregorius Wibisono | `gregorius5069.pplg1@smkprestasiprima.sch.id` |
| Wakil Ketua | Rizqy Dwi Budi Rabbani | `rizqy5086.pplg1@smkprestasiprima.sch.id` |
| Sekretaris | Daud Sanggalangi Patuli | `daud5063.pplg1@smkprestasiprima.sch.id` |
| Sekretaris | Zefanya Anastasia Setiawan | `zefanya5092.pplg1@smkprestasiprima.sch.id` |
| Ketua Divisi | 5 orang (Bayu/Cybersec, Gagah/Gamedev, Kayla/UIUX, Nathaniel/Cybersec, Tober/Web) | pattern `<nama><no>.pplg<N>@smkprestasiprima.sch.id`, contoh `gagah5067.pplg1@...` |
| Mentor | 6 orang (semua per divisinya) | pattern sama, contoh `ghifari5068.pplg1@smkprestasiprima.sch.id` |

Daftar lengkap: `SELECT email, full_name FROM users u JOIN roles r ON r.id=u.role_id;` Semua divisi membawai 1 akun member dummy siap pakai:

| Akun Member Dummy | Divisi |
|---|---|
| `dummy.gamedev01@smkprestasiprima.sch.id` | Game Development |
| `dummy.webdev01@smkprestasiprima.sch.id` | Web Development |
| `dummy.uiux01@smkprestasiprima.sch.id` | UI/UX |
| `dummy.cybersec01@smkprestasiprima.sch.id` | Cybersecurity |
| `dummy.esport01@smkprestasiprima.sch.id` | Esport |

Sumber akun: `supabase/seed.sql` dan migrasi `20261017000005_seed_game_dev_students.sql` (fungsi `create_gd_student` masih bisa dipanggil ulang). Akun member dummy dibuat langsung via psql (data uji, bukan migrasi).

## 3. Matriks Hak Akses (sumber kebenaran: RLS + `AuthContext`)

| Peran | Akses halaman | Catatan scoping |
|---|---|---|
| Pembina, Ketua | Semua, termasuk Laporan, Divisi, Log Audit, tombol Reset Nilai | Top admin, paritas 1:1 |
| Wakil Ketua, Sekretaris | Dashboard, Anggota, Divisi, Laporan, Absensi, Materi, Nilai | Tidak bisa menilai atau reset nilai (DB menolak) |
| Ketua Divisi, Mentor | Dashboard, Absensi, Materi, Tugas, Nilai (semua terkunci divisinya) | Tidak bisa membuat sesi gabungan atau mengakses Laporan/Divisi |
| Member | Dashboard, Absensi, Materi, Tugas, Nilai (semuanya pribadi) | Tidak bisa menilai diri sendiri (RLS menolak) |

Kebijakan ini hidup di tiga tempat yang harus tetap sinkron: (1) policy SQL di migrasi `20261017000002_rbac_and_rls.sql`; (2) flag turunan di `src/context/AuthContext.tsx` (`isTopAdmin`, `isDivisionScoped`, `canViewReports`, `canViewDivisions`, dan lainnya); (3) gerbang render per halaman di `src/App.tsx` dan item nav `Sidebar`/`MobileNav`.

## 4. Aturan Bisnis Utama

- **QR presensi:** sesi dibuka admin, RPC `generate_qr_token` menerbitkan token acak yang dirotasi; anggota memindai (kamera in-app) atau menempel token/kode cadangan 6 karakter; RPC `verify_attendance_scan` memvalidasi; absen ganda ditolak constraint unik; status Hadir/Terlambat otomatis lewat `late_threshold_minutes`.
- **Nilai:** formula `Nilai Akhir = (persentase kehadiran sesi Wajib x 40%) + (rata-rata nilai tugas x 60%)`; kegiatan Opsional tidak mengurangi nilai Wajib; data belum lengkap diberi label.
- **Anggota:** maksimal 2 divisi aktif per anggota (1 Wajib + 1 Opsional, divalidasi trigger).
- **Log audit:** tindakan sensitif (input manual, ubah role, reset nilai) wajib memakai `AuditPromptModal` dengan alasan wajib isi, lalu memanggil `logAudit(...)`; tabel `audit_logs` immutable (REVOKE UPDATE/DELETE + trigger pencegah).
- **Semua teks UI memakai Bahasa Indonesia.**

## 5. Migrasi Database (urutan penting)

```text
supabase/migrations/
  20261017000001_core_schema.sql            # tabel inti: users, roles, divisions, members, sessions, dst.
  20261017000002_rbac_and_rls.sql           # fungsi RBAC (is_officer, is_top_admin, auth_user_division_ids) + semua policy
  20261017000003_audit_triggers_and_rpc.sql # audit log immutable + RPC buat token & verifikasi presensi
  20261017000004_fix_relations_and_columns.sql
  20261017000005_seed_game_dev_students.sql
  20261017000006_real_organization_structure.sql
  20261018000001_security_hardening.sql
  20261018000002_vulnerability_fixes.sql
  20261018000003_clear_activity_data.sql
  20261018000004_add_change_role_audit_action.sql
  20261018000005_rpc_dashboard_summary.sql  # RPC get_dashboard_summary metrik riil dashboard
  20261018000006_seed_activity_data.sql      # data uji aktivitas presensi, materi, tugas, nilai
  20261018000007_add_reset_grades_audit_action.sql  # whitelist log audit ditambah RESET_GRADES (fitur Reset Nilai)
  20261018000008_fix_verify_scan_idor.sql    # penjaga IDOR: member hanya bisa merekam presensi diri sendiri
```

Perlu dicermati: kolom `activity_type` di `attendance_sessions` adalah **generated column** (dari `session_type`, nilai `Wajib`/`Opsional`/`General`), jadi kolom itu tidak menerima INSERT manual.

## 6. Struktur Direktori

```text
src/
  pages/        # DashboardPage, MembersPage, AttendancePage, MaterialsPage, AssignmentsPage,
                # GradesPage, ReportsPage, AuditPage, DivisionsPage, LoginPage
  components/   # Sidebar, MobileNav (nav bawah HP), Header, UIState (AuditPromptModal, spinner, dll)
  context/      # AuthContext (flag hak akses), ThemeContext (gelap/terang)
  lib/          # supabase client, verifyAttendance, generateQrToken, logAudit
  types/        # interface AttendanceSession, AttendanceRecord, dst.
supabase/       # config.toml, migrations/, seed.sql, functions/ (Edge Function)
index.html      # CSP dipasang ketat (script-src 'self'), daftar connect-src per environment
```

## 7. Deploy LAN (server: `192.168.1.11`)

Aplikasi statis disajikan Caddy di server LAN; Supabase tetap berjalan di laptop dev dan diproxi lewat satu asal.

- URL situs: `https://192.168.1.11:8899` (TLS sertifikat self-signed, SAN IP + `orens.home`; browser akan menampilkan peringatan "not private", tap Lanjut: sisi klien butuh secure context untuk izin kamera).
- Konfigurasi Caddy: `/opt/web/caddy/Caddyfile` (site `https://192.168.1.11:8899`, proxy `/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1` ke laptop dev di port 54321).
- Menjalankan deploy frontend: `npx vite build`, lalu tar `dist/` ke `/opt/web/sites/orens` melalui SSH, lalu `sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile` (container caddy perlu di-recreate bila Caddyfile diedit di host karena bind-mount per-file terikat inode lama).
- Catatan penting: edit `VITE_SUPABASE_URL` di `.env` dan daftar `connect-src` di `index.html` **sebelum** build; URL dan CSP harus cocok dengan origin sebuah deployment. Laptop dev harus hidup karena adalah database Supabase hostnya.

## 8. Panduan Khusus untuk AI Agent yang Menguji

Jika Anda adalah AI agent yang diminta menguji atau mengerjakan repo ini, ikuti urutan berikut agar hasilnya terverifikasi:

**Gerbang wajib sebelum menyatakan selesai:**

```bash
npx tsc --noEmit        # 0 error = lolos
npx vite build          # sukses = build app utuh
```

Sisi UI wajib bisa klik-uji satu per satu (tombol, form, modal, tab). Jika tidak ada headless browser harness, nyatakan keterbatasan ini secara jujur di laporan, dan ganti dengan verifikasi level API minimal untuk alur utama (login, buat sesi, verifikasi presensi, penilaian):

**Pengujian E2E lewat REST (pola terbukti):**

```bash
# Login untuk setiap role (password Orens2026!)
curl "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"gagah5067.pplg1@smkprestasiprima.sch.id","password":"Orens2026!"}'

# Semua query pakai header: apikey + Authorization: Bearer <access_token>
# Endpoint yang dipakai UI:
POST /rest/v1/rpc/generate_qr_token      { p_session_id: <uuid> }
POST /rest/v1/rpc/verify_attendance_scan { p_token, p_member_id, p_session_id, p_method: "qr_scan"|"backup_code" }
GET/POST/DELETE /rest/v1/attendance_sessions, assignments, assignment_submissions, assignment_grades, learning_materials
```

**Uji RLS adalah bagian dari test:** hak akses ditetapkan per role, maka juga uji operasi insert/update/delete dengan token dari peran berbeda (member harus 403 pada `assignment_grades`, Ketua Divisi 201 hanya pada submission divisinya, dan seterusnya). Kebijakan hidup di migrasi `20261017000002_rbac_and_rls.sql`, jangan hanya perbaiki di UI tanpa mengecek DB.

**Jebakan yang sudah pernah dialami tim:**

- Status RLS bentuk "204 tapi baris tidak terhapus" itu normal di PostgREST (delete yang cocok nol baris tetap 204); buktikan dengan membandingkan jumlah baris sebelum dan sesudah.
- `activity_type` adalah GENERATED column; jangan `INSERT` nilainya.
- `assignments` wajib `due_date`; `learning_materials` memiliki CHECK `learning_level IN ('Beginner','Intermediate','Advanced')`.
- Verifikasi kamera butuh HTTPS, dan fail saat membuka URL IP tanpa SNI jika Caddy tidak punya `default_sni`.
- Membuat `auth.users` baru via SQL wajib mengisi kolom token dengan string kosong (GoTrue menolak NULL, detail di bagian 2).
- Ada satu sesi presensi bekas uji user yang sengaja dibiarkan di DB lokal (sesi `ad`, status closed).

**Direktori acuan:** `prd.md` (kebutuhan), `gemini.md` (build prompt asal), `Pendaftaran Ekstrakulikuler Orens Solution (Jawaban).xlsx` (sumber data roster), migrasi SQL (aturan data paling mengikat).

## 9. Status Implementasi dan Penyelesaian Item Tertunda

Seluruh item tertunda pada rilis sebelumnya telah diselesaikan:

1. **RPC Dashboard `get_dashboard_summary` (Selesai):**
   - Fungsi database PostgreSQL `get_dashboard_summary()` telah diimplementasikan di `supabase/migrations/20261018000005_rpc_dashboard_summary.sql`.
   - Mengembalikan metrik agregat riil: total anggota aktif (`total_members`), total sesi presensi (`total_sessions`), persentase kehadiran (`attendance_rate`), rincian 5 divisi (`divisions` dengan nama kadiv), serta tren kehadiran 7 hari terakhir (`daily_trend`).
   - Dapat diakses langsung melalui PostgREST RPC (`POST /rest/v1/rpc/get_dashboard_summary`) oleh pengguna terotentikasi; `anon` sudah dicabut (migrasi 00005 direvisi).

2. **Seed Data Aktivitas Realistis (Selesai):**
   - Tersedia di migrasi `supabase/migrations/20261018000006_seed_activity_data.sql` dan file mandiri `supabase/seed_activity.sql`.
   - Memuat data sesi presensi Wajib dan Opsional, rekaman presensi anggota (Hadir, Terlambat, Izin), materi pembelajaran per divisi (tingkat Beginner, Intermediate, Advanced), tugas dengan bobot penilaian dan tenggat waktu, serta pengumpulan tugas dan penilaian mentor/kadiv.
   - Cara menjalankan seed aktivitas:
     ```bash
     psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed_activity.sql
     ```

3. **Pipeline Deployment Server (Selesai):**
   - Tersedia script deployment mandiri `deploy.sh` di root repository.
   - Otomatis memverifikasi build frontend (`npx tsc --noEmit` dan `npx vite build`), memeriksa integritas direktori `dist/`, mengemas bundle tarball, mentransfer ke server LAN via SSH, dan me-reload service Caddy.
   - Mendukung mode dry-run untuk pengujian build lokal tanpa menyentuh server remote.
   - Cara penggunaan script deploy:
     ```bash
     # Validasi lokal tanpa transfer server (dry-run)
     ./deploy.sh --dry-run

     # Deploy live ke server Caddy LAN (192.168.1.11)
     ./deploy.sh

     # Deploy dengan kustomisasi server atau user
     ./deploy.sh -s 192.168.1.11 -u rea -t /opt/web/sites/orens

     # Melihat bantuan dan opsi lengkap
     ./deploy.sh --help

4. **Aksi Audit `RESET_GRADES` Terdaftar (Selesai):**
   - Fitur Reset Nilai memanggil `logAudit('RESET_GRADES', ...)`, tetapi whitelist `log_audit_event` pada migrasi 0004 belum memuat aksi itu sehingga penulisan log audit gagal senyap ("Aksi audit tidak valid", tertulis hanya di console).
   - Migrasi `20261018000007_add_reset_grades_audit_action.sql` menambahkan aksi tersebut; terverifikasi via REST: panggilan RPC sukses dan barisnya muncul di `audit_logs`.

5. **Penjaga IDOR `verify_attendance_scan` (Selesai):**
   - Sebelum separuh jalan, siapa pun yang login bisa menitip presensi anggota lain hanya dengan parameter `p_member_id` (buktinya via REST: satu member dummy berhasil menandai Ketua "Terlambat" menggunakan satu token QR).
   - Migrasi `20261018000008_fix_verify_scan_idor.sql` melarang `p_member_id` selain diri sendiri, kecuali pemanggil petugas. Alur member sendiri, petugas, dan penolakan lintas anggota semuanya teruji ulang via REST.
     ```

