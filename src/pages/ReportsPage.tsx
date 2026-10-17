import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Layers,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/UIState';
import { Division } from '../types';

interface AttendanceReportRow {
  session_title: string;
  division_name: string;
  activity_type: string;
  date: string;
  student_name: string;
  student_email: string;
  status: string;
  scan_time: string;
  method: string;
}

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'attendance' | 'grades'>('attendance');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [attendanceRows, setAttendanceRows] = useState<AttendanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: divData } = await supabase.from('divisions').select('*').order('name');
      setDivisions(divData || []);

      // Fetch actual attendance records joined with sessions and users
      let query = supabase
        .from('attendance_records')
        .select(`
          id, status, scan_time, verification_method,
          member:users (full_name, email),
          session:attendance_sessions (
            title, date, activity_type, division_id,
            division:divisions (name)
          )
        `)
        .order('scan_time', { ascending: false });

      const { data, error: repErr } = await query;
      if (repErr) throw repErr;

      const formatted: AttendanceReportRow[] = (data || []).map((r: any) => {
        const rawMem = Array.isArray(r.member) ? r.member[0] : r.member;
        const rawSess = Array.isArray(r.session) ? r.session[0] : r.session;
        const rawDiv = rawSess?.division ? (Array.isArray(rawSess.division) ? rawSess.division[0] : rawSess.division) : null;

        return {
          session_title: rawSess?.title || 'Sesi Presensi',
          division_name: rawDiv?.name || 'Semua Divisi',
          activity_type: rawSess?.activity_type || 'Wajib',
          date: rawSess?.date || '-',
          student_name: rawMem?.full_name || 'Anggota',
          student_email: rawMem?.email || '',
          status: r.status,
          scan_time: r.scan_time ? new Date(r.scan_time).toLocaleTimeString('id-ID') : '-',
          method: r.verification_method || 'qr_scan',
        };
      });

      setAttendanceRows(formatted);
    } catch (err: any) {
      console.error('Fetch reports error:', err);
      setError(err.message || 'Gagal mengambil data laporan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredAttendance = attendanceRows.filter((r) => {
    const matchDiv = selectedDivision === 'ALL' || r.division_name === selectedDivision;
    const matchStart = !startDate || r.date >= startDate;
    const matchEnd = !endDate || r.date <= endDate;
    return matchDiv && matchStart && matchEnd;
  });

  // Export CSV Function
  const exportToCSV = () => {
    if (filteredAttendance.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = [
      'Sesi',
      'Divisi',
      'Kategori',
      'Tanggal',
      'Nama Siswa',
      'Email Siswa',
      'Status Presensi',
      'Waktu Scan',
      'Metode',
    ];

    const rows = filteredAttendance.map((r) => [
      `"${r.session_title}"`,
      `"${r.division_name}"`,
      `"${r.activity_type}"`,
      `"${r.date}"`,
      `"${r.student_name}"`,
      `"${r.student_email}"`,
      `"${r.status}"`,
      `"${r.scan_time}"`,
      `"${r.method}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Rekap_Presensi_Orens_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Card */}
      <div className="bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orens-600" />
            <span>Rekapitulasi Laporan Organisasi</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Unduh data absensi dan penilaian aktual dalam format CSV untuk pelaporan sekolah.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orens-600 hover:bg-orens-700 rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Divisi:
          </label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
          >
            <option value="ALL">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Dari Tanggal:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Sampai:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {(startDate || endDate || selectedDivision !== 'ALL') && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedDivision('ALL');
            }}
            className="text-xs text-orens-600 hover:underline font-semibold"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Report Table */}
      {loading ? (
        <LoadingSpinner message="Menyusun data laporan aktual..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReports} />
      ) : filteredAttendance.length === 0 ? (
        <EmptyState
          title="Tidak Ada Catatan Laporan"
          description="Tidak ditemukan data presensi yang sesuai dengan rentang tanggal dan filter divisi."
        />
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm overflow-hidden">
          <div className="p-3 bg-gray-50 dark:bg-dark-900/50 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between text-xs text-gray-500">
            <span>Menampilkan {filteredAttendance.length} rekaman presensi aktual</span>
            <span>Format: UTF-8 Encoded CSV Compatible</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-dark-900/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                <tr>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Sesi Pertemuan</th>
                  <th className="py-3 px-4">Divisi & Kategori</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Waktu Pindai</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {filteredAttendance.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {row.student_name}
                      </div>
                      <div className="text-xs text-gray-400">{row.student_email}</div>
                    </td>

                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      {row.session_title}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <div>{row.division_name}</div>
                      <span className="text-[10px] text-gray-400">{row.activity_type}</span>
                    </td>

                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                      {row.date}
                    </td>

                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                      {row.scan_time} WIB
                    </td>

                    <td className="py-3 px-4 text-xs font-mono text-gray-500">
                      {row.method}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          row.status === 'Hadir'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : row.status === 'Terlambat'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        {row.status}
                      </span>
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
