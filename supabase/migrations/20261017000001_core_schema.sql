-- Core schema migration for Orens Solution Management System
-- Covers all 21 relational tables with constraints, indexes, and dual-division membership triggers.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table 1: roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL CHECK (name IN ('Pembina', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Ketua Divisi', 'Mentor', 'Member')),
    display_name TEXT NOT NULL,
    description TEXT,
    hierarchy_level INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(hierarchy_level);

-- Table 2: permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- Table 3: role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

-- Table 4: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Table 5: members
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nim TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    bio TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alumni', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_nim ON members(nim);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);

-- Table 6: divisions
CREATE TABLE IF NOT EXISTS divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES members(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_divisions_code ON divisions(code);
CREATE INDEX IF NOT EXISTS idx_divisions_lead ON divisions(lead_id);
CREATE INDEX IF NOT EXISTS idx_divisions_active ON divisions(is_active);

-- Table 7: member_divisions
CREATE TABLE IF NOT EXISTS member_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    classification TEXT NOT NULL CHECK (classification IN ('Wajib', 'Opsional')),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_member_division_dates CHECK (end_date IS NULL OR end_date >= effective_date)
);

CREATE INDEX IF NOT EXISTS idx_member_divisions_lookup ON member_divisions(member_id, is_active, classification);
CREATE INDEX IF NOT EXISTS idx_member_divisions_div ON member_divisions(division_id, is_active);
CREATE INDEX IF NOT EXISTS idx_member_divisions_dates ON member_divisions(member_id, effective_date, end_date);

-- Trigger for member_divisions: max 2 active divisions, max 1 Wajib and 1 Opsional
CREATE OR REPLACE FUNCTION check_member_division_rules()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    class_count INTEGER;
BEGIN
    IF NEW.is_active = TRUE AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
        -- Rule 1: Max 2 active divisions
        SELECT COUNT(*) INTO active_count
        FROM member_divisions
        WHERE member_id = NEW.member_id 
          AND is_active = TRUE 
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

        IF active_count >= 2 THEN
            RAISE EXCEPTION 'A member cannot belong to more than 2 active divisions simultaneously';
        END IF;

        -- Rule 2: Max 1 Wajib and max 1 Opsional
        SELECT COUNT(*) INTO class_count
        FROM member_divisions
        WHERE member_id = NEW.member_id 
          AND classification = NEW.classification 
          AND is_active = TRUE 
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

        IF class_count >= 1 THEN
            RAISE EXCEPTION 'A member can have at most one active % division', NEW.classification;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_member_division_rules ON member_divisions;
CREATE TRIGGER trg_check_member_division_rules
BEFORE INSERT OR UPDATE ON member_divisions
FOR EACH ROW EXECUTE FUNCTION check_member_division_rules();

-- Table 8: activities
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('regular_meeting', 'workshop', 'competition', 'general_assembly', 'other')),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_activity_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_activities_division ON activities(division_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_cancelled ON activities(is_cancelled);

-- Table 9: attendance_sessions
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL CHECK (session_type IN ('Wajib', 'Opsional', 'General')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_threshold_minutes INTEGER NOT NULL DEFAULT 15 CHECK (late_threshold_minutes >= 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'cancelled')),
    backup_code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_division ON attendance_sessions(division_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(date);

-- Table 10: session_participants
CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    participation_type TEXT NOT NULL CHECK (participation_type IN ('Wajib', 'Opsional')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_participant UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_member ON session_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_type ON session_participants(session_id, member_id, participation_type);

-- Table 11: attendance_qr_tokens
CREATE TABLE IF NOT EXISTS attendance_qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_qr_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_session_active ON attendance_qr_tokens(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_lookup ON attendance_qr_tokens(token, expires_at, is_active);

-- Table 12: attendance_records
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alfa', 'Belum Absen')),
    scan_time TIMESTAMPTZ,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('qr_scan', 'backup_code', 'manual_correction', 'leave_approval', 'system_timeout')),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_member_session_attendance UNIQUE (member_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_member_status ON attendance_records(member_id, status);

-- Table 13: leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Izin', 'Sakit')),
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_member ON leave_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_session ON leave_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);

-- Table 14: learning_materials
CREATE TABLE IF NOT EXISTS learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    learning_level TEXT NOT NULL CHECK (learning_level IN ('Beginner', 'Intermediate', 'Advanced')),
    file_url TEXT,
    external_link TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_division ON learning_materials(division_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON learning_materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_level ON learning_materials(learning_level);

-- Table 15: assignments
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (max_score > 0),
    attachment_url TEXT,
    target_participants TEXT NOT NULL DEFAULT 'all' CHECK (target_participants IN ('all', 'wajib_only', 'opsional_only')),
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_division ON assignments(division_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date);

-- Table 16: assignment_submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    submission_text TEXT,
    file_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'resubmitted')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assignment_member_submission UNIQUE (assignment_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_member ON assignment_submissions(member_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON assignment_submissions(status);

-- Table 17: assignment_grades
CREATE TABLE IF NOT EXISTS assignment_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID UNIQUE NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    grader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    raw_score NUMERIC(5,2) NOT NULL CHECK (raw_score >= 0),
    normalized_score NUMERIC(5,2) NOT NULL CHECK (normalized_score >= 0 AND normalized_score <= 100),
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grades_submission ON assignment_grades(submission_id);
CREATE INDEX IF NOT EXISTS idx_grades_grader ON assignment_grades(grader_id);
CREATE INDEX IF NOT EXISTS idx_grades_status ON assignment_grades(status);

-- Table 18: grading_policies
CREATE TABLE IF NOT EXISTS grading_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT NOT NULL,
    attendance_weight NUMERIC(5,2) NOT NULL DEFAULT 40.00 CHECK (attendance_weight >= 0 AND attendance_weight <= 100),
    assignment_weight NUMERIC(5,2) NOT NULL DEFAULT 60.00 CHECK (assignment_weight >= 0 AND assignment_weight <= 100),
    late_penalty_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    late_penalty_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (late_penalty_percent >= 0 AND late_penalty_percent <= 100),
    unsubmitted_is_zero BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_policy_weights_sum CHECK (attendance_weight + assignment_weight = 100.00)
);

CREATE INDEX IF NOT EXISTS idx_grading_policies_active ON grading_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_grading_policies_locked ON grading_policies(is_locked);

-- Table 19: announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_division ON announcements(division_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, published_at);

-- Table 20: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Table 21: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
