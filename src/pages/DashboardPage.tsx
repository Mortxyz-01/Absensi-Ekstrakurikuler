import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Layers,
  QrCode,
  CalendarCheck,
  BookOpen,
  FileCheck2,
  Clock,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '../components/UIState';
import { AttendanceSession, Division } from '../types';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { profile, role, isMemberOnly } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState({
    totalMembers: 0,
    totalDivisions: 5,
    activeSessionsCount: 0,
    totalMaterials: 0,
    totalAssignments: 0,
  });

  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [memberAttendanceSummary, setMemberAttendanceSummary] = useState({
    attended: 0,
    total: 0,
    percentage: 0,
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch active attendance session
      const { data: activeSessData } = await supabase
        .from('attendance_sessions')
        .select('*, division:divisions(*)')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveSession(activeSessData || null);

      // 2. Fetch counts
      const [{ count: memCount }, { data: divData }, { count: matCount }, { count: assignCount }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('divisions').select('*').eq('is_active', true),
        supabase.from('learning_materials').select('*', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('is_published', true),
      ]);

      setStats({
        totalMembers: memCount || 0,
        totalDivisions: (divData || []).length,
        activeSessionsCount: activeSessData ? 1 : 0,
        totalMaterials: matCount || 0,
        totalAssignments: assignCount || 0,
      });

      setDivisions(divData || []);

      // 3. If member, fetch personal attendance summary
      if (profile && isMemberOnly) {
        const { count: attendedCount } = await supabase
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('member_id', profile.id)
          .in('status', ['Hadir', 'Terlambat']);

        const { count: finishedWajibCount } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'closed')
          .eq('activity_type', 'Wajib');

        const totalWajib = finishedWajibCount || 0;
        const attended = attendedCount || 0;
        const pct = totalWajib > 0 ? Math.round((attended / totalWajib) * 100) : 100;

        setMemberAttendanceSummary({
          attended,
          total: totalWajib,
          percentage: pct,
        });
      }
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError('Gagal memuat ringkasan dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  if (loading) {
    return <LoadingSpinner message="Memuat metrik dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboardData} />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-orens-600 to-orens-700 rounded-2xl p-6 text-white shadow-md shadow-orens-600/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                {role}
              </span>
              <span className="text-xs text-orens-100">
                Zona Waktu Asia/Jakarta (WIB)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Selamat Datang, {profile?.full_name}!
            </h2>
            <p className="text-xs sm:text-sm text-orens-100 mt-1 max-w-xl">
              Sistem manajemen terintegrasi untuk absensi QR dinamis, anggota, materi, dan penilaian otomatis.
            </p>
          </div>

          {activeSession && (
            <button
              onClick={() => onNavigate('attendance')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-orens-700 font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:bg-orens-50 transition-colors shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>{isMemberOnly ? 'Pindai QR Sekarang' : 'Buka Panel Sesi Aktif'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Session Notification Card */}
      {activeSession ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Sesi Presensi Sedang Berlangsung
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {activeSession.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Divisi: {activeSession.division?.name || 'Seluruh Anggota'} • Jenis: {activeSession.activity_type} • Kode Cadangan: <code className="font-mono font-bold text-orens-600 dark:text-orens-400">{activeSession.backup_code}</code>
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('attendance')}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 rounded-lg transition-colors shadow-sm"
          >
            {isMemberOnly ? 'Absen Sekarang' : 'Kelola Presensi'}
          </button>
        </div>
      ) : null}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Anggota</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
            {stats.totalMembers}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Siswa dan Pengurus Aktif</p>
        </div>

        <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Divisi Peminatan</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
            {stats.totalDivisions}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Maksimal 2 Divisi/Siswa</p>
        </div>

        <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Materi Terbit</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
            {stats.totalMaterials}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Modul Pembelajaran</p>
        </div>

        <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tugas Terjadwal</span>
            <div className="p-2 bg-orens-50 dark:bg-orens-950/40 text-orens-600 rounded-lg">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
            {stats.totalAssignments}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Bobot Nilai 60%</p>
        </div>
      </div>

      {/* Member Personal Summary or Admin Division Overview */}
      {isMemberOnly ? (
        <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-orens-600" />
            <span>Rekap Kehadiran Pribadi</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Sesi Wajib Selesai</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{memberAttendanceSummary.total} Sesi</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Kehadiran Kamu</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{memberAttendanceSummary.attended} Sesi</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400">Persentase Kehadiran</p>
              <p className="text-xl font-bold text-orens-600 dark:text-orens-400 mt-1">{memberAttendanceSummary.percentage}%</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-orens-600" />
              <span>5 Divisi Peminatan Ekstrakurikuler</span>
            </h3>
            <button
              onClick={() => onNavigate('divisions')}
              className="text-xs text-orens-600 hover:text-orens-700 font-semibold"
            >
              Lihat Rincian →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {divisions.map((div) => (
              <div
                key={div.id}
                className="p-3.5 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{div.name}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                    {div.code}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                  {div.description || 'Divisi peminatan Orens Solution'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('attendance')}
          className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-orens-500 transition-colors text-left shadow-sm"
        >
          <QrCode className="w-5 h-5 text-orens-600 mb-2" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Presensi QR</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Sesi dan pemindaian</p>
        </button>

        <button
          onClick={() => onNavigate('materials')}
          className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-orens-500 transition-colors text-left shadow-sm"
        >
          <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Materi Divisi</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Modul pembelajaran</p>
        </button>

        <button
          onClick={() => onNavigate('assignments')}
          className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-orens-500 transition-colors text-left shadow-sm"
        >
          <FileCheck2 className="w-5 h-5 text-emerald-600 mb-2" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Tugas & Nilai</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Evaluasi berkala</p>
        </button>

        <button
          onClick={() => onNavigate('grades')}
          className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-orens-500 transition-colors text-left shadow-sm"
        >
          <Shield className="w-5 h-5 text-purple-600 mb-2" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Kalkulasi Rapor</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Rumus 40% + 60%</p>
        </button>
      </div>
    </div>
  );
};
