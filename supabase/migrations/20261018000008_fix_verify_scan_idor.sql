-- Migration 20261018000008: Close IDOR in verify_attendance_scan
-- Any authenticated user could pass another member's UUID as p_member_id with
-- a valid session token and mark that person present (proven via REST:
-- a member marked the Ketua "Terlambat"). The frontend always passes
-- profile.id, so guarding the write to self (or officers for manual help)
-- changes no legitimate flow.

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
    -- IDOR guard: members may only record attendance for themselves.
    -- Officers (Pembina/Ketua/Wakil/Sekre) keep the option to record on
    -- behalf of a member (e.g. helping with a broken camera).
    IF p_member_id IS NULL THEN
        p_member_id := auth.uid();
    END IF;
    IF p_member_id IS NULL OR (p_member_id != auth.uid() AND NOT is_officer()) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Presensi hanya bisa direkam untuk akun sendiri.'
        );
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
            'message', 'Presensi tercatat.',
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

REVOKE EXECUTE ON FUNCTION verify_attendance_scan(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_attendance_scan(TEXT, UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
