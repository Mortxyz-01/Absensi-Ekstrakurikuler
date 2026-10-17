import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  GraduationCap,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  Layers,
  CalendarCheck,
  FileCheck2,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState } from '../components/UIState';
import { Division, StudentGradeSummary } from '../types';

export const GradesPage: React.FC = () => {
  const { profile, isMemberOnly } = useAuth();
  const [summaries, setSummaries] = useState<StudentGradeSummary[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');

  const fetchGradesData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch divisions
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      setDivisions(divData || []);

      // 2. Fetch all members with their active divisions
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select(`
          id, full_name, email,
          role:roles (name),
          member_divisions:member_divisions (
            division_id, classification, is_active,
            division:divisions (name)
          )
        `)
        .order('full_name');

      if (uErr) throw uErr;

      // 3. Fetch finished/closed sessions with activity_type = 'Wajib'
      const { data: wajibSessions, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id, division_id, activity_type, status')
        .eq('status', 'closed')
        .eq('activity_type', 'Wajib');

      if (sErr) throw sErr;

      // 4. Fetch all attendance records
      const { data: attendanceRecords, error: attErr } = await supabase
        .from('attendance_records')
        .select('session_id, member_id, status');

      if (attErr) throw attErr;

      // 5. Fetch all published assignments
      const { data: assignmentsData, error: assErr } = await supabase
        .from('assignments')
        .select('id, division_id, weight, max_score')
        .eq('status', 'published');

      if (assErr) throw assErr;

      // 6. Fetch all assignment grades
      const { data: gradesData, error: grErr } = await supabase
        .from('assignment_grades')
        .select(`
          id, submission_id, normalized_score,
          submission:assignment_submissions (member_id, assignment_id)
        `)
        .eq('status', 'published');

      if (grErr) throw grErr;

      // Build data summaries per student
      const result: StudentGradeSummary[] = (usersData || [])
        // Only include Members or students
        .filter((u: any) => {
          const rawRole = Array.isArray(u.role) ? u.role[0] : u.role;
          return rawRole?.name === 'Member' || !isMemberOnly;
        })
        .map((u: any) => {
          const mDivs = (u.member_divisions || []).filter((md: any) => md.is_active);
          const divNames = mDivs.map((md: any) => {
            const rawD = Array.isArray(md.division) ? md.division[0] : md.division;
            return `${rawD?.name || 'Divisi'} (${md.classification})`;
          });

          // Wajib sessions relevant for this member
          // Wajib session is either general (division_id is null) or belongs to their Wajib division
          const wajibDiv = mDivs.find((md: any) => md.classification === 'Wajib');
          const relevantWajibSessions = (wajibSessions || []).filter((ws: any) => {
            if (!ws.division_id) return true; // General session
            return wajibDiv && ws.division_id === wajibDiv.division_id;
          });

          const totalWajibSessions = relevantWajibSessions.length;

          // Attended sessions: Hadir or Terlambat in relevant wajib sessions
          const relevantSessionIds = new Set(relevantWajibSessions.map((ws: any) => ws.id));
          const attendedSessionsCount = (attendanceRecords || []).filter(
            (ar: any) =>
              ar.member_id === u.id &&
              relevantSessionIds.has(ar.session_id) &&
              (ar.status === 'Hadir' || ar.status === 'Terlambat')
          ).length;

          // Attendance Percentage: (Hadir + Terlambat) / Total Sesi Wajib Selesai * 100%
          const attendancePercentage =
            totalWajibSessions > 0
              ? Math.round((attendedSessionsCount / totalWajibSessions) * 1000) / 10
              : null;

          // Assignment Score average
          const memberGrades = (gradesData || []).filter((g: any) => {
            const rawSub = Array.isArray(g.submission) ? g.submission[0] : g.submission;
            return rawSub?.member_id === u.id;
          });

          const assignmentAverage =
            memberGrades.length > 0
              ? Math.round(
                  (memberGrades.reduce((sum: number, g: any) => sum + Number(g.normalized_score), 0) /
                    memberGrades.length) *
                    10
                ) / 10
              : null;

          // Final Grade = (Kehadiran * 0.4) + (Nilai Tugas * 0.6)
          // PRD rule: "Jangan menghitung data yang belum tersedia sebagai nol otomatis. Tampilkan status penilaian yang belum lengkap."
          let finalGrade: number | null = null;
          let statusLabel: 'Lengkap' | 'Penilaian belum lengkap' = 'Penilaian belum lengkap';

          if (attendancePercentage !== null && assignmentAverage !== null) {
            finalGrade = Math.round((attendancePercentage * 0.4 + assignmentAverage * 0.6) * 10) / 10;
            statusLabel = 'Lengkap';
          }

          return {
            member_id: u.id,
            full_name: u.full_name,
            email: u.email,
            division_names: divNames,
            total_wajib_sessions: totalWajibSessions,
            attended_sessions: attendedSessionsCount,
            attendance_percentage: attendancePercentage,
            average_assignment_score: assignmentAverage,
            final_grade: finalGrade,
            status_label: statusLabel,
          };
        });

      setSummaries(result);
    } catch (err: any) {
      console.error('Grades fetch error:', err);
      setError(err.message || 'Gagal menghitung nilai.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradesData();
  }, [profile]);

  const filtered = summaries.filter((s) => {
    const matchSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchDiv =
      selectedDivision === 'ALL' ||
      s.division_names.some((dn) => dn.toLowerCase().includes(selectedDivision.toLowerCase()));

    return matchSearch && matchDiv;
  });

  const getPredicate = (score: number) => {
    if (score >= 85) return { grade: 'A', desc: 'Sangat Baik' };
    if (score >= 75) return { grade: 'B', desc: 'Baik' };
    if (score >= 60) return { grade: 'C', desc: 'Cukup' };
    return { grade: 'D', desc: 'Perlu Perbaikan' };
  };

  // If member, filter down to member's own card
  const mySummary = summaries.find((s) => s.member_id === profile?.id);

  return (
    <div className="space-y-6">
      {/* Formula Explanation Card */}
      <div className="bg-gradient-to-r from-gray-900 to-dark-800 text-white rounded-2xl p-6 shadow-md border border-gray-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-orens-600/30 text-orens-400 text-xs font-mono font-bold">
                Formula Penilaian PRD MVP
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Penilaian Otomatis Ekstrakurikuler
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xl">
              Nilai Akhir = (Persentase Kehadiran Wajib × 40%) + (Rata-rata Nilai Tugas × 60%).
            </p>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs space-y-1">
            <div>• Kehadiran: (Hadir + Terlambat) / Sesi Selesai × 100%</div>
            <div>• Kegiatan Opsional tidak mengurangi nilai Wajib</div>
            <div>• Data yang belum lengkap ditampilkan status spesifik</div>
          </div>
        </div>
      </div>

      {/* MEMBER PERSONAL REPORT CARD */}
      {isMemberOnly && mySummary && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Rapor Nilai Saya: {mySummary.full_name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Divisi: {mySummary.division_names.join(', ') || 'Belum terdaftar'}
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                mySummary.status_label === 'Lengkap'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {mySummary.status_label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-dark-900 rounded-xl border border-gray-100 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Kehadiran (40%)</span>
                <CalendarCheck className="w-4 h-4 text-orens-600" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
                {mySummary.attendance_percentage !== null ? `${mySummary.attendance_percentage}%` : 'Belum Ada Sesi'}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {mySummary.attended_sessions} dari {mySummary.total_wajib_sessions} sesi wajib selesai
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-dark-900 rounded-xl border border-gray-100 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Nilai Tugas (60%)</span>
                <FileCheck2 className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
                {mySummary.average_assignment_score !== null ? mySummary.average_assignment_score : 'Belum Dinilai'}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Rata-rata evaluasi tugas divisi
              </p>
            </div>

            <div className="p-4 bg-orens-50 dark:bg-orens-950/30 rounded-xl border border-orens-200 dark:border-orens-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs text-orens-800 dark:text-orens-300 font-semibold">Nilai Akhir</span>
                <Award className="w-4 h-4 text-orens-600" />
              </div>
              <p className="text-3xl font-black text-orens-700 dark:text-orens-400 mt-2">
                {mySummary.final_grade !== null ? mySummary.final_grade : '-'}
              </p>
              <p className="text-[11px] text-orens-700 dark:text-orens-300 mt-1">
                {mySummary.final_grade !== null
                  ? `Predikat: ${getPredicate(mySummary.final_grade).grade} (${getPredicate(mySummary.final_grade).desc})`
                  : 'Penilaian belum lengkap'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STAFF VIEW: ALL STUDENTS SUMMARY TABLE */}
      {!isMemberOnly && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari siswa berdasarkan nama atau email..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
              >
                <option value="ALL">Semua Divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Menghitung penilaian seluruh siswa..." />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchGradesData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Tidak Ada Data Siswa"
              description="Tidak ada data siswa yang cocok dengan filter."
            />
          ) : (
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                  <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                    <tr>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">Divisi Terdaftar</th>
                      <th className="py-3 px-4 text-center">Kehadiran (40%)</th>
                      <th className="py-3 px-4 text-center">Nilai Tugas (60%)</th>
                      <th className="py-3 px-4 text-center">Nilai Akhir</th>
                      <th className="py-3 px-4 text-center">Predikat</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                    {filtered.map((s) => {
                      const pred = s.final_grade !== null ? getPredicate(s.final_grade) : null;

                      return (
                        <tr key={s.member_id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {s.full_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {s.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs">
                            {s.division_names.length > 0 ? (
                              s.division_names.map((dn, i) => (
                                <div key={i} className="text-gray-700 dark:text-gray-300">
                                  {dn}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">Belum ada</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.attendance_percentage !== null ? (
                              <div>
                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                  {s.attendance_percentage}%
                                </span>
                                <div className="text-[10px] text-gray-400">
                                  {s.attended_sessions}/{s.total_wajib_sessions} sesi
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.average_assignment_score !== null ? (
                              <span className="font-bold text-gray-900 dark:text-gray-100">
                                {s.average_assignment_score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.final_grade !== null ? (
                              <span className="font-black text-base text-orens-600 dark:text-orens-400">
                                {s.final_grade}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Belum Lengkap</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {pred ? (
                              <span className="font-bold text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200">
                                {pred.grade}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                s.status_label === 'Lengkap'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {s.status_label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
