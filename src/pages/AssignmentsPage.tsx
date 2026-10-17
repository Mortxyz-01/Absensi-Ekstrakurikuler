import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, logAudit } from '../lib/supabase';
import {
  FileCheck2,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Award,
  X,
  Search,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState } from '../components/UIState';
import { Division } from '../types';

interface AssignmentItem {
  id: string;
  division_id: string;
  title: string;
  description: string;
  weight: number;
  max_score: number;
  due_date: string;
  status: 'draft' | 'published' | 'closed';
  division?: { name: string; code: string };
  mySubmission?: {
    id: string;
    submission_text?: string;
    submitted_at: string;
    grade?: {
      raw_score: number;
      normalized_score: number;
      feedback?: string;
    };
  };
}

export const AssignmentsPage: React.FC = () => {
  const { profile, canManageAssignments, isMemberOnly } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');

  // Create Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDivisionId, setNewDivisionId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newWeight, setNewWeight] = useState(1);
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [saving, setSaving] = useState(false);

  // Member Submit Modal
  const [submittingAssignment, setSubmittingAssignment] = useState<AssignmentItem | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitSaving, setSubmitSaving] = useState(false);

  // Staff Grading Modal
  const [gradingAssignment, setGradingAssignment] = useState<AssignmentItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(85);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeSaving, setGradeSaving] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      setDivisions(divData || []);
      if (divData && divData.length > 0 && !newDivisionId) {
        setNewDivisionId(divData[0].id);
      }

      // Fetch assignments
      const { data, error: assErr } = await supabase
        .from('assignments')
        .select('*, division:divisions(name, code)')
        .order('due_date', { ascending: false });

      if (assErr) throw assErr;

      // If member, also fetch personal submissions and grades
      let mySubsMap: Record<string, any> = {};
      if (profile) {
        const { data: subData } = await supabase
          .from('assignment_submissions')
          .select(`
            id, assignment_id, submission_text, submitted_at,
            grade:assignment_grades (raw_score, normalized_score, feedback)
          `)
          .eq('member_id', profile.id);

        (subData || []).forEach((s: any) => {
          const rawGrade = Array.isArray(s.grade) ? s.grade[0] : s.grade;
          mySubsMap[s.assignment_id] = {
            id: s.id,
            submission_text: s.submission_text,
            submitted_at: s.submitted_at,
            grade: rawGrade,
          };
        });
      }

      const formatted: AssignmentItem[] = (data || []).map((a: any) => ({
        ...a,
        mySubmission: mySubsMap[a.id] || null,
      }));

      setAssignments(formatted);
    } catch (err: any) {
      console.error('Fetch assignments error:', err);
      setError(err.message || 'Gagal memuat tugas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [profile]);

  const filtered = assignments.filter((a) => {
    if (selectedDivision === 'ALL') return true;
    return a.division_id === selectedDivision;
  });

  // Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDivisionId || !newDueDate) return;

    setSaving(true);
    try {
      const { error: insErr } = await supabase.from('assignments').insert({
        title: newTitle.trim(),
        description: newDesc.trim() || 'Kerjakan tugas sesuai instruksi materi.',
        division_id: newDivisionId,
        weight: Number(newWeight),
        max_score: Number(newMaxScore),
        due_date: new Date(newDueDate).toISOString(),
        status: 'published',
        creator_id: profile?.id,
      });

      if (insErr) throw insErr;

      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      fetchAssignments();
    } catch (err: any) {
      alert('Gagal membuat tugas: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Member Submit Assignment
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment || !submissionText.trim() || !profile) return;

    setSubmitSaving(true);
    try {
      const { error: subErr } = await supabase.from('assignment_submissions').upsert({
        assignment_id: submittingAssignment.id,
        member_id: profile.id,
        submission_text: submissionText.trim(),
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });

      if (subErr) throw subErr;

      setSubmittingAssignment(null);
      setSubmissionText('');
      fetchAssignments();
    } catch (err: any) {
      alert('Gagal mengirim jawaban tugas: ' + err.message);
    } finally {
      setSubmitSaving(false);
    }
  };

  // Open Staff Grading Modal
  const openGradingModal = async (a: AssignmentItem) => {
    setGradingAssignment(a);
    setGradingSubId(null);
    try {
      // 1. Fetch all active members in this division
      const { data: memDivData } = await supabase
        .from('member_divisions')
        .select('member_id')
        .eq('division_id', a.division_id)
        .eq('is_active', true);

      const memberIds = (memDivData || []).map((m: any) => m.member_id);

      // 2. Fetch users info for these members
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, role:roles(name)')
        .in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

      const userMap = new Map<string, any>();
      (usersData || []).forEach((u: any) => {
        const rawRole = Array.isArray(u.role) ? u.role[0] : u.role;
        // Only include Members or students
        if (rawRole?.name === 'Member') {
          userMap.set(u.id, u);
        }
      });

      // 3. Fetch submissions for this assignment
      const { data: subsData } = await supabase
        .from('assignment_submissions')
        .select(`
          id, assignment_id, member_id, submission_text, submitted_at,
          member:users (full_name, email),
          grade:assignment_grades (id, raw_score, normalized_score, feedback)
        `)
        .eq('assignment_id', a.id);

      const existingSubsMap = new Map<string, any>();
      (subsData || []).forEach((s: any) => {
        existingSubsMap.set(s.member_id, s);
      });

      // 4. Combine into complete student grading list
      const combinedList: any[] = [];
      userMap.forEach((u, memberId) => {
        const existing = existingSubsMap.get(memberId);
        if (existing) {
          combinedList.push(existing);
        } else {
          combinedList.push({
            id: 'temp_' + memberId,
            assignment_id: a.id,
            member_id: memberId,
            submission_text: 'Belum mengirimkan jawaban (dapat dinilai langsung oleh mentor)',
            submitted_at: new Date().toISOString(),
            member: { full_name: u.full_name, email: u.email },
            grade: null,
          });
        }
      });

      setSubmissionsList(combinedList);
    } catch (err) {
      console.error('Error fetching submissions for grading:', err);
    }
  };

  // Save Grade
  const handleSaveGrade = async (submissionId: string, memberId?: string) => {
    if (!profile || !gradingAssignment) return;
    setGradeSaving(true);
    try {
      let targetSubId = submissionId;

      // If virtual submission, create assignment_submissions row first
      if (submissionId.startsWith('temp_')) {
        const actualMemberId = memberId || submissionId.replace('temp_', '');
        const { data: newSub, error: subErr } = await supabase
          .from('assignment_submissions')
          .insert({
            assignment_id: gradingAssignment.id,
            member_id: actualMemberId,
            submission_text: 'Dinilai langsung oleh Ketua/Mentor',
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (subErr) throw subErr;
        targetSubId = newSub.id;
      }

      const scoreNum = Number(gradeScore);
      const { error: grErr } = await supabase.from('assignment_grades').upsert(
        {
          submission_id: targetSubId,
          grader_id: profile.id,
          raw_score: scoreNum,
          normalized_score: scoreNum,
          feedback: gradeFeedback.trim() || null,
          status: 'published',
          graded_at: new Date().toISOString(),
        },
        { onConflict: 'submission_id' }
      );

      if (grErr) throw grErr;

      // Re-fetch submissions
      openGradingModal(gradingAssignment);
      setGradingSubId(null);
      setGradeFeedback('');
    } catch (err: any) {
      alert('Gagal menyimpan nilai: ' + err.message);
    } finally {
      setGradeSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Action Bar */}
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
          >
            <option value="ALL">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} Tugas Tersedia (Bobot Penilaian 60%)
          </span>
        </div>

        {canManageAssignments && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-xl transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Tugas Baru</span>
          </button>
        )}
      </div>

      {/* Assignments List */}
      {loading ? (
        <LoadingSpinner message="Memuat tugas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAssignments} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum Ada Tugas"
          description="Tugas untuk divisi ini belum dibuat oleh mentor."
          actionText={canManageAssignments ? 'Buat Tugas Pertama' : undefined}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const hasSubmitted = !!a.mySubmission;
            const myGrade = a.mySubmission?.grade;

            return (
              <div
                key={a.id}
                className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm flex flex-col justify-between hover:border-orens-500/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300">
                      {a.division?.name || 'Umum'}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-orens-600" />
                      <span>Tenggat: {new Date(a.due_date).toLocaleDateString('id-ID')}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {a.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">
                    {a.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-dark-700 space-y-2">
                  {/* Member Submission Status */}
                  {isMemberOnly && (
                    <div className="flex items-center justify-between">
                      {hasSubmitted ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle className="w-4 h-4" />
                          <span>Sudah Dikumpulkan</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                          <AlertCircle className="w-4 h-4" />
                          <span>Belum Mengumpulkan</span>
                        </div>
                      )}

                      {myGrade ? (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Nilai: {myGrade.normalized_score} / 100
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSubmittingAssignment(a);
                            setSubmissionText(a.mySubmission?.submission_text || '');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 rounded-lg shadow-sm"
                        >
                          {hasSubmitted ? 'Ubah Jawaban' : 'Kirim Jawaban'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Staff Review Button */}
                  {canManageAssignments && (
                    <button
                      onClick={() => openGradingModal(a)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-xl transition-colors"
                    >
                      <Award className="w-4 h-4 text-orens-600" />
                      <span>Evaluasi & Beri Nilai Siswa</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MEMBER SUBMIT MODAL */}
      {submittingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Pengumpulan Tugas
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{submittingAssignment.title}</p>
              </div>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Jawaban Tugas (Teks atau Tautan URL GitHub/Figma/Google Drive):
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Tuliskan jawaban Anda atau sertakan tautan hasil karya..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setSubmittingAssignment(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {submitSaving ? 'Mengirim...' : 'Kirim Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF GRADING MODAL */}
      {gradingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-2xl w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Evaluasi Jawaban Siswa
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {gradingAssignment.title} (Bobot 60%)
                </p>
              </div>
              <button
                onClick={() => setGradingAssignment(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 max-h-80 overflow-y-auto space-y-3">
              {submissionsList.length === 0 ? (
                <p className="text-xs text-center text-gray-400 italic py-8">
                  Belum ada siswa yang mengumpulkan tugas ini.
                </p>
              ) : (
                submissionsList.map((sub: any) => {
                  const rawMem = Array.isArray(sub.member) ? sub.member[0] : sub.member;
                  const rawGrade = Array.isArray(sub.grade) ? sub.grade[0] : sub.grade;
                  const isBeingGraded = gradingSubId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            {rawMem?.full_name || 'Anggota'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Dikirim: {new Date(sub.submitted_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        {rawGrade ? (
                          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Nilai: {rawGrade.normalized_score}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                            Belum Dinilai
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-dark-800 text-xs text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-dark-700 break-words">
                        {sub.submission_text}
                      </div>

                      {rawGrade?.feedback && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                          Catatan: {rawGrade.feedback}
                        </p>
                      )}

                      {/* Grading Form Inline */}
                      {isBeingGraded ? (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-dark-700 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              Nilai (0-100):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={gradeScore}
                              onChange={(e) => setGradeScore(Number(e.target.value))}
                              className="w-20 px-2 py-1 text-xs rounded border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Catatan / umpan balik untuk siswa..."
                            value={gradeFeedback}
                            onChange={(e) => setGradeFeedback(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => setGradingSubId(null)}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                              Batal
                            </button>
                            <button
                              disabled={gradeSaving}
                              onClick={() => handleSaveGrade(sub.id, sub.member_id)}
                              className="px-3 py-1 text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 rounded shadow-sm"
                            >
                              {gradeSaving ? 'Menyimpan...' : 'Simpan Nilai'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setGradingSubId(sub.id);
                              setGradeScore(rawGrade?.normalized_score || 85);
                              setGradeFeedback(rawGrade?.feedback || '');
                            }}
                            className="text-xs text-orens-600 hover:underline font-semibold"
                          >
                            {rawGrade ? 'Koreksi Nilai' : 'Beri Nilai Siswa'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-dark-700">
              <button
                onClick={() => setGradingAssignment(null)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ASSIGNMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Buat Tugas Baru
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Judul Tugas:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Desain Landing Page Mobile"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Divisi:
                  </label>
                  <select
                    value={newDivisionId}
                    onChange={(e) => setNewDivisionId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                    required
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tenggat Waktu:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Instruksi & Deskripsi Tugas:
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Jelaskan kebutuhan tugas dan format pengumpulan..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
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
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {saving ? 'Menyimpan...' : 'Terbitkan Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
