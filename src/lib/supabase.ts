import { createClient } from '@supabase/supabase-js';

// Fail hard when environment variables are missing. Never fall back to a
// hostname-derived URL or a hardcoded public demo key, so the app cannot
// silently send bearer tokens to an uncontrolled host.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Konfigurasi Supabase tidak lengkap. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function generateQrToken(sessionId: string) {
  // Call server RPC
  const { data, error } = await supabase.rpc('generate_qr_token', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data as {
    session_id: string;
    token: string;
    expires_at: string;
    is_active: boolean;
  };
}

export async function verifyAttendance(
  token: string,
  memberId: string,
  sessionId: string,
  method: 'qr_scan' | 'backup_code' = 'qr_scan'
) {
  const { data, error } = await supabase.rpc('verify_attendance_scan', {
    p_token: token,
    p_member_id: memberId,
    p_session_id: sessionId,
    p_method: method,
  });
  if (error) throw error;
  return data as {
    success: boolean;
    message?: string;
    error?: string;
    status?: string;
    scan_time?: string;
  };
}

export async function logAudit(action: string, targetType: string, targetId: string, reason: string, oldData?: any, newData?: any) {
  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: action,
      p_target_table: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_old_val: oldData ?? null,
      p_new_val: newData ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}
