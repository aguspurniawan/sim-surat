import React from 'react';
import {
  LayoutDashboard, Mail, FileCheck, Hash, FileText, BarChart3,
  Bot, MessageSquare, Settings, ShieldCheck, Cpu, Database,
  Inbox, Send, Clock, BookOpen, ShieldAlert, Award, FileSpreadsheet,
  ChevronRight, Layers, X, Contact
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'surat-masuk'
  | 'surat-keluar'
  | 'surat-draft'
  | 'surat-persetujuan'
  | 'surat-disposisi'
  | 'nomor-ambil'
  | 'nomor-reserved'
  | 'nomor-issued'
  | 'nomor-cancelled'
  | 'nomor-riwayat'
  | 'nomor-concurrency'
  | 'dokumen-spo'
  | 'dokumen-perdir'
  | 'dokumen-sk'
  | 'dokumen-umum'
  | 'laporan'
  | 'integrasi-telegram'
  | 'integrasi-whatsapp'
  | 'kontak-whatsapp'
  | 'pengaturan'
  | 'backup-restore'
  | 'audit-log';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileOpen = false, onCloseMobile }) => {
  const [openSubmenu, setOpenSubmenu] = React.useState<string | null>('nomor');

  const toggleSubmenu = (menuKey: string) => {
    setOpenSubmenu(prev => (prev === menuKey ? null : menuKey));
  };

  const handleSelectTab = (tabKey: ActiveTab) => {
    setActiveTab(tabKey);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tabKey: ActiveTab) =>
    `flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
      activeTab === tabKey
        ? 'bg-indigo-50 text-indigo-700 font-bold'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const submenuHeaderClass = (menuKey: string) =>
    `flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
      openSubmenu === menuKey ? 'text-slate-900 font-bold bg-slate-100/70' : 'text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`w-64 bg-white border-r border-slate-200 text-slate-800 flex flex-col h-screen fixed md:sticky top-0 left-0 z-50 shrink-0 select-none overflow-y-auto transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0">
              S
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">
                E-Surat <br />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">RS SEBENING KASIH</span>
              </h1>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Tree */}
        <div className="p-3 space-y-1 flex-1">
          {/* Main Section Header */}
          <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-2">Main Menu</div>

          {/* Dashboard */}
          <button onClick={() => handleSelectTab('dashboard')} className={navItemClass('dashboard')}>
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            <span>Dashboard</span>
          </button>

          {/* Menu Surat */}
          <div>
            <button onClick={() => toggleSubmenu('surat')} className={submenuHeaderClass('surat')}>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-500" />
                <span>Manajemen Surat</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openSubmenu === 'surat' ? 'rotate-90' : ''}`} />
            </button>
            {openSubmenu === 'surat' && (
              <div className="ml-4 mt-1 pl-2 border-l border-slate-200 space-y-0.5">
                <button onClick={() => handleSelectTab('surat-masuk')} className={navItemClass('surat-masuk')}>
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Surat Masuk</span>
                </button>
                <button onClick={() => handleSelectTab('surat-keluar')} className={navItemClass('surat-keluar')}>
                  <Send className="w-3.5 h-3.5" />
                  <span>Surat Keluar</span>
                </button>
                <button onClick={() => handleSelectTab('surat-disposisi')} className={navItemClass('surat-disposisi')}>
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Disposisi</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu Nomor Surat */}
          <div>
            <button onClick={() => toggleSubmenu('nomor')} className={submenuHeaderClass('nomor')}>
              <div className="flex items-center gap-3">
                <Hash className="w-4 h-4 text-slate-500" />
                <span>Nomor Surat</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openSubmenu === 'nomor' ? 'rotate-90' : ''}`} />
            </button>
            {openSubmenu === 'nomor' && (
              <div className="ml-4 mt-1 pl-2 border-l border-slate-200 space-y-0.5">
                <button onClick={() => handleSelectTab('nomor-ambil')} className={navItemClass('nomor-ambil')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Ambil Nomor</span>
                </button>
                <button onClick={() => handleSelectTab('nomor-reserved')} className={navItemClass('nomor-reserved')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Nomor Reserved</span>
                </button>
                <button onClick={() => handleSelectTab('nomor-issued')} className={navItemClass('nomor-issued')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Nomor Issued</span>
                </button>
                <button onClick={() => handleSelectTab('nomor-cancelled')} className={navItemClass('nomor-cancelled')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span>Nomor Cancelled</span>
                </button>
                <button onClick={() => handleSelectTab('nomor-riwayat')} className={navItemClass('nomor-riwayat')}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Riwayat Nomor</span>
                </button>
                <button onClick={() => handleSelectTab('nomor-concurrency')} className={navItemClass('nomor-concurrency')}>
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Uji Concurrency</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu Dokumen (SPO, PERDIR, SK, Umum) */}
          <div>
            <button onClick={() => toggleSubmenu('dokumen')} className={submenuHeaderClass('dokumen')}>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Dokumen & SPO</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openSubmenu === 'dokumen' ? 'rotate-90' : ''}`} />
            </button>
            {openSubmenu === 'dokumen' && (
              <div className="ml-4 mt-1 pl-2 border-l border-slate-200 space-y-0.5">
                <button onClick={() => handleSelectTab('dokumen-spo')} className={navItemClass('dokumen-spo')}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>SPO</span>
                </button>
                <button onClick={() => handleSelectTab('dokumen-perdir')} className={navItemClass('dokumen-perdir')}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>PERDIR</span>
                </button>
                <button onClick={() => handleSelectTab('dokumen-sk')} className={navItemClass('dokumen-sk')}>
                  <Award className="w-3.5 h-3.5" />
                  <span>SK</span>
                </button>
                <button onClick={() => handleSelectTab('dokumen-umum')} className={navItemClass('dokumen-umum')}>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Surat Umum</span>
                </button>
              </div>
            )}
          </div>

          {/* Section Header System */}
          <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-2 mt-4">System Settings</div>

          {/* Laporan */}
          <button onClick={() => handleSelectTab('laporan')} className={navItemClass('laporan')}>
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>Laporan</span>
          </button>

          {/* Menu Integrasi */}
          <div>
            <button onClick={() => toggleSubmenu('integrasi')} className={submenuHeaderClass('integrasi')}>
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-slate-500" />
                <span>Integrasi API</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openSubmenu === 'integrasi' ? 'rotate-90' : ''}`} />
            </button>
            {openSubmenu === 'integrasi' && (
              <div className="ml-4 mt-1 pl-2 border-l border-slate-200 space-y-0.5">
                <button onClick={() => handleSelectTab('integrasi-telegram')} className={navItemClass('integrasi-telegram')}>
                  <Bot className="w-3.5 h-3.5 text-sky-500" />
                  <span>Telegram Bot</span>
                </button>
                <button onClick={() => handleSelectTab('integrasi-whatsapp')} className={navItemClass('integrasi-whatsapp')}>
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>WhatsApp Baileys</span>
                </button>
                <button onClick={() => handleSelectTab('kontak-whatsapp')} className={navItemClass('kontak-whatsapp')}>
                  <Contact className="w-3.5 h-3.5 text-teal-600" />
                  <span>Kontak WhatsApp</span>
                </button>
              </div>
            )}
          </div>

          {/* Pengaturan */}
          <button onClick={() => handleSelectTab('pengaturan')} className={navItemClass('pengaturan')}>
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Pengaturan</span>
          </button>

          {/* Backup & Restore */}
          <button onClick={() => handleSelectTab('backup-restore')} className={navItemClass('backup-restore')}>
            <Database className="w-4 h-4 text-slate-500" />
            <span>Backup & Restore</span>
          </button>

          {/* Audit Log */}
          <button onClick={() => handleSelectTab('audit-log')} className={navItemClass('audit-log')}>
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Audit Log</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Atomic Engine</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
