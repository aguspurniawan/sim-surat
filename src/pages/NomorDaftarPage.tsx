import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { INumberReservation, NumberStatus, ChannelType } from '../types';
import {
  Search, Filter, CheckCircle, XCircle, Clock, Hash,
  RefreshCw, AlertCircle, Eye, ShieldAlert, Bot, MessageSquare, Monitor
} from 'lucide-react';

interface NomorDaftarPageProps {
  initialTab?: 'ALL' | 'RESERVED' | 'ISSUED' | 'CANCELLED';
}

export const NomorDaftarPage: React.FC<NomorDaftarPageProps> = ({ initialTab = 'ALL' }) => {
  const [activeStatus, setActiveStatus] = useState<string>(initialTab);
  const [list, setList] = useState<INumberReservation[]>([]);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedItem, setSelectedItem] = useState<INumberReservation | null>(null);
  const [cancelReasonModal, setCancelReasonModal] = useState<INumberReservation | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState<string>('');
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [issuingSelected, setIssuingSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiService.getNumberHistory({
        status: activeStatus === 'ALL' ? '' : activeStatus,
        typeCode: typeFilter,
        search
      });
      setList(res);
      setCurrentPage(1);
      setSelectedNumbers([]);
    } catch (err) {
      console.error('Error fetching numbering history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeStatus, typeFilter, search]);

  const handleIssueNumber = async (numStr: string) => {
    if (!confirm(`Konfirmasi penerbitan resmi untuk nomor ${numStr}?`)) return;
    try {
      await apiService.issueNumber(numStr);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCancelNumber = async () => {
    if (!cancelReasonModal) return;
    if (!cancelReasonText.trim()) {
      alert('Alasan pembatalan wajib diisi.');
      return;
    }
    try {
      await apiService.cancelNumber(cancelReasonModal.number, cancelReasonText);
      setCancelReasonModal(null);
      setCancelReasonText('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleIssueSelected = async () => {
    if (selectedNumbers.length === 0 || issuingSelected) return;

    if (
      !confirm(
        `Konfirmasi penerbitan resmi untuk ${selectedNumbers.length} nomor terpilih?`
      )
    ) {
      return;
    }

    setIssuingSelected(true);

    const failed: string[] = [];
    let successCount = 0;

    try {
      for (const number of selectedNumbers) {
        try {
          await apiService.issueNumber(number);
          successCount++;
        } catch (error) {
          failed.push(number);
        }
      }

      setSelectedNumbers(failed);
      await loadData();

      if (failed.length > 0) {
        alert(
          `${successCount} nomor berhasil di-issue. ${failed.length} nomor gagal dan tetap dapat diproses kembali.`
        );
      } else {
        alert(`Berhasil menerbitkan ${successCount} nomor.`);
      }
    } finally {
      setIssuingSelected(false);
    }
  };

  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedList = list.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const reservedOnPage = paginatedList.filter(
    (r) => r.status === NumberStatus.RESERVED
  );

  const allReservedSelectedOnPage =
    reservedOnPage.length > 0 &&
    reservedOnPage.every((r) => selectedNumbers.includes(r.number));

  const toggleNumberSelection = (number: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageNumbers = reservedOnPage.map((r) => r.number);

    if (allReservedSelectedOnPage) {
      setSelectedNumbers((prev) =>
        prev.filter((n) => !pageNumbers.includes(n))
      );
    } else {
      setSelectedNumbers((prev) =>
        Array.from(new Set([...prev, ...pageNumbers]))
      );
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Daftar & Riwayat Penomoran</h2>
            <p className="text-xs text-slate-500">Rekam jejak seluruh transaksi nomor surat lintas kanal (Web, Telegram, WhatsApp)</p>
          </div>
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors self-start md:self-auto flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'ALL', label: 'Semua Status' },
            { id: NumberStatus.RESERVED, label: 'Reserved (Dicadangkan)' },
            { id: NumberStatus.ISSUED, label: 'Issued (Diterbitkan)' },
            { id: NumberStatus.CANCELLED, label: 'Cancelled / Void' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Type Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan nomor surat, perihal, judul, atau pemohon..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-700"
          >
            <option value="">Semua Jenis Surat</option>
            <option value="SPO">SPO</option>
            <option value="PERDIR">PERDIR</option>
            <option value="SK">SK</option>
            <option value="UMUM">UMUM</option>
          </select>
        </div>
      </div>

      {/* Bulk Issue Toolbar */}
      {selectedNumbers.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-emerald-900">
              {selectedNumbers.length} nomor dipilih
            </div>
            <div className="text-[11px] text-emerald-700">
              Nomor RESERVED siap diterbitkan secara massal.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedNumbers([])}
              disabled={issuingSelected}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              Batal Pilihan
            </button>
            <button
              onClick={handleIssueSelected}
              disabled={issuingSelected}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {issuingSelected ? 'Memproses...' : `Issue Terpilih (${selectedNumbers.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-medium">Memuat data nomor...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-sm">Tidak ada data nomor surat ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={allReservedSelectedOnPage}
                      onChange={toggleSelectAllOnPage}
                      disabled={reservedOnPage.length === 0}
                      title="Pilih semua nomor RESERVED di halaman ini"
                      className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </th>
                  <th className="p-3.5">Nomor Surat</th>
                  <th className="p-3.5">Jenis</th>
                  <th className="p-3.5">Unit</th>
                  <th className="p-3.5">Perihal / Judul</th>
                  <th className="p-3.5">Pemohon</th>
                  <th className="p-3.5">Kanal</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Keterangan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 w-10">
                      {r.status === NumberStatus.RESERVED ? (
                        <input
                          type="checkbox"
                          checked={selectedNumbers.includes(r.number)}
                          onChange={() => toggleNumberSelection(r.number)}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          title="Pilih nomor untuk Issue massal"
                        />
                      ) : null}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">{r.number}</td>
                    <td className="p-3.5 font-semibold text-slate-700">{r.typeCode}</td>
                    <td className="p-3.5">{r.unitCode || 'ADM'}</td>
                    <td className="p-3.5 text-slate-800 max-w-xs truncate">{r.subject || r.title || '-'}</td>
                    <td className="p-3.5">{r.userName}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.channel === ChannelType.TELEGRAM ? 'bg-sky-100 text-sky-700' :
                        r.channel === ChannelType.WHATSAPP ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {r.channel === ChannelType.TELEGRAM && <Bot className="w-3 h-3" />}
                        {r.channel === ChannelType.WHATSAPP && <MessageSquare className="w-3 h-3" />}
                        {r.channel === ChannelType.WEB && <Monitor className="w-3 h-3" />}
                        <span>{r.channel}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">{new Date(r.createdAt).toLocaleDateString('id-ID')}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        r.status === NumberStatus.RESERVED ? 'bg-amber-100 text-amber-800' :
                        r.status === NumberStatus.ISSUED ? 'bg-emerald-100 text-emerald-800' :
                        r.status === NumberStatus.CANCELLED || r.status === NumberStatus.VOID ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {r.status === NumberStatus.CANCELLED || r.status === NumberStatus.VOID ? (
                        <span className="text-red-600 font-semibold text-[11px]">Nomor dibatalkan</span>
                      ) : r.previousCancelledNumber ? (
                        <span className="text-red-600 font-semibold text-[11px]">
                          Melanjutkan setelah {r.previousCancelledNumber} dibatalkan
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {r.status === NumberStatus.RESERVED && (
                        <>
                          <button
                            onClick={() => handleIssueNumber(r.number)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition-colors"
                          >
                            Issue
                          </button>
                          <button
                            onClick={() => setCancelReasonModal(r)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] transition-colors"
                          >
                            Batal
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedItem(r)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title="Lihat Detail"
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
            <div className="text-[11px] text-slate-500">Menampilkan <span className="font-bold text-slate-700">{startIndex + 1}</span>-<span className="font-bold text-slate-700">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> dari <span className="font-bold text-slate-700">{totalItems}</span> data</div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">Sebelumnya</button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">Selanjutnya</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Detail Nomor Surat</h3>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-3 bg-slate-900 text-emerald-400 font-mono font-bold text-center text-lg rounded-xl">
                {selectedItem.number}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div><span className="text-slate-400">Jenis:</span> <span className="font-bold">{selectedItem.typeCode}</span></div>
                <div><span className="text-slate-400">Unit:</span> <span className="font-bold">{selectedItem.unitCode}</span></div>
                <div><span className="text-slate-400">Status:</span> <span className="font-bold text-emerald-600">{selectedItem.status}</span></div>
                <div><span className="text-slate-400">Kanal:</span> <span className="font-bold">{selectedItem.channel}</span></div>
                <div className="col-span-2"><span className="text-slate-400">Perihal / Judul:</span> <p className="font-semibold text-slate-900 mt-0.5">{selectedItem.subject || selectedItem.title || '-'}</p></div>
                <div className="col-span-2"><span className="text-slate-400">Pemohon:</span> <p className="font-semibold text-slate-900">{selectedItem.userName}</p></div>
                {selectedItem.cancelReason && (
                  <div className="col-span-2 p-2.5 bg-rose-50 text-rose-800 rounded-lg">
                    <strong>Alasan Pembatalan:</strong> {selectedItem.cancelReason}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedItem(null)} className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Cancel Reason Modal */}
      {cancelReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-rose-700 text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span>Pembatalan Nomor Surat</span>
            </h3>
            <p className="text-xs text-slate-600">
              Sesuai kebijakan audit, nomor yang dibatalkan tetap dianggap pernah digunakan dan meninggalkan audit trail:
            </p>
            <div className="font-mono text-sm font-bold bg-slate-100 p-2.5 rounded-lg text-slate-800">
              {cancelReasonModal.number}
            </div>
            <textarea
              value={cancelReasonText}
              onChange={(e) => setCancelReasonText(e.target.value)}
              placeholder="Masukkan alasan pembatalan nomor surat..."
              rows={3}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setCancelReasonModal(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleCancelNumber}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Konfirmasi Pembatalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};