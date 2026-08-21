import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { IDashboardStats, INumberReservation, NumberStatus } from '../types';
import {
  Inbox, Send, FileText, CheckCircle2, Hash, AlertTriangle,
  TrendingUp, Clock, ArrowUpRight, Plus, RefreshCw, Zap
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';

interface DashboardPageProps {
  onNavigateToAmbilNomor: () => void;
  onNavigateToNomorList: () => void;
}

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6366F1'];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToAmbilNomor,
  onNavigateToNomorList
}) => {
  const [stats, setStats] = useState<IDashboardStats | null>(null);
  const [recentReservations, setRecentReservations] = useState<INumberReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDashboardStats();
      const history = await apiService.getNumberHistory();
      setStats(data);
      setRecentReservations(history.slice(0, 6));
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="font-medium text-sm">Memuat data dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Surat Masuk</p>
            <h2 className="text-2xl font-bold text-slate-900">{stats.totalIncoming}</h2>
            <div className="mt-2 flex items-center text-emerald-600 text-[10px] font-bold">
              <TrendingUp className="w-3 h-3 mr-1" /> +12% bulan ini
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-100">
            <Inbox className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Surat Keluar</p>
            <h2 className="text-2xl font-bold text-slate-900">{stats.totalOutgoing}</h2>
            <div className="mt-2 flex items-center text-slate-400 text-[10px] font-bold">
              Stabil bulan ini
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-100">
            <Send className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Nomor Reserved</p>
            <h2 className="text-2xl font-bold text-indigo-600">{stats.reservedNumbers}</h2>
            <div className="mt-2 flex items-center text-amber-600 text-[10px] font-bold">
              Pemesanan Aktif
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Hash className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Nomor Issued</p>
            <h2 className="text-2xl font-bold text-slate-900">{stats.issuedNumbers}</h2>
            <div className="mt-2 flex items-center text-emerald-600 text-[10px] font-bold">
              Terbit Resmi
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Primary Action Header Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Configurable Atomic Engine</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Penomoran Otomatis RS Sebening Kasih</h2>
          <p className="text-xs text-slate-500">Service terpusat 0% nomor ganda terintegrasi dengan Web, Telegram, dan WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToAmbilNomor}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ambil Nomor Baru</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Tren Penomoran Surat</h3>
              <p className="text-xs text-slate-500">Statistik transaksi bulanan</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Masuk
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Keluar
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Area type="monotone" dataKey="masuk" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorMasuk)" />
                <Area type="monotone" dataKey="keluar" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorKeluar)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Letter Type Pie Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Distribusi Kategori Surat</h3>
            <p className="text-xs text-slate-500">Persentase nomor per jenis</p>
          </div>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byType}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {stats.byType.map((entry) => (
                    <Cell
                      key={`pie-${entry.name}`}
                      fill={COLORS[stats.byType.indexOf(entry) % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {stats.byType.map((t, idx) => (
              <div key={t.name} className="flex items-center gap-2 p-1.5 rounded-md bg-slate-50 border border-slate-100">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="font-medium text-slate-700 truncate">{t.name}:</span>
                <span className="font-bold text-slate-900 ml-auto">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Reservations Table */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Aktivitas Penomoran Terakhir</h3>
          <button
            onClick={onNavigateToNomorList}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 transition-colors cursor-pointer"
          >
            Lihat Audit Log
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-3">Nomor Surat</th>
                <th className="px-6 py-3">Jenis</th>
                <th className="px-6 py-3">Unit</th>
                <th className="px-6 py-3">Perihal</th>
                <th className="px-6 py-3">Pemohon</th>
                <th className="px-6 py-3">Kanal</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentReservations.map((r) => (
                  <tr
                    key={r.number}
                    className="hover:bg-slate-50 transition-colors"
                  >
                  <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">{r.number}</td>
                  <td className="px-6 py-4 font-medium text-xs text-slate-700">{r.typeCode}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">{r.unitCode || 'ADM'}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-800 max-w-xs truncate">{r.subject || r.title || '-'}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">{r.userName}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      r.channel === 'TELEGRAM' ? 'bg-sky-100 text-sky-700' :
                      r.channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      r.status === NumberStatus.RESERVED ? 'bg-indigo-100 text-indigo-700' :
                      r.status === NumberStatus.ISSUED ? 'bg-emerald-100 text-emerald-700' :
                      r.status === NumberStatus.CANCELLED ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
