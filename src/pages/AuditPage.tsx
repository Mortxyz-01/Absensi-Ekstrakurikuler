import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Search, RefreshCw, Lock } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState } from '../components/UIState';

interface AuditRow {
  id: string;
  action: string;
  target_table: string;
  target_id: string;
  reason?: string;
  created_at: string;
  actor?: { full_name: string; email: string };
  old_value?: any;
  new_value?: any;
}

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: logErr } = await supabase
        .from('audit_logs')
        .select(`
          id, action, target_table, target_id, reason, created_at, old_value, new_value,
          actor:users (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (logErr) throw logErr;

      const formatted: AuditRow[] = (data || []).map((d: any) => {
        const rawActor = Array.isArray(d.actor) ? d.actor[0] : d.actor;
        return {
          id: d.id,
          action: d.action,
          target_table: d.target_table,
          target_id: d.target_id,
          reason: d.reason,
          created_at: d.created_at,
          actor: rawActor,
          old_value: d.old_value,
          new_value: d.new_value,
        };
      });

      setLogs(formatted);
    } catch (err: any) {
      console.error('Audit log fetch error:', err);
      setError(err.message || 'Gagal memuat log audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const s = searchTerm.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      (l.reason && l.reason.toLowerCase().includes(s)) ||
      (l.actor?.full_name && l.actor.full_name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orens-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Log Audit Permanen Organisasi
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Setiap tindakan sensitif (koreksi absensi, perubahan role, formula nilai) dicatat secara permanen dan tidak dapat dimanipulasi.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Log</span>
        </button>
      </div>

      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari log berdasarkan aksi, alasan, atau penanggung jawab..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Mengambil log audit keamanan..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAuditLogs} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum Ada Log Audit"
          description="Log audit akan muncul saat ada perubahan data sensitif oleh Pembina atau Ketua."
        />
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                <tr>
                  <th className="py-3 px-4">Waktu Kejadian</th>
                  <th className="py-3 px-4">Aksi / Operasi</th>
                  <th className="py-3 px-4">Tabel Target</th>
                  <th className="py-3 px-4">Pelaku (Actor)</th>
                  <th className="py-3 px-4">Alasan Resmi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700 font-mono text-xs">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/40">
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                      {new Date(l.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-bold text-orens-600 dark:text-orens-400">
                      {l.action}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {l.target_table}
                    </td>
                    <td className="py-3 px-4 font-sans text-xs">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {l.actor?.full_name || 'System'}
                      </div>
                      <div className="text-[10px] text-gray-400">{l.actor?.email}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-xs text-gray-700 dark:text-gray-300 max-w-xs break-words">
                      {l.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
