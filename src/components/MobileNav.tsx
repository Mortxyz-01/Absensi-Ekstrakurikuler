import React, { useState } from 'react';
import {
  LayoutDashboard,
  QrCode,
  BookOpen,
  FileCheck2,
  Menu,
  X,
  Users,
  Layers,
  GraduationCap,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface MobileNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  setCurrentTab,
}) => {
  const { profile, role, logout, canManageMembers, isTopAdmin, canViewReports, canViewDivisions } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
    { id: 'attendance', label: 'Absensi', icon: QrCode },
    { id: 'materials', label: 'Materi', icon: BookOpen },
    { id: 'assignments', label: 'Tugas', icon: FileCheck2 },
  ];

  const extraTabs = [
    { id: 'members', label: 'Anggota', icon: Users, show: canManageMembers },
    { id: 'divisions', label: 'Divisi', icon: Layers, show: canViewDivisions },
    { id: 'grades', label: 'Nilai & Rapor', icon: GraduationCap, show: true },
    { id: 'reports', label: 'Laporan', icon: FileSpreadsheet, show: canViewReports },
    { id: 'audit', label: 'Log Audit', icon: ShieldAlert, show: isTopAdmin },
  ];

  return (
    <>
      {/* Top Mobile Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Orens Solution"
            className="w-8 h-8 object-contain rounded-lg shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Orens Solution
            </h1>
            <p className="text-[10px] text-gray-700 dark:text-gray-200">
              {role || 'Ekstrakurikuler'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Buka Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sticky Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border-t border-gray-200 dark:border-dark-700 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex justify-around items-center">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[48px] px-2 py-1 rounded-lg transition-colors ${
                isActive
                  ? 'text-orens-600 dark:text-orens-500 font-bold'
                  : 'text-gray-700 dark:text-gray-200 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Slide-over Drawer for Extra Pages */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative ml-auto w-72 max-w-[80%] bg-white dark:bg-dark-900 h-full p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl flex flex-col justify-between z-10 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-2">
                  <img
                    src="/logo.png"
                    alt="Orens Solution"
                    className="w-7 h-7 object-contain rounded-lg shrink-0"
                  />
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Menu Lainnya</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-3">
                <p className="text-xs text-gray-700 dark:text-gray-200 font-medium mb-1">Akun</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {profile?.full_name}
                </p>
                <span className="inline-block text-[11px] font-semibold px-2 py-0.5 mt-1 rounded-full bg-orens-100 dark:bg-orens-950/60 text-orens-700 dark:text-orens-300">
                  {role}
                </span>
              </div>

              <div className="space-y-1 mt-2">
                {extraTabs
                  .filter((item) => item.show)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          setDrawerOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[44px] font-medium transition-colors ${
                          isActive
                            ? 'bg-orens-600 text-white'
                            : 'text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-800'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-dark-700 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-200 bg-gray-50 dark:bg-dark-800 rounded-lg min-h-[44px]"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  <span>Mode {isDark ? 'Terang' : 'Gelap'}</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-200">{isDark ? 'Dark' : 'Light'}</span>
              </button>

              <button
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sistem</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
