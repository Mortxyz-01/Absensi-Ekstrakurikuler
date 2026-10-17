import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  QrCode,
  Layers,
  BookOpen,
  FileCheck2,
  Award,
  Activity,
  ChevronRight,
  Sparkles,
  Shield,
  UserCheck,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '../components/UIState';
import { AttendanceSession, Division } from '../types';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

interface DivisionOverview {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  leadName?: string;
  color: string;
}

interface RecentActivityItem {
  id: string;
  studentName: string;
  divisionName: string;
  scanTime: string;
  status: string;
  sessionTitle: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { profile, role, isMemberOnly } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Operational Metrics
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [overallAttendanceRate, setOverallAttendanceRate] = useState(0);
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null);

  // Division stats
  const [divisionList, setDivisionList] = useState<DivisionOverview[]>([]);

  // Recent Sessions
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);

  // Recent Live Attendance Activity
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);

  // Member Personal Metrics
  const [myAttendanceCount, setMyAttendanceCount] = useState(0);
  const [myTotalEligibleSessions, setMyTotalEligibleSessions] = useState(0);
  const [myAverageGrade, setMyAverageGrade] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Divisions
      const { data: divData, error: divErr } = await supabase
        .from('divisions')
        .select('*')
        .order('name');
      if (divErr) throw divErr;

      // 2. Fetch Users & Roles
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('id, full_name, email, role:roles(name)')
        .eq('is_active', true);
      if (uErr) throw uErr;

      const userMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      // 3. Fetch Member Divisions
      const { data: memDivData, error: mdErr } = await supabase
        .from('member_divisions')
        .select('member_id, division_id, classification, is_active')
        .eq('is_active', true);
      if (mdErr) throw mdErr;

      // Count members per division
      const divCountMap: Record<string, number> = {};
      const memberDivisionMap = new Map<string, string[]>();

      (memDivData || []).forEach((md: any) => {
        divCountMap[md.division_id] = (divCountMap[md.division_id] || 0) + 1;
        if (!memberDivisionMap.has(md.member_id)) {
          memberDivisionMap.set(md.member_id, []);
        }
        memberDivisionMap.get(md.member_id)!.push(md.division_id);
      });

      const colors = ['#ea580c', '#2563eb', '#10b981', '#8b5cf6', '#ec4899'];
      const formattedDivisions: DivisionOverview[] = (divData || []).map((d: any, idx: number) => {
        const lead = d.lead_id ? userMap.get(d.lead_id) : undefined;
        return {
          id: d.id,
          name: d.name,
          code: d.code,
          memberCount: divCountMap[d.id] || 0,
          leadName: lead?.full_name,
          color: colors[idx % colors.length],
        };
      });
      setDivisionList(formattedDivisions);
      setTotalMembers((usersData || []).length);

      // 4. Fetch Attendance Sessions
      const { data: sessData, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('*, division:divisions(name, code)')
        .order('created_at', { ascending: false });
      if (sErr) throw sErr;

      const allSessions: AttendanceSession[] = sessData || [];
      setTotalSessions(allSessions.length);
      setRecentSessions(allSessions.slice(0, 4));

      // Determine active open session
      // For member: strictly filter to their division or general
      if (isMemberOnly && profile?.divisions && profile.divisions.length > 0) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        const matchedOpen = allSessions.find(
          (s) => s.status === 'open' && (!s.division_id || myDivIds.has(s.division_id))
        );
        setOpenSession(matchedOpen || null);
      } else {
        const anyOpen = allSessions.find((s) => s.status === 'open');
        setOpenSession(anyOpen || null);
      }

      // 5. Fetch Attendance Records for Rate & Activity Feed
      const { data: recData, error: recErr } = await supabase
        .from('attendance_records')
        .select(`
          id, session_id, member_id, status, scan_time, verification_method,
          member:users(full_name, email),
          session:attendance_sessions(title, division_id, division:divisions(name))
        `)
        .order('scan_time', { ascending: false });
      if (recErr) throw recErr;

      const allRecords = recData || [];
      const attendedCount = allRecords.filter((r) => r.status === 'Hadir' || r.status === 'Terlambat').length;
      const rate = allRecords.length > 0 ? Math.round((attendedCount / allRecords.length) * 100) : 100;
      setOverallAttendanceRate(rate);

      // Format recent 5 activity scans
      const activities: RecentActivityItem[] = allRecords.slice(0, 5).map((r: any) => {
        const rawMem = Array.isArray(r.member) ? r.member[0] : r.member;
        const rawSess = Array.isArray(r.session) ? r.session[0] : r.session;
        const rawDiv = rawSess?.division ? (Array.isArray(rawSess.division) ? rawSess.division[0] : rawSess.division) : null;

        return {
          id: r.id,
          studentName: rawMem?.full_name || 'Siswa',
          divisionName: rawDiv?.name || 'Ekstrakurikuler',
          scanTime: r.scan_time ? new Date(r.scan_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
          status: r.status,
          sessionTitle: rawSess?.title || 'Sesi Presensi',
        };
      });
      setRecentActivities(activities);

      // 6. If Member: calculate personal stats
      if (profile && isMemberOnly) {
        const myDivIds = new Set((profile.divisions || []).map((d: any) => d.division_id));
        const mySessions = allSessions.filter(
          (s) => s.status === 'closed' && (!s.division_id || myDivIds.has(s.division_id))
        );
        setMyTotalEligibleSessions(mySessions.length);

        const myRecs = allRecords.filter((r) => r.member_id === profile.id && (r.status === 'Hadir' || r.status === 'Terlambat'));
        setMyAttendanceCount(myRecs.length);

        // Fetch assignment grades
        const { data: subData } = await supabase
          .from('assignment_submissions')
          .select('id, grade:assignment_grades(normalized_score)')
          .eq('member_id', profile.id);

        const scores: number[] = [];
        (subData || []).forEach((s: any) => {
          const rawG = Array.isArray(s.grade) ? s.grade[0] : s.grade;
          if (rawG?.normalized_score !== undefined && rawG?.normalized_score !== null) {
            scores.push(Number(rawG.normalized_score));
          }
        });

        if (scores.length > 0) {
          const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
          setMyAverageGrade(avg);
        } else {
          setMyAverageGrade(null);
        }
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Gagal memuat ringkasan portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  if (loading) {
    return <LoadingSpinner message="Menyiapkan data dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboardData} />;
  }

  // Greeting based on time
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Selamat Pagi' : currentHour < 15 ? 'Selamat Siang' : currentHour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  return (
    <div className="space-y-6">
      {/* 1. PURPOSEFUL WELCOME HEADER */}
      <div className="bg-gradient-to-r from-gray-900 via-dark-800 to-gray-900 text-white rounded-2xl p-6 sm:p-7 border border-gray-800 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-orens-600/30 text-orens-400 text-xs font-mono font-bold tracking-wide">
                Portal Ekstrakurikuler Orens
              </span>
              <span className="text-gray-400 text-xs">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {greeting}, {profile?.full_name}!
            </h1>

            <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl">
              {isMemberOnly
                ? `Kamu terdaftar di divisi ${(profile?.divisions || []).map((d: any) => d.division?.name).join(', ') || 'Ekstrakurikuler'}. Pantau jadwal dan presensi kamu di sini.`
                : `Masuk sebagai ${role || 'Pengurus'}. Kelola presensi, evaluasi siswa, dan monitoring aktivitas 5 divisi peminatan.`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isMemberOnly ? (
              <button
                onClick={() => onNavigate('attendance')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orens-600 hover:bg-orens-700 active:bg-orens-800 text-white text-xs font-bold transition-colors shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>Absensi Sekarang</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('attendance')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orens-600 hover:bg-orens-700 active:bg-orens-800 text-white text-xs font-bold transition-colors shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>Buka Presensi QR</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME ACTIVE SESSION ALERT (If open) */}
      {openSession && (
        <div className="bg-orens-50 dark:bg-orens-950/30 border-2 border-orens-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-orens-600 text-white rounded-xl shrink-0 shadow-sm">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-orens-700 dark:text-orens-400">
                  Sesi Presensi Sedang Dibuka
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {openSession.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Divisi: {openSession.division?.name || 'Semua Divisi'} • Kode Cadangan: <strong className="font-mono text-orens-700 dark:text-orens-400">{openSession.backup_code}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('attendance')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-xl transition-colors shadow-sm shrink-0 self-end sm:self-auto"
          >
            <span>{isMemberOnly ? 'Pindai / Masukkan Kode' : 'Buka Layar QR Pop-up'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. CORE METRICS - ADAPTIVE TO ROLE */}
      {isMemberOnly ? (
        /* Member Personalized Metrics */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Kehadiran Sesi Wajib</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {myAttendanceCount} <span className="text-sm font-semibold text-gray-400">/ {myTotalEligibleSessions} Sesi</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {myTotalEligibleSessions > 0
                ? `${Math.round((myAttendanceCount / myTotalEligibleSessions) * 100)}% kehadiran tercatat`
                : 'Belum ada sesi wajib yang selesai'}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Rata-Rata Tugas</span>
              <FileCheck2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {myAverageGrade !== null ? myAverageGrade : '-'}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {myAverageGrade !== null ? 'Evaluasi dari mentor divisi' : 'Belum ada tugas yang dinilai'}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Divisi Terdaftar</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2 line-clamp-1">
              {(profile?.divisions || []).map((d: any) => d.division?.name).join(', ') || 'Belum Terdaftar'}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Status anggota aktif
            </p>
          </div>
        </div>
      ) : (
        /* Staff / Admin Operational Metrics */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Total Siswa Terdaftar</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {totalMembers}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Tersebar di 5 divisi peminatan
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Tingkat Kehadiran</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {overallAttendanceRate}%
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Rasio hadir pada sesi selesai
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Total Sesi Pertemuan</span>
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {totalSessions}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {openSession ? '1 sesi aktif berlangsung' : 'Semua sesi terjadwal'}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Divisi Peminatan</span>
              <Layers className="w-4 h-4 text-orens-600" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {divisionList.length}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              1 Kadiv & 2 Mentor per divisi
            </p>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: 5 DIVISIONS OVERVIEW & RECENT SESSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): 5 Divisions Capacity & Recent Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* 5 Divisions Breakdown */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-orens-600" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Distribusi Siswa di 5 Divisi Peminatan
                </h3>
              </div>
              <button
                onClick={() => onNavigate('divisions')}
                className="text-xs font-semibold text-orens-600 hover:text-orens-700 flex items-center gap-1"
              >
                <span>Lihat Detail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {divisionList.map((div) => {
                const percentage = totalMembers > 0 ? Math.round((div.memberCount / totalMembers) * 100) : 0;

                return (
                  <div
                    key={div.id}
                    className="p-3.5 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50/60 dark:bg-dark-900/40 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                            {div.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                            {div.code.toUpperCase()}
                          </span>
                        </div>
                        {div.leadName && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Ketua Divisi: {div.leadName}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          {div.memberCount} Siswa
                        </span>
                        <span className="text-[11px] text-gray-400 ml-1.5 font-medium">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(8, percentage)}%`,
                          backgroundColor: div.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sesi Terjadwal & Riwayat */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Agenda Sesi Presensi Terbaru
                </h3>
              </div>
              <button
                onClick={() => onNavigate('attendance')}
                className="text-xs font-semibold text-orens-600 hover:text-orens-700 flex items-center gap-1"
              >
                <span>Kelola Presensi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {recentSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-3 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/40 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {sess.title}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Tanggal: {sess.date} • {sess.start_time} - {sess.end_time} WIB
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sess.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : sess.status === 'closed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {sess.status === 'open' ? 'Buka' : sess.status === 'closed' ? 'Selesai' : 'Terjadwal'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1/3): Real-Time Scan Feed & Quick Links */}
        <div className="space-y-6">
          {/* Live Recent Attendance Activity */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Presensi Terakhir
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Real-Time</span>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                Belum ada rekaman presensi terbaru.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-dark-700/60 bg-gray-50/50 dark:bg-dark-900/30 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {act.studentName}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                        {act.divisionName} • {act.scanTime} WIB
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        act.status === 'Hadir'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Access Menu */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-100 dark:border-dark-700">
              Navigasi Cepat
            </h3>

            <button
              onClick={() => onNavigate('grades')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-orens-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Rapor & Penilaian</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Formula Kehadiran 40% + Tugas 60%</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => onNavigate('materials')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Modul & Materi</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Silabus dan bahan ajar peminatan</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => onNavigate('assignments')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Tugas Divisi</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Pengumpulan dan penilaian proyek</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
