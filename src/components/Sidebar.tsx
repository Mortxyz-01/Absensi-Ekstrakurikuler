import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  QrCode,
  BookOpen,
  FileCheck2,
  GraduationCap,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isDark,
  toggleTheme,
}) => {
  const { profile, role, logout, canManageMembers, isTopAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'members', label: 'Anggota', icon: Users, show: canManageMembers },
    { id: 'divisions', label: 'Divisi', icon: Layers, show: true },
    { id: 'attendance', label: 'Absensi', icon: QrCode, show: true },
    { id: 'materials', label: 'Materi', icon: BookOpen, show: true },
    { id: 'assignments', label: 'Tugas', icon: FileCheck2, show: true },
    { id: 'grades', label: 'Nilai', icon: GraduationCap, show: true },
    { id: 'reports', label: 'Laporan', icon: FileSpreadsheet, show: !profile?.role?.name || profile.role.name !== 'Member' },
    { id: 'audit', label: 'Log Audit', icon: ShieldAlert, show: isTopAdmin },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-dark-900 border-r border-gray-200 dark:border-dark-700 min-h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Orens Solution"
            className="w-10 h-10 object-contain rounded-lg shrink-0"
          />
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
              Orens Solution
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* User Info Capsule */}
      <div className="p-4 mx-3 my-3 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pengguna Masuk</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {profile?.full_name || 'Memuat...'}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300">
            {role || 'Tamu'}
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.filter((item) => item.show).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orens-600 text-white shadow-sm shadow-orens-600/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gray-200 dark:border-dark-700 space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            <span>Mode {isDark ? 'Terang' : 'Gelap'}</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-dark-700">
            {isDark ? 'Dark' : 'Light'}
          </span>
        </button>

        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sistem</span>
        </button>
      </div>
    </aside>
  );
};
