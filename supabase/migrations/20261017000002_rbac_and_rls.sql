-- Migration: 7-Role RBAC and Row Level Security (RLS) policies
-- Enforces division isolation, member isolation, and identical Pembina/Ketua authority.

-- Helper functions for RBAC and RLS
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
    SELECT r.name 
    FROM public.users u 
    JOIN public.roles r ON u.role_id = r.id 
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_top_admin()
RETURNS BOOLEAN AS $$
    SELECT auth_user_role() IN ('Pembina', 'Ketua');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_officer()
RETURNS BOOLEAN AS $$
    SELECT auth_user_role() IN ('Pembina', 'Ketua', 'Wakil Ketua', 'Sekretaris');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_division_ids()
RETURNS TABLE (division_id UUID) AS $$
    -- Division led by user (Ketua Divisi)
    SELECT id AS division_id FROM public.divisions WHERE lead_id = auth.uid()
    UNION
    -- Active division assignments
    SELECT md.division_id 
    FROM public.member_divisions md 
    WHERE md.member_id = auth.uid() 
      AND md.is_active = TRUE 
      AND (md.end_date IS NULL OR md.end_date >= CURRENT_DATE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all 21 tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 1. roles RLS
CREATE POLICY "Anyone can view roles"
ON roles FOR SELECT
TO authenticated, anon
USING (TRUE);

CREATE POLICY "Only top admin can manage roles"
ON roles FOR ALL
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

-- 2. permissions RLS
CREATE POLICY "Anyone can view permissions"
ON permissions FOR SELECT
TO authenticated, anon
USING (TRUE);

CREATE POLICY "Only top admin can manage permissions"
ON permissions FOR ALL
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

-- 3. role_permissions RLS
CREATE POLICY "Anyone can view role_permissions"
ON role_permissions FOR SELECT
TO authenticated, anon
USING (TRUE);

CREATE POLICY "Only top admin can manage role_permissions"
ON role_permissions FOR ALL
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

-- 4. users RLS
CREATE POLICY "Officers view all users, members view division peers and self"
ON users FOR SELECT
TO authenticated
USING (
    is_officer()
    OR id = auth.uid()
    OR id IN (
        SELECT md.member_id FROM member_divisions md
        WHERE md.division_id IN (SELECT division_id FROM auth_user_division_ids())
          AND md.is_active = TRUE
    )
);

CREATE POLICY "Top admin can insert users"
ON users FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

CREATE POLICY "User update policy with hierarchy check"
ON users FOR UPDATE
TO authenticated
USING (
    is_top_admin()
    OR (
        auth_user_role() = 'Wakil Ketua'
        AND role_id NOT IN (SELECT id FROM roles WHERE name IN ('Pembina', 'Ketua'))
    )
    OR (id = auth.uid())
)
WITH CHECK (
    is_top_admin()
    OR (
        auth_user_role() = 'Wakil Ketua'
        AND role_id NOT IN (SELECT id FROM roles WHERE name IN ('Pembina', 'Ketua'))
    )
    OR (
        id = auth.uid()
        AND role_id = (SELECT role_id FROM users WHERE id = auth.uid())
    )
);

CREATE POLICY "Only top admin can delete users"
ON users FOR DELETE
TO authenticated
USING (is_top_admin());

-- 5. members RLS
CREATE POLICY "Members viewable by officers, division leads, and self"
ON members FOR SELECT
TO authenticated
USING (
    is_officer()
    OR id = auth.uid()
    OR id IN (
        SELECT md.member_id FROM member_divisions md
        WHERE md.division_id IN (SELECT division_id FROM auth_user_division_ids())
          AND md.is_active = TRUE
    )
);

CREATE POLICY "Officers can insert members"
ON members FOR INSERT
TO authenticated
WITH CHECK (is_officer() OR id = auth.uid());

CREATE POLICY "Members update policy"
ON members FOR UPDATE
TO authenticated
USING (
    is_officer()
    OR id = auth.uid()
)
WITH CHECK (
    is_officer()
    OR (
        id = auth.uid()
        AND status = (SELECT status FROM members WHERE id = auth.uid())
        AND nim = (SELECT nim FROM members WHERE id = auth.uid())
    )
);

CREATE POLICY "Only top admin can delete members"
ON members FOR DELETE
TO authenticated
USING (is_top_admin());

-- 6. divisions RLS
CREATE POLICY "Divisions viewable by all authenticated"
ON divisions FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Only top admin can manage divisions"
ON divisions FOR ALL
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

-- 7. member_divisions RLS
CREATE POLICY "Officers view all member_divisions, division leads and members view scoped"
ON member_divisions FOR SELECT
TO authenticated
USING (
    is_officer()
    OR member_id = auth.uid()
    OR division_id IN (SELECT division_id FROM auth_user_division_ids())
);

CREATE POLICY "Only top admin can insert or update member_divisions"
ON member_divisions FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

CREATE POLICY "Only top admin can update member_divisions"
ON member_divisions FOR UPDATE
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

CREATE POLICY "Only top admin can delete member_divisions"
ON member_divisions FOR DELETE
TO authenticated
USING (is_top_admin());

-- 8. activities RLS
CREATE POLICY "Activities viewable by officers and scoped participants"
ON activities FOR SELECT
TO authenticated
USING (
    is_officer()
    OR division_id IS NULL
    OR division_id IN (SELECT division_id FROM auth_user_division_ids())
);

CREATE POLICY "Activities manageable by officers and division leads"
ON activities FOR INSERT
TO authenticated
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Activities updateable by officers and division leads"
ON activities FOR UPDATE
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
)
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Activities deletable by top admin or division leads"
ON activities FOR DELETE
TO authenticated
USING (
    is_top_admin()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

-- 9. attendance_sessions RLS
CREATE POLICY "Sessions viewable by officers and scoped members"
ON attendance_sessions FOR SELECT
TO authenticated
USING (
    is_officer()
    OR division_id IS NULL
    OR division_id IN (SELECT division_id FROM auth_user_division_ids())
);

CREATE POLICY "Sessions insertable by officers and division leads"
ON attendance_sessions FOR INSERT
TO authenticated
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Sessions updateable by officers and division leads"
ON attendance_sessions FOR UPDATE
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
)
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Sessions deletable by top admin"
ON attendance_sessions FOR DELETE
TO authenticated
USING (is_top_admin());

-- 10. session_participants RLS
CREATE POLICY "Participants viewable by officers, division leads, and self"
ON session_participants FOR SELECT
TO authenticated
USING (
    is_officer()
    OR member_id = auth.uid()
    OR session_id IN (
        SELECT id FROM attendance_sessions
        WHERE division_id IS NULL OR division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

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

-- 11. attendance_qr_tokens RLS
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

-- 12. attendance_records RLS
CREATE POLICY "Attendance records viewable by officers, division mentors, and self"
ON attendance_records FOR SELECT
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
    OR member_id = auth.uid()
);

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

CREATE POLICY "Attendance records updateable by authorized officers with audit"
ON attendance_records FOR UPDATE
TO authenticated
USING (
    is_top_admin()
    OR auth_user_role() IN ('Wakil Ketua', 'Sekretaris')
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
)
WITH CHECK (
    is_top_admin()
    OR auth_user_role() IN ('Wakil Ketua', 'Sekretaris')
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND session_id IN (
            SELECT id FROM attendance_sessions
            WHERE division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

CREATE POLICY "Attendance records delete forbidden to officers and members"
ON attendance_records FOR DELETE
TO authenticated
USING (is_top_admin());

-- 13. leave_requests RLS
CREATE POLICY "Leave requests viewable by officers, division leads, and self"
ON leave_requests FOR SELECT
TO authenticated
USING (
    is_officer()
    OR member_id = auth.uid()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND member_id IN (
            SELECT md.member_id FROM member_divisions md
            WHERE md.division_id IN (SELECT division_id FROM auth_user_division_ids())
              AND md.is_active = TRUE
        )
    )
);

CREATE POLICY "Leave requests insertable by member for self"
ON leave_requests FOR INSERT
TO authenticated
WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leave requests updateable by reviewer or pending member"
ON leave_requests FOR UPDATE
TO authenticated
USING (
    (member_id = auth.uid() AND status = 'pending')
    OR is_top_admin()
    OR auth_user_role() = 'Sekretaris'
)
WITH CHECK (
    (member_id = auth.uid() AND status = 'pending')
    OR is_top_admin()
    OR auth_user_role() = 'Sekretaris'
);

CREATE POLICY "Leave requests deletable by member if pending or top admin"
ON leave_requests FOR DELETE
TO authenticated
USING (
    (member_id = auth.uid() AND status = 'pending')
    OR is_top_admin()
);

-- 14. learning_materials RLS
CREATE POLICY "Materials viewable by officers, mentors, and assigned division members"
ON learning_materials FOR SELECT
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
    OR (
        status = 'published'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Materials insertable by officers and division mentors"
ON learning_materials FOR INSERT
TO authenticated
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Materials updateable by officers and division mentors"
ON learning_materials FOR UPDATE
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
)
WITH CHECK (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Materials deletable by top admin or division mentors"
ON learning_materials FOR DELETE
TO authenticated
USING (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

-- 15. assignments RLS
CREATE POLICY "Assignments viewable by officers, mentors, and division members"
ON assignments FOR SELECT
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
    OR (
        status = 'published'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Assignments insertable by top admin and division mentors"
ON assignments FOR INSERT
TO authenticated
WITH CHECK (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Assignments updateable by top admin and division mentors"
ON assignments FOR UPDATE
TO authenticated
USING (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
)
WITH CHECK (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Assignments deletable by top admin"
ON assignments FOR DELETE
TO authenticated
USING (is_top_admin());

-- 16. assignment_submissions RLS
CREATE POLICY "Submissions viewable by officers, division mentors, and self"
ON assignment_submissions FOR SELECT
TO authenticated
USING (
    is_officer()
    OR member_id = auth.uid()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND assignment_id IN (
            SELECT id FROM assignments
            WHERE division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

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

CREATE POLICY "Submissions updateable by member for self"
ON assignment_submissions FOR UPDATE
TO authenticated
USING (member_id = auth.uid())
WITH CHECK (member_id = auth.uid());

CREATE POLICY "Submissions deletable by top admin"
ON assignment_submissions FOR DELETE
TO authenticated
USING (is_top_admin());

-- 17. assignment_grades RLS
CREATE POLICY "Grades viewable by officers, division mentors, and self published"
ON assignment_grades FOR SELECT
TO authenticated
USING (
    is_officer()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND submission_id IN (
            SELECT s.id FROM assignment_submissions s
            JOIN assignments a ON s.assignment_id = a.id
            WHERE a.division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
    OR (
        status = 'published'
        AND submission_id IN (
            SELECT id FROM assignment_submissions
            WHERE member_id = auth.uid()
        )
    )
);

CREATE POLICY "Grades insertable by top admin and division mentors"
ON assignment_grades FOR INSERT
TO authenticated
WITH CHECK (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND submission_id IN (
            SELECT s.id FROM assignment_submissions s
            JOIN assignments a ON s.assignment_id = a.id
            WHERE a.division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

CREATE POLICY "Grades updateable by top admin and division mentors"
ON assignment_grades FOR UPDATE
TO authenticated
USING (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND submission_id IN (
            SELECT s.id FROM assignment_submissions s
            JOIN assignments a ON s.assignment_id = a.id
            WHERE a.division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
)
WITH CHECK (
    is_top_admin()
    OR (
        auth_user_role() IN ('Ketua Divisi', 'Mentor')
        AND submission_id IN (
            SELECT s.id FROM assignment_submissions s
            JOIN assignments a ON s.assignment_id = a.id
            WHERE a.division_id IN (SELECT division_id FROM auth_user_division_ids())
        )
    )
);

CREATE POLICY "Grades deletable by top admin"
ON assignment_grades FOR DELETE
TO authenticated
USING (is_top_admin());

-- 18. grading_policies RLS
CREATE POLICY "Grading policies viewable by all authenticated"
ON grading_policies FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Only top admin can insert grading policies"
ON grading_policies FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

CREATE POLICY "Only top admin can update grading policies"
ON grading_policies FOR UPDATE
TO authenticated
USING (is_top_admin() AND is_locked = FALSE)
WITH CHECK (is_top_admin() AND is_locked = FALSE);

CREATE POLICY "Only top admin can delete grading policies"
ON grading_policies FOR DELETE
TO authenticated
USING (is_top_admin());

-- 19. announcements RLS
CREATE POLICY "Announcements viewable by all authenticated for their division or global"
ON announcements FOR SELECT
TO authenticated
USING (
    is_active = TRUE
    AND (
        division_id IS NULL
        OR division_id IN (SELECT division_id FROM auth_user_division_ids())
        OR is_officer()
    )
);

CREATE POLICY "Announcements insertable by officers and division leads"
ON announcements FOR INSERT
TO authenticated
WITH CHECK (
    is_top_admin()
    OR auth_user_role() = 'Sekretaris'
    OR (
        auth_user_role() = 'Ketua Divisi'
        AND division_id IN (SELECT division_id FROM auth_user_division_ids())
    )
);

CREATE POLICY "Announcements updateable by author, sekretaris, or top admin"
ON announcements FOR UPDATE
TO authenticated
USING (
    is_top_admin()
    OR auth_user_role() = 'Sekretaris'
    OR author_id = auth.uid()
)
WITH CHECK (
    is_top_admin()
    OR auth_user_role() = 'Sekretaris'
    OR author_id = auth.uid()
);

CREATE POLICY "Announcements deletable by top admin or sekretaris"
ON announcements FOR DELETE
TO authenticated
USING (
    is_top_admin()
    OR auth_user_role() = 'Sekretaris'
);

-- 20. audit_logs RLS
CREATE POLICY "Only top admin can read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_top_admin());

CREATE POLICY "Audit logs insertable only by top admin"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

CREATE POLICY "No role can update audit logs"
ON audit_logs FOR UPDATE
TO authenticated
USING (FALSE);

CREATE POLICY "No role can delete audit logs"
ON audit_logs FOR DELETE
TO authenticated
USING (FALSE);

-- 21. system_settings RLS
CREATE POLICY "System settings viewable by all authenticated"
ON system_settings FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Only top admin can insert system settings"
ON system_settings FOR INSERT
TO authenticated
WITH CHECK (is_top_admin());

CREATE POLICY "Only top admin can update system settings"
ON system_settings FOR UPDATE
TO authenticated
USING (is_top_admin())
WITH CHECK (is_top_admin());

CREATE POLICY "Only top admin can delete system settings"
ON system_settings FOR DELETE
TO authenticated
USING (is_top_admin());
