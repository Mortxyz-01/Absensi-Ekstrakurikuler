import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, logAudit } from '../lib/supabase';
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  Edit,
  Layers,
  History,
  X,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState, AuditPromptModal } from '../components/UIState';
import { Division, UserRole } from '../types';

interface MemberItem {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role_id: string;
  role_name: UserRole;
  nim?: string;
  phone?: string;
  divisions: {
    id: string;
    division_id: string;
    classification: 'Wajib' | 'Opsional';
    division_name: string;
  }[];
}

export const MembersPage: React.FC = () => {
  const { isTopAdmin, profile } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');

  // Audit modal state for deactivation / role change
  const [auditTarget, setAuditTarget] = useState<{
    memberId: string;
    name: string;
    action: 'toggle_status';
    nextStatus: boolean;
  } | null>(null);

  // Edit division modal state
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [editWajibDiv, setEditWajibDiv] = useState('');
  const [editOpsionalDiv, setEditOpsionalDiv] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // History view modal state
  const [historyMember, setHistoryMember] = useState<MemberItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch divisions
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      setDivisions(divData || []);

      // 2. Fetch users + roles + members + member_divisions
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select(`
          id, email, full_name, is_active, role_id,
          role:roles (id, name),
          member_record:members (nim, phone, status)
        `)
        .order('full_name');

      if (usersErr) throw usersErr;

      // 3. Fetch member divisions
      const { data: memDivData, error: memDivErr } = await supabase
        .from('member_divisions')
        .select(`
          id, member_id, division_id, classification, is_active,
          division:divisions (name)
        `)
        .eq('is_active', true);

      if (memDivErr) throw memDivErr;

      const divMap: Record<string, any[]> = {};
      (memDivData || []).forEach((md: any) => {
        if (!divMap[md.member_id]) divMap[md.member_id] = [];
        divMap[md.member_id].push({
          id: md.id,
          division_id: md.division_id,
          classification: md.classification,
          division_name: md.division?.name || 'Divisi',
        });
      });

      const items: MemberItem[] = (usersData || []).map((u: any) => {
        const rawRole = Array.isArray(u.role) ? u.role[0] : u.role;
        const rawMem = Array.isArray(u.member_record) ? u.member_record[0] : u.member_record;
        return {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          is_active: u.is_active,
          role_id: u.role_id,
          role_name: (rawRole?.name || 'Member') as UserRole,
          nim: rawMem?.nim || '',
          phone: rawMem?.phone || '',
          divisions: divMap[u.id] || [],
        };
      });

      setMembers(items);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err.message || 'Gagal memuat daftar anggota.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Filtered members list
  const filtered = members.filter((m) => {
    const matchSearch =
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.nim && m.nim.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchRole = selectedRole === 'ALL' || m.role_name === selectedRole;

    const matchDivision =
      selectedDivision === 'ALL' ||
      m.divisions.some((d) => d.division_id === selectedDivision);

    return matchSearch && matchRole && matchDivision;
  });

  // Handle status toggle with required audit reason
  const handleConfirmStatusToggle = async (reason: string) => {
    if (!auditTarget) return;
    try {
      const { error: updErr } = await supabase
        .from('users')
        .update({ is_active: auditTarget.nextStatus, updated_at: new Date().toISOString() })
        .eq('id', auditTarget.memberId);

      if (updErr) throw updErr;

      // Update members table if exists
      await supabase
        .from('members')
        .update({ status: auditTarget.nextStatus ? 'active' : 'inactive', updated_at: new Date().toISOString() })
        .eq('id', auditTarget.memberId);

      // Log audit
      await logAudit(
        auditTarget.nextStatus ? 'ACTIVATE_MEMBER' : 'DEACTIVATE_MEMBER',
        'users',
        auditTarget.memberId,
        reason,
        { is_active: !auditTarget.nextStatus },
        { is_active: auditTarget.nextStatus }
      );

      setAuditTarget(null);
      fetchMembers();
    } catch (err: any) {
      alert('Gagal memperbarui status anggota: ' + err.message);
    }
  };

  // Open Edit Divisions Modal
  const openEditDivisions = (m: MemberItem) => {
    setEditingMember(m);
    setEditError('');
    const wajib = m.divisions.find((d) => d.classification === 'Wajib');
    const opsional = m.divisions.find((d) => d.classification === 'Opsional');
    setEditWajibDiv(wajib ? wajib.division_id : '');
    setEditOpsionalDiv(opsional ? opsional.division_id : '');
  };

  // Save Divisions
  const handleSaveDivisions = async () => {
    if (!editingMember) return;
    setEditError('');

    // Rule: Cannot choose same division for Wajib and Opsional
    if (editWajibDiv && editOpsionalDiv && editWajibDiv === editOpsionalDiv) {
      setEditError('Divisi Wajib dan Divisi Opsional tidak boleh sama.');
      return;
    }

    setEditSaving(true);
    try {
      // 1. Deactivate current active divisions
      await supabase
        .from('member_divisions')
        .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
        .eq('member_id', editingMember.id)
        .eq('is_active', true);

      // 2. Insert new Wajib division if selected
      if (editWajibDiv) {
        const { error: insWajibErr } = await supabase.from('member_divisions').insert({
          member_id: editingMember.id,
          division_id: editWajibDiv,
          classification: 'Wajib',
          is_active: true,
        });
        if (insWajibErr) throw insWajibErr;
      }

      // 3. Insert new Opsional division if selected
      if (editOpsionalDiv) {
        const { error: insOpsErr } = await supabase.from('member_divisions').insert({
          member_id: editingMember.id,
          division_id: editOpsionalDiv,
          classification: 'Opsional',
          is_active: true,
        });
        if (insOpsErr) throw insOpsErr;
      }

      // Audit log
      await logAudit(
        'UPDATE_MEMBER_DIVISIONS',
        'member_divisions',
        editingMember.id,
        'Pembaruan alokasi divisi Wajib dan Opsional anggota',
        editingMember.divisions,
        { wajib: editWajibDiv, opsional: editOpsionalDiv }
      );

      setEditingMember(null);
      fetchMembers();
    } catch (err: any) {
      setEditError(err.message || 'Gagal menyimpan divisi anggota.');
    } finally {
      setEditSaving(false);
    }
  };

  // Open Member Attendance History
  const openHistoryModal = async (m: MemberItem) => {
    setHistoryMember(m);
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select(`
          id, status, scan_time, verification_method, notes,
          session:attendance_sessions (title, date, activity_type)
        `)
        .eq('member_id', m.id)
        .order('scan_time', { ascending: false });

      setHistoryRecords(data || []);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari anggota berdasarkan nama, NIM, atau email..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Division Filter */}
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

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
          >
            <option value="ALL">Semua Role</option>
            <option value="Pembina">Pembina</option>
            <option value="Ketua">Ketua</option>
            <option value="Wakil Ketua">Wakil Ketua</option>
            <option value="Sekretaris">Sekretaris</option>
            <option value="Ketua Divisi">Ketua Divisi</option>
            <option value="Mentor">Mentor</option>
            <option value="Member">Member</option>
          </select>
        </div>
      </div>

      {/* Main Members Content */}
      {loading ? (
        <LoadingSpinner message="Memuat daftar anggota..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchMembers} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak Ada Anggota Ditemukan"
          description="Coba sesuaikan kata kunci pencarian atau filter divisi dan role."
        />
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                <tr>
                  <th className="py-3.5 px-4">Nama Lengkap & Kontak</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Divisi Terdaftar</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {filtered.map((m) => {
                  const wajib = m.divisions.find((d) => d.classification === 'Wajib');
                  const opsional = m.divisions.find((d) => d.classification === 'Opsional');

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/70 dark:hover:bg-dark-700/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {m.full_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>{m.email}</span>
                          {m.nim && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300">
                              NIM: {m.nim}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300">
                          {m.role_name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 text-xs">
                          {wajib ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                Wajib
                              </span>
                              <span className="text-gray-800 dark:text-gray-200">{wajib.division_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Belum ada divisi Wajib</span>
                          )}

                          {opsional && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                Opsional
                              </span>
                              <span className="text-gray-800 dark:text-gray-200">{opsional.division_name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {m.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openHistoryModal(m)}
                            title="Riwayat Presensi"
                            className="p-1.5 text-gray-500 hover:text-orens-600 dark:hover:text-orens-400 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {isTopAdmin && (
                            <>
                              <button
                                onClick={() => openEditDivisions(m)}
                                title="Atur Divisi Anggota"
                                className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                              >
                                <Layers className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  setAuditTarget({
                                    memberId: m.id,
                                    name: m.full_name,
                                    action: 'toggle_status',
                                    nextStatus: !m.is_active,
                                  })
                                }
                                title={m.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                                  m.is_active ? 'text-gray-500 hover:text-red-600' : 'text-gray-500 hover:text-emerald-600'
                                }`}
                              >
                                {m.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Divisions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Atur Divisi Anggota
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{editingMember.full_name}</p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="my-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Divisi Wajib (Prioritas Utama):
                </label>
                <select
                  value={editWajibDiv}
                  onChange={(e) => setEditWajibDiv(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                >
                  <option value="">Pilih Divisi Wajib...</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Divisi Opsional (Pilihan Tambahan):
                </label>
                <select
                  value={editOpsionalDiv}
                  onChange={(e) => setEditOpsionalDiv(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                >
                  <option value="">Tidak Mengambil Divisi Opsional</option>
                  {divisions
                    .filter((d) => d.id !== editWajibDiv)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code.toUpperCase()})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Setiap anggota maksimal mengikuti 2 divisi (1 Wajib dan 1 Opsional).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSaveDivisions}
                className="px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 disabled:opacity-50 rounded-lg shadow-sm"
              >
                {editSaving ? 'Menyimpan...' : 'Simpan Pembagian Divisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-lg w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Riwayat Presensi
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{historyMember.full_name}</p>
              </div>
              <button
                onClick={() => setHistoryMember(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 max-h-72 overflow-y-auto space-y-2">
              {historyLoading ? (
                <LoadingSpinner message="Mengambil riwayat..." />
              ) : historyRecords.length === 0 ? (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-6">
                  Belum ada catatan presensi untuk anggota ini.
                </p>
              ) : (
                historyRecords.map((r) => {
                  const sess = Array.isArray(r.session) ? r.session[0] : r.session;
                  return (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {sess?.title || 'Sesi Presensi'}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          Tanggal: {sess?.date || '-'} • Metode: {r.verification_method || 'qr_scan'}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'Hadir'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : r.status === 'Terlambat'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-dark-700">
              <button
                onClick={() => setHistoryMember(null)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit prompt modal for sensitive status change */}
      {auditTarget && (
        <AuditPromptModal
          isOpen={true}
          title="Konfirmasi Perubahan Status Akun"
          description={`Anda akan mengubah status akun ${auditTarget.name} menjadi ${
            auditTarget.nextStatus ? 'Aktif' : 'Nonaktif'
          }. Tindakan ini dicatat ke dalam log audit permanen.`}
          onConfirm={handleConfirmStatusToggle}
          onCancel={() => setAuditTarget(null)}
        />
      )}
    </div>
  );
};
