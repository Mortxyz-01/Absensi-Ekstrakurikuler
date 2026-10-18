-- Migration 20261018000005: RPC get_dashboard_summary
-- Provides real-time aggregated metrics for DashboardPage.tsx:
--   - total_members: Total active enrolled members
--   - total_sessions: Total attendance sessions
--   - attendance_rate: Average percentage of attended records across closed sessions
--   - divisions: Division breakdown with id, name, code, member_count, and lead_name
--   - daily_trend: 7-day attendance trend with date_str, label, and count

CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
    v_total_members BIGINT;
    v_total_sessions BIGINT;
    v_attendance_rate NUMERIC;
    v_divisions JSONB;
    v_daily_trend JSONB;
BEGIN
    -- 1. Total active members
    SELECT COUNT(DISTINCT m.id) INTO v_total_members
    FROM members m
    JOIN users u ON u.id = m.id
    WHERE m.status = 'active' AND u.is_active = TRUE;

    -- 2. Total attendance sessions
    SELECT COUNT(*) INTO v_total_sessions
    FROM attendance_sessions;

    -- 3. Overall attendance rate (% of Hadir & Terlambat)
    -- Computes from closed sessions if any exist, otherwise falls back to all recorded sessions (excluding cancelled).
    SELECT COALESCE(
        ROUND(
            (COUNT(*) FILTER (WHERE ar.status IN ('Hadir', 'Terlambat'))::NUMERIC / 
             NULLIF(COUNT(*)::NUMERIC, 0) * 100), 
            1
        ),
        0.0
    ) INTO v_attendance_rate
    FROM attendance_records ar
    JOIN attendance_sessions s ON s.id = ar.session_id
    WHERE (
        s.status = 'closed'
        OR (NOT EXISTS (SELECT 1 FROM attendance_sessions WHERE status = 'closed') AND s.status != 'cancelled')
    );

    -- 4. Division breakdown
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', d.id,
                'name', d.name,
                'code', d.code,
                'member_count', COALESCE(mc.cnt, 0),
                'lead_name', u.full_name
            ) ORDER BY COALESCE(mc.cnt, 0) DESC, d.name ASC
        ),
        '[]'::jsonb
    ) INTO v_divisions
    FROM divisions d
    LEFT JOIN users u ON u.id = d.lead_id
    LEFT JOIN (
        SELECT md.division_id, COUNT(DISTINCT md.member_id) AS cnt
        FROM member_divisions md
        JOIN members m ON m.id = md.member_id
        JOIN users u ON u.id = m.id
        WHERE md.is_active = TRUE AND m.status = 'active' AND u.is_active = TRUE
        GROUP BY md.division_id
    ) mc ON mc.division_id = d.id
    WHERE d.is_active = TRUE;

    -- 5. 7-day daily attendance trend (from CURRENT_DATE - 6 days to CURRENT_DATE)
    WITH days AS (
        SELECT d::date AS dt
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'date_str', to_char(days.dt, 'YYYY-MM-DD'),
                'label', to_char(days.dt, 'DD Mon'),
                'count', COALESCE(rc.cnt, 0)
            ) ORDER BY days.dt ASC
        ),
        '[]'::jsonb
    ) INTO v_daily_trend
    FROM days
    LEFT JOIN (
        SELECT COALESCE(ar.scan_time::date, s.date) AS rec_date, COUNT(*) AS cnt
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ar.status IN ('Hadir', 'Terlambat')
          AND s.status != 'cancelled'
        GROUP BY COALESCE(ar.scan_time::date, s.date)
    ) rc ON rc.rec_date = days.dt;

    RETURN jsonb_build_object(
        'total_members', COALESCE(v_total_members, 0),
        'total_sessions', COALESCE(v_total_sessions, 0),
        'attendance_rate', COALESCE(v_attendance_rate, 0.0),
        'divisions', COALESCE(v_divisions, '[]'::jsonb),
        'daily_trend', COALESCE(v_daily_trend, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- PostgREST API permission configuration
-- Aggregate org metrics are for logged-in users only (anon must stay out).
REVOKE EXECUTE ON FUNCTION get_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';
