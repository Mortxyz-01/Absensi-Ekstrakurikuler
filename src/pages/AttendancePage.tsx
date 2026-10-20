import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
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
  Maximize2,
  Minimize2,
  UserPlus,
  CameraOff,
  Search,
  Copy,
  Check,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState, AuditPromptModal } from '../components/UIState';
import { AttendanceSession, AttendanceRecord, Division } from '../types';

export const AttendancePage: React.FC = () => {
  const { profile, role, canManageAttendance, isMemberOnly, isDivisionScoped } = useAuth();
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

  // Large QR Pop-up Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Manual Attendance Modal State (for students with camera or device issues)
  const [showManualModal, setShowManualModal] = useState(false);
  const [targetSessionForManual, setTargetSessionForManual] = useState<AttendanceSession | null>(null);
  const [manualStudentList, setManualStudentList] = useState<{
    id: string;
    full_name: string;
    email: string;
    alreadyAttended: boolean;
    currentStatus?: string;
  }[]>([]);
  const [manualLoadingStudents, setManualLoadingStudents] = useState(false);
  const [selectedManualMemberId, setSelectedManualMemberId] = useState('');
  const [manualStatus, setManualStatus] = useState<'Hadir' | 'Terlambat' | 'Izin' | 'Sakit'>('Hadir');
  const [manualNote, setManualNote] = useState('Kamera HP bermasalah / tidak bisa scan');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  // Member Scan / Input state
  const [scanInputCode, setScanInputCode] = useState('');
  const [scanMethod, setScanMethod] = useState<'qr' | 'code'>('qr');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastRecord, setLastRecord] = useState<{
    status: string;
    scanTime: string;
    method: string;
    sessionTitle: string;
    divisionName: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Member history state
  const [myHistory, setMyHistory] = useState<AttendanceRecord[]>([]);

  // Petugas divisi (Ketua Divisi/Mentor) tak boleh membuat sesi gabungan:
  // RLS hanya mengizinkan mereka membuat sesi untuk divisinya sendiri.
  useEffect(() => {
    if (isDivisionScoped && !newDivisionId && divisions.length) {
      setNewDivisionId(divisions[0].id);
    }
  }, [isDivisionScoped, divisions, newDivisionId]);

  // Ketua Divisi/Mentor hanya boleh mengelola sesi divisinya sendiri; sesi
  // gabungan (tanpa divisi) ditangani Pembina/Wakil/Sekre/Ketua (RLS menolak).
  const canManageSessionRow = (s: { division_id: string | null }) =>
    !isDivisionScoped || !!s.division_id;

  // QR canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch all sessions
  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      // Member & petugas divisi hanya melihat divisi yang mereka ikuti
      let divisionList = (divData || []) as any[];
      if ((isMemberOnly || isDivisionScoped) && profile?.divisions?.length) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        divisionList = divisionList.filter((d: any) => myDivIds.has(d.id));
      }
      setDivisions(divisionList);

      let sessData: AttendanceSession[] | null = null;
      let sessErr: any = null;

      if (canManageAttendance) {
        const res = await supabase
          .from('attendance_sessions')
          .select('*, division:divisions(*)')
          .order('created_at', { ascending: false });
        sessData = res.data as AttendanceSession[] | null;
        sessErr = res.error;
      } else {
        const res = await supabase
          .from('attendance_sessions')
          .select('id, title, division_id, session_type, date, start_time, end_time, late_threshold_minutes, status, created_by, opened_at, closed_at, created_at, updated_at, division:divisions(*)')
          .order('created_at', { ascending: false });
        sessData = res.data as unknown as AttendanceSession[] | null;
        sessErr = res.error;
      }

      if (sessErr) throw sessErr;
      setSessions(sessData || []);

      // Check if any session is open matching user's division
      let openSess: AttendanceSession | undefined;
      if (isMemberOnly && profile?.divisions && profile.divisions.length > 0) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        openSess = (sessData || []).find(
          (s) => s.status === 'open' && (!s.division_id || myDivIds.has(s.division_id))
        );
      } else if (isDivisionScoped) {
        // Ketua Divisi/Mentor: sesi gabungan (tanpa divisi) tak bisa dikelola
        // (RLS menolak tanpa pesan), jadi jangan jadikan sesi aktif.
        openSess = (sessData || []).find((s) => s.status === 'open' && s.division_id);
      } else {
        openSess = (sessData || []).find((s) => s.status === 'open');
      }

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
          member:members (full_name, user:users (email))
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
          member_email: rawMem?.user?.email || rawMem?.email || '',
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
      const qrPayload = JSON.stringify({
        sessionId,
        token: tokenData.token,
        t: Date.now(),
      });

      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, qrPayload, {
          width: 256,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });
      }

      if (modalCanvasRef.current) {
        QRCode.toCanvas(modalCanvasRef.current, qrPayload, {
          width: 400,
          margin: 2,
          color: {
            dark: '#09090b',
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

  // Re-draw QR canvas whenever qrToken changes or modal opens
  useEffect(() => {
    if (activeSession && qrToken) {
      const qrPayload = JSON.stringify({
        sessionId: activeSession.id,
        token: qrToken,
      });

      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, qrPayload, {
          width: 256,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });
      }

      if (modalCanvasRef.current) {
        QRCode.toCanvas(modalCanvasRef.current, qrPayload, {
          width: 400,
          margin: 2,
          color: {
            dark: '#09090b',
            light: '#ffffff',
          },
        });
      }
    }
  }, [qrToken, showQrModal, activeSession]);

  // Projector Modal handlers & keyboard accessibility
  const handleCopyBackup = async () => {
    if (activeSession?.backup_code) {
      try {
        await navigator.clipboard.writeText(activeSession.backup_code);
        setCopiedBackup(true);
        setTimeout(() => setCopiedBackup(false), 2000);
      } catch (err) {
        console.error('Failed to copy backup code:', err);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const closeQrModal = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setShowQrModal(false);
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!showQrModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeQrModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQrModal]);

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
          session_type: newActivityType,
          date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'draft',
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
      setShowQrModal(true);
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

  // Open manual attendance modal for an active or scheduled session
  const openManualAttendanceModal = async (session: AttendanceSession) => {
    setTargetSessionForManual(session);
    setShowManualModal(true);
    setManualLoadingStudents(true);
    setManualError('');
    setManualSuccess('');
    setManualSearchQuery('');
    setManualStatus('Hadir');
    setManualNote('Kamera HP bermasalah / tidak bisa scan');

    try {
      // 1. Fetch existing attendance records for this session
      const { data: currentRecs } = await supabase
        .from('attendance_records')
        .select('member_id, status')
        .eq('session_id', session.id);

      const attendedMap = new Map<string, string>();
      (currentRecs || []).forEach((r: any) => attendedMap.set(r.member_id, r.status));

      // 2. Fetch member IDs if session is division-specific
      let memberIds: string[] | null = null;
      if (session.division_id) {
        const { data: mdData, error: mdErr } = await supabase
          .from('member_divisions')
          .select('member_id')
          .eq('division_id', session.division_id)
          .eq('is_active', true);

        if (mdErr) throw mdErr;
        memberIds = (mdData || []).map((m: any) => m.member_id);
      }

      // 3. Fetch users and their member record
      let query = supabase
        .from('users')
        .select(`
          id, full_name, email,
          member_record:members (status)
        `)
        .eq('is_active', true);

      if (memberIds !== null) {
        if (memberIds.length === 0) {
          setManualStudentList([]);
          setSelectedManualMemberId('');
          setManualLoadingStudents(false);
          return;
        }
        query = query.in('id', memberIds);
      }

      const { data: usersData, error: uErr } = await query.order('full_name');
      if (uErr) throw uErr;

      const formatted = (usersData || []).map((u: any) => {
        const attended = attendedMap.has(u.id);
        return {
          id: u.id,
          full_name: u.full_name || 'Tanpa Nama',
          email: u.email || '',
          alreadyAttended: attended,
          currentStatus: attendedMap.get(u.id),
        };
      });

      setManualStudentList(formatted);
      const firstCandidate = formatted.find((s) => !s.alreadyAttended) || formatted[0];
      if (firstCandidate) {
        setSelectedManualMemberId(firstCandidate.id);
      } else {
        setSelectedManualMemberId('');
      }
    } catch (err: any) {
      console.error('Error fetching students for manual attendance:', err);
      setManualError(err.message || 'Gagal memuat daftar siswa.');
    } finally {
      setManualLoadingStudents(false);
    }
  };

  // Save manual attendance (insert or update)
  const handleSaveManualAttendance = async (continueNext = false) => {
    if (!targetSessionForManual || !selectedManualMemberId) {
      setManualError('Pilih siswa terlebih dahulu.');
      return;
    }

    setManualSaving(true);
    setManualError('');
    setManualSuccess('');

    try {
      const selectedStudent = manualStudentList.find((s) => s.id === selectedManualMemberId);
      const existing = attendees.find((a) => a.member_id === selectedManualMemberId);

      let recordId: string | null = null;
      const noteText = manualNote.trim() || 'Input manual (kendala kamera)';

      if (existing) {
        const { error: updErr } = await supabase
          .from('attendance_records')
          .update({
            status: manualStatus,
            verification_method: 'manual_correction',
            notes: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updErr) throw updErr;
        recordId = existing.id;
      } else {
        const { data: insData, error: insErr } = await supabase
          .from('attendance_records')
          .insert({
            session_id: targetSessionForManual.id,
            member_id: selectedManualMemberId,
            status: manualStatus,
            scan_time: new Date().toISOString(),
            verification_method: 'manual_correction',
            notes: noteText,
            created_by: profile?.id,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        recordId = insData?.id || null;
      }

      if (recordId) {
        await logAudit(
          'MANUAL_ATTENDANCE',
          'attendance_records',
          recordId,
          noteText,
          existing ? { status: existing.status } : null,
          {
            session_id: targetSessionForManual.id,
            member_id: selectedManualMemberId,
            status: manualStatus,
            student_name: selectedStudent?.full_name,
            reason: noteText,
          }
        );
      }

      if (activeSession && activeSession.id === targetSessionForManual.id) {
        await fetchAttendees(activeSession.id);
      }
      await fetchSessions();

      const studentName = selectedStudent?.full_name || 'Siswa';
      setManualSuccess(`Berhasil mencatat presensi untuk ${studentName} (${manualStatus}).`);

      setManualStudentList((prev) =>
        prev.map((s) =>
          s.id === selectedManualMemberId
            ? { ...s, alreadyAttended: true, currentStatus: manualStatus }
            : s
        )
      );

      if (continueNext) {
        const nextCandidate = manualStudentList.find(
          (s) => s.id !== selectedManualMemberId && !s.alreadyAttended
        );
        if (nextCandidate) {
          setSelectedManualMemberId(nextCandidate.id);
        }
      } else {
        setTimeout(() => {
          setShowManualModal(false);
          setManualSuccess('');
        }, 1100);
      }
    } catch (err: any) {
      console.error('Error saving manual attendance:', err);
      setManualError(err.message || 'Gagal menyimpan presensi manual.');
    } finally {
      setManualSaving(false);
    }
  };

  // Member Scan / Manual Code Attendance
  // Verifikasi kode presensi (tempel token QR / kode cadangan, atau hasil scan kamera)
  const runAttendanceCheck = async (rawCode: string, source: 'manual' | 'camera' = 'manual') => {
    if (!rawCode.trim()) return;
    if (!profile) return;

    setScanLoading(true);
    setScanResult(null);

    try {
      // Find currently open session matching student's enrolled division or general
      let targetSession = activeSession;
      if (!targetSession) {
        if (isMemberOnly && profile?.divisions && profile.divisions.length > 0) {
          const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
          targetSession = sessions.find(
            (s) => s.status === 'open' && (!s.division_id || myDivIds.has(s.division_id))
          ) || null;
        } else {
          targetSession = sessions.find((s) => s.status === 'open') || null;
        }
      }

      if (!targetSession) {
        setScanResult({
          success: false,
          message: 'Tidak ada sesi absensi yang sedang dibuka untuk divisi kamu saat ini.',
        });
        setScanLoading(false);
        return;
      }

      // Explicit division guard: Member of Division A cannot attend Division B sessions
      if (targetSession.division_id && isMemberOnly && profile?.divisions) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        if (!myDivIds.has(targetSession.division_id)) {
          const myDivNames = profile.divisions.map((d: any) => d.division?.name || 'terdaftar').join(', ');
          setScanResult({
            success: false,
            message: `Akses ditolak: Kamu hanya terdaftar di divisi "${myDivNames}". Kamu tidak berhak absen pada sesi divisi lain!`,
          });
          setScanLoading(false);
          return;
        }
      }

      // Check whether user pasted token or backup code
      let method: 'qr_scan' | 'backup_code' = 'qr_scan';
      let tokenToVerify = rawCode.trim();

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
        setScanResult(null);
        setScanInputCode('');
        setLastRecord({
          status: res.status || 'Hadir',
          scanTime: res.scan_time || new Date().toISOString(),
          method:
            method === 'backup_code'
              ? 'Kode cadangan'
              : source === 'camera'
                ? 'Kamera (pindai QR)'
                : 'Token QR',
          sessionTitle: targetSession.title,
          divisionName: targetSession.division_id
            ? (targetSession.division as any)?.name ||
              divisions.find((d: any) => d.id === targetSession!.division_id)?.name ||
              '-'
            : 'Umum (semua divisi)',
        });
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

  // Wrapper tombol form (tempel kode manual)
  const handleMemberSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAttendanceCheck(scanInputCode);
  };

  // Scanner kamera in-app. API kamera (getUserMedia) hanya tersedia di secure context,
  // yaitu HTTPS atau localhost — di plain HTTP browser tidak pernah menampilkan prompt izin.
  useEffect(() => {
    if (!cameraActive) return;
    let handled = false;

    const startScan = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'API kamera tidak tersedia. Buka aplikasi lewat alamat HTTPS (https://192.168.1.11:8899), bukan http://'
          );
        }
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 230 },
          (decodedText: string) => {
            if (handled) return;
            handled = true;
            void (async () => {
              try { await scanner.stop(); } catch {}
              scannerRef.current = null;
              setCameraActive(false);
              await runAttendanceCheck(decodedText, 'camera');
            })();
          },
          () => {}
        );
      } catch (err: any) {
        setCameraError(
          err?.message?.includes('HTTPS')
            ? err.message
            : 'Tidak dapat membuka kamera. Pastikan izin kamera situs ini diizinkan di browser HP, lalu coba lagi.'
        );
        setCameraActive(false);
      }
    };

    void startScan();

    return () => {
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) inst.stop().catch(() => {});
    };
  }, [cameraActive]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatWaktuAbsen = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner and Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-orens-600" />
            <span>Presensi QR Orens Solution</span>
          </h2>
          <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5">
            Kode QR berganti otomatis setiap 5 menit, mengikuti jam server.
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
            <p className="text-xs text-gray-700 dark:text-gray-200 mb-4">
              Masukkan token QR atau kode cadangan 6 digit yang ditampilkan oleh admin di depan ruangan.
            </p>

            {scanResult && (
              <div className="mb-4 p-3.5 rounded-xl border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{scanResult.message}</span>
              </div>
            )}

            {lastRecord ? (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </span>
                  <div>
                    <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                      Presensi Berhasil Tercatat
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Kehadiran {profile?.full_name || 'kamu'} sudah masuk ke rapor divisi.
                    </p>
                  </div>
                </div>

                <dl className="rounded-xl bg-white dark:bg-dark-900 border border-emerald-200 dark:border-emerald-900/40 divide-y divide-gray-100 dark:divide-dark-700 text-xs">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-gray-700 dark:text-gray-200">Status kehadiran</dt>
                    <dd>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          lastRecord.status === 'Hadir'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {lastRecord.status}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-gray-700 dark:text-gray-200 shrink-0">Waktu absen</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatWaktuAbsen(lastRecord.scanTime)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-gray-700 dark:text-gray-200 shrink-0">Sesi</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{lastRecord.sessionTitle}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-gray-700 dark:text-gray-200 shrink-0">Divisi</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{lastRecord.divisionName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-gray-700 dark:text-gray-200 shrink-0">Metode presensi</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{lastRecord.method}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setLastRecord(null)}
                  className="mt-4 w-full min-h-[44px] rounded-xl text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 transition-colors"
                >
                  Selesai, Kembali ke Menu Presensi
                </button>
              </div>
            ) : (
            <form onSubmit={handleMemberSubmitAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Kode Cadangan Sesi / Token QR
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-gray-600 dark:text-gray-200" />
                  <input
                    type="text"
                    value={scanInputCode}
                    onChange={(e) => setScanInputCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: AB12CD atau tempel token QR"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500 font-mono font-bold tracking-wider"
                    required
                  />
                </div>
                {/* Scanner kamera in-app */}
              <div className="mt-3">
                {!cameraActive && (
                  <button
                    type="button"
                    onClick={() => { setCameraError(''); setCameraActive(true); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl text-xs font-bold text-orens-700 bg-orens-50 dark:bg-orens-500/10 border border-orens-200 dark:border-orens-500/30 hover:bg-orens-100 dark:hover:bg-orens-500/20 active:bg-orens-200 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Pindai QR dengan Kamera HP</span>
                  </button>
                )}
                {cameraActive && (
                  <div className="space-y-2">
                    <div id="qr-reader" className="w-full rounded-xl overflow-hidden border border-gray-300 dark:border-dark-600" />
                    <p className="text-[11px] text-gray-700 dark:text-gray-200 text-center">
                      Arahkan QR dari layar pembina ke kamera. Pertama kali browser akan menanyakan izin kamera: pilih <strong className="text-gray-900 dark:text-gray-100">Izinkan / Allow</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCameraActive(false)}
                      className="w-full py-2 min-h-[44px] rounded-xl text-xs font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 active:bg-gray-200 dark:active:bg-dark-600 transition-colors"
                    >
                      Tutup Kamera
                    </button>
                  </div>
                )}
                {cameraError && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <CameraOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Kamera Bermasalah, atau Scan Gagal?</p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                     Ketik <strong>6 karakter Kode Cadangan</strong> dari layar pembina ke kolom di atas. Ini jalur darurat yang selalu bisa dipakai walau kamera/koneksi bermasalah.
                  </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={scanLoading || !scanInputCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {scanLoading ? 'Memproses Kehadiran...' : 'Kirim Presensi Sekarang'}
              </button>
            </form>
            )}
          </div>

          {/* Member Personal Attendance Log */}
          <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-orens-600" />
              <span>Riwayat Presensi Saya</span>
            </h3>

            {myHistory.length === 0 ? (
              <p className="text-xs text-gray-700 dark:text-gray-200 italic py-6 text-center">
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
                      <p className="text-[10px] text-gray-700 dark:text-gray-200">
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

              {/* Maximize to Modal Button */}
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 transition-colors shadow-sm"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Buka Mode Proyektor</span>
              </button>
            </div>

            {/* Right: Session Info & Live Attendees List */}
            <div className="flex-1 w-full space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Sesi Dibuka • Siap Dipindai
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {activeSession.title}
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-200">
                    Divisi: {activeSession.division?.name || 'Semua Divisi'} • Kategori: {activeSession.session_type} • Batas Telat: {activeSession.late_threshold_minutes} menit
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowQrModal(true)}
                    title="Buka QR dalam Mode Proyektor"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orens-700 dark:text-orens-300 bg-orens-50 dark:bg-orens-950/40 hover:bg-orens-100 dark:hover:bg-orens-900/60 rounded-xl border border-orens-200 dark:border-orens-800/40 transition-colors shadow-sm"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Mode Proyektor</span>
                  </button>

                  <button
                    onClick={() => refreshQrToken(activeSession.id)}
                    title="Segarkan Token QR Server Sekarang"
                    className="p-2 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600"
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
                  <span className="text-[11px] text-gray-700 dark:text-gray-200">Total Hadir</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {attendees.filter((a) => a.status === 'Hadir').length}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
                  <span className="text-[11px] text-gray-700 dark:text-gray-200">Terlambat</span>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {attendees.filter((a) => a.status === 'Terlambat').length}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
                  <span className="text-[11px] text-gray-700 dark:text-gray-200">Total Tercatat</span>
                  <p className="text-xl font-bold text-orens-600 dark:text-orens-400 mt-0.5">
                    {attendees.length}
                  </p>
                </div>
              </div>

              {/* Attendee Live Table */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                    Daftar Peserta Hadir (Pembaruan Otomatis):
                  </h4>
                  <button
                    type="button"
                    onClick={() => openManualAttendanceModal(activeSession)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-xl shadow-sm transition-colors self-start sm:self-auto"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Input Presensi Manual Siswa</span>
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {attendees.length === 0 ? (
                    <p className="text-xs text-gray-600 dark:text-gray-200 italic py-4 text-center">
                      Belum ada siswa yang memindai QR atau dicatat manual pada sesi ini.
                    </p>
                  ) : (
                    attendees.map((att) => (
                      <div
                        key={att.id}
                        className="px-3 py-2 bg-gray-50 dark:bg-dark-900/60 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {att.member_name}
                            </span>
                            {att.verification_method === 'manual_correction' && (
                              <span
                                title={att.notes || 'Input manual pembina'}
                                className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60"
                              >
                                Manual: {att.notes || 'Kamera HP'}
                              </span>
                            )}
                            {att.verification_method === 'backup_code' && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60">
                                Kode Cadangan
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-600 dark:text-gray-200">
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
            <span className="text-xs text-gray-700 dark:text-gray-200">
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
            <>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-200">
                <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-dark-700">
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
                            sess.session_type === 'Wajib'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}
                        >
                          {sess.session_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-200">
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
                              ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-200'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {sess.status === 'open' ? 'Buka' : sess.status === 'closed' ? 'Ditutup' : 'Terjadwal'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(sess.status === 'scheduled' || sess.status === 'draft') && canManageSessionRow(sess) && (
                          <button
                            onClick={() => handleOpenSession(sess)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                          >
                            <Play className="w-3 h-3" />
                            <span>Buka Sesi</span>
                          </button>
                        )}
                        {(sess.status === 'scheduled' || sess.status === 'draft') && !canManageSessionRow(sess) && (
                          <span className="text-[10px] italic text-gray-600 dark:text-gray-300">Gabungan (Pengurus)</span>
                        )}
                        {sess.status === 'open' && canManageSessionRow(sess) && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openManualAttendanceModal(sess)}
                              title="Input presensi manual untuk siswa berkendala kamera"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                            >
                              <UserPlus className="w-3 h-3 text-orens-600 dark:text-orens-400" />
                              <span>Manual</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveSession(sess);
                                setShowQrModal(true);
                              }}
                              title="Buka QR dalam Mode Proyektor"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orens-700 dark:text-orens-300 bg-orens-50 dark:bg-orens-950/40 border border-orens-200 dark:border-orens-800 rounded-lg shadow-sm hover:bg-orens-100"
                            >
                              <Maximize2 className="w-3 h-3" />
                              <span>Mode Proyektor</span>
                            </button>
                            <button
                              onClick={() => handleCloseSession(sess)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                            >
                              <Square className="w-3 h-3" />
                              <span>Tutup</span>
                            </button>
                          </div>
                        )}
                        {sess.status === 'open' && !canManageSessionRow(sess) && (
                          <span className="text-[10px] italic text-gray-600 dark:text-gray-300">Gabungan (Pengurus)</span>
                        )}
                        {sess.status === 'closed' && (
                          <span className="text-xs text-gray-600 dark:text-gray-200 italic">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: kartu sesi bertumpuk, menggantikan tabel */}
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-dark-700">
              {sessions.map((sess) => (
                <li key={sess.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-base text-gray-900 dark:text-gray-100">
                        {sess.title}
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5">
                        {sess.division?.name || 'Semua Divisi'} • {sess.date} • {sess.start_time} - {sess.end_time}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sess.status === 'open'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : sess.status === 'closed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-200'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {sess.status === 'open' ? 'Buka' : sess.status === 'closed' ? 'Ditutup' : 'Terjadwal'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        sess.session_type === 'Wajib'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}
                    >
                      {sess.session_type}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-orens-600 dark:text-orens-400 bg-gray-50 dark:bg-dark-900/60 border border-gray-200 dark:border-dark-700 px-2 py-0.5 rounded">
                      Kode: {sess.backup_code}
                    </span>
                  </div>

                  {canManageSessionRow(sess) && (sess.status === 'scheduled' || sess.status === 'draft' || sess.status === 'open') && (
                    <div className="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                      {(sess.status === 'scheduled' || sess.status === 'draft') && (
                        <button
                          onClick={() => handleOpenSession(sess)}
                          className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Buka Sesi</span>
                        </button>
                      )}
                      {sess.status === 'open' && (
                        <>
                          <button
                            onClick={() => openManualAttendanceModal(sess)}
                            title="Input presensi manual untuk siswa berkendala kamera"
                            className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-orens-600 dark:text-orens-400" />
                            <span>Manual</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveSession(sess);
                              setShowQrModal(true);
                            }}
                            title="Buka QR dalam Mode Proyektor"
                            className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-orens-700 dark:text-orens-300 bg-orens-50 dark:bg-orens-950/40 border border-orens-200 dark:border-orens-800 rounded-lg shadow-sm hover:bg-orens-100"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Mode Proyektor</span>
                          </button>
                          <button
                            onClick={() => handleCloseSession(sess)}
                            className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Tutup</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {!canManageSessionRow(sess) && (sess.status === 'scheduled' || sess.status === 'draft' || sess.status === 'open') && (
                    <p className="text-[11px] italic text-gray-600 dark:text-gray-300 mt-3 text-right">Gabungan: dikelola Pembina/Wakil/Sekre/Ketua</p>
                  )}
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      )}

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Buat Sesi Presensi Baru
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3.5 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  {isDivisionScoped ? 'Divisi Sesi:' : 'Divisi Khusus (Opsional):'}
                </label>
                <select
                  value={newDivisionId}
                  onChange={(e) => setNewDivisionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                >
                  <option value="">{isDivisionScoped ? 'Wajib pilih divisi' : 'Semua Divisi (Pertemuan Gabungan)'}</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
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

      {/* POP-UP MODAL QR CODE: CLEAN, HIGH-CONTRAST FOR PROJECTOR */}
      {showQrModal && activeSession && (
        <div
          ref={modalContainerRef}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-900/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Mode Proyektor Presensi QR"
        >
          <div
            className={`w-full bg-white text-gray-900 shadow-2xl flex flex-col ${
              isFullscreen
                ? 'max-w-3xl rounded-2xl p-6 sm:p-10 my-auto'
                : 'max-w-xl rounded-2xl p-5 sm:p-7'
            }`}
          >
            {/* Controls */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Presensi QR
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (F11 / Proyektor)'}
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeQrModal}
                  title="Tutup (Esc)"
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Tutup jendela presensi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Session Title & Metadata */}
            <div className="mt-3">
              <h2
                className={`font-bold tracking-tight text-gray-900 ${
                  isFullscreen ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'
                }`}
              >
                {activeSession.title}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {activeSession.division?.name || 'Semua Divisi'} &middot; {activeSession.session_type}
                {activeSession.late_threshold_minutes
                  ? ` &middot; telat lebih dari ${activeSession.late_threshold_minutes} menit dicatat Terlambat`
                  : ''}
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center py-5 sm:py-7">
              <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-gray-200">
                <canvas
                  ref={modalCanvasRef}
                  className="w-[230px] h-[230px] sm:w-[300px] sm:h-[300px] md:w-[340px] md:h-[340px] block"
                />
              </div>
              <p className={`text-gray-600 mt-3 ${isFullscreen ? 'text-base' : 'text-sm'}`}>
                Pindai dengan kamera HP siswa
              </p>
            </div>

            {/* Countdown & Backup Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex flex-col">
                <span className="text-[11px] text-gray-600">Kode QR berganti dalam</span>
                <span className="text-2xl font-mono font-bold text-orens-600 mt-0.5">
                  {formatSeconds(secondsLeft)}
                </span>
                <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-orens-500 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, (secondsLeft / 300) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5">
                <span className="text-[11px] text-gray-600">
                  Kamera kendala? Masukkan kode ini di aplikasi
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-2xl font-bold tracking-widest text-gray-900 select-all">
                    {activeSession.backup_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBackup}
                    title="Salin kode cadangan"
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    aria-label="Salin kode cadangan"
                  >
                    {copiedBackup ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer: Attendee Count & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                Hadir: <strong className="text-emerald-600">{attendees.length}</strong> siswa
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    closeQrModal();
                    openManualAttendanceModal(activeSession);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-gray-500" />
                  <span>Input Manual</span>
                </button>
                <button
                  type="button"
                  onClick={() => refreshQrToken(activeSession.id)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Segarkan</span>
                </button>
                <button
                  type="button"
                  onClick={closeQrModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT PRESENSI MANUAL SISWA (KENDALA KAMERA / PERANGKAT) */}
      {showManualModal && targetSessionForManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 max-w-lg w-full p-6 shadow-2xl relative text-gray-900 dark:text-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-dark-700 pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <UserPlus className="w-5 h-5 text-orens-600 dark:text-orens-400" />
                  <span>Input Presensi Manual Siswa</span>
                </h3>
                <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5">
                  Solusi resmi bila kamera HP siswa rusak, izin ditolak, atau kendala perangkat.
                </p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session Summary Card */}
            <div className="p-3 bg-gray-50 dark:bg-dark-900/60 rounded-xl border border-gray-200 dark:border-dark-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {targetSessionForManual.title}
                </span>
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Sesi {targetSessionForManual.status === 'open' ? 'Buka' : 'Terpilih'}
                </span>
              </div>
              <div className="text-[11px] text-gray-700 dark:text-gray-200">
                Divisi: <strong>{targetSessionForManual.division?.name || 'Semua Divisi'}</strong> • Kategori: <strong>{targetSessionForManual.session_type}</strong>
              </div>
            </div>

            {/* Feedback Alerts */}
            {manualError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}
            {manualSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{manualSuccess}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* Student Picker */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-200 mb-1">
                  Pilih Siswa / Anggota
                </label>

                {manualLoadingStudents ? (
                  <div className="py-4 text-center text-xs text-gray-600 dark:text-gray-200">
                    Memuat daftar siswa divisi...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Search filter for students */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-600 dark:text-gray-200" />
                      <input
                        type="text"
                        value={manualSearchQuery}
                        onChange={(e) => setManualSearchQuery(e.target.value)}
                        placeholder="Cari nama siswa..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                      />
                    </div>

                    <select
                      value={selectedManualMemberId}
                      onChange={(e) => setSelectedManualMemberId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {manualStudentList
                        .filter((s) => {
                          const q = manualSearchQuery.toLowerCase();
                          return (
                            !q ||
                            s.full_name.toLowerCase().includes(q) ||
                            s.email.toLowerCase().includes(q)
                          );
                        })
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} - {s.alreadyAttended ? `[Sudah: ${s.currentStatus || 'Hadir'}]` : '[Belum Presensi]'}
                          </option>
                        ))}
                    </select>

                    <div className="flex items-center justify-between text-[11px] text-gray-700 dark:text-gray-200">
                      <span>Total Siswa Divisi: <strong>{manualStudentList.length}</strong></span>
                      <span>Belum Hadir: <strong className="text-amber-600 dark:text-amber-400">{manualStudentList.filter(s => !s.alreadyAttended).length}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance Status Picker */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Hadir', 'Terlambat', 'Izin', 'Sakit'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManualStatus(st)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        manualStatus === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'Terlambat'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : st === 'Izin'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-dark-900 border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Preset Reasons */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  Alasan Cepat (Kendala Kamera / Perangkat)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Kamera HP bermasalah / blank',
                    'Izin kamera browser ditolak',
                    'Baterai HP siswa habis',
                    'Kendala jaringan / kuota',
                    'Hadir fisik di lokasi (konfirmasi pembina)',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setManualNote(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                        manualNote === preset
                          ? 'bg-orens-100 dark:bg-orens-950/60 text-orens-800 dark:text-orens-300 border-orens-400 dark:border-orens-700 font-bold'
                          : 'bg-gray-100 dark:bg-dark-700/60 text-gray-600 dark:text-gray-200 border-transparent hover:bg-gray-200 dark:hover:bg-dark-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Reason / Notes Input */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-200 mb-1">
                  Catatan / Keterangan Pembina
                </label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Tuliskan keterangan detail kendala siswa..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
                <p className="text-[10px] text-gray-600 dark:text-gray-200 mt-1">
                  Keterangan ini dicatat ke log audit dengan metode verifikasi <code>manual_correction</code>.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-gray-100 dark:border-dark-700 flex flex-wrap items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-3.5 py-2 rounded-xl text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 font-medium transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={manualSaving || !selectedManualMemberId}
                onClick={() => handleSaveManualAttendance(true)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-800 dark:text-gray-200 font-bold disabled:opacity-50 transition-colors"
              >
                {manualSaving ? 'Menyimpan...' : 'Simpan & Siswa Lain'}
              </button>
              <button
                type="button"
                disabled={manualSaving || !selectedManualMemberId}
                onClick={() => handleSaveManualAttendance(false)}
                className="px-4 py-2 rounded-xl bg-orens-600 hover:bg-orens-700 text-white font-bold disabled:opacity-50 transition-colors shadow-sm"
              >
                {manualSaving ? 'Menyimpan...' : 'Simpan Presensi Manual'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


