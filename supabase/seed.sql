-- Seed data for Orens Solution Management System
-- Seeds 7 system roles, granular permissions, 5 divisions, 7 demo accounts, grading policy, and system settings.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Insert 7 System Roles
INSERT INTO roles (id, name, display_name, description, hierarchy_level) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Pembina', 'Pembina Organisasi', 'Otoritas tertinggi pembina dengan akses komprehensif seluruh modul', 1),
    ('00000000-0000-0000-0000-000000000002', 'Ketua', 'Ketua Umum', 'Otoritas tertinggi ketua dengan hak akses setara penuh dengan Pembina', 1),
    ('00000000-0000-0000-0000-000000000003', 'Wakil Ketua', 'Wakil Ketua', 'Pimpinan operasional harian organisasi dan monitoring presensi', 2),
    ('00000000-0000-0000-0000-000000000004', 'Sekretaris', 'Sekretaris', 'Pengelola administrasi, jadwal, izin/sakit, dan rekapitulasi data', 3),
    ('00000000-0000-0000-0000-000000000005', 'Ketua Divisi', 'Ketua Divisi', 'Pimpinan divisi teknis dengan wewenang terbatas pada divisi yang dipimpin', 4),
    ('00000000-0000-0000-0000-000000000006', 'Mentor', 'Mentor Divisi', 'Pengajar divisi yang mengelola materi, tugas, dan penilaian anggota bimbingan', 5),
    ('00000000-0000-0000-0000-000000000007', 'Member', 'Anggota', 'Anggota organisasi dengan hak akses data personal dan materi divisi terdaftar', 6)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level;

-- 2. Insert Permissions
INSERT INTO permissions (code, module, description) VALUES
    ('users:read_all', 'users', 'Melihat profil dan status akun semua pengguna'),
    ('users:manage', 'users', 'Membuat, mengedit, dan menonaktifkan akun pengguna'),
    ('roles:manage', 'rbac', 'Mengelola penetapan role dan permission pengguna'),
    ('divisions:manage', 'divisions', 'Mengelola struktur divisi dan penetapan ketua divisi'),
    ('divisions:read', 'divisions', 'Melihat data divisi dan daftar anggota divisi'),
    ('activities:manage', 'activities', 'Membuat, memperbarui, dan membatalkan jadwal kegiatan'),
    ('activities:read', 'activities', 'Melihat kalender dan agenda kegiatan organisasi'),
    ('attendance:create_session', 'attendance', 'Membuat dan membuka sesi presensi'),
    ('attendance:close_session', 'attendance', 'Menutup sesi presensi yang sedang berlangsung'),
    ('attendance:scan', 'attendance', 'Melakukan pemindaian QR code atau input kode sesi'),
    ('attendance:correct', 'attendance', 'Koreksi manual catatan presensi dengan alasan wajib'),
    ('attendance:read_all', 'attendance', 'Melihat seluruh rekapitulasi presensi organisasi'),
    ('attendance:read_division', 'attendance', 'Melihat rekap presensi dalam divisi sendiri'),
    ('attendance:read_own', 'attendance', 'Melihat riwayat presensi personal'),
    ('leave:submit', 'leave', 'Mengajukan surat izin atau sakit'),
    ('leave:review', 'leave', 'Menyetujui atau menolak permohonan izin/sakit anggota'),
    ('materials:manage_all', 'materials', 'Mengelola materi pembelajaran seluruh divisi'),
    ('materials:manage_division', 'materials', 'Mengelola materi pembelajaran divisi sendiri'),
    ('materials:read_division', 'materials', 'Mengunduh dan membaca materi divisi terdaftar'),
    ('assignments:manage_all', 'assignments', 'Mengelola tugas dan proyek seluruh divisi'),
    ('assignments:manage_division', 'assignments', 'Mengelola tugas dalam divisi sendiri'),
    ('assignments:submit', 'assignments', 'Mengumpulkan pengerjaan tugas personal'),
    ('grades:manage_all', 'grades', 'Memberi nilai dan koreksi nilai seluruh divisi'),
    ('grades:manage_division', 'grades', 'Memberi nilai dan koreksi nilai divisi sendiri'),
    ('grades:read_all', 'grades', 'Melihat rekapitulasi nilai seluruh anggota'),
    ('grades:read_division', 'grades', 'Melihat nilai tugas anggota divisi sendiri'),
    ('grades:read_own', 'grades', 'Melihat nilai personal dan umpan balik mentor'),
    ('grading_policy:manage', 'grading', 'Mengatur formula dan bobot persentase penilaian'),
    ('announcements:manage', 'announcements', 'Membuat, mengedit, dan menghapus pengumuman'),
    ('announcements:read', 'announcements', 'Membaca pengumuman organisasi dan divisi'),
    ('audit:read', 'audit', 'Melihat log audit perubahan dan keamanan'),
    ('exports:all', 'exports', 'Mengekspor laporan CSV, Excel, dan PDF tingkat organisasi'),
    ('exports:division', 'exports', 'Mengekspor laporan presensi dan nilai divisi'),
    ('settings:manage', 'settings', 'Mengubah konfigurasi sistem dan preferensi organisasi')
ON CONFLICT (code) DO NOTHING;

-- 3. Assign Role Permissions
-- A. Pembina and Ketua have EXACT SAME permissions (zero discrepancies)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Pembina', 'Ketua')
  AND p.code IN (
    'users:read_all', 'users:manage', 'roles:manage', 'divisions:manage', 'divisions:read',
    'activities:manage', 'activities:read', 'attendance:create_session', 'attendance:close_session',
    'attendance:scan', 'attendance:correct', 'attendance:read_all', 'attendance:read_division',
    'attendance:read_own', 'leave:submit', 'leave:review', 'materials:manage_all',
    'materials:manage_division', 'materials:read_division', 'assignments:manage_all',
    'assignments:manage_division', 'grades:manage_all', 'grades:manage_division',
    'grades:read_all', 'grades:read_division', 'grades:read_own', 'grading_policy:manage',
    'announcements:manage', 'announcements:read', 'audit:read', 'exports:all',
    'exports:division', 'settings:manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- B. Wakil Ketua
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Wakil Ketua'
  AND p.code IN (
    'users:read_all', 'divisions:read', 'activities:manage', 'activities:read',
    'attendance:create_session', 'attendance:close_session', 'attendance:scan', 'attendance:correct',
    'attendance:read_all', 'attendance:read_division', 'attendance:read_own', 'leave:submit',
    'materials:manage_all', 'materials:manage_division', 'materials:read_division',
    'grades:read_all', 'grades:read_division', 'grades:read_own', 'announcements:manage',
    'announcements:read', 'exports:all', 'exports:division'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- C. Sekretaris
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sekretaris'
  AND p.code IN (
    'users:read_all', 'divisions:read', 'activities:manage', 'activities:read',
    'attendance:create_session', 'attendance:close_session', 'attendance:scan', 'attendance:correct',
    'attendance:read_all', 'attendance:read_division', 'attendance:read_own', 'leave:submit',
    'leave:review', 'materials:manage_all', 'materials:manage_division', 'materials:read_division',
    'grades:read_all', 'grades:read_division', 'grades:read_own', 'announcements:manage',
    'announcements:read', 'exports:all', 'exports:division'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- D. Ketua Divisi
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Ketua Divisi'
  AND p.code IN (
    'divisions:read', 'activities:read', 'attendance:create_session', 'attendance:close_session',
    'attendance:scan', 'attendance:correct', 'attendance:read_division', 'attendance:read_own',
    'leave:submit', 'materials:manage_division', 'materials:read_division',
    'assignments:manage_division', 'grades:manage_division', 'grades:read_division',
    'grades:read_own', 'announcements:manage', 'announcements:read', 'exports:division'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- E. Mentor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Mentor'
  AND p.code IN (
    'divisions:read', 'activities:read', 'attendance:scan', 'attendance:read_division',
    'attendance:read_own', 'leave:submit', 'materials:manage_division', 'materials:read_division',
    'assignments:manage_division', 'grades:manage_division', 'grades:read_division',
    'grades:read_own', 'announcements:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- F. Member
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Member'
  AND p.code IN (
    'divisions:read', 'activities:read', 'attendance:scan', 'attendance:read_own',
    'leave:submit', 'materials:read_division', 'assignments:submit', 'grades:read_own',
    'announcements:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Insert 5 Initial Divisions
INSERT INTO divisions (id, name, code, description, is_active) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'UI/UX', 'uiux', 'Desain antarmuka dan pengalaman pengguna modern', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'Web Development', 'webdev', 'Pengembangan aplikasi web modern full-stack', TRUE),
    ('a0000000-0000-0000-0000-000000000003', 'Game Development', 'gamedev', 'Perancangan dan pemrograman video game multiplatform', TRUE),
    ('a0000000-0000-0000-0000-000000000004', 'Esport', 'esport', 'Kompetisi taktis game elektronik dan manajemen tim esport', TRUE),
    ('a0000000-0000-0000-0000-000000000005', 'Cybersecurity', 'cybersec', 'Keamanan jaringan, forensik digital, dan ethical hacking', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- 5. Seed 7 Demo Role Accounts in auth.users and public.users
DO $$
DECLARE
    v_encrypted_pw TEXT;
    v_role_pembina UUID;
    v_role_ketua UUID;
    v_role_wakil UUID;
    v_role_sekretaris UUID;
    v_role_ketua_divisi UUID;
    v_role_mentor UUID;
    v_role_member UUID;
    v_div_uiux UUID := 'a0000000-0000-0000-0000-000000000001';
    v_div_webdev UUID := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    v_encrypted_pw := crypt('UjiOrensMVP2026!', gen_salt('bf'));

    SELECT id INTO v_role_pembina FROM roles WHERE name = 'Pembina';
    SELECT id INTO v_role_ketua FROM roles WHERE name = 'Ketua';
    SELECT id INTO v_role_wakil FROM roles WHERE name = 'Wakil Ketua';
    SELECT id INTO v_role_sekretaris FROM roles WHERE name = 'Sekretaris';
    SELECT id INTO v_role_ketua_divisi FROM roles WHERE name = 'Ketua Divisi';
    SELECT id INTO v_role_mentor FROM roles WHERE name = 'Mentor';
    SELECT id INTO v_role_member FROM roles WHERE name = 'Member';

    -- 1. Pembina
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'pembina@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Pembina Orens","role":"Pembina"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('11111111-1111-1111-1111-111111111111', 'pembina@orens.org', 'Pembina Orens', v_role_pembina, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'DOSEN-001', 'Pembina Orens', '081234567890', 'active', '2020-01-01')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    -- 2. Ketua
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ketua@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Ketua Umum","role":"Ketua"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('22222222-2222-2222-2222-222222222222', 'ketua@orens.org', 'Ketua Umum', v_role_ketua, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('22222222-2222-2222-2222-222222222222', '2024001001', 'Ketua Umum', '081234567891', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    -- 3. Wakil Ketua
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'wakil@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Rian Hidayat","role":"Wakil Ketua"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('33333333-3333-3333-3333-333333333333', 'wakil@orens.org', 'Rian Hidayat', v_role_wakil, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('33333333-3333-3333-3333-333333333333', '2024001002', 'Rian Hidayat', '081234567892', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    -- 4. Sekretaris
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'sekretaris@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Siti Nurhaliza","role":"Sekretaris"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('44444444-4444-4444-4444-444444444444', 'sekretaris@orens.org', 'Siti Nurhaliza', v_role_sekretaris, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('44444444-4444-4444-4444-444444444444', '2024001003', 'Siti Nurhaliza', '081234567893', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    -- 5. Ketua Divisi (UI/UX lead)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ketuadivisi@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Ahmad Zaki","role":"Ketua Divisi"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-5555-5555-5555-555555555555', 'ketuadivisi@orens.org', 'Ahmad Zaki', v_role_ketua_divisi, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('55555555-5555-5555-5555-555555555555', '2024001004', 'Ahmad Zaki', '081234567894', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    UPDATE divisions SET lead_id = '55555555-5555-5555-5555-555555555555' WHERE id = v_div_uiux;

    -- 6. Mentor (UI/UX)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'mentor@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Dewi Lestari","role":"Mentor"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-6666-6666-6666-666666666666', 'mentor@orens.org', 'Dewi Lestari', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('66666666-6666-6666-6666-666666666666', '2024001005', 'Dewi Lestari', '081234567895', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    INSERT INTO member_divisions (member_id, division_id, classification, effective_date, is_active)
    VALUES ('66666666-6666-6666-6666-666666666666', v_div_uiux, 'Wajib', '2024-01-15', TRUE)
    ON CONFLICT DO NOTHING;

    -- 7. Member (UI/UX Wajib, Web Development Opsional)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'member@orens.org', v_encrypted_pw, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Bayu Anggoro","role":"Member"}',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, email, full_name, role_id, is_active)
    VALUES ('77777777-7777-7777-7777-777777777777', 'member@orens.org', 'Bayu Anggoro', v_role_member, TRUE)
    ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;

    INSERT INTO members (id, nim, full_name, phone, status, join_date)
    VALUES ('77777777-7777-7777-7777-777777777777', '2024001006', 'Bayu Anggoro', '081234567896', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status;

    INSERT INTO member_divisions (member_id, division_id, classification, effective_date, is_active)
    VALUES
        ('77777777-7777-7777-7777-777777777777', v_div_uiux, 'Wajib', '2024-01-15', TRUE),
        ('77777777-7777-7777-7777-777777777777', v_div_webdev, 'Opsional', '2024-01-15', TRUE)
    ON CONFLICT DO NOTHING;

END $$;

-- 6. Insert Default Grading Policy
INSERT INTO grading_policies (
    period_name,
    attendance_weight,
    assignment_weight,
    late_penalty_enabled,
    late_penalty_percent,
    unsubmitted_is_zero,
    is_active,
    is_locked
) VALUES (
    'Periode 2026/2027 Ganjil',
    40.00,
    60.00,
    FALSE,
    0.00,
    FALSE,
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- 7. Insert System Settings
INSERT INTO system_settings (key, value, description) VALUES
    ('organization_name', '"Orens Solution"', 'Nama resmi organisasi ekstrakurikuler'),
    ('timezone', '"Asia/Jakarta"', 'Zona waktu operasional sistem (WIB / UTC+07:00)'),
    ('late_threshold_default', '15', 'Batas default keterlambatan presensi dalam satuan menit'),
    ('qr_rotation_seconds', '300', 'Interval rotasi token QR dinamis (5 menit = 300 detik)'),
    ('grading_weights_default', '{"attendance": 40.0, "assignments": 60.0}', 'Bobot default formula nilai akhir organisasi')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;
