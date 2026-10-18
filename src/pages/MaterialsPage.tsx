import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Layers,
  Archive,
  Trash2,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState } from '../components/UIState';
import { Division } from '../types';

interface MaterialItem {
  id: string;
  division_id: string;
  title: string;
  description?: string;
  category: string;
  learning_level: 'Beginner' | 'Intermediate' | 'Advanced';
  external_link?: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  division?: { name: string; code: string };
}

function isValidHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const MaterialsPage: React.FC = () => {
  const { profile, canManageMaterials, isMemberOnly, isDivisionScoped } = useAuth();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Create material modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDivisionId, setNewDivisionId] = useState('');
  const [newLevel, setNewLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMaterials = async () => {
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
      if (divisionList.length > 0 && !newDivisionId) {
        setNewDivisionId(divisionList[0].id);
      }

      const { data, error: matErr } = await supabase
        .from('learning_materials')
        .select('*, division:divisions(name, code)')
        .order('created_at', { ascending: false });

      if (matErr) throw matErr;
      setMaterials((data as any) || []);
    } catch (err: any) {
      console.error('Fetch materials error:', err);
      setError(err.message || 'Gagal memuat materi pembelajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const filtered = materials.filter((m) => {
    const matchSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchDiv =
      selectedDivision === 'ALL'
        ? (!isDivisionScoped || divisions.length === 0 || divisions.some((d) => d.id === m.division_id))
        : m.division_id === selectedDivision;
    return matchSearch && matchDiv;
  });

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDivisionId) return;

    if (newLink.trim() && !isValidHttpUrl(newLink.trim())) {
      alert('Tautan materi harus berupa URL yang valid dengan awalan http:// atau https://');
      return;
    }

    setSaving(true);
    try {
      const { error: insErr } = await supabase.from('learning_materials').insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        division_id: newDivisionId,
        learning_level: newLevel,
        category: 'Teknis',
        external_link: newLink.trim() || null,
        status: 'published',
        creator_id: profile?.id,
        published_at: new Date().toISOString(),
      });

      if (insErr) throw insErr;

      setShowModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewLink('');
      fetchMaterials();
    } catch (err: any) {
      alert('Gagal menambah materi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (m: MaterialItem) => {
    try {
      const nextStatus = m.status === 'archived' ? 'published' : 'archived';
      const { error: updErr } = await supabase
        .from('learning_materials')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', m.id);

      if (updErr) throw updErr;
      fetchMaterials();
    } catch (err: any) {
      alert('Gagal mengubah status materi: ' + err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Action Bar */}
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-600 dark:text-gray-200" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari materi pembelajaran..."
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
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {canManageMaterials && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-xl transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Materi</span>
            </button>
          )}
        </div>
      </div>

      {/* Materials List */}
      {loading ? (
        <LoadingSpinner message="Memuat materi..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchMaterials} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum Ada Materi"
          description="Materi untuk filter ini belum tersedia."
          actionText={canManageMaterials ? 'Unggah Materi Pertama' : undefined}
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 shadow-sm flex flex-col justify-between hover:border-orens-500/50 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300">
                    {m.division?.name || 'Umum'}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.learning_level === 'Beginner'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : m.learning_level === 'Intermediate'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    }`}
                  >
                    {m.learning_level}
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                  {m.title}
                </h3>
                <p className="text-xs text-gray-700 dark:text-gray-200 line-clamp-3 mb-4">
                  {m.description || 'Tidak ada deskripsi tambahan.'}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                {m.external_link && isValidHttpUrl(m.external_link) ? (
                  <a
                    href={m.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orens-600 dark:text-orens-400 hover:underline"
                  >
                    <span>Buka Tautan Materi</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-[11px] text-gray-600 dark:text-gray-200 italic">Materi tatap muka</span>
                )}

                {canManageMaterials && (
                  <button
                    onClick={() => handleArchive(m)}
                    title={m.status === 'archived' ? 'Buka Arsip' : 'Arsipkan'}
                    className={`p-1.5 rounded-lg text-xs ${
                      m.status === 'archived'
                        ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                        : 'text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MATERIAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Tambah Materi Pembelajaran
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-3.5 my-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Judul Materi:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Pengenalan Wireframing di Figma"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Tingkat Kesulitan:
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Deskripsi / Catatan Materi:
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ringkasan poin pembelajaran..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Tautan Eksternal (Google Drive / GitHub / Video):
                </label>
                <input
                  type="url"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orens-600 hover:bg-orens-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {saving ? 'Menyimpan...' : 'Terbitkan Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
