import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserCheck, Shield } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({ currentTab }) => {
  const { profile, role } = useAuth();

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Ringkasan kegiatan ekstrakurikuler' },
    members: { title: 'Manajemen Anggota', subtitle: 'Data siswa, jabatan, dan pembagian divisi' },
    divisions: { title: 'Divisi Ekstrakurikuler', subtitle: '5 divisi peminatan Orens Solution' },
    attendance: { title: 'Presensi QR', subtitle: 'Buat sesi, bagikan kode QR, catat kehadiran' },
    materials: { title: 'Materi Pembelajaran', subtitle: 'Materi teknis per divisi' },
    assignments: { title: 'Tugas & Proyek', subtitle: 'Tugas beserta tenggat pengumpulan' },
    grades: { title: 'Nilai', subtitle: 'Nilai akhir dari kehadiran (40%) dan tugas (60%)' },
    reports: { title: 'Laporan', subtitle: 'Unduh rekap presensi dan nilai (CSV dan cetak)' },
    audit: { title: 'Log Audit', subtitle: 'Riwayat tindakan pengurus, tidak bisa diubah' },
  };

  const current = titles[currentTab] || { title: 'Orens Solution', subtitle: 'Sistem Manajemen' };

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-5 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          {current.title}
        </h2>
        <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5">
          {current.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-xs text-gray-700 dark:text-gray-200">
          <Shield className="w-3.5 h-3.5 text-orens-600" />
          <span>Role: <strong className="text-orens-600 dark:text-orens-400">{role}</strong></span>
        </div>

        <div className="flex items-center gap-2.5 pl-4 border-l border-gray-200 dark:border-dark-700">
          <div className="w-8 h-8 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300 flex items-center justify-center font-bold text-xs">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              {profile?.full_name}
            </p>
            <p className="text-[10px] text-gray-700 dark:text-gray-200">
              {profile?.email}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
