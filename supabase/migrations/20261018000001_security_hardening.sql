-- Migration 20261018000001: Comprehensive Security Hardening (VibeSec / OWASP Top 10)
-- Fixes critical access control, IDOR, sensitive data leakage, and injection vulnerabilities

-- ==============================================================================
-- 1. HARDEN RLS ON attendance_qr_tokens (VULN-01)
-- Only officers and division mentors/leads can SELECT or manage QR tokens
-- ==============================================================================
DROP POLICY IF EXISTS "Tokens viewable by officers and division leads" ON attendance_qr_tokens;
DROP POLICY IF EXISTS "Tokens manageable by officers and division leads" ON attendance_qr_tokens;

CREATE POLICY "Tokens viewable by officers and division leads"
ON attendance_qr_tokens FOR SELECT
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

CREATE POLICY "Tokens manageable by officers and division leads"
ON attendance_qr_tokens FOR ALL
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
)
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

-- ==============================================================================
-- 2. HARDEN RLS ON session_participants (VULN-06)
-- Only officers and division leads/mentors can manage session participants
-- ==============================================================================
DROP POLICY IF EXISTS "Participants manageable by officers and division leads" ON session_participants;

CREATE POLICY "Participants manageable by officers and division leads"
ON session_participants FOR ALL
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
)
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

-- ==============================================================================
-- 3. HARDEN RLS ON attendance_records INSERT (VULN-04)
-- Remove direct INSERT permission from students. Attendance must go through verify_attendance_scan RPC.
-- ==============================================================================
DROP POLICY IF EXISTS "Attendance records insertable by self scan or authorized officers" ON attendance_records;

CREATE POLICY "Attendance records insertable by authorized officers"
ON attendance_records FOR INSERT
TO authenticated
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

-- ==============================================================================
-- 4. HARDEN RLS ON audit_logs INSERT (VULN-11)
-- Prevent audit log tampering/poisoning. Direct INSERT only by top admin.
-- Normal audit logs are recorded via SECURITY DEFINER function log_audit_event().
-- ==============================================================================
DROP POLICY IF EXISTS "Audit logs insertable by system or authenticated users" ON audit_logs;

CREATE POLICY "Audit logs insertable only by top admin"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

-- ==============================================================================
-- 5. FIX RLS ON assignment_submissions INSERT (VULN-12)
-- Allow mentors and officers to insert placeholder submissions when grading unsubmitted students
-- ==============================================================================
DROP POLICY IF EXISTS "Submissions insertable by member for self" ON assignment_submissions;

CREATE POLICY "Submissions insertable by member for self or division mentors"
ON assignment_submissions FOR INSERT
TO authenticated
WITH CHECK (
    member_id = auth.uid()
    OR is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND assignment_id IN (
            SELECT id FROM assignments
            WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

-- ==============================================================================
-- 6. HARDEN verify_attendance_scan RPC (VULN-03 - Caller ID verification)
-- ==============================================================================
CREATE OR REPLACE FUNCTION verify_attendance_scan(
    p_token TEXT,
    p_member_id UUID,
    p_session_id UUID,
    p_method TEXT DEFAULT 'qr_scan'
)
RETURNS JSONB AS $$
DECLARE
    v_session attendance_sessions%ROWTYPE;
    v_token_valid BOOLEAN := FALSE;
    v_status TEXT;
    v_late_cutoff TIMESTAMPTZ;
    v_existing attendance_records%ROWTYPE;
    v_new_record attendance_records%ROWTYPE;
BEGIN
    -- VibeSec Check: Caller authentication & authorization
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Autentikasi diperlukan untuk mencatat kehadiran.');
    END IF;

    -- VibeSec Check: Prevent IDOR / "Titip Absen". Caller must be the member themself OR an authorized officer/mentor
    IF auth.uid() != p_member_id AND NOT (
        is_officer() OR (
            auth_user_role() IN ('Ketua Divisi', 'Mentor')
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Anda hanya dapat mencatatkan presensi untuk diri sendiri.');
    END IF;

    -- Fetch session details
    SELECT * INTO v_session
    FROM attendance_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesi absensi tidak ditemukan.');
    END IF;

    IF v_session.status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesi absensi telah ditutup atau belum dibuka.');
    END IF;

    -- Validate token or backup code
    IF p_method = 'qr_scan' THEN
        SELECT EXISTS (
            SELECT 1 FROM attendance_qr_tokens
            WHERE session_id = p_session_id
              AND token = p_token
              AND is_active = TRUE
              AND clock_timestamp() <= expires_at
        ) INTO v_token_valid;

        IF NOT v_token_valid THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Kode QR telah kedaluwarsa. Silakan pindai kode QR terbaru.'
            );
        END IF;
    ELSIF p_method = 'backup_code' THEN
        IF UPPER(TRIM(p_token)) != UPPER(TRIM(v_session.backup_code)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Kode sesi cadangan tidak valid.');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Metode verifikasi tidak didukung.');
    END IF;

    -- Verify member active status and division eligibility
    IF NOT EXISTS (
        SELECT 1 FROM members m
        JOIN users u ON u.id = m.id
        WHERE m.id = p_member_id AND m.status = 'active' AND u.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akun anggota tidak aktif atau sedang ditangguhkan.');
    END IF;

    IF v_session.division_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM member_divisions md
        WHERE md.member_id = p_member_id
          AND md.division_id = v_session.division_id
          AND md.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kamu tidak terdaftar sebagai peserta untuk sesi divisi ini.');
    END IF;

    -- Check if member already has an attendance record
    SELECT * INTO v_existing
    FROM attendance_records
    WHERE session_id = p_session_id AND member_id = p_member_id;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', v_existing.status,
            'message', 'Kamu sudah mengisi absensi untuk sesi ini (Status: ' || v_existing.status || ').'
        );
    END IF;

    -- Determine status based on current time and late threshold
    v_late_cutoff := (v_session.date + v_session.start_time) + (v_session.late_threshold_minutes || ' minutes')::INTERVAL;

    IF clock_timestamp() <= v_late_cutoff THEN
        v_status := 'Hadir';
    ELSE
        v_status := 'Terlambat';
    END IF;

    -- Insert attendance record (bypasses RLS safely via SECURITY DEFINER)
    INSERT INTO attendance_records (
        session_id,
        member_id,
        status,
        verification_method,
        scan_time,
        notes
    ) VALUES (
        p_session_id,
        p_member_id,
        v_status,
        p_method,
        clock_timestamp(),
        CASE
            WHEN v_status = 'Terlambat' THEN 'Scan setelah batas toleransi ' || v_session.late_threshold_minutes || ' menit'
            ELSE 'Presensi valid via ' || p_method
        END
    ) RETURNING * INTO v_new_record;

    -- Audit log event
    PERFORM log_audit_event(
        'ATTENDANCE_SCAN',
        'attendance_records',
        v_new_record.id::TEXT,
        NULL,
        to_jsonb(v_new_record),
        'Pencatatan kehadiran mandiri via ' || p_method || ' oleh ' || auth.uid()::TEXT
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', v_status,
        'message', 'Absensi berhasil! Kehadiran kamu sudah tercatat (' || v_status || ').'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. HARDEN generate_qr_token RPC (VULN-07 - Invalidation DoS prevention)
-- ==============================================================================
CREATE OR REPLACE FUNCTION generate_qr_token(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
    v_session attendance_sessions%ROWTYPE;
BEGIN
    -- VibeSec Check: Caller must be authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Autentikasi diperlukan untuk membuat token QR.';
    END IF;

    -- Fetch session details
    SELECT * INTO v_session
    FROM attendance_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi absensi tidak ditemukan.';
    END IF;

    -- VibeSec Check: Only officers or assigned division leads/mentors can generate QR tokens
    IF NOT (
        is_officer() OR (
            auth_user_role() IN ('Ketua Divisi', 'Mentor')
            AND (v_session.division_id IS NULL OR v_session.division_id IN (SELECT division_id FROM auth_user_division_ids()))
        )
    ) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya pengurus atau pembina sesi yang berhak membuat token QR.';
    END IF;

    IF v_session.status != 'open' THEN
        RAISE EXCEPTION 'Tidak dapat membuat token QR untuk sesi yang belum dibuka atau telah ditutup (Status: %)', v_session.status;
    END IF;

    -- Generate cryptographically secure token
    v_token := encode(gen_random_bytes(24), 'hex');
    v_expires_at := clock_timestamp() + interval '5 minutes';

    -- Deactivate previous active tokens for this session
    UPDATE attendance_qr_tokens
    SET is_active = FALSE
    WHERE session_id = p_session_id AND is_active = TRUE;

    -- Insert new token
    INSERT INTO attendance_qr_tokens (
        session_id,
        token,
        created_at,
        expires_at,
        is_active
    ) VALUES (
        p_session_id,
        v_token,
        clock_timestamp(),
        v_expires_at,
        TRUE
    );

    RETURN jsonb_build_object(
        'session_id', p_session_id,
        'token', v_token,
        'expires_at', v_expires_at,
        'is_active', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
