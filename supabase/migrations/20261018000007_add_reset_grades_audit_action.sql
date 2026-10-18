-- Migration 20261018000005: Register RESET_GRADES audit action
-- The Reset Nilai feature (GradesPage, top admins only) deletes all
-- assignment_grades rows of a division then calls logAudit('RESET_GRADES', ...).
-- The whitelist in 20261018000004 predates that feature, so the audit write
-- was rejected silently ("Aksi audit tidak valid") and the audit trail would
-- miss every grade reset. Add the action so the mandatory reason prompt has
-- a matching permanent record.

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
    v_action TEXT;
    v_target_table TEXT;
BEGIN
    -- Authentication required (blocks anon callers entirely)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Autentikasi diperlukan untuk menulis log audit.';
    END IF;

    -- Whitelist of legitimate audit actions (client-side + internal RPC actions)
    v_action := TRIM(UPPER(p_action));
    IF v_action NOT IN (
        'MANUAL_ATTENDANCE', 'MANUAL_ATTENDANCE_CORRECTION', 'ATTENDANCE_SCAN',
        'ACTIVATE_MEMBER', 'DEACTIVATE_MEMBER', 'UPDATE_MEMBER_DIVISIONS',
        'GRADE_EDIT', 'CHANGE_ROLE', 'RESET_GRADES'
    ) THEN
        RAISE EXCEPTION 'Aksi audit tidak valid.';
    END IF;

    -- Whitelist of target tables and sane length caps to keep the log clean
    v_target_table := TRIM(LOWER(p_target_table));
    IF v_target_table NOT IN (
        'attendance_records', 'assignment_grades', 'assignment_submissions',
        'users', 'members', 'member_divisions'
    ) OR LENGTH(p_target_id) > 128 THEN
        RAISE EXCEPTION 'Target audit tidak valid.';
    END IF;

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
        v_action,
        v_target_table,
        LEFT(p_target_id, 128),
        p_old_val,
        p_new_val,
        LEFT(p_reason, 1000),
        NOW()
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
