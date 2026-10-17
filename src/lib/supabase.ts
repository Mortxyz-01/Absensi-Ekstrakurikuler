import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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
  };
}

export async function logAudit(action: string, targetType: string, targetId: string, reason: string, oldData?: any, newData?: any) {
  try {
    await supabase.rpc('log_audit_event', {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_old_data: oldData ? JSON.stringify(oldData) : null,
      p_new_data: newData ? JSON.stringify(newData) : null,
    });
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}
