-- Migration 20261018000006: Realistic Activity Seed Data
-- Populates:
--   1. Dual-division enrollments (max 1 Wajib + 1 Opsional per member)
--   2. Attendance sessions (Wajib and Opsional, closed and open)
--   3. Attendance records (Hadir, Terlambat, Izin)
--   4. Learning materials across all 5 divisions (Beginner, Intermediate, Advanced)
--   5. Assignments with weights and due dates
--   6. Assignment submissions and mentor grades

DO $$
DECLARE
    -- Roles
    v_role_member UUID := '00000000-0000-0000-0000-000000000007';

    -- Divisions
    v_div_uiux UUID := 'a0000000-0000-0000-0000-000000000001';
    v_div_webdev UUID := 'a0000000-0000-0000-0000-000000000002';
    v_div_gamedev UUID := 'a0000000-0000-0000-0000-000000000003';
    v_div_esport UUID := 'a0000000-0000-0000-0000-000000000004';
    v_div_cybersec UUID := 'a0000000-0000-0000-0000-000000000005';

    -- Officers / Mentors
    v_user_pembina UUID := '11111111-1111-1111-1111-111111111111';
    v_user_ketua UUID := '22222222-2222-2222-2222-222222222222';
    v_user_kadiv_gd UUID := '55555555-0003-0000-0000-000000000001';
    v_user_mentor_gd UUID := '66666666-0003-0000-0000-000000000001';
    v_user_kadiv_ux UUID := '55555555-0001-0000-0000-000000000001';
    v_user_kadiv_wd UUID := '66666666-0002-0000-0000-000000000001';
    v_user_mentor_wd UUID := '55555555-0002-0000-0000-000000000001';
    v_user_kadiv_cs UUID := '55555555-0005-0000-0000-000000000001';
    v_user_mentor_cs UUID := '66666666-0005-0000-0000-000000000001';

    -- Students
    v_stu_gd01 UUID := 'c2000000-0000-0000-0000-000000000001'; -- DUM Gamedev 01
    v_stu_wd01 UUID := 'c2000000-0000-0000-0000-000000000002'; -- DUM Webdev 01
    v_stu_ux01 UUID := 'c2000000-0000-0000-0000-000000000003'; -- DUM UIUX 01
    v_stu_cs01 UUID := 'c2000000-0000-0000-0000-000000000004'; -- DUM Cybersec 01
    v_stu_es01 UUID := 'c2000000-0000-0000-0000-000000000005'; -- DUM Esport 01

    v_stu_gd_brandon UUID := 'c1000000-0000-0000-0000-000000000001';
    v_stu_gd_ernest UUID := 'c1000000-0000-0000-0000-000000000002';
    v_stu_gd_devanda UUID := 'c1000000-0000-0000-0000-000000000003';
    v_stu_gd_fadel UUID := 'c1000000-0000-0000-0000-000000000004';
    v_stu_gd_fattan UUID := 'c1000000-0000-0000-0000-000000000005';
    v_stu_gd_gilbert UUID := 'c1000000-0000-0000-0000-000000000006';
    v_stu_gd_irvan UUID := 'c1000000-0000-0000-0000-000000000007';
    v_stu_gd_izzan UUID := 'c1000000-0000-0000-0000-000000000008';
    v_stu_gd_jenaro UUID := 'c1000000-0000-0000-0000-000000000009';
    v_stu_gd_joshua UUID := 'c1000000-0000-0000-0000-000000000010';

    -- Session IDs
    v_sess_gd_wajib UUID := 'd1000000-0000-0000-0000-000000000001';
    v_sess_ux_wajib UUID := 'd1000000-0000-0000-0000-000000000002';
    v_sess_wd_wajib UUID := 'd1000000-0000-0000-0000-000000000003';
    v_sess_cs_wajib UUID := 'd1000000-0000-0000-0000-000000000004';
    v_sess_es_opsional UUID := 'd1000000-0000-0000-0000-000000000005';
    v_sess_gen_open UUID := 'd1000000-0000-0000-0000-000000000006';

    -- Assignment IDs
    v_asg_gd UUID := 'e1000000-0000-0000-0000-000000000001';
    v_asg_ux UUID := 'e1000000-0000-0000-0000-000000000002';
    v_asg_wd UUID := 'e1000000-0000-0000-0000-000000000003';
    v_asg_cs UUID := 'e1000000-0000-0000-0000-000000000004';
    v_asg_es UUID := 'e1000000-0000-0000-0000-000000000005';

    -- Submission IDs
    v_sub_gd_01 UUID := 'f1000000-0000-0000-0000-000000000001';
    v_sub_gd_ernest UUID := 'f1000000-0000-0000-0000-000000000002';
    v_sub_gd_fadel UUID := 'f1000000-0000-0000-0000-000000000003';
    v_sub_gd_gilbert UUID := 'f1000000-0000-0000-0000-000000000004';
    v_sub_gd_izzan UUID := 'f1000000-0000-0000-0000-000000000005';
    v_sub_gd_joshua UUID := 'f1000000-0000-0000-0000-000000000006';
    v_sub_ux_01 UUID := 'f1000000-0000-0000-0000-000000000007';
    v_sub_wd_01 UUID := 'f1000000-0000-0000-0000-000000000008';
    v_sub_cs_01 UUID := 'f1000000-0000-0000-0000-000000000009';
    v_sub_es_01 UUID := 'f1000000-0000-0000-0000-000000000010';

BEGIN
    -- =========================================================================
    -- 1. Dual-Division Enrollments (Wajib + Opsional)
    -- =========================================================================
    INSERT INTO member_divisions (member_id, division_id, classification, is_active)
    SELECT m.member_id, m.division_id, m.classification, m.is_active
    FROM (
        VALUES
            (v_stu_gd_ernest, v_div_uiux, 'Opsional'::text, TRUE),
            (v_stu_gd_fadel, v_div_webdev, 'Opsional'::text, TRUE),
            (v_stu_gd_gilbert, v_div_cybersec, 'Opsional'::text, TRUE),
            (v_stu_gd_izzan, v_div_esport, 'Opsional'::text, TRUE),
            (v_stu_gd_joshua, v_div_uiux, 'Opsional'::text, TRUE),
            (v_stu_wd01, v_div_esport, 'Opsional'::text, TRUE),
            (v_stu_ux01, v_div_webdev, 'Opsional'::text, TRUE),
            (v_stu_cs01, v_div_gamedev, 'Opsional'::text, TRUE),
            (v_stu_es01, v_div_cybersec, 'Opsional'::text, TRUE)
    ) AS m(member_id, division_id, classification, is_active)
    WHERE NOT EXISTS (
        SELECT 1 FROM member_divisions md
        WHERE md.member_id = m.member_id
          AND md.division_id = m.division_id
          AND md.is_active = TRUE
    );

    -- =========================================================================
    -- 2. Attendance Sessions (Wajib & Opsional, Closed & Open)
    -- =========================================================================
    -- Clean up scratch sessions from previous manual runs, keeping documented baseline session 'ad'
    DELETE FROM attendance_sessions WHERE id::text NOT LIKE 'd1000000%' AND id != '2d80b0e8-e7bf-4ae1-91d5-12b426cb7203';

    -- Session 1: Game Dev (Wajib, Closed, 5 days ago)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at, closed_at
    ) VALUES (
        v_sess_gd_wajib,
        'Pengenalan Game Engine Unity & Siklus Game Loop',
        v_div_gamedev, 'Wajib', CURRENT_DATE - INTERVAL '5 days',
        '15:30:00', '17:30:00', 15, 'closed', 'GD01WK', v_user_kadiv_gd,
        (CURRENT_DATE - INTERVAL '5 days' + TIME '15:30:00')::TIMESTAMPTZ,
        (CURRENT_DATE - INTERVAL '5 days' + TIME '17:30:00')::TIMESTAMPTZ
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- Session 2: UI/UX (Wajib, Closed, 4 days ago)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at, closed_at
    ) VALUES (
        v_sess_ux_wajib,
        'Workshop Auto-Layout & Design Tokens Figma',
        v_div_uiux, 'Wajib', CURRENT_DATE - INTERVAL '4 days',
        '15:30:00', '17:30:00', 15, 'closed', 'UX02TK', v_user_kadiv_ux,
        (CURRENT_DATE - INTERVAL '4 days' + TIME '15:30:00')::TIMESTAMPTZ,
        (CURRENT_DATE - INTERVAL '4 days' + TIME '17:30:00')::TIMESTAMPTZ
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- Session 3: Web Development (Wajib, Closed, 3 days ago)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at, closed_at
    ) VALUES (
        v_sess_wd_wajib,
        'Komponen Reaktif & State Management React 18',
        v_div_webdev, 'Wajib', CURRENT_DATE - INTERVAL '3 days',
        '15:30:00', '17:30:00', 15, 'closed', 'WD03RC', v_user_mentor_wd,
        (CURRENT_DATE - INTERVAL '3 days' + TIME '15:30:00')::TIMESTAMPTZ,
        (CURRENT_DATE - INTERVAL '3 days' + TIME '17:30:00')::TIMESTAMPTZ
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- Session 4: Cybersecurity (Wajib, Closed, 2 days ago)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at, closed_at
    ) VALUES (
        v_sess_cs_wajib,
        'Praktik Scanning Nmap & Analisis Port Jaringan',
        v_div_cybersec, 'Wajib', CURRENT_DATE - INTERVAL '2 days',
        '15:30:00', '17:30:00', 15, 'closed', 'CS04NM', v_user_kadiv_cs,
        (CURRENT_DATE - INTERVAL '2 days' + TIME '15:30:00')::TIMESTAMPTZ,
        (CURRENT_DATE - INTERVAL '2 days' + TIME '17:30:00')::TIMESTAMPTZ
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- Session 5: Esport (Opsional, Closed, yesterday)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at, closed_at
    ) VALUES (
        v_sess_es_opsional,
        'Analisis Makro Gameplay & Rotasi Tim Scrim',
        v_div_esport, 'Opsional', CURRENT_DATE - INTERVAL '1 day',
        '16:00:00', '18:00:00', 15, 'closed', 'ES05SC', v_user_ketua,
        (CURRENT_DATE - INTERVAL '1 day' + TIME '16:00:00')::TIMESTAMPTZ,
        (CURRENT_DATE - INTERVAL '1 day' + TIME '18:00:00')::TIMESTAMPTZ
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- Session 6: General All Divisions (Wajib, Open, TODAY)
    INSERT INTO attendance_sessions (
        id, title, division_id, session_type, date, start_time, end_time,
        late_threshold_minutes, status, backup_code, created_by, opened_at
    ) VALUES (
        v_sess_gen_open,
        'Evaluasi Proyek Tengah Semester & Showcase Karya',
        NULL, 'Wajib', CURRENT_DATE,
        '13:00:00', '17:00:00', 20, 'open', 'ALL06E', v_user_pembina,
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, session_type = EXCLUDED.session_type, status = EXCLUDED.status;

    -- =========================================================================
    -- 3. Attendance Records (Hadir, Terlambat, Izin across past 5 days & today)
    -- =========================================================================
    -- Session 1 (Game Dev - 5 days ago)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_gd_wajib, v_stu_gd01, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:34:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_ernest, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:37:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_fadel, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:39:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_gilbert, 'Terlambat', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:48:00')::TIMESTAMPTZ, 'backup_code', 'Scan via kode cadangan melebihi toleransi', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_izzan, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:35:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_joshua, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:40:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_gd_brandon, 'Izin', (CURRENT_DATE - INTERVAL '5 days' + TIME '14:00:00')::TIMESTAMPTZ, 'leave_approval', 'Dispensasi persiapan lomba LKS', v_user_kadiv_gd),
        (v_sess_gd_wajib, v_stu_cs01, 'Hadir', (CURRENT_DATE - INTERVAL '5 days' + TIME '15:42:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_kadiv_gd)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- Session 2 (UI/UX - 4 days ago)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_ux_wajib, v_stu_ux01, 'Hadir', (CURRENT_DATE - INTERVAL '4 days' + TIME '15:32:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_ux),
        (v_sess_ux_wajib, v_stu_gd_ernest, 'Hadir', (CURRENT_DATE - INTERVAL '4 days' + TIME '15:35:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_kadiv_ux),
        (v_sess_ux_wajib, v_stu_gd_joshua, 'Terlambat', (CURRENT_DATE - INTERVAL '4 days' + TIME '15:50:00')::TIMESTAMPTZ, 'backup_code', 'Input kode cadangan', v_user_kadiv_ux)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- Session 3 (Web Dev - 3 days ago)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_wd_wajib, v_stu_wd01, 'Hadir', (CURRENT_DATE - INTERVAL '3 days' + TIME '15:33:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_mentor_wd),
        (v_sess_wd_wajib, v_stu_gd_fadel, 'Hadir', (CURRENT_DATE - INTERVAL '3 days' + TIME '15:36:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_mentor_wd),
        (v_sess_wd_wajib, v_stu_ux01, 'Izin', (CURRENT_DATE - INTERVAL '3 days' + TIME '13:00:00')::TIMESTAMPTZ, 'leave_approval', 'Surat izin sakit terlampir', v_user_mentor_wd)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- Session 4 (Cybersec - 2 days ago)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_cs_wajib, v_stu_cs01, 'Hadir', (CURRENT_DATE - INTERVAL '2 days' + TIME '15:31:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_kadiv_cs),
        (v_sess_cs_wajib, v_stu_gd_gilbert, 'Hadir', (CURRENT_DATE - INTERVAL '2 days' + TIME '15:38:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_kadiv_cs),
        (v_sess_cs_wajib, v_stu_es01, 'Terlambat', (CURRENT_DATE - INTERVAL '2 days' + TIME '15:52:00')::TIMESTAMPTZ, 'backup_code', 'Input manual via kode', v_user_kadiv_cs)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- Session 5 (Esport - yesterday)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_es_opsional, v_stu_es01, 'Hadir', (CURRENT_DATE - INTERVAL '1 day' + TIME '16:05:00')::TIMESTAMPTZ, 'qr_scan', 'Scan tepat waktu', v_user_ketua),
        (v_sess_es_opsional, v_stu_gd_izzan, 'Hadir', (CURRENT_DATE - INTERVAL '1 day' + TIME '16:08:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_ketua),
        (v_sess_es_opsional, v_stu_wd01, 'Hadir', (CURRENT_DATE - INTERVAL '1 day' + TIME '16:11:00')::TIMESTAMPTZ, 'qr_scan', 'Presensi divisi opsional', v_user_ketua)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- Session 6 (General - today)
    INSERT INTO attendance_records (session_id, member_id, status, scan_time, verification_method, notes, created_by)
    VALUES
        (v_sess_gen_open, v_stu_gd01, 'Hadir', NOW() - INTERVAL '25 minutes', 'qr_scan', 'Scan QR sesi aktif', v_user_pembina),
        (v_sess_gen_open, v_stu_wd01, 'Hadir', NOW() - INTERVAL '18 minutes', 'qr_scan', 'Scan QR sesi aktif', v_user_pembina),
        (v_sess_gen_open, v_stu_ux01, 'Hadir', NOW() - INTERVAL '10 minutes', 'qr_scan', 'Scan QR sesi aktif', v_user_pembina)
    ON CONFLICT (member_id, session_id) DO UPDATE SET status = EXCLUDED.status, scan_time = EXCLUDED.scan_time;

    -- =========================================================================
    -- 4. Learning Materials per Division (Beginner, Intermediate, Advanced)
    -- =========================================================================
    INSERT INTO learning_materials (
        division_id, title, description, category, learning_level, external_link, status, creator_id, published_at
    )
    SELECT m.division_id, m.title, m.description, m.category, m.learning_level, m.external_link, m.status, m.creator_id, m.published_at
    FROM (
        VALUES
            -- Game Development (3 levels)
            (v_div_gamedev, 'Dasar Arsitektur Game Engine & Game Loop C#', 'Memahami lifecycle Update, FixedUpdate, LateUpdate, serta penanganan input pada Unity.', 'Architecture', 'Beginner', 'https://docs.unity3d.com/Manual/ExecutionOrder.html', 'published', v_user_kadiv_gd, NOW() - INTERVAL '20 days'),
            (v_div_gamedev, 'Fisika Rigidbody 2D/3D & NavMesh Pathfinding', 'Simulasi dinamika gravitasi, collision matrix layer, dan kalkulasi jalur otomatis AI.', 'Gameplay', 'Intermediate', 'https://learn.unity.com/tutorial/physics-best-practices', 'published', v_user_mentor_gd, NOW() - INTERVAL '12 days'),
            (v_div_gamedev, 'Optimasi Profiler, Draw Calls & Shaders HLSL', 'Teknik profiling memori, GPU instancing, occlusion culling, dan shader kustom.', 'Graphics', 'Advanced', 'https://catlikecoding.com/unity/tutorials/custom-srp/', 'published', v_user_kadiv_gd, NOW() - INTERVAL '4 days'),
            -- UI/UX (3 levels)
            (v_div_uiux, 'Heuristik Desain Antarmuka & Wireframing Low-Fi', '10 prinsip evaluasi heuristik Nielsen, anatomi layout, dan rapid prototyping sketsa.', 'Foundations', 'Beginner', 'https://www.nngroup.com/articles/ten-usability-heuristics/', 'published', v_user_kadiv_ux, NOW() - INTERVAL '18 days'),
            (v_div_uiux, 'Design System, Variabel & Auto-Layout Figma', 'Membangun token warna terstruktur, typography scale, dan komponen interaktif dinamis.', 'Design System', 'Intermediate', 'https://help.figma.com/hc/en-us/articles/360040451373', 'published', v_user_kadiv_ux, NOW() - INTERVAL '10 days'),
            (v_div_uiux, 'Usability Testing & Audit Aksesibilitas WCAG 2.1', 'Metode pengujian pengguna nyata, kalkulasi skor SUS, dan validasi rasio kontras warna.', 'Research', 'Advanced', 'https://www.w3.org/WAI/WCAG21/quickref/', 'published', v_user_kadiv_ux, NOW() - INTERVAL '3 days'),
            -- Web Development (3 levels)
            (v_div_webdev, 'Modern JavaScript (ES6+), DOM & Async Fetch', 'Struktur Promise, Async/Await, Destructuring, dan integrasi API RESTful modern.', 'Frontend', 'Beginner', 'https://javascript.info/', 'published', v_user_mentor_wd, NOW() - INTERVAL '19 days'),
            (v_div_webdev, 'Komponen Modular React 18, Hooks & Tailwind', 'Desain komponen fungsional, custom hooks, atomic state, dan utility-first styling.', 'Frontend', 'Intermediate', 'https://react.dev/learn', 'published', v_user_kadiv_wd, NOW() - INTERVAL '11 days'),
            (v_div_webdev, 'PostgREST Architecture, RLS Policy & SSR', 'Desain API berbasis relasi PostgreSQL, Row Level Security, dan caching edge network.', 'Architecture', 'Advanced', 'https://postgrest.org/en/stable/', 'published', v_user_mentor_wd, NOW() - INTERVAL '2 days'),
            -- Cybersecurity (3 levels)
            (v_div_cybersec, 'Konsep Dasar Jaringan, Model OSI & TCP 3-Way Handshake', 'Fondasi protokol transmisi data, IP addressing, DNS lookups, dan analisis paket awal.', 'Networking', 'Beginner', 'https://www.wireshark.org/docs/', 'published', v_user_kadiv_cs, NOW() - INTERVAL '17 days'),
            (v_div_cybersec, 'Audit Kerentanan OWASP Top 10 & Lab Injeksi SQL', 'Identifikasi celah broken access control, XSS, CSRF, dan mitigasi prepared statement.', 'AppSec', 'Intermediate', 'https://owasp.org/www-project-top-ten/', 'published', v_user_mentor_cs, NOW() - INTERVAL '9 days'),
            (v_div_cybersec, 'Network Packet Forensics & Log Correlation SIEM', 'Investigasi insiden keamanan siber, analisis payload malware, dan mitigasi ancaman.', 'Forensics', 'Advanced', 'https://attack.mitre.org/', 'published', v_user_kadiv_cs, NOW() - INTERVAL '1 day'),
            -- Esport (3 levels)
            (v_div_esport, 'Fundamental Komunikasi Mikro & Makro Gameplay', 'Manajemen tempo pertandingan, call-out ringkas, dan penguasaan vision map.', 'Strategy', 'Beginner', 'https://esports.gg/', 'published', v_user_ketua, NOW() - INTERVAL '16 days'),
            (v_div_esport, 'Analisis VOD Scrim, Draft Pick & Objective Control', 'Evaluasi komposisi hero sinergis, timing contested lord/turtle, dan re-clearing lane.', 'Tactics', 'Intermediate', 'https://liquipedia.net/', 'published', v_user_ketua, NOW() - INTERVAL '8 days'),
            (v_div_esport, 'Manajemen Mental Atlet, Ergonomi & Statistik Turnamen', 'Kesiapan psikologis tanding, penanganan burnout, dan analisis data metrik kill/death/assist.', 'Performance', 'Advanced', 'https://www.gamersedge.org/', 'published', v_user_ketua, NOW() - INTERVAL '2 days')
    ) AS m(division_id, title, description, category, learning_level, external_link, status, creator_id, published_at)
    WHERE NOT EXISTS (
        SELECT 1 FROM learning_materials lm
        WHERE lm.division_id = m.division_id
          AND lm.title = m.title
    );

    -- =========================================================================
    -- 5. Assignments with Weights & Due Dates
    -- =========================================================================
    INSERT INTO assignments (
        id, division_id, title, description, weight, max_score, target_participants, due_date, status, creator_id
    ) VALUES
        (v_asg_gd, v_div_gamedev, 'Proyek Mini: Game Platformer 2D dengan Skor & Game Over', 'Buat satu level platformer 2D dengan minimal 3 rintangan, mekanik double jump, sistem koin, dan transisi layar game over.', 1.50, 100.00, 'all', NOW() + INTERVAL '7 days', 'published', v_user_kadiv_gd),
        (v_asg_ux, v_div_uiux, 'Redesign Halaman Profil Sekolah SMK Prestasi Prima', 'Susun prototipe interaktif high-fidelity di Figma lengkap dengan komponen terstandar dan pengujian aksesibilitas WCAG.', 1.00, 100.00, 'all', NOW() + INTERVAL '7 days', 'published', v_user_kadiv_ux),
        (v_asg_wd, v_div_webdev, 'Aplikasi To-Do List Interaktif dengan React & Validasi', 'Kembangkan antarmuka tugas harian dengan React 18, Tailwind CSS, filter status, dan penyimpanan state persist.', 1.00, 100.00, 'all', NOW() + INTERVAL '7 days', 'published', v_user_mentor_wd),
        (v_asg_cs, v_div_cybersec, 'Laporan Investigasi Analisis Traffic Wireshark', 'Lakukan capture paket pada skenario simulated attack, analisis indikator compromise (IoC), dan tuliskan laporan mitigasi.', 1.50, 100.00, 'all', NOW() + INTERVAL '7 days', 'published', v_user_kadiv_cs),
        (v_asg_es, v_div_esport, 'Breakdown Video Pertandingan Scrim & Solusi Taktis', 'Tonton rekaman scrim tim, catat 3 kesalahan rotasi utama, dan berikan solusi draft alternatif untuk counter musuh.', 1.00, 100.00, 'all', NOW() + INTERVAL '7 days', 'published', v_user_ketua)
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, weight = EXCLUDED.weight, max_score = EXCLUDED.max_score, due_date = EXCLUDED.due_date;

    -- =========================================================================
    -- 6. Assignment Submissions & Mentor Grades
    -- =========================================================================
    -- Submissions
    INSERT INTO assignment_submissions (
        id, assignment_id, member_id, submission_text, file_url, submitted_at, status
    ) VALUES
        (v_sub_gd_01, v_asg_gd, v_stu_gd01, 'Repository GitHub: https://github.com/orens-gd/platformer-dum01. Telah mengimplementasikan sistem skor dan kamera cinemachine.', 'https://github.com/orens-gd/platformer-dum01', NOW() - INTERVAL '2 days', 'submitted'),
        (v_sub_gd_ernest, v_asg_gd, v_stu_gd_ernest, 'Proyek unitypackage selesai diunggah di drive. Sistem fisika platformer menggunakan custom raycast controller.', 'https://drive.google.com/open?id=demo_gd_ernest', NOW() - INTERVAL '2 days', 'submitted'),
        (v_sub_gd_fadel, v_asg_gd, v_stu_gd_fadel, 'Level platformer 2D dengan tema sci-fi pixel art. Sudah dilengkapi enemy patrol AI sederhana.', 'https://github.com/orens-gd/platformer-fadel', NOW() - INTERVAL '1 day', 'submitted'),
        (v_sub_gd_gilbert, v_asg_gd, v_stu_gd_gilbert, 'Game platformer mekanik gravitasi terbalik. Menggunakan ScriptableObject untuk manajemen save state.', 'https://github.com/orens-gd/platformer-gilbert', NOW() - INTERVAL '1 day', 'submitted'),
        (v_sub_gd_izzan, v_asg_gd, v_stu_gd_izzan, 'Build WebGL siap dijalankan di browser. Dilengkapi efek suara SFX dan musik latar berulang.', 'https://orens-gd.itch.io/platformer-izzan', NOW() - INTERVAL '12 hours', 'submitted'),
        (v_sub_gd_joshua, v_asg_gd, v_stu_gd_joshua, 'Prototipe game platformer 2D dengan sistem leaderboard lokal dan partikel efek debu saat melompat.', 'https://github.com/orens-gd/platformer-joshua', NOW() - INTERVAL '6 hours', 'submitted'),
        (v_sub_ux_01, v_asg_ux, v_stu_ux01, 'Link File Figma Prototype: https://figma.com/@orens/profile-smkpp. Skor kontras rasio warna rata-rata 6.2:1 (Lolos AAA).', 'https://figma.com/@orens/profile-smkpp', NOW() - INTERVAL '2 days', 'submitted'),
        (v_sub_wd_01, v_asg_wd, v_stu_wd01, 'Deploy Vercel: https://orens-todo-app.vercel.app. Menggunakan React Hooks + Context API + Tailwind CSS.', 'https://orens-todo-app.vercel.app', NOW() - INTERVAL '1 day', 'submitted'),
        (v_sub_cs_01, v_asg_cs, v_stu_cs01, 'Dokumen PDF laporan analisis paket Wireshark: Analisis serangan SYN Flood dan Port Scanning.', 'https://storage.orens.org/cs-reports/cs01-wireshark.pdf', NOW() - INTERVAL '2 days', 'submitted'),
        (v_sub_es_01, v_asg_es, v_stu_es01, 'Dokumen analisis evaluasi scrim: Breakdown rotasi early game dan positioning marksman.', 'https://storage.orens.org/es-reports/es01-scrim.pdf', NOW() - INTERVAL '1 day', 'submitted')
    ON CONFLICT (assignment_id, member_id) DO UPDATE SET
        submission_text = EXCLUDED.submission_text, file_url = EXCLUDED.file_url, status = EXCLUDED.status;

    -- Grades by Mentor / Kadiv
    INSERT INTO assignment_grades (
        submission_id, grader_id, raw_score, normalized_score, feedback, status, graded_at
    ) VALUES
        (v_sub_gd_01, v_user_kadiv_gd, 88.00, 88.00, 'Implementasi movement controller dan game over loop sangat baik. Perhatikan optimasi layer collision.', 'published', NOW() - INTERVAL '1 day'),
        (v_sub_gd_ernest, v_user_mentor_gd, 92.00, 92.00, 'Raycast controller bekerja sangat mulus tanpa glitch snapping. Struktur script C# modular dan mudah dibaca.', 'published', NOW() - INTERVAL '1 day'),
        (v_sub_gd_fadel, v_user_kadiv_gd, 86.00, 86.00, 'Patrol AI berjalan konsisten. Saran untuk menambahkan variasi pola serangan pada musuh kedua.', 'published', NOW() - INTERVAL '18 hours'),
        (v_sub_gd_gilbert, v_user_mentor_gd, 95.00, 95.00, 'Ide mekanik inversi gravitasi sangat inovatif. Pemanfaatan ScriptableObject tepat guna dan rapi.', 'published', NOW() - INTERVAL '16 hours'),
        (v_sub_gd_izzan, v_user_kadiv_gd, 90.00, 90.00, 'Build WebGL berjalan mulus pada 60 FPS. SFX dan timing animasi lompatan sangat responsif.', 'published', NOW() - INTERVAL '8 hours'),
        (v_sub_gd_joshua, v_user_mentor_gd, 87.00, 87.00, 'Leaderboard lokal berfungsi sempurna. Partikel efek menambah kedalaman visual permainan.', 'published', NOW() - INTERVAL '4 hours'),
        (v_sub_ux_01, v_user_kadiv_ux, 94.00, 94.00, 'Hierarki tipografi dan sistem token warna sangat matang. Dokumentasi komponen di Figma lengkap.', 'published', NOW() - INTERVAL '1 day'),
        (v_sub_wd_01, v_user_mentor_wd, 90.00, 90.00, 'Pemisahan modul komponen bersih dan clean code. Penanganan local storage aman dari parsing error.', 'published', NOW() - INTERVAL '18 hours'),
        (v_sub_cs_01, v_user_kadiv_cs, 91.00, 91.00, 'Laporan investigasi sangat rinci dengan tangkapan layar paket dan langkah mitigasi firewall konkrit.', 'published', NOW() - INTERVAL '1 day'),
        (v_sub_es_01, v_user_ketua, 89.00, 89.00, 'Identifikasi kesalahan rotasi menit ke-4 dan ke-9 sangat tepat. Solusi draft counter masuk akal.', 'published', NOW() - INTERVAL '12 hours')
    ON CONFLICT (submission_id) DO UPDATE SET
        raw_score = EXCLUDED.raw_score, normalized_score = EXCLUDED.normalized_score,
        feedback = EXCLUDED.feedback, status = EXCLUDED.status, graded_at = EXCLUDED.graded_at;

END $$;
