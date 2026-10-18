import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  Edit3,
  X,
  Check,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState, AuditPromptModal } from '../components/UIState';
import { supabase, logAudit } from '../lib/supabase';
import { Division, StudentGradeSummary } from '../types';

interface AssignmentOption {
  id: string;
  division_id: string;
  title: string;
  max_score: number;
}

export const GradesPage: React.FC = () => {
  const { profile, isMemberOnly, isTopAdmin, isDivisionScoped } = useAuth();
  const [summaries, setSummaries] = useState<StudentGradeSummary[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');

  // Direct Grading Modal for Ketua & Mentor
  const [gradingStudent, setGradingStudent] = useState<StudentGradeSummary | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [inputScore, setInputScore] = useState<number>(85);
  const [inputFeedback, setInputFeedback] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Reset Nilai Divisi (hanya Ketua/Pembina yang punya izin DELETE level top admin)
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDivId, setResetDivId] = useState('');
  const [resetCount, setResetCount] = useState<number | null>(null);
  const [resetAuditOpen, setResetAuditOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const userRole = profile?.role?.name;
  const canGrade =
    userRole === 'Ketua' ||
    userRole === 'Pembina' ||
    userRole === 'Ketua Divisi' ||
    userRole === 'Mentor';

  const fetchGradesData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch divisions
      const { data: divData, error: divErr } = await supabase
        .from('divisions')
        .select('*')
        .order('name');
      if (divErr) throw divErr;
      // Member & petugas divisi hanya melihat divisi yang mereka ikuti
      let divisionList = (divData || []) as any[];
      if ((isMemberOnly || isDivisionScoped) && profile?.divisions?.length) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        divisionList = divisionList.filter((d: any) => myDivIds.has(d.id));
      }
      setDivisions(divisionList);
      const divMap = new Map(divData.map((d: any) => [d.id, d.name]));

      // 2. Fetch all users with their roles separately
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('id, full_name, email, role:roles(name)')
        .order('full_name');
      if (uErr) throw uErr;

      // 3. Fetch active member_divisions separately
      const { data: memDivData, error: mdErr } = await supabase
        .from('member_divisions')
        .select('member_id, division_id, classification, is_active')
        .eq('is_active', true);
      if (mdErr) throw mdErr;

      const memberDivMap = new Map<string, any[]>();
      (memDivData || []).forEach((md: any) => {
        if (!memberDivMap.has(md.member_id)) memberDivMap.set(md.member_id, []);
        memberDivMap.get(md.member_id)!.push({
          division_id: md.division_id,
          classification: md.classification,
          division_name: divMap.get(md.division_id) || 'Divisi',
        });
      });

      // 4. Fetch closed sessions (session_type = 'Wajib')
      const { data: wajibSessions, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id, division_id, session_type, status')
        .eq('status', 'closed')
        .eq('session_type', 'Wajib');
      if (sErr) throw sErr;

      // 5. Fetch all attendance records
      const { data: attendanceRecords, error: attErr } = await supabase
        .from('attendance_records')
        .select('session_id, member_id, status');
      if (attErr) throw attErr;

      // 6. Fetch published assignments
      const { data: assignmentsData, error: assErr } = await supabase
        .from('assignments')
        .select('id, division_id, weight, max_score, title')
        .eq('status', 'published');
      if (assErr) throw assErr;
      setAssignments(assignmentsData || []);

      // 7. Fetch submissions & grades separately
      const { data: subsData } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, member_id');

      const subToMemberMap = new Map<string, string>();
      (subsData || []).forEach((s: any) => {
        subToMemberMap.set(s.id, s.member_id);
      });

      const { data: gradesData, error: grErr } = await supabase
        .from('assignment_grades')
        .select('id, submission_id, normalized_score')
        .eq('status', 'published');
      if (grErr) throw grErr;

      // Group normalized scores per member_id
      const memberScoresMap = new Map<string, number[]>();
      (gradesData || []).forEach((g: any) => {
        const memberId = subToMemberMap.get(g.submission_id);
        if (memberId) {
          if (!memberScoresMap.has(memberId)) memberScoresMap.set(memberId, []);
          memberScoresMap.get(memberId)!.push(Number(g.normalized_score));
        }
      });

      // Build data summaries per student (role Member)
      const result: StudentGradeSummary[] = (usersData || [])
        .filter((u: any) => {
          const rawRole = Array.isArray(u.role) ? u.role[0] : u.role;
          return rawRole?.name === 'Member';
        })
        .map((u: any) => {
          const mDivs = memberDivMap.get(u.id) || [];
          const divNames = mDivs.map((md: any) => `${md.division_name} (${md.classification})`);

          // Wajib sessions relevant for this member
          const wajibDiv = mDivs.find((md: any) => md.classification === 'Wajib');
          const relevantWajibSessions = (wajibSessions || []).filter((ws: any) => {
            if (!ws.division_id) return true;
            return wajibDiv && ws.division_id === wajibDiv.division_id;
          });

          const totalWajibSessions = relevantWajibSessions.length;
          const relevantSessionIds = new Set(relevantWajibSessions.map((ws: any) => ws.id));
          const attendedSessionsCount = (attendanceRecords || []).filter(
            (ar: any) =>
              ar.member_id === u.id &&
              relevantSessionIds.has(ar.session_id) &&
              (ar.status === 'Hadir' || ar.status === 'Terlambat')
          ).length;

          const attendancePercentage =
            totalWajibSessions > 0
              ? Math.round((attendedSessionsCount / totalWajibSessions) * 1000) / 10
              : null;

          const scores = memberScoresMap.get(u.id) || [];
          const assignmentAverage =
            scores.length > 0
              ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
              : null;

          let finalGrade: number | null = null;
          let statusLabel: 'Lengkap' | 'Penilaian belum lengkap' = 'Penilaian belum lengkap';

          if (attendancePercentage !== null && assignmentAverage !== null) {
            finalGrade = Math.round((attendancePercentage * 0.4 + assignmentAverage * 0.6) * 10) / 10;
            statusLabel = 'Lengkap';
          }

          return {
            member_id: u.id,
            full_name: u.full_name || 'Siswa',
            email: u.email || '',
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
      selectedDivision === 'ALL'
        ? (!isDivisionScoped || divisions.length === 0 || s.division_names.some((dn) => divisions.some((d) => dn.toLowerCase().includes(d.name.toLowerCase()))))
        : s.division_names.some((dn) => dn.toLowerCase().includes(selectedDivision.toLowerCase()));

    return matchSearch && matchDiv;
  });

  const getPredicate = (score: number) => {
    if (score >= 85) return { grade: 'A', desc: 'Sangat Baik' };
    if (score >= 75) return { grade: 'B', desc: 'Baik' };
    if (score >= 60) return { grade: 'C', desc: 'Cukup' };
    return { grade: 'D', desc: 'Perlu Perbaikan' };
  };

  // Open Direct Grading Modal
  const openDirectGradeModal = (student: StudentGradeSummary) => {
    setGradingStudent(student);
    setInputScore(85);
    setInputFeedback('Bagus, pertahankan.');

    // Filter assignments that match student's division or all
    const matchingAssignments = assignments.filter((a) =>
      student.division_names.some((dn) => {
        const divObj = divisions.find((d) => d.id === a.division_id);
        return divObj && dn.includes(divObj.name);
      })
    );

    if (matchingAssignments.length > 0) {
      setSelectedAssignmentId(matchingAssignments[0].id);
    } else if (assignments.length > 0) {
      setSelectedAssignmentId(assignments[0].id);
    }
  };

  // Save Direct Grade
  const handleSaveDirectGrade = async () => {
    if (!gradingStudent || !selectedAssignmentId || !profile) return;
    setSaveLoading(true);

    try {
      // 1. Check or create submission
      const { data: existingSub } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('assignment_id', selectedAssignmentId)
        .eq('member_id', gradingStudent.member_id)
        .maybeSingle();

      let submissionId = existingSub?.id;
      if (!submissionId) {
        const { data: newSub, error: subErr } = await supabase
          .from('assignment_submissions')
          .insert({
            assignment_id: selectedAssignmentId,
            member_id: gradingStudent.member_id,
            status: 'submitted',
            submission_text: 'Dinilai langsung oleh Ketua/Mentor',
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (subErr) throw subErr;
        submissionId = newSub.id;
      }

      // 2. Insert or update grade
      const scoreNum = Number(inputScore);
      const { error: grErr } = await supabase.from('assignment_grades').upsert(
        {
          submission_id: submissionId,
          grader_id: profile.id,
          raw_score: scoreNum,
          normalized_score: scoreNum,
          feedback: inputFeedback.trim() || null,
          status: 'published',
          graded_at: new Date().toISOString(),
        },
        { onConflict: 'submission_id' }
      );

      if (grErr) throw grErr;

      setActionSuccess(`Nilai tugas berhasil disimpan untuk ${gradingStudent.full_name}`);
      setTimeout(() => setActionSuccess(''), 4000);
      setGradingStudent(null);
      fetchGradesData();
    } catch (err: any) {
      alert('Gagal menyimpan nilai: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const mySummary = summaries.find((s) => s.member_id === profile?.id);

  // ==== Reset Nilai Divisi (hanya Ketua/Pembina, izin DELETE di level top admin DB) ====
  useEffect(() => {
    if (!resetOpen || !resetDivId) {
      setResetCount(null);
      return;
    }
    let active = true;
    const scopeAssignments =
      resetDivId === 'ALL'
        ? assignments
        : assignments.filter((a: any) => a.division_id === resetDivId);
    const assignIds = scopeAssignments.map((a: any) => a.id);
    if (assignIds.length === 0) {
      setResetCount(0);
      return;
    }
    void (async () => {
      const { data: subs, error: sErr } = await supabase
        .from('assignment_submissions')
        .select('id')
        .in('assignment_id', assignIds);
      if (sErr || !subs || subs.length === 0) {
        if (active) setResetCount(0);
        return;
      }
      const subIds = subs.map((s: any) => s.id);
      const { count, error } = await supabase
        .from('assignment_grades')
        .select('id', { count: 'exact', head: true })
        .in('submission_id', subIds);
      if (active) setResetCount(error ? null : count || 0);
    })();
    return () => {
      active = false;
    };
  }, [resetOpen, resetDivId, assignments]);

  const resetDivName = resetDivId === 'ALL' ? 'Semua Divisi' : divisions.find((d: any) => d.id === resetDivId)?.name || '-';

  const handleConfirmResetGrades = async (reason: string) => {
    if (!resetDivId) return;
    setResetLoading(true);
    try {
      const scopeAssignments =
        resetDivId === 'ALL'
          ? assignments
          : assignments.filter((a: any) => a.division_id === resetDivId);
      const assignIds = scopeAssignments.map((a: any) => a.id);
      if (assignIds.length === 0) {
        setResetAuditOpen(false);
        setResetOpen(false);
        setActionSuccess('');
        setError(
          resetDivId === 'ALL'
            ? 'Belum ada tugas di divisi manapun, tidak ada nilai yang bisa direset.'
            : 'Divisi ini belum memiliki tugas, tidak ada nilai yang bisa direset.'
        );
        return;
      }

      const { data: subs, error: sErr } = await supabase
        .from('assignment_submissions')
        .select('id')
        .in('assignment_id', assignIds);
      if (sErr) throw sErr;
      const subIds = (subs || []).map((s: any) => s.id);
      if (subIds.length === 0) {
        setResetAuditOpen(false);
        setResetOpen(false);
        setActionSuccess('');
        setError(
          resetDivId === 'ALL'
            ? 'Belum ada siswa yang mengumpulkan tugas, tidak ada nilai yang bisa direset.'
            : 'Divisi ini belum memiliki pengumpulan tugas, tidak ada nilai yang bisa direset.'
        );
        return;
      }

      // Snapshot data lama untuk log audit sebelum dihapus
      const { data: oldGrades, error: oldErr } = await supabase
        .from('assignment_grades')
        .select('id, submission_id, raw_score, normalized_score, status')
        .in('submission_id', subIds);
      if (oldErr) throw oldErr;

      const { data: deleted, error: delErr } = await supabase
        .from('assignment_grades')
        .delete()
        .in('submission_id', subIds)
        .select('id');
      if (delErr) throw delErr;

      await logAudit('RESET_GRADES', 'assignment_grades', resetDivId === 'ALL' ? 'ALL' : resetDivId, reason, {
        division: resetDivName,
        deleted_count: (oldGrades || []).length,
        grades: oldGrades || [],
      }, { division: resetDivName });

      setResetAuditOpen(false);
      setResetOpen(false);
      setError('');
      setActionSuccess(
        resetDivId === 'ALL'
          ? `Nilai semua divisi berhasil direset. ${(deleted || []).length} penilaian dihapus; Nilai Akhir akan dihitung ulang dari sisa data.`
          : `Nilai divisi ${resetDivName} berhasil direset. ${(deleted || []).length} penilaian dihapus; Nilai Akhir akan dihitung ulang dari sisa data.`
      );
      fetchGradesData();
    } catch (err: any) {
      setResetAuditOpen(false);
      setError(err.message || 'Gagal mereset nilai.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formula Explanation Card */}
      <div className="bg-gradient-to-r from-gray-900 to-dark-800 text-white rounded-2xl p-6 shadow-md border border-gray-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Penilaian Otomatis Ekstrakurikuler
            </h2>
            <p className="text-xs text-gray-200 mt-1 max-w-xl">
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
              <p className="text-xs text-gray-700 dark:text-gray-200">
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
                <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold">Kehadiran (40%)</span>
                <CalendarCheck className="w-4 h-4 text-orens-600" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
                {mySummary.attendance_percentage !== null ? `${mySummary.attendance_percentage}%` : 'Belum Ada Sesi'}
              </p>
              <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1">
                {mySummary.attended_sessions} dari {mySummary.total_wajib_sessions} sesi wajib selesai
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-dark-900 rounded-xl border border-gray-100 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold">Nilai Tugas (60%)</span>
                <FileCheck2 className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
                {mySummary.average_assignment_score !== null ? mySummary.average_assignment_score : 'Belum Dinilai'}
              </p>
              <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1">
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
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-600 dark:text-gray-200" />
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
                <option value="ALL">{isMemberOnly || isDivisionScoped ? 'Semua Divisi Saya' : 'Semua Divisi'}</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              {isTopAdmin && (
                <button
                  onClick={() => { setResetDivId(''); setResetCount(null); setResetOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-bold rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 active:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset Nilai Divisi</span>
                </button>
              )}
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
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-200">
                  <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-dark-700">
                    <tr>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">Divisi Terdaftar</th>
                      <th className="py-3 px-4 text-center">Kehadiran (40%)</th>
                      <th className="py-3 px-4 text-center">Nilai Tugas (60%)</th>
                      <th className="py-3 px-4 text-center">Nilai Akhir</th>
                      <th className="py-3 px-4 text-center">Predikat</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      {canGrade && <th className="py-3 px-4 text-right">Aksi Penilaian</th>}
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
                            <div className="text-xs text-gray-700 dark:text-gray-200">
                              {s.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs">
                            {s.division_names.length > 0 ? (
                              s.division_names.map((dn, i) => (
                                <div key={i} className="text-gray-700 dark:text-gray-200">
                                  {dn}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-600 dark:text-gray-200 italic">Belum ada</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.attendance_percentage !== null ? (
                              <div>
                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                  {s.attendance_percentage}%
                                </span>
                                <div className="text-[10px] text-gray-600 dark:text-gray-200">
                                  {s.attended_sessions}/{s.total_wajib_sessions} sesi
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600 dark:text-gray-200">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.average_assignment_score !== null ? (
                              <span className="font-bold text-gray-900 dark:text-gray-100">
                                {s.average_assignment_score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600 dark:text-gray-200">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {s.final_grade !== null ? (
                              <span className="font-black text-base text-orens-600 dark:text-orens-400">
                                {s.final_grade}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600 dark:text-gray-200 italic">Belum Lengkap</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {pred ? (
                              <span className="font-bold text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200">
                                {pred.grade}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600 dark:text-gray-200">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
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

                          {canGrade && (
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => openDirectGradeModal(s)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-orens-700 dark:text-orens-300 bg-orens-50 dark:bg-orens-950/40 hover:bg-orens-100 dark:hover:bg-orens-900/60 transition-colors border border-orens-200 dark:border-orens-800/40"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Beri Nilai</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: kartu nilai bertumpuk */}
              <ul className="md:hidden divide-y divide-gray-100 dark:divide-dark-700">
                {filtered.map((s) => {
                  const pred = s.final_grade !== null ? getPredicate(s.final_grade) : null;
                  return (
                    <li key={s.member_id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-base text-gray-900 dark:text-gray-100">
                            {s.full_name}
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-200 truncate">{s.email}</p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            s.status_label === 'Lengkap'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {s.status_label}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                        {s.division_names.length > 0 ? s.division_names.join(' • ') : 'Belum ada divisi'}
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="rounded-xl bg-gray-50 dark:bg-dark-900/60 border border-gray-100 dark:border-dark-700 p-2">
                          <div className="text-[10px] text-gray-600 dark:text-gray-200">Kehadiran</div>
                          <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            {s.attendance_percentage !== null ? `${s.attendance_percentage}%` : '-'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 dark:bg-dark-900/60 border border-gray-100 dark:border-dark-700 p-2">
                          <div className="text-[10px] text-gray-600 dark:text-gray-200">Rata-rata Tugas</div>
                          <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            {s.average_assignment_score !== null ? s.average_assignment_score : '-'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-orens-50 dark:bg-orens-950/40 border border-orens-100 dark:border-orens-900/40 p-2">
                          <div className="text-[10px] text-orens-700 dark:text-orens-300">Nilai Akhir</div>
                          <div className="font-black text-base text-orens-600 dark:text-orens-400">
                            {s.final_grade !== null ? s.final_grade : 'Belum Ada'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                          Predikat: {pred ? pred.grade : '-'}
                        </span>
                        {canGrade && (
                          <button
                            onClick={() => openDirectGradeModal(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold text-orens-700 dark:text-orens-300 bg-orens-50 dark:bg-orens-950/40 hover:bg-orens-100 dark:hover:bg-orens-900/60 transition-colors border border-orens-200 dark:border-orens-800/40"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Beri Nilai</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* DIRECT GRADING MODAL FOR KETUA & MENTOR */}
      {gradingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl max-w-md w-full border border-gray-200 dark:border-dark-700 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orens-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Input Nilai Tugas Siswa
                </h3>
              </div>
              <button
                onClick={() => setGradingStudent(null)}
                className="p-1 rounded-lg text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-dark-900/60 rounded-xl border border-gray-100 dark:border-dark-700 text-xs">
              <div className="font-bold text-gray-900 dark:text-gray-100">{gradingStudent.full_name}</div>
              <div className="text-gray-700 dark:text-gray-200">{gradingStudent.email}</div>
              <div className="text-orens-600 dark:text-orens-400 mt-1 font-semibold">
                {gradingStudent.division_names.join(', ')}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveDirectGrade();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                  Pilih Tugas Divisi
                </label>
                {assignments.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                    Belum ada tugas divisi yang dibuat. Buat tugas terlebih dahulu di menu Tugas.
                  </p>
                ) : (
                  <select
                    value={selectedAssignmentId}
                    onChange={(e) => setSelectedAssignmentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  >
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} (Maks: {a.max_score})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    Nilai Tugas (Skala 0 - 100)
                  </label>
                  <span className="text-xs font-mono font-bold text-orens-600 dark:text-orens-400">
                    {inputScore}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputScore}
                  onChange={(e) => setInputScore(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                  Catatan / Umpan Balik Mentor
                </label>
                <textarea
                  value={inputFeedback}
                  onChange={(e) => setInputFeedback(e.target.value)}
                  rows={2}
                  placeholder="Bagus, pemahaman konsep sudah tepat..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingStudent(null)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveLoading || !selectedAssignmentId}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saveLoading ? 'Menyimpan...' : 'Simpan Nilai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET NILAI DIVISI: pemilih divisi (hanya Ketua/Pembina) */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Reset Nilai Divisi
            </h3>
            <div className="my-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Ini menghapus <strong>{resetDivId === 'ALL' ? 'seluruh penilaian tugas semua divisi' : 'seluruh penilaian tugas divisi terpilih'}</strong> dari semua siswa. Tindakan ini tidak dapat dibatalkan dan seluruh isi penilaian akan disimpan dalam Log Audit.
              </span>
            </div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Divisi yang direset
            </label>
            <select
              value={resetDivId}
              onChange={(e) => setResetDivId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
            >
              <option value="">Pilih divisi...</option>
              <option value="ALL">Semua divisi</option>
              {divisions.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {resetDivId && (
              <p className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                Penilaian yang akan dihapus: <strong>{resetCount === null ? 'menghitung...' : resetCount}</strong>
                {resetCount === 0 && ' (belum ada pengumpulan tugas di divisi ini)'}
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setResetOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!resetDivId || resetCount === 0 || resetCount === null}
                onClick={() => setResetAuditOpen(true)}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                Lanjut ke Konfirmasi Audit
              </button>
            </div>
          </div>
        </div>
      )}

      <AuditPromptModal
        isOpen={resetAuditOpen}
        title="Konfirmasi Reset Nilai"
        description={
          resetDivId === 'ALL'
            ? 'Seluruh penilaian tugas pada semua divisi akan dihapus permanen. Tulis alasan resmi untuk Log Audit, lalu konfirmasi.'
            : `Seluruh penilaian tugas pada divisi "${resetDivName}" akan dihapus permanen. Tulis alasan resmi untuk Log Audit, lalu konfirmasi.`
        }
        onConfirm={handleConfirmResetGrades}
        onCancel={() => setResetAuditOpen(false)}
      />
    </div>
  );
};
