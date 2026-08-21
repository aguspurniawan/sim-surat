import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { IAuditLog } from '../types';
import { ShieldCheck, Search, RefreshCw, Eye } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<IAuditLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiService.getAuditLogs(search);
      setLogs(res);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const totalItems = logs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = logs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Audit Trail & Activity Log</h2>
          <p className="text-xs text-slate-500">Catatan jejak digital lengkap seluruh aksi penomoran, pembuatan surat, dan integrasi kanal</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aksi, user, atau entity..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-medium">Memuat log audit...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">Aksi</th>
                  <th className="p-3.5">Entity / Ref</th>
                  <th className="p-3.5">Pengguna</th>
                  <th className="p-3.5">Kanal</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-500 text-[11px]">{new Date(l.timestamp).toLocaleString('id-ID')}</td>
                    <td className="p-3.5 font-bold text-emerald-800">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-800">{l.entityId || l.entity}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{l.userName}</td>
                    <td className="p-3.5 font-bold text-slate-600">{l.channel}</td>
                    <td className="p-3.5 font-mono text-slate-500">{l.ip}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[11px] text-slate-500">
              Menampilkan <span className="font-bold text-slate-700">{startIndex + 1}</span>-
              <span className="font-bold text-slate-700">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> dari <span className="font-bold text-slate-700">{totalItems}</span> data
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">Sebelumnya</button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">Selanjutnya</button>
            </div>
          </div>
        )}
      </div>

      {/* Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Detail Record Audit</h3>
            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-60">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>
            <button onClick={() => setSelectedLog(null)} className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};