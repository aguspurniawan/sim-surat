import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { AmbilNomorPage } from './pages/AmbilNomorPage';
import { NomorDaftarPage } from './pages/NomorDaftarPage';
import { SuratMasukPage } from './pages/SuratMasukPage';
import { SuratKeluarPage } from './pages/SuratKeluarPage';
import { DokumenSopPage } from './pages/DokumenSopPage';
import { DokumenPerdirPage } from './pages/DokumenPerdirPage';
import { DokumenSkPage } from './pages/DokumenSkPage';
import { DokumenUmumPage } from './pages/DokumenUmumPage';
import { LaporanPage } from './pages/LaporanPage';
import { IntegrasiTelegramPage } from './pages/IntegrasiTelegramPage';
import { IntegrasiWhatsappPage } from './pages/IntegrasiWhatsappPage';
import { KontakWhatsappPage } from './pages/KontakWhatsappPage';
import { ConcurrencyTestPage } from './pages/ConcurrencyTestPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { AuditLogPage } from './pages/AuditLogPage';
import {
  ShieldCheck, Lock, LogIn, Eye, EyeOff, UserCheck, Activity,
  Server, Smartphone, CheckCircle, Hospital
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, login } = useAuthStore();
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Default view is Login Page (no auto-login)
  useEffect(() => {
    // Keep user state null initially to display Login Page by default
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      await login(loginUsername, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Login gagal. Periksa username dan password Anda.');
    } finally {
      setLoggingIn(false);
    }
  };

  const setQuickProfile = (username: string, pass: string) => {
    setLoginUsername(username);
    setLoginPassword(pass);
    setLoginError('');
  };

  // If not logged in, show sleek, professional login form
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-6 font-sans text-slate-800 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 md:p-10 max-w-md w-full shadow-2xl relative z-10 space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-3xl shadow-lg shadow-indigo-500/30 ring-8 ring-indigo-50/50 mx-auto">
              S
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-[11px] font-bold text-emerald-700 mb-2">
                <Hospital className="w-3.5 h-3.5 text-emerald-600" />
                <span>RS SEBENING KASIH</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-snug">
                Portal E-Surat & Dokumen
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Sistem Manajemen Surat Resmi & Penomoran Otomatis RS
              </p>
            </div>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center shadow-2xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Username / NIP</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                placeholder="Masukkan username Anda..."
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Kata Sandi / Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loggingIn ? 'Memvalidasi Akun...' : 'Masuk ke Sistem'}</span>
            </button>
          </form>

          {/* Quick Fills for Demo */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Pilih Akun Demo (1-Klik Isi Login)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuickProfile('admin', 'admin123')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  loginUsername === 'admin'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <div className="text-[11px] font-bold">Super Admin</div>
              </button>

              <button
                type="button"
                onClick={() => setQuickProfile('direktur', 'password123')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  loginUsername === 'direktur'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <div className="text-[11px] font-bold">Direksi</div>
              </button>

              <button
                type="button"
                onClick={() => setQuickProfile('staff', 'password123')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  loginUsername === 'staff'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <div className="text-[11px] font-bold">Staff Admin</div>
              </button>
            </div>
          </div>

          {/* Security & Tech Badge */}
          <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Akses Terenkripsi & Ter-audit</span>
            </span>
            <span className="text-slate-400 font-medium">v2.4 Production</span>
          </div>
        </div>
      </div>
    );
  }

  // Render current tab component
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigateToAmbilNomor={() => setActiveTab('nomor-ambil')}
            onNavigateToNomorList={() => setActiveTab('nomor-issued')}
          />
        );

      case 'surat-masuk':
      case 'surat-disposisi':
        return <SuratMasukPage />;

      case 'surat-keluar':
      case 'surat-draft':
      case 'surat-persetujuan':
        return <SuratKeluarPage />;

      case 'nomor-ambil':
        return <AmbilNomorPage />;

      case 'nomor-reserved':
        return <NomorDaftarPage initialTab="RESERVED" />;

      case 'nomor-issued':
        return <NomorDaftarPage initialTab="ISSUED" />;

      case 'nomor-cancelled':
        return <NomorDaftarPage initialTab="CANCELLED" />;

      case 'nomor-riwayat':
        return <NomorDaftarPage initialTab="ALL" />;

      case 'nomor-concurrency':
        return <ConcurrencyTestPage />;

      case 'dokumen-spo':
        return <DokumenSopPage />;

      case 'dokumen-perdir':
        return <DokumenPerdirPage />;

      case 'dokumen-sk':
        return <DokumenSkPage />;

      case 'dokumen-umum':
        return <DokumenUmumPage />;

      case 'laporan':
        return <LaporanPage />;

      case 'integrasi-telegram':
        return <IntegrasiTelegramPage />;

      case 'integrasi-whatsapp':
        return <IntegrasiWhatsappPage />;

      case 'kontak-whatsapp':
        return <KontakWhatsappPage />;

      case 'pengaturan':
        return <PengaturanPage />;

      case 'backup-restore':
        return <BackupRestorePage />;

      case 'audit-log':
        return <AuditLogPage />;

      default:
        return <DashboardPage onNavigateToAmbilNomor={() => setActiveTab('nomor-ambil')} onNavigateToNomorList={() => setActiveTab('nomor-issued')} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          activeTab={activeTab}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
