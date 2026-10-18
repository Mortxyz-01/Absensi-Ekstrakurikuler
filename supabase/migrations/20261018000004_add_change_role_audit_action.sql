-- Migration 20261018000004: Support role (jabatan) change UI
-- Ketua and Pembina share identical authority (hierarchy_level 1, same
-- role_permissions, same is_top_admin() paths). This migration extends the
-- log_audit_event whitelist so role changes made through the Members page UI
-- can be recorded permanently in audit_logs as 'CHANGE_ROLE'.
-- Note: permission to actually change roles is already enforced by
--   - users UPDATE RLS (top admin = Pembina/Ketua), and
--   - trg_guard_users_edit (role_id editable by Pembina/Ketua only).

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
        'GRADE_EDIT', 'CHANGE_ROLE'
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
