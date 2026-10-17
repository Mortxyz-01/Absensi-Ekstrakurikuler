import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase, generateQrToken, verifyAttendance, logAudit } from '../lib/supabase';
import {
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  Square,
  Users,
  Camera,
  KeyRound,
  RotateCw,
  X,
  History,
  ShieldAlert,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState, AuditPromptModal } from '../components/UIState';
import { AttendanceSession, AttendanceRecord, Division } from '../types';

export const AttendancePage: React.FC = () => {
  const { profile, role, canManageAttendance, isMemberOnly } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active open session being managed
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [qrToken, setQrToken] = useState<string>('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);

  // Create session modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDivisionId, setNewDivisionId] = useState('');
  const [newActivityType, setNewActivityType] = useState<'Wajib' | 'Opsional'>('Wajib');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('15:00');
  const [newEndTime, setNewEndTime] = useState('17:00');
  const [newLateThreshold, setNewLateThreshold] = useState(15);
  const [createSaving, setCreateSaving] = useState(false);

  // Member Scan / Input state
  const [scanInputCode, setScanInputCode] = useState('');
  const [scanMethod, setScanMethod] = useState<'qr' | 'code'>('qr');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Member history state
  const [myHistory, setMyHistory] = useState<AttendanceRecord[]>([]);

  // QR canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch all sessions
  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      setDivisions(divData || []);

      const { data: sessData, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select('*, division:divisions(*)')
        .order('created_at', { ascending: false });

      if (sessErr) throw sessErr;
      setSessions(sessData || []);

      // Check if any session is open
      const openSess = (sessData || []).find((s) => s.status === 'open');
      if (openSess) {
        setActiveSession(openSess);
      } else {
        setActiveSession(null);
      }

      // If member, fetch personal history
      if (profile) {
        const { data: recData } = await supabase
          .from('attendance_records')
          .select('*, session:attendance_sessions(*)')
          .eq('member_id', profile.id)
          .order('scan_time', { ascending: false });

        setMyHistory(recData || []);
      }
    } catch (err: any) {
      console.error('Fetch sessions error:', err);
      setError(err.message || 'Gagal memuat sesi absensi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [profile]);

  // Fetch attendees for the active session
  const fetchAttendees = async (sessionId: string) => {
    try {
      const { data, error: attErr } = await supabase
        .from('attendance_records')
        .select(`
          id, session_id, member_id, status, scan_time, verification_method, notes,
          member:users (full_name, email)
        `)
        .eq('session_id', sessionId)
        .order('scan_time', { ascending: false });

      if (attErr) throw attErr;

      const formatted: AttendanceRecord[] = (data || []).map((d: any) => {
        const rawMem = Array.isArray(d.member) ? d.member[0] : d.member;
        return {
          id: d.id,
          session_id: d.session_id,
          member_id: d.member_id,
          status: d.status,
          scan_time: d.scan_time,
          verification_method: d.verification_method,
          notes: d.notes,
          member_name: rawMem?.full_name || 'Anggota',
          member_email: rawMem?.email || '',
        };
      });

      setAttendees(formatted);
    } catch (err) {
      console.error('Error fetching attendees:', err);
    }
  };

  // Generate server QR token
  const refreshQrToken = async (sessionId: string) => {
    try {
      const tokenData = await generateQrToken(sessionId);
      setQrToken(tokenData.token);
      const expiry = new Date(tokenData.expires_at).getTime();
      setTokenExpiresAt(expiry);
      setSecondsLeft(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));

      // Render QR to canvas
      if (canvasRef.current) {
        const qrPayload = JSON.stringify({
          sessionId,
          token: tokenData.token,
          t: Date.now(),
        });
        QRCode.toCanvas(canvasRef.current, qrPayload, {
          width: 256,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });
      }
    } catch (err) {
      console.error('Failed to generate QR token:', err);
    }
  };

  // Manage open session lifecycle: token refresh and countdown
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'open') return;

    fetchAttendees(activeSession.id);
    refreshQrToken(activeSession.id);

    // Attendees poll interval
    const attendeesInterval = setInterval(() => {
      fetchAttendees(activeSession.id);
    }, 4000);

    // Countdown and 5-minute renewal timer
    const countdownInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Token expired, request new 5-minute server token
          refreshQrToken(activeSession.id);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(attendeesInterval);
      clearInterval(countdownInterval);
    };
  }, [activeSession?.id, activeSession?.status]);

  // Re-draw QR canvas whenever qrToken changes
  useEffect(() => {
    if (activeSession && qrToken && canvasRef.current) {
      const qrPayload = JSON.stringify({
        sessionId: activeSession.id,
        token: qrToken,
      });
      QRCode.toCanvas(canvasRef.current, qrPayload, {
        width: 256,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });
    }
  }, [qrToken]);

  // Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreateSaving(true);
    try {
      // Random 6-char backup code
      const backupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error: insErr } = await supabase
        .from('attendance_sessions')
        .insert({
          title: newTitle.trim(),
          division_id: newDivisionId || null,
          activity_type: newActivityType,
          date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'scheduled',
          backup_code: backupCode,
          late_threshold_minutes: Number(newLateThreshold),
          created_by: profile?.id,
        })
        .select()
        .single();

      if (insErr) throw insErr;

      setShowCreateModal(false);
      setNewTitle('');
      fetchSessions();
    } catch (err: any) {
      alert('Gagal membuat sesi: ' + err.message);
    } finally {
      setCreateSaving(false);
    }
  };

  // Open Session (starts 5-minute dynamic QR)
  const handleOpenSession = async (sess: AttendanceSession) => {
    try {
      const { error: updErr } = await supabase
        .from('attendance_sessions')
        .update({
          status: 'open',
          opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sess.id);

      if (updErr) throw updErr;

      setActiveSession({ ...sess, status: 'open' });
      fetchSessions();
    } catch (err: any) {
      alert('Gagal membuka sesi: ' + err.message);
    }
  };

  // Close Session
  const handleCloseSession = async (sess: AttendanceSession) => {
    if (!confirm(`Tutup sesi absensi "${sess.title}" sekarang? Peserta tidak dapat absen lagi setelah sesi ditutup.`)) {
      return;
    }

    try {
      const { error: updErr } = await supabase
        .from('attendance_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sess.id);

      if (updErr) throw updErr;

      // Deactivate all QR tokens for this session
      await supabase
        .from('attendance_qr_tokens')
        .update({ is_active: false })
        .eq('session_id', sess.id);

      setActiveSession(null);
      fetchSessions();
    } catch (err: any) {
      alert('Gagal menutup sesi: ' + err.message);
    }
  };

  // Member Scan / Manual Code Attendance
  const handleMemberSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInputCode.trim()) return;
    if (!profile) return;

    setScanLoading(true);
    setScanResult(null);

    try {
      // Find currently open session
      const targetSession = activeSession || sessions.find((s) => s.status === 'open');
      if (!targetSession) {
        setScanResult({
          success: false,
          message: 'Tidak ada sesi absensi yang sedang dibuka oleh admin.',
        });
        setScanLoading(false);
        return;
      }

      // Check whether user pasted token or backup code
      let method: 'qr_scan' | 'backup_code' = 'qr_scan';
      let tokenToVerify = scanInputCode.trim();

      // If length is ~6 and alphanumeric, likely backup code
      if (tokenToVerify.length <= 8 && !tokenToVerify.includes('{')) {
        method = 'backup_code';
      }

      // If user pasted json payload from qr
      if (tokenToVerify.startsWith('{')) {
        try {
          const parsed = JSON.parse(tokenToVerify);
          if (parsed.token) tokenToVerify = parsed.token;
        } catch {}
      }

      const res = await verifyAttendance(
        tokenToVerify,
        profile.id,
        targetSession.id,
        method
      );

      if (res.success) {
        setScanResult({
          success: true,
          message: res.message || `Absensi berhasil dicatat! Status: ${res.status || 'Hadir'}.`,
        });
        setScanInputCode('');
        fetchSessions();
      } else {
        setScanResult({
          success: false,
          message: res.error || 'Gagal memverifikasi absensi.',
        });
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat memproses absensi.',
      });
    } finally {
      setScanLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-orens-600" />
            <span>Presensi Digital Orens Solution</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Token QR diperbarui otomatis setiap 5 menit dengan validasi waktu server.
          </p>
        </div>

        {canManageAttendance && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-xl transition-colors shadow-sm shadow-orens-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Sesi Absensi Baru</span>
          </button>
        )}
      </div>

      {/* MEMBER VIEW: SCAN QR OR ENTER CODE */}
      {isMemberOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-orens-600" />
              <span>Input Presensi Kehadiran</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Masukkan token QR atau kode cadangan 6 digit yang ditampilkan oleh admin di depan ruangan.
            </p>

            {scanResult && (
              <div
                className={`mb-4 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  scanResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300'
                }`}
              >
                {scanResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                )}
                <span>{scanResult.message}</span>
              </div>
            )}

            <form onSubmit={handleMemberSubmitAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Kode Cadangan Sesi / Token QR
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={scanInputCode}
                    onChange={(e) => setScanInputCode(e.target.value)}
                    placeholder="Contoh: AB12CD atau tempel token QR"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Kamera tidak tersedia? Minta kode cadangan 6 huruf kepada panitia pembina.
                </p>
              </div>

              <button
                type="submit"
                disabled={scanLoading || !scanInputCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {scanLoading ? 'Memproses Kehadiran...' : 'Kirim Presensi Sekarang'}
              </button>
            </form>
          </div>

          {/* Member Personal Attendance Log */}
          <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-orens-600" />
              <span>Riwayat Presensi Saya</span>
            </h3>

            {myHistory.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic py-6 text-center">
                Belum ada rekaman presensi.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {myHistory.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {rec.session?.title || 'Sesi Ekstrakurikuler'}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Tanggal: {rec.session?.date} • Waktu: {rec.scan_time ? new Date(rec.scan_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        rec.status === 'Hadir'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : rec.status === 'Terlambat'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAFF / ADMIN VIEW: LIVE OPEN SESSION QR DISPLAY */}
      {canManageAttendance && activeSession && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border-2 border-orens-500/40 p-6 shadow-md shadow-orens-500/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: QR Display with countdown */}
            <div className="flex flex-col items-center text-center p-4 bg-gray-50 dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-inner">
              <div className="relative p-2 bg-white rounded-xl shadow-sm">
                <canvas ref={canvasRef} className="rounded-lg w-56 h-56" />
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full mt-3">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-orens-600 dark:text-orens-400">
                    <Clock className="w-4 h-4 animate-spin text-orens-600" />
                    <span>Pembaruan Token</span>
                  </span>
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100 font-extrabold">
                    {formatSeconds(secondsLeft)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-orens-600 h-2 transition-all duration-1000"
                    style={{ width: `${(secondsLeft / 300) * 100}%` }}
                  />
                </div>
              </div>

              {/* Backup Code Display */}
              <div className="mt-3 px-3 py-1.5 rounded-lg bg-orens-100 dark:bg-orens-950/60 text-xs text-orens-900 dark:text-orens-200 font-semibold">
                Kode Cadangan: <strong className="font-mono text-sm tracking-wider text-orens-700 dark:text-orens-400">{activeSession.backup_code}</strong>
              </div>
            </div>

            {/* Right: Session Info & Live Attendees List */}
            <div className="flex-1 w-full space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Sesi Dibuka & Siap Dipindai
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {activeSession.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Divisi: {activeSession.division?.name || 'Semua Divisi'} • Kategori: {activeSession.activity_type} • Batas Telat: {activeSession.late_threshold_minutes} menit
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshQrToken(activeSession.id)}
                    title="Segarkan Token QR Server Sekarang"
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCloseSession(activeSession)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Tutup Sesi Presensi</span>
                  </button>
                </div>
              </div>

              {/* Live Attendee Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Total Hadir</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {attendees.filter((a) => a.status === 'Hadir').length}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Terlambat</span>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {attendees.filter((a) => a.status === 'Terlambat').length}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Total Tercatat</span>
                  <p className="text-xl font-bold text-orens-600 dark:text-orens-400 mt-0.5">
                    {attendees.length}
                  </p>
                </div>
              </div>

              {/* Attendee Live Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Daftar Peserta Hadir (Pembaruan Otomatis):
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {attendees.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-4 text-center">
                      Belum ada siswa yang memindai QR sesi ini.
                    </p>
                  ) : (
                    attendees.map((att) => (
                      <div
                        key={att.id}
                        className="px-3 py-2 bg-gray-50 dark:bg-dark-900/60 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {att.member_name}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-2">
                            {att.scan_time ? new Date(att.scan_time).toLocaleTimeString('id-ID') : '-'}
                          </span>
                        </div>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            att.status === 'Hadir'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {att.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SESSIONS LIST */}
      {canManageAttendance && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Riwayat dan Jadwal Sesi Presensi
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {sessions.length} Sesi Terdaftar
            </span>
          </div>

          {loading ? (
            <LoadingSpinner message="Memuat sesi presensi..." />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="Belum Ada Sesi Presensi"
              description="Buat sesi absensi baru untuk memulai pertemuan ekstrakurikuler."
              actionText="Buat Sesi Pertama"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="py-3 px-4">Judul Sesi</th>
                    <th className="py-3 px-4">Divisi & Kategori</th>
                    <th className="py-3 px-4">Tanggal & Waktu</th>
                    <th className="py-3 px-4">Kode Cadangan</th>
                    <th className="py-3 px-4">Status Sesi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">
                        {sess.title}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div>{sess.division?.name || 'Semua Divisi'}</div>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            sess.activity_type === 'Wajib'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}
                        >
                          {sess.activity_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                        <div>{sess.date}</div>
                        <div>{sess.start_time} - {sess.end_time}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-xs text-orens-600 dark:text-orens-400">
                        {sess.backup_code}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            sess.status === 'open'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : sess.status === 'closed'
                              ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {sess.status === 'open' ? 'Buka' : sess.status === 'closed' ? 'Ditutup' : 'Terjadwal'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sess.status === 'scheduled' && (
                          <button
                            onClick={() => handleOpenSession(sess)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                          >
                            <Play className="w-3 h-3" />
                            <span>Buka Sesi</span>
                          </button>
                        )}
                        {sess.status === 'open' && (
                          <button
                            onClick={() => handleCloseSession(sess)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                          >
                            <Square className="w-3 h-3" />
                            <span>Tutup</span>
                          </button>
                        )}
                        {sess.status === 'closed' && (
                          <span className="text-xs text-gray-400 italic">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Buat Sesi Presensi Baru
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3.5 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Judul Pertemuan:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Pertemuan Rutin Pekan 3"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Divisi Khusus (Opsional):
                </label>
                <select
                  value={newDivisionId}
                  onChange={(e) => setNewDivisionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                >
                  <option value="">Semua Divisi (Pertemuan Gabungan)</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Klasifikasi:
                  </label>
                  <select
                    value={newActivityType}
                    onChange={(e) => setNewActivityType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  >
                    <option value="Wajib">Wajib (Bobot 40%)</option>
                    <option value="Opsional">Opsional (Tambahan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Toleransi Telat (Menit):
                  </label>
                  <input
                    type="number"
                    value={newLateThreshold}
                    onChange={(e) => setNewLateThreshold(Number(e.target.value))}
                    min={1}
                    max={120}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal:
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mulai:
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Selesai:
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {createSaving ? 'Menyimpan...' : 'Jadwalkan Sesi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
