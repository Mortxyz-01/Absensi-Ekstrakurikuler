-- Migration: Audit log immutability triggers, audit logging RPC, and domain verification functions

-- 1. Immutability trigger for audit_logs
CREATE OR REPLACE FUNCTION trg_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are strictly immutable. Modifications and deletions are forbidden by security policy.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION trg_prevent_audit_log_mutation();

-- Revoke UPDATE and DELETE privileges on audit_logs
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon, PUBLIC;

-- 2. Generic helper to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action TEXT,
    p_target_table TEXT,
    p_target_id TEXT,
    p_old_val JSONB DEFAULT NULL,
    p_new_val JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        actor_id,
        action,
        target_table,
        target_id,
        old_value,
        new_value,
        reason,
        created_at
    ) VALUES (
        auth.uid(),
        p_action,
        p_target_table,
        p_target_id,
        p_old_val,
        p_new_val,
        p_reason,
        NOW()
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attendance correction RPC requiring logged reason
CREATE OR REPLACE FUNCTION correct_attendance(
    p_record_id UUID,
    p_new_status TEXT,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_old_rec JSONB;
    v_new_rec JSONB;
    v_user_role TEXT;
BEGIN
    -- Validate mandatory reason
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid reason is required for manual attendance corrections';
    END IF;

    -- Validate status
    IF p_new_status NOT IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alfa', 'Belum Absen') THEN
        RAISE EXCEPTION 'Invalid attendance status: %', p_new_status;
    END IF;

    -- Authentication check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Role authorization check
    v_user_role := auth_user_role();
    IF NOT (is_top_admin() OR v_user_role IN ('Wakil Ketua', 'Sekretaris', 'Ketua Divisi')) THEN
        RAISE EXCEPTION 'Unauthorized to perform manual attendance correction';
    END IF;

    -- Division boundary enforcement for Ketua Divisi
    IF v_user_role = 'Ketua Divisi' THEN
        IF NOT EXISTS (
            SELECT 1 FROM attendance_records ar
            JOIN attendance_sessions s ON ar.session_id = s.id
            WHERE ar.id = p_record_id
              AND s.division_id IN (SELECT division_id FROM auth_user_division_ids())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: attendance record does not belong to your division';
        END IF;
    END IF;

    -- Capture old record
    SELECT to_jsonb(ar) INTO v_old_rec
    FROM attendance_records ar
    WHERE ar.id = p_record_id;

    IF v_old_rec IS NULL THEN
        RAISE EXCEPTION 'Attendance record not found';
    END IF;

    -- Update record
    UPDATE attendance_records
    SET status = p_new_status,
        verification_method = 'manual_correction',
        notes = p_reason,
        created_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_record_id
    RETURNING to_jsonb(attendance_records.*) INTO v_new_rec;

    -- Log audit event
    INSERT INTO audit_logs (
        actor_id,
        action,
        target_table,
        target_id,
        old_value,
        new_value,
        reason,
        created_at
    ) VALUES (
        auth.uid(),
        'MANUAL_ATTENDANCE_CORRECTION',
        'attendance_records',
        p_record_id::TEXT,
        v_old_rec,
        v_new_rec,
        p_reason,
        NOW()
    );

    RETURN v_new_rec;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grade correction RPC requiring logged reason
CREATE OR REPLACE FUNCTION correct_grade(
    p_grade_id UUID,
    p_new_raw_score NUMERIC,
    p_feedback TEXT,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_old_rec JSONB;
    v_new_rec JSONB;
    v_max_score NUMERIC;
    v_normalized NUMERIC;
    v_user_role TEXT;
BEGIN
    -- Validate mandatory reason
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid reason is required for manual grade corrections';
    END IF;

    -- Validate score
    IF p_new_raw_score < 0 THEN
        RAISE EXCEPTION 'Raw score cannot be negative';
    END IF;

    -- Authentication check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Authorization check
    v_user_role := auth_user_role();
    IF NOT (is_top_admin() OR v_user_role IN ('Ketua Divisi', 'Mentor')) THEN
        RAISE EXCEPTION 'Unauthorized to correct grades';
    END IF;

    -- Division boundary enforcement for Ketua Divisi and Mentor
    IF v_user_role IN ('Ketua Divisi', 'Mentor') THEN
        IF NOT EXISTS (
            SELECT 1 FROM assignment_grades ag
            JOIN assignment_submissions s ON ag.submission_id = s.id
            JOIN assignments a ON s.assignment_id = a.id
            WHERE ag.id = p_grade_id
              AND a.division_id IN (SELECT division_id FROM auth_user_division_ids())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: grade does not belong to your assigned division';
        END IF;
    END IF;

    -- Get max score from assignment
    SELECT a.max_score INTO v_max_score
    FROM assignment_grades ag
    JOIN assignment_submissions s ON ag.submission_id = s.id
    JOIN assignments a ON s.assignment_id = a.id
    WHERE ag.id = p_grade_id;

    IF v_max_score IS NULL OR v_max_score <= 0 THEN
        v_max_score := 100.00;
    END IF;

    -- Compute normalized score (0-100 scale)
    v_normalized := ROUND(((p_new_raw_score / v_max_score) * 100.00)::NUMERIC, 2);
    IF v_normalized > 100.00 THEN
        v_normalized := 100.00;
    END IF;

    -- Capture old record
    SELECT to_jsonb(ag) INTO v_old_rec
    FROM assignment_grades ag
    WHERE ag.id = p_grade_id;

    IF v_old_rec IS NULL THEN
        RAISE EXCEPTION 'Grade record not found';
    END IF;

    -- Update grade
    UPDATE assignment_grades
    SET raw_score = p_new_raw_score,
        normalized_score = v_normalized,
        feedback = COALESCE(p_feedback, feedback),
        grader_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_grade_id
    RETURNING to_jsonb(assignment_grades.*) INTO v_new_rec;

    -- Log audit event
    INSERT INTO audit_logs (
        actor_id,
        action,
        target_table,
        target_id,
        old_value,
        new_value,
        reason,
        created_at
    ) VALUES (
        auth.uid(),
        'GRADE_EDIT',
        'assignment_grades',
        p_grade_id::TEXT,
        v_old_rec,
        v_new_rec,
        p_reason,
        NOW()
    );

    RETURN v_new_rec;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Dynamic 5-minute QR token generator RPC
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

    -- Deactivate previous active tokens for this session without touching attendance records
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

-- 6. QR scan / backup code verification RPC
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
    WHERE member_id = p_member_id AND session_id = p_session_id;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kamu sudah melakukan absensi untuk sesi ini.',
            'status', v_existing.status
        );
    END IF;

    -- Determine status based on late threshold
    -- Threshold is calculated relative to session opening time or date + start_time
    IF v_session.opened_at IS NOT NULL THEN
        v_late_cutoff := v_session.opened_at + (v_session.late_threshold_minutes || ' minutes')::INTERVAL;
    ELSE
        v_late_cutoff := (v_session.date + v_session.start_time) + (v_session.late_threshold_minutes || ' minutes')::INTERVAL;
    END IF;

    IF clock_timestamp() <= v_late_cutoff THEN
        v_status := 'Hadir';
    ELSE
        v_status := 'Terlambat';
    END IF;

    -- Insert attendance record (composite unique constraint guarantees single entry)
    BEGIN
        INSERT INTO attendance_records (
            session_id,
            member_id,
            status,
            scan_time,
            verification_method,
            notes,
            created_at,
            updated_at
        ) VALUES (
            p_session_id,
            p_member_id,
            v_status,
            clock_timestamp(),
            p_method,
            NULL,
            NOW(),
            NOW()
        ) RETURNING * INTO v_new_record;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Absensi berhasil! Kehadiran kamu sudah tercatat.',
            'status', v_new_record.status,
            'scan_time', v_new_record.scan_time
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kamu sudah melakukan absensi untuk sesi ini.'
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Verification function for Check 1: Pembina and Ketua permission parity
CREATE OR REPLACE FUNCTION check_pembina_ketua_parity()
RETURNS TABLE (
    pembina_exclusive_count BIGINT,
    ketua_exclusive_count BIGINT,
    is_identical BOOLEAN
) AS $$
DECLARE
    v_p_count BIGINT;
    v_k_count BIGINT;
BEGIN
    WITH pembina_perms AS (
        SELECT p.code FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = 'Pembina'
    ),
    ketua_perms AS (
        SELECT p.code FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = 'Ketua'
    )
    SELECT 
        (SELECT COUNT(*) FROM (SELECT * FROM pembina_perms EXCEPT SELECT * FROM ketua_perms) d1),
        (SELECT COUNT(*) FROM (SELECT * FROM ketua_perms EXCEPT SELECT * FROM pembina_perms) d2)
    INTO v_p_count, v_k_count;

    RETURN QUERY SELECT v_p_count, v_k_count, (v_p_count = 0 AND v_k_count = 0);
END;
$$ LANGUAGE plpgsql STABLE;
