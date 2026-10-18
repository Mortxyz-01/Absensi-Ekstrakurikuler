import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Layers,
  Users,
  Shield,
  BookOpen,
  FileCheck2,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { LoadingSpinner, ErrorState } from '../components/UIState';
import { Division } from '../types';

interface DivisionWithDetails extends Division {
  wajibCount: number;
  opsionalCount: number;
  leadName?: string;
  leadEmail?: string;
  membersList: {
    id: string;
    full_name: string;
    email: string;
    classification: 'Wajib' | 'Opsional';
    role_name: string;
  }[];
}

interface DivisionsPageProps {
  onNavigate?: (tab: string) => void;
}

export const DivisionsPage: React.FC<DivisionsPageProps> = ({ onNavigate }) => {
  const { profile, isMemberOnly } = useAuth();
  const [divisions, setDivisions] = useState<DivisionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDivId, setSelectedDivId] = useState<string | null>(null);

  const fetchDivisions = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch divisions
      const { data: divData, error: divErr } = await supabase
        .from('divisions')
        .select('*')
        .order('name');

      if (divErr) throw divErr;

      // Member hanya melihat divisi yang ia ikuti (1-2 divisi)
      let visibleDivisions = divData || [];
      if (isMemberOnly && profile?.divisions?.length) {
        const myDivIds = new Set(profile.divisions.map((d: any) => d.division_id));
        visibleDivisions = visibleDivisions.filter((d: any) => myDivIds.has(d.id));
      }

      // 2. Fetch all member_divisions with users & roles
      const { data: memDivData, error: mdErr } = await supabase
        .from('member_divisions')
        .select(`
          division_id, classification, is_active,
          member:users (
            id, full_name, email,
            role:roles (name)
          )
        `)
        .eq('is_active', true);

      if (mdErr) throw mdErr;

      const grouped: Record<string, any[]> = {};
      (memDivData || []).forEach((item: any) => {
        if (!grouped[item.division_id]) grouped[item.division_id] = [];
        const rawRole = Array.isArray(item.member?.role) ? item.member.role[0] : item.member?.role;
        grouped[item.division_id].push({
          id: item.member?.id,
          full_name: item.member?.full_name || 'Anggota',
          email: item.member?.email || '',
          classification: item.classification,
          role_name: rawRole?.name || 'Member',
        });
      });

      const detailedList: DivisionWithDetails[] = visibleDivisions.map((d: any) => {
        const mems = grouped[d.id] || [];
        const wajib = mems.filter((m) => m.classification === 'Wajib').length;
        const ops = mems.filter((m) => m.classification === 'Opsional').length;
        return {
          ...d,
          wajibCount: wajib,
          opsionalCount: ops,
          membersList: mems,
        };
      });

      setDivisions(detailedList);
      if (detailedList.length > 0 && !selectedDivId) {
        setSelectedDivId(detailedList[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching divisions:', err);
      setError(err.message || 'Gagal memuat divisi ekstrakurikuler.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, []);

  const activeDivision = divisions.find((d) => d.id === selectedDivId) || divisions[0];

  if (loading) {
    return <LoadingSpinner message={isMemberOnly ? 'Memuat divisi kamu...' : 'Memuat 5 divisi peminatan...'} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDivisions} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 5 Divisions Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {divisions.map((d) => {
          const isSelected = d.id === selectedDivId;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDivId(d.id)}
              className={`text-left p-4 rounded-2xl border transition-all shadow-sm ${isSelected
                  ? 'border-orens-600 bg-orens-50/50 dark:bg-orens-950/20 ring-2 ring-orens-500/20'
                  : 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-gray-300 dark:hover:border-dark-600'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orens-600 dark:text-orens-400 font-mono">
                  {d.code}
                </span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  {d.membersList.length} Siswa
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                {d.name}
              </h3>
              <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1 line-clamp-2">
                {d.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Division Detailed Inspector */}
      {activeDivision && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-dark-700">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Divisi {activeDivision.name}
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-200">
                  {activeDivision.code.toUpperCase()}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-200 mt-1">
                {activeDivision.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {onNavigate && (
                <>
                  <button
                    onClick={() => onNavigate('materials')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Materi Divisi</span>
                  </button>
                  <button
                    onClick={() => onNavigate('assignments')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tugas Divisi</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Division Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
              <span className="text-[11px] text-gray-700 dark:text-gray-200 font-medium">Total Anggota Terdaftar</span>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mt-0.5">
                {activeDivision.membersList.length}
              </p>
            </div>

            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Anggota Divisi Wajib</span>
              <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                {activeDivision.wajibCount}
              </p>
            </div>

            <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Anggota Divisi Opsional</span>
              <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {activeDivision.opsionalCount}
              </p>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-100 dark:border-dark-700">
              <span className="text-[11px] text-gray-700 dark:text-gray-200 font-medium">Status Divisi</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Aktif & Beroperasi</span>
              </p>
            </div>
          </div>

          {/* Members in Division List */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-orens-600" />
              <span>Daftar Anggota di Divisi {activeDivision.name}</span>
            </h4>

            {activeDivision.membersList.length === 0 ? (
              <p className="text-xs text-gray-700 dark:text-gray-200 italic py-4">
                Belum ada anggota yang didaftarkan ke divisi ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {activeDivision.membersList.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {m.full_name}
                      </p>
                      <p className="text-[10px] text-gray-700 dark:text-gray-200 truncate max-w-[140px]">
                        {m.email}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.classification === 'Wajib'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          }`}
                      >
                        {m.classification}
                      </span>
                      <span className="text-[9px] text-gray-600 dark:text-gray-200 font-medium">
                        {m.role_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
