import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { User, Bell, Database, RefreshCw, LogOut, CheckCircle2, Menu } from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onToggleMobileMenu }) => {
  const { user, logout } = useAuthStore();

  const tabTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
    'dashboard': { title: 'Dashboard Utama', subtitle: 'Overview' },
    'surat-masuk': { title: 'Surat Masuk', subtitle: 'Manajemen Surat' },
    'surat-keluar': { title: 'Surat Keluar', subtitle: 'Manajemen Surat' },
    'surat-draft': { title: 'Draft Surat', subtitle: 'Manajemen Surat' },
    'surat-persetujuan': { title: 'Persetujuan Surat', subtitle: 'Manajemen Surat' },
    'surat-disposisi': { title: 'Disposisi Surat', subtitle: 'Manajemen Surat' },
    'nomor-ambil': { title: 'Ambil Nomor Surat', subtitle: 'Konfigurasi Penomoran' },
    'nomor-reserved': { title: 'Nomor Reserved', subtitle: 'Konfigurasi Penomoran' },
    'nomor-issued': { title: 'Nomor Issued', subtitle: 'Konfigurasi Penomoran' },
    'nomor-cancelled': { title: 'Nomor Cancelled', subtitle: 'Konfigurasi Penomoran' },
    'nomor-riwayat': { title: 'Riwayat Penomoran', subtitle: 'Konfigurasi Penomoran' },
    'nomor-concurrency': { title: 'Uji Concurrency', subtitle: 'Konfigurasi Penomoran' },
    'dokumen-spo': { title: 'Dokumen SPO', subtitle: 'SPO & Dokumen' },
    'dokumen-perdir': { title: 'Dokumen PERDIR', subtitle: 'SPO & Dokumen' },
    'dokumen-sk': { title: 'Dokumen SK', subtitle: 'SPO & Dokumen' },
    'dokumen-umum': { title: 'Surat Umum / Dinas', subtitle: 'SPO & Dokumen' },
    'laporan': { title: 'Laporan & Ekspor', subtitle: 'System Settings' },
    'integrasi-telegram': { title: 'Telegram Bot', subtitle: 'Integrasi API' },
    'integrasi-whatsapp': { title: 'WhatsApp Baileys', subtitle: 'Integrasi API' },
    'kontak-whatsapp': { title: 'Kontak WhatsApp', subtitle: 'Integrasi Baileys' },
    'pengaturan': { title: 'Pengaturan Sistem', subtitle: 'System Settings' },
    'backup-restore': { title: 'Backup & Restore', subtitle: 'System Settings' },
    'audit-log': { title: 'Audit Trail', subtitle: 'System Settings' }
  };

  const currentInfo = tabTitles[activeTab] || { title: 'Sistem Surat', subtitle: 'Dashboard' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs md:text-sm overflow-hidden">
          <span className="text-slate-400 font-medium hidden sm:inline">{currentInfo.subtitle}</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-slate-900 font-bold truncate">{currentInfo.title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 text-slate-700 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          <span>MongoDB Sync</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        </div>

        {/* Bell Notification */}
        <div className="relative text-slate-400 hover:text-slate-600 cursor-pointer p-1">
          <div className="w-2 h-2 bg-rose-500 rounded-full absolute top-1 right-1"></div>
          <Bell className="w-5 h-5" />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-2 md:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shadow-2xs shrink-0">
            {user?.fullName ? user.fullName.charAt(0) : 'U'}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-slate-900 leading-tight">{user?.fullName || 'Super Admin'}</div>
            <div className="text-[10px] text-slate-500">{user?.role || 'Administrator'}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-0.5 cursor-pointer"
            title="Keluar / Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
