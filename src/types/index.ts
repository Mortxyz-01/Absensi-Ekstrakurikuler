export type UserRole =
  | 'Pembina'
  | 'Ketua'
  | 'Wakil Ketua'
  | 'Sekretaris'
  | 'Ketua Divisi'
  | 'Mentor'
  | 'Member';

export interface Role {
  id: string;
  name: UserRole;
  description?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
  avatar_url?: string;
  created_at?: string;
  role?: Role;
  divisions?: MemberDivision[];
}

export interface Division {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  member_count?: number;
}

export interface MemberDivision {
  id: string;
  member_id: string;
  division_id: string;
  classification: 'Wajib' | 'Opsional';
  effective_date?: string;
  end_date?: string | null;
  is_active: boolean;
  division?: Division;
}

export type ActivityType = 'Wajib' | 'Opsional';
export type SessionStatus = 'scheduled' | 'open' | 'closed' | 'draft' | 'cancelled';

export interface AttendanceSession {
  id: string;
  title: string;
  division_id: string | null;
  session_type: ActivityType;
  date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  backup_code: string;
  opened_at?: string | null;
  closed_at?: string | null;
  late_threshold_minutes: number;
  created_by?: string;
  created_at?: string;
  division?: Division;
}

export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alfa';

export interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  scan_time?: string;
  verification_method?: string;
  notes?: string;
  created_at?: string;
  member_name?: string;
  member_email?: string;
  session_title?: string;
}

export interface LearningMaterial {
  id: string;
  title: string;
  description?: string;
  division_id: string;
  content_url?: string;
  file_path?: string;
  is_archived: boolean;
  created_by?: string;
  created_at?: string;
  division?: Division;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  division_id: string;
  deadline: string;
  max_score: number;
  weight: number;
  is_published: boolean;
  created_by?: string;
  created_at?: string;
  division?: Division;
}

export interface AssignmentGrade {
  id: string;
  assignment_id: string;
  member_id: string;
  score: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
  assignment?: Assignment;
  member?: UserProfile;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  old_data?: any;
  new_data?: any;
  reason?: string;
  created_at: string;
  user_email?: string;
}

export interface StudentGradeSummary {
  member_id: string;
  full_name: string;
  email: string;
  division_names: string[];
  total_wajib_sessions: number;
  attended_sessions: number; // Hadir + Terlambat
  attendance_percentage: number | null; // null if no finished sessions
  average_assignment_score: number | null; // null if no assignments graded
  final_grade: number | null; // (attendance * 0.4) + (assignment * 0.6)
  status_label: 'Lengkap' | 'Penilaian belum lengkap';
}
