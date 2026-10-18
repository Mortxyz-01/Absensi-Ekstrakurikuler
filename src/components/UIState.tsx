import React, { useState } from 'react';
import { Loader2, AlertCircle, Inbox, X } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Memuat data...' }) => (
  <div className="flex flex-col items-center justify-center p-8 text-gray-700 dark:text-gray-200">
    <Loader2 className="w-8 h-8 animate-spin text-orens-600 mb-2" />
    <p className="text-sm">{message}</p>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionText, onAction, icon }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 my-4 shadow-sm">
    <div className="p-3 bg-orens-50 dark:bg-orens-950/40 text-orens-600 rounded-full mb-3">
      {icon || <Inbox className="w-8 h-8" />}
    </div>
    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
    <p className="text-sm text-gray-700 dark:text-gray-200 max-w-sm mb-4">{description}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 text-sm font-medium text-white bg-orens-600 hover:bg-orens-700 active:bg-orens-800 rounded-lg transition-colors focus:ring-2 focus:ring-orens-500"
      >
        {actionText}
      </button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 my-4">
    <AlertCircle className="w-8 h-8 mb-2" />
    <p className="text-sm font-medium mb-3 text-center">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 rounded-md transition-colors"
      >
        Coba Lagi
      </button>
    )}
  </div>
);

export const AuditPromptModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ isOpen, title, description, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Alasan resmi wajib diisi untuk pencatatan log audit.');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-xl max-w-md w-full p-6 text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-600 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-200 my-3">{description}</p>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
            Alasan Resmi (Wajib)
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="Contoh: Koreksi absensi karena kendala jaringan saat sesi dimulai"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 focus:ring-2 focus:ring-orens-500 focus:border-orens-500"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-orens-600 hover:bg-orens-700 rounded-lg transition-colors"
            >
              Simpan & Catat Audit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
