import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { IIncomingLetter, IDisposition, IUser, IUnit } from '../types';
import {
  Inbox, Plus, FileText, Send, RefreshCw, Search, CheckCircle2,
  AlertCircle, Eye, Clock, Check, X, ArrowRight, UserCheck,
  ShieldCheck, MessageSquare, Download, Calendar, Tag, ChevronDown, Filter
} from 'lucide-react';

export const SuratMasukPage: React.FC = () => {
  const [letters, setLetters] = useState<IIncomingLetter[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [units, setUnits] = useState<IUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailLetter, setDetailLetter] = useState<IIncomingLetter | null>(null);
  const [dispModalLetter, setDispModalLetter] = useState<IIncomingLetter | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Form State
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sender, setSender] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [receiverUnitCode, setReceiverUnitCode] = useState('ADM');
  const [classification, setClassification] = useState('Biasa');
  const [urgency, setUrgency] = useState('Biasa');

  // Disposition Form
  const [toUserOrUnit, setToUserOrUnit] = useState('');
  const [targetUnitCode, setTargetUnitCode] = useState('ADM');
  const [toJid, setToJid] = useState('');
  const [instruction, setInstruction] = useState('Tindak lanjuti dan laporkan perkembangan kepada Direktur');
  const [deadline, setDeadline] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, uList, unitList] = await Promise.all([
        apiService.getIncomingLetters(),
        apiService.getUsers().catch(() => []),
        apiService.getUnits().catch(() => [])
      ]);
      setLetters(data);
      setUsers(uList);
      setUnits(unitList);
      if (detailLetter) {
        const refreshed = data.find(l => l.id === detailLetter.id);
        if (refreshed) setDetailLetter(refreshed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!letterNumber || !sender || !subject) {
      alert('Mohon lengkapi nomor surat, pengirim, dan perihal.');
      return;
    }
    try {
      await apiService.createIncomingLetter({
        letterNumber,
        letterDate,
        receivedDate,
        sender,
        senderAddress,
        subject,
        receiverUnitCode,
        classification,
        urgency
      });
      setShowAddModal(false);
      setLetterNumber('');
      setSender('');
      setSubject('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddDisposition = async () => {
    if (!dispModalLetter) return;
    if (!toUserOrUnit) {
      alert('Pilih tujuan disposisi terlebih dahulu.');
      return;
    }
    try {
      await apiService.createDisposition(dispModalLetter.id, {
        toUserOrUnit,
        targetUnitCode,
        toJid: toJid || undefined,
        instruction,
        deadline
      });
      setDispModalLetter(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApproveDisp = async (dispId: string) => {
    try {
      await apiService.approveDisposition(dispId, actionNotes || 'Disetujui Direktur');
      setActionNotes('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectDisp = async (dispId: string) => {
    const reason = prompt('Masukkan alasan penolakan disposisi:');
    if (!reason) return;
    try {
      await apiService.rejectDisposition(dispId, reason);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleProcessDisp = async (dispId: string) => {
    try {
      await apiService.processDisposition(dispId);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCompleteDisp = async (dispId: string) => {
    try {
      await apiService.completeDisposition(dispId);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Filter letters
  const filteredLetters = letters.filter(l => {
    const matchSearch =
      (l.agendaNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.letterNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.sender || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.subject || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalItems = filteredLetters.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLetters = filteredLetters.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">Menunggu ACC Direktur</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">Disetujui Direktur</span>;
      case 'DISPOSITIONED':
        return <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold">Terdisposisi</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold">Sedang Diproses</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-300 text-green-800 text-[10px] font-bold">Selesai Ditindaklanjuti</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">Ditolak</span>;
      case 'REVISION_REQUESTED':
        return <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold">Perlu Revisi</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold">{status || 'Diterima'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-2">
            <Inbox className="w-3.5 h-3.5" />
            <span>Manajemen Surat Masuk & Disposisi</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Arsip & Disposisi Surat Masuk</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitoring rekam jejak surat masuk, persetujuan disposisi Direktur, dan pelacakan tindak lanjut unit kerja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Input Surat Masuk (Manual)</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Cari No Agenda, No Surat, Pengirim, Perihal..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'PROCESSED', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' && 'Semua'}
              {st === 'PROCESSED' && 'Diterima'}
              {st === 'PENDING_APPROVAL' && 'Menunggu ACC'}
              {st === 'APPROVED' && 'Disetujui'}
              {st === 'IN_PROGRESS' && 'Diproses'}
              {st === 'COMPLETED' && 'Selesai'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs font-medium">Memuat data surat masuk & disposisi...</p>
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Tidak ada surat masuk ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan form input manual atau kirim file PDF melalui WhatsApp Sekretariat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">No. Agenda</th>
                  <th className="p-3.5">No. Surat Asal</th>
                  <th className="p-3.5">Pengirim</th>
                  <th className="p-3.5">Perihal</th>
                  <th className="p-3.5">Tgl Masuk</th>
                  <th className="p-3.5">Status & Disposisi</th>
                  <th className="p-3.5">Kanal</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedLetters.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">
                      {l.agendaNumber}
                    </td>
                    <td className="p-3.5 font-mono font-semibold text-slate-800">
                      {l.letterNumber}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      {l.sender}
                    </td>
                    <td className="p-3.5 text-slate-800 max-w-xs truncate" title={l.subject}>
                      {l.subject}
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {l.receivedDate}
                    </td>
                    <td className="p-3.5 space-y-1">
                      <div>{getStatusBadge(l.status)}</div>
                      <div className="text-[10px] text-slate-400">
                        {l.dispositions?.length || 0} Lembar Disposisi
                      </div>
                    </td>
                    <td className="p-3.5">
                      {l.channel === 'WHATSAPP' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                          <span>Web Portal</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 shrink-0">
                      <button
                        onClick={() => setDetailLetter(l)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Detail</span>
                      </button>
                      <button
                        onClick={() => setDispModalLetter(l)}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Disposisi</span>
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
              <span className="font-bold text-slate-700">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> dari{' '}
              <span className="font-bold text-slate-700">{totalItems}</span> data
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
              >
                Sebelumnya
              </button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL WITH DISPOSITION WORKFLOW & AUDIT TRAIL */}
      {detailLetter && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Detail Surat Masuk</span>
                <h3 className="font-bold text-slate-900 text-lg">{detailLetter.agendaNumber}</h3>
              </div>
              <button
                onClick={() => setDetailLetter(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-[10px]">Nomor Surat Asal</span>
                <span className="font-mono font-bold text-slate-800">{detailLetter.letterNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Pengirim</span>
                <span className="font-bold text-slate-800">{detailLetter.sender}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Tanggal Surat</span>
                <span className="font-semibold text-slate-700">{detailLetter.letterDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Tanggal Diterima</span>
                <span className="font-semibold text-slate-700">{detailLetter.receivedDate}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px]">Perihal</span>
                <span className="font-bold text-slate-900">{detailLetter.subject}</span>
              </div>
              {detailLetter.fileUrl && (
                <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span className="font-semibold text-slate-700">{detailLetter.fileName || 'Berkas Lampiran Surat'}</span>
                  </div>
                  <a
                    href={detailLetter.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 hover:bg-indigo-100"
                  >
                    <Download className="w-3 h-3" />
                    <span>Unduh Dokumen</span>
                  </a>
                </div>
              )}
            </div>

            {/* Dispositions List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>Lembar Disposisi ({detailLetter.dispositions?.length || 0})</span>
                </h4>
                <button
                  onClick={() => {
                    const l = detailLetter;
                    setDetailLetter(null);
                    setDispModalLetter(l);
                  }}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-700"
                >
                  + Tambah Disposisi
                </button>
              </div>

              {(!detailLetter.dispositions || detailLetter.dispositions.length === 0) ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Belum ada lembar disposisi untuk surat ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {detailLetter.dispositions.map((disp: IDisposition, idx: number) => (
                    <div key={disp.id || idx} className="p-4 bg-purple-50/50 border border-purple-200/70 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-purple-700 uppercase">Tujuan:</span>
                          <h5 className="font-bold text-slate-900 text-xs">{disp.toUserOrUnit}</h5>
                        </div>
                        <div>{getStatusBadge(disp.status)}</div>
                      </div>

                      <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-purple-100 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block">Instruksi:</span>
                        <p className="font-medium text-slate-800">{disp.instruction}</p>
                        {disp.deadline && (
                          <div className="text-[11px] text-rose-600 font-semibold pt-1">
                            Batas Waktu: {disp.deadline}
                          </div>
                        )}
                        {disp.directorNotes && (
                          <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded-lg mt-2">
                            <strong>Catatan Direktur:</strong> {disp.directorNotes}
                          </div>
                        )}
                      </div>

                      {/* Workflow Control Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {disp.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => handleRejectDisp(disp.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              <span>Tolak (Direktur)</span>
                            </button>
                            <button
                              onClick={() => handleApproveDisp(disp.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] inline-flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Setujui (ACC Direktur)</span>
                            </button>
                          </>
                        )}

                        {disp.status === 'APPROVED' && (
                          <button
                            onClick={() => handleProcessDisp(disp.id)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-[11px] inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>Mulai Tindak Lanjut Unit</span>
                          </button>
                        )}

                        {disp.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleCompleteDisp(disp.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Tandai Selesai (Unit)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity History */}
            {detailLetter.activityHistory && detailLetter.activityHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 text-xs">Jejak Aktivitas & Audit</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {detailLetter.activityHistory.map((act, i) => (
                    <div key={i} className="text-[11px] p-2 bg-slate-50 rounded-xl flex items-center justify-between text-slate-600">
                      <div>
                        <strong>{act.user}</strong>: {act.details || act.action}
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(act.timestamp).toLocaleTimeString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => setDetailLetter(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INCOMING LETTER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Input Surat Masuk Baru</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Nomor Surat Asal *</label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="Contoh: 045/DINKES/VIII/2026"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Tanggal Surat</label>
                  <input
                    type="date"
                    value={letterDate}
                    onChange={(e) => setLetterDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Tanggal Diterima</label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700">Pengirim (Instansi / Perusahaan) *</label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Dinas Kesehatan Kabupaten Pati"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Perihal *</label>
                <textarea
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Perihal surat masuk..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleCreate}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Simpan Surat Masuk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPOSITION MODAL */}
      {dispModalLetter && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-purple-900 text-base">Buat Lembar Disposisi Pimpinan</h3>
            <div className="p-3.5 bg-purple-50 rounded-xl text-xs text-purple-900 space-y-1">
              <div>Agenda: <strong>{dispModalLetter.agendaNumber}</strong></div>
              <div>Pengirim: {dispModalLetter.sender}</div>
              <div className="truncate">Perihal: {dispModalLetter.subject}</div>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Diteruskan Kepada (Pejabat / Staf / Unit) *</label>
                <select
                  value={`${toUserOrUnit}|${targetUnitCode}|${toJid}`}
                  onChange={(e) => {
                    const [name, unit, jid] = e.target.value.split('|');
                    setToUserOrUnit(name || '');
                    setTargetUnitCode(unit || 'ADM');
                    setToJid(jid || '');
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">-- Pilih Penerima Disposisi --</option>
                  <optgroup label="Pejabat & Pengguna">
                    {users.filter(u => u.isActive !== false).map(u => (
                      <option key={u.id} value={`${u.fullName}|${u.unitCode || 'ADM'}|${u.whatsappJid || ''}`}>
                        {u.fullName} ({u.role} - {u.unitCode || 'RS'}) {u.whatsappJid ? '📱 WA' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Unit Kerja / Satker">
                    {units.map(u => (
                      <option key={u.id || u.code} value={`${u.name}|${u.code}|`}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </optgroup>
                </select>
                {toJid && (
                  <p className="mt-1 text-[11px] text-emerald-700 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp: {toJid.split('@')[0]}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="font-bold text-slate-700">Instruksi Disposisi *</label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  rows={3}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Batas Waktu Penyelesaian (Deadline)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDispModalLetter(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleAddDisposition}
                className="w-1/2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Ajukan ke Direktur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
