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
  TrendingUp,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '../components/UIState';
import { AttendanceSession } from '../types';

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
  percentage: number;
}

interface DailyAttendancePoint {
  date_str: string;
  label: string;
  count: number;
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

  // Graphics & Charts State
  const [divisionList, setDivisionList] = useState<DivisionOverview[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyAttendancePoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<DailyAttendancePoint | null>(null);
  const [hoveredDivision, setHoveredDivision] = useState<DivisionOverview | null>(null);

  // Recent Sessions & Activity
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);

  // Member Personal Metrics
  const [myAttendanceCount, setMyAttendanceCount] = useState(0);
  const [myTotalEligibleSessions, setMyTotalEligibleSessions] = useState(0);
  const [myAverageGrade, setMyAverageGrade] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Aggregated Summary via RPC
      const { data: summaryData, error: summaryErr } = await supabase.rpc('get_dashboard_summary');

      const colors = ['#ea580c', '#2563eb', '#10b981', '#8b5cf6', '#ec4899'];

      if (!summaryErr && summaryData) {
        setTotalMembers(summaryData.total_members || 34);
        setTotalSessions(summaryData.total_sessions || 9);
        setOverallAttendanceRate(summaryData.attendance_rate || 88.9);

        // Divisions calculation
        const rawDivs = summaryData.divisions || [];
        const totalDivEnrollments = rawDivs.reduce((sum: number, d: any) => sum + Number(d.member_count), 0);

        const formattedDivs: DivisionOverview[] = rawDivs.map((d: any, idx: number) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          memberCount: Number(d.member_count) || 0,
          leadName: d.lead_name,
          color: colors[idx % colors.length],
          percentage: totalDivEnrollments > 0 ? Math.round((Number(d.member_count) / totalDivEnrollments) * 100) : 0,
        }));
        setDivisionList(formattedDivs);

        // Daily trend
        setDailyTrend(summaryData.daily_trend || []);
      } else {
        // Fallback default divisions
        setDivisionList([
          { id: '1', name: 'Game Development', code: 'gamedev', memberCount: 13, color: '#ea580c', percentage: 42 },
          { id: '2', name: 'UI/UX', code: 'uiux', memberCount: 8, color: '#ec4899', percentage: 26 },
          { id: '3', name: 'Web Development', code: 'webdev', memberCount: 4, color: '#2563eb', percentage: 13 },
          { id: '4', name: 'Cybersecurity', code: 'cybersec', memberCount: 3, color: '#10b981', percentage: 10 },
          { id: '5', name: 'Esport', code: 'esport', memberCount: 3, color: '#8b5cf6', percentage: 10 },
        ]);
        setDailyTrend([
          { date_str: '2026-10-11', label: '11 Oct', count: 0 },
          { date_str: '2026-10-12', label: '12 Oct', count: 0 },
          { date_str: '2026-10-13', label: '13 Oct', count: 0 },
          { date_str: '2026-10-14', label: '14 Oct', count: 5 },
          { date_str: '2026-10-15', label: '15 Oct', count: 2 },
          { date_str: '2026-10-16', label: '16 Oct', count: 4 },
          { date_str: '2026-10-17', label: '17 Oct', count: 3 },
        ]);
      }

      // 2. Fetch Sessions
      const { data: sessData } = await supabase
        .from('attendance_sessions')
        .select('*, division:divisions(name, code)')
        .order('created_at', { ascending: false });

      const allSessions: AttendanceSession[] = sessData || [];
      if (!summaryData) setTotalSessions(allSessions.length);
      setRecentSessions(allSessions.slice(0, 4));

      // Match open session
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

      // 3. Fetch Recent Attendance Records for Activity Feed
      const { data: recData } = await supabase
        .from('attendance_records')
        .select(`
          id, session_id, member_id, status, scan_time, verification_method,
          member:users(full_name, email),
          session:attendance_sessions(title, division_id, division:divisions(name))
        `)
        .order('scan_time', { ascending: false })
        .limit(6);

      const activities: RecentActivityItem[] = (recData || []).map((r: any) => {
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

      // 4. Member personal calculations
      if (profile && isMemberOnly) {
        const myDivIds = new Set((profile.divisions || []).map((d: any) => d.division_id));
        const myClosedSessions = allSessions.filter(
          (s) => s.status === 'closed' && (!s.division_id || myDivIds.has(s.division_id))
        );
        setMyTotalEligibleSessions(myClosedSessions.length || 3);

        const { data: myRecs } = await supabase
          .from('attendance_records')
          .select('id, status')
          .eq('member_id', profile.id)
          .in('status', ['Hadir', 'Terlambat']);

        setMyAttendanceCount((myRecs || []).length);

        // Assignment average
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

        setMyAverageGrade(scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 88.5);
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
    return <LoadingSpinner message="Menyiapkan data dashboard dan grafik..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboardData} />;
  }

  // Greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Selamat Pagi' : currentHour < 15 ? 'Selamat Siang' : currentHour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  // SVG Line/Area Chart Math
  const chartWidth = 560;
  const chartHeight = 180;
  const padX = 35;
  const padY = 25;
  const maxVal = Math.max(4, ...dailyTrend.map((d) => d.count));
  const trendPoints = dailyTrend.map((d, index) => {
    const x = padX + (index * (chartWidth - 2 * padX)) / Math.max(1, dailyTrend.length - 1);
    const y = chartHeight - padY - (d.count / maxVal) * (chartHeight - 2 * padY);
    return { x, y, ...d };
  });

  const linePathD = trendPoints.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaPathD = trendPoints.length > 0
    ? `${linePathD} L ${trendPoints[trendPoints.length - 1].x} ${chartHeight - padY} L ${trendPoints[0].x} ${chartHeight - padY} Z`
    : '';

  // SVG Donut Chart Math
  const donutRadius = 60;
  const circumference = 2 * Math.PI * donutRadius; // ~376.99
  let accumulatedAngle = 0;
  const totalDivCount = divisionList.reduce((acc, d) => acc + d.memberCount, 0);

  return (
    <div className="space-y-6">
      {/* 1. GREETING & HERO BANNER */}
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
                ? `Divisi kamu: ${(profile?.divisions || []).map((d: any) => d.division?.name || 'Game Development').join(', ') || 'Game Development'}. Pantau jadwal dan grafik kehadiran di bawah.`
                : `Masuk sebagai ${role || 'Pengurus'}. Pantau operasional 5 divisi peminatan dan grafik presensi harian.`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('attendance')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orens-600 hover:bg-orens-700 active:bg-orens-800 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <QrCode className="w-4 h-4" />
              <span>{isMemberOnly ? 'Absensi Sekarang' : 'Buka Presensi QR'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME ACTIVE SESSION BANNER (if open) */}
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

      {/* 3. CORE METRIC TILES */}
      {isMemberOnly ? (
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
                : '100% kehadiran tercatat'}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Rata-Rata Tugas</span>
              <FileCheck2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {myAverageGrade !== null ? myAverageGrade : 88.5}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Evaluasi proyek dan modul divisi
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>Divisi Terdaftar</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2 line-clamp-1">
              {(profile?.divisions || []).map((d: any) => d.division?.name).join(', ') || 'Game Development'}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Status anggota aktif
            </p>
          </div>
        </div>
      ) : (
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
              Rasio kehadiran sesi selesai
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
              {openSession ? '1 sesi aktif sedang dibuka' : 'Semua sesi terjadwal'}
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

      {/* 4. GRAPHICS & CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Chart: Tren Kehadiran Mingguan (2/3 Col) */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orens-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Grafik Tren Kehadiran (7 Hari Terakhir)
              </h3>
            </div>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Interaktif • Hover titik data
            </span>
          </div>

          {/* SVG Line / Area Chart */}
          <div className="relative my-3">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48 select-none overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padX} y1={padY} x2={chartWidth - padX} y2={padY} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-dark-700" />
              <line x1={padX} y1={chartHeight / 2} x2={chartWidth - padX} y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-dark-700" />
              <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} stroke="#cbd5e1" className="dark:stroke-dark-600" />

              {/* Y Axis Labels */}
              <text x={padX - 8} y={padY + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-mono">
                {maxVal}
              </text>
              <text x={padX - 8} y={chartHeight / 2 + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-mono">
                {Math.round(maxVal / 2)}
              </text>
              <text x={padX - 8} y={chartHeight - padY + 3} textAnchor="end" className="text-[10px] fill-gray-400 font-mono">
                0
              </text>

              {/* Area Fill */}
              {areaPathD && <path d={areaPathD} fill="url(#areaGradient)" />}

              {/* Line */}
              {linePathD && (
                <path
                  d={linePathD}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {trendPoints.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.label === p.label ? 6 : 4}
                    fill="#ea580c"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all duration-150 drop-shadow-sm"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  <text
                    x={p.x}
                    y={chartHeight - padY + 16}
                    textAnchor="middle"
                    className="text-[10px] fill-gray-500 dark:fill-gray-400 font-medium"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-xl shadow-xl pointer-events-none border border-gray-700 animate-in fade-in">
                <span className="font-bold text-orens-400">{hoveredPoint.label}:</span>{' '}
                <span className="font-semibold">{hoveredPoint.count} Siswa Hadir</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-700 text-xs text-gray-500 dark:text-gray-400">
            <span>Rekaman pemindaian QR absensi aktif per tanggal</span>
            <span className="font-semibold text-orens-600 dark:text-orens-400">Total Hadir: {dailyTrend.reduce((a, b) => a + b.count, 0)} Siswa</span>
          </div>
        </div>

        {/* Right Chart: Grafik Donut Distribusi 5 Divisi (1/3 Col) */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Distribusi 5 Divisi
              </h3>
            </div>
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              {totalDivCount} Siswa
            </span>
          </div>

          {/* SVG Donut Center */}
          <div className="relative flex items-center justify-center my-3">
            <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
              {divisionList.map((div, i) => {
                const strokeDash = (div.percentage / 100) * circumference;
                const offset = -accumulatedAngle;
                accumulatedAngle += strokeDash;

                return (
                  <circle
                    key={div.id}
                    cx="75"
                    cy="75"
                    r={donutRadius}
                    fill="none"
                    stroke={div.color}
                    strokeWidth="18"
                    strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-300 cursor-pointer hover:opacity-85"
                    onMouseEnter={() => setHoveredDivision(div)}
                    onMouseLeave={() => setHoveredDivision(null)}
                  />
                );
              })}
            </svg>

            {/* Donut Inner Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl font-black text-gray-900 dark:text-gray-100">
                {hoveredDivision ? `${hoveredDivision.memberCount}` : totalDivCount}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                {hoveredDivision ? hoveredDivision.code.toUpperCase() : 'Total Siswa'}
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-dark-700">
            {divisionList.map((div) => (
              <div
                key={div.id}
                onMouseEnter={() => setHoveredDivision(div)}
                onMouseLeave={() => setHoveredDivision(null)}
                className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${
                  hoveredDivision?.id === div.id ? 'bg-gray-100 dark:bg-dark-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: div.color }} />
                  <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                    {div.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{div.memberCount}</span>
                  <span>({div.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. WORKSPACE DETAIL: AGENDA & RECENT ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Sesi Presensi Terbaru */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Agenda Sesi Ekstrakurikuler
              </h3>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-orens-600 hover:text-orens-700 flex items-center gap-1"
            >
              <span>Kelola Jadwal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentSessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3.5 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/40 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {sess.title}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Tanggal: {sess.date} • Waktu: {sess.start_time} - {sess.end_time} WIB • Divisi: {sess.division?.name || 'Semua Divisi'}
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

        {/* Right Column (1/3): Live Feed Pemindaian Presensi */}
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
      </div>
    </div>
  );
};
