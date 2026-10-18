import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { DivisionsPage } from './pages/DivisionsPage';
import { AttendancePage } from './pages/AttendancePage';
import { MaterialsPage } from './pages/MaterialsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { GradesPage } from './pages/GradesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { LoadingSpinner } from './components/UIState';

const MainLayout: React.FC = () => {
  const { user, loading, canViewReports, canViewDivisions } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const { isDark, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
        <LoadingSpinner message="Memeriksa sesi login Orens Solution..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100">
      {/* Desktop Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <MobileNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <Header currentTab={currentTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-8">
          {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
          {currentTab === 'members' && <MembersPage />}
          {currentTab === 'divisions' && (canViewDivisions ? <DivisionsPage onNavigate={setCurrentTab} /> : <DashboardPage onNavigate={setCurrentTab} />)}
          {currentTab === 'attendance' && <AttendancePage />}
          {currentTab === 'materials' && <MaterialsPage />}
          {currentTab === 'assignments' && <AssignmentsPage />}
          {currentTab === 'grades' && <GradesPage />}
          {currentTab === 'reports' && (canViewReports ? <ReportsPage /> : <DashboardPage onNavigate={setCurrentTab} />)}
          {currentTab === 'audit' && <AuditPage />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
