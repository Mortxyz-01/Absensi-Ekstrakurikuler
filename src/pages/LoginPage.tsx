import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, AlertCircle, Loader2, ShieldCheck, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    { role: 'Pembina', email: 'pembina@orens.org', desc: 'Hak akses penuh setara Ketua' },
    { role: 'Ketua', email: 'ketua@orens.org', desc: 'Hak akses penuh setara Pembina' },
    { role: 'Wakil Ketua', email: 'wakil@orens.org', desc: 'Absensi, anggota, materi' },
    { role: 'Sekretaris', email: 'sekretaris@orens.org', desc: 'Absensi, anggota, laporan' },
    { role: 'Ketua Divisi', email: 'ketuadivisi@orens.org', desc: 'Kelola divisi UI/UX' },
    { role: 'Mentor', email: 'mentor@orens.org', desc: 'Bimbingan divisi Web Dev' },
    { role: 'Member', email: 'member@orens.org', desc: 'Scan QR dan lihat nilai' },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);
    const res = await login(email, password);
    if (!res.success) {
      setError(res.error || 'Gagal masuk akun. Periksa email atau sandi Anda.');
    }
    setLoading(false);
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Orens2026!');
    setError('');
    setLoading(true);
    const res = await login(demoEmail, 'Orens2026!');
    if (!res.success) {
      setError(res.error || 'Gagal login akun demo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 bg-orens-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto shadow-lg shadow-orens-600/30">
          O
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
          Orens Solution
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Sistem Manajemen Ekstrakurikuler
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-dark-800 py-8 px-6 shadow-xl shadow-gray-200/50 dark:shadow-none rounded-2xl border border-gray-100 dark:border-dark-700">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-red-700 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@orens.org"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500 focus:border-orens-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orens-500 focus:border-orens-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 disabled:opacity-50 transition-colors shadow-sm shadow-orens-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Masuk ke Akun</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Switcher */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-orens-600" />
              <span>Akses Cepat Akun Demo (7 Role):</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin(acc.email)}
                  className="flex flex-col text-left p-2 rounded-lg bg-gray-50 dark:bg-dark-700/60 hover:bg-orens-50 dark:hover:bg-dark-700 border border-gray-200 dark:border-dark-600 transition-colors"
                >
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 text-orens-700 dark:text-orens-400">
                    {acc.role}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
