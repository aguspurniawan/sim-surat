import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { IDocumentUmum } from '../types';
import { 
  FileSpreadsheet, Plus, RefreshCw, Eye, Edit2, CheckCircle2, 
  Upload, FileText, Download, Trash2, X, ExternalLink, Paperclip 
} from 'lucide-react';

export const DokumenUmumPage: React.FC = () => {
  const [docs, setDocs] = useState<IDocumentUmum[]>([]);
  const [loading, setLoading] = useState(true);
  const [numberingHistory, setNumberingHistory] = useState<any[]>([]);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<IDocumentUmum | null>(null);
  const [editingDoc, setEditingDoc] = useState<IDocumentUmum | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state for Create
  const [unitCode, setUnitCode] = useState('ADM');
  const [destination, setDestination] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [createFile, setCreateFile] = useState<{ fileName: string; fileUrl: string; fileSize: string; uploadDate: string } | null>(null);

  // Form state for Edit
  const [editUnitCode, setEditUnitCode] = useState('ADM');
  const [editDestination, setEditDestination] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFile, setEditFile] = useState<{ fileName: string; fileUrl: string; fileSize: string; uploadDate: string } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, history] = await Promise.all([
        apiService.getUmumDocuments(),
        apiService.getNumberHistory()
      ]);
      setDocs(data);
      setNumberingHistory(history);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'create' | 'edit' | 'detail') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const uploaded = await apiService.uploadFile(file.name, base64Data);

        if (target === 'create') {
          setCreateFile(uploaded);
        } else if (target === 'edit') {
          setEditFile(uploaded);
        } else if (target === 'detail' && selectedDoc) {
          // Instantly attach uploaded file to current selectedDoc on local PC disk
          const updatedDoc = await apiService.updateUmumDocument(selectedDoc.id || selectedDoc.number, {
            fileName: uploaded.fileName,
            fileUrl: uploaded.fileUrl,
            fileSize: uploaded.fileSize,
            uploadDate: uploaded.uploadDate
          });
          setSelectedDoc({ ...selectedDoc, ...updatedDoc });
          loadData();
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Gagal mengunggah file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!destination || !subject || !content) {
      alert('Mohon lengkapi Tujuan, Perihal, dan Ringkasan/Isi Surat.');
      return;
    }
    try {
      await apiService.createUmumDocument({
        unitCode,
        destination,
        subject,
        content,
        summary: content,
        ...(createFile ? {
          fileName: createFile.fileName,
          fileUrl: createFile.fileUrl,
          fileSize: createFile.fileSize,
          uploadDate: createFile.uploadDate
        } : {})
      });
      setShowCreateModal(false);
      setDestination('');
      setSubject('');
      setContent('');
      setCreateFile(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEditModal = (doc: IDocumentUmum) => {
    setEditingDoc(doc);
    setEditUnitCode(doc.unitCode || 'ADM');
    setEditDestination(doc.destination || '');
    setEditSubject(doc.subject || '');
    setEditContent(doc.content || doc.summary || '');
    if (doc.fileUrl && doc.fileName) {
      setEditFile({
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize || 'FILE',
        uploadDate: doc.uploadDate || ''
      });
    } else {
      setEditFile(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    try {
      await apiService.updateUmumDocument(editingDoc.id || editingDoc.number, {
        unitCode: editUnitCode,
        destination: editDestination,
        subject: editSubject,
        content: editContent,
        summary: editContent,
        fileName: editFile?.fileName || '',
        fileUrl: editFile?.fileUrl || '',
        fileSize: editFile?.fileSize || '',
        uploadDate: editFile?.uploadDate || ''
      });
      setEditingDoc(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRemoveFileFromDetail = async () => {
    if (!selectedDoc) return;
    if (!confirm('Apakah Anda yakin ingin menghapus lampiran dokumen dari surat ini?')) return;
    try {
      const updated = await apiService.updateUmumDocument(selectedDoc.id || selectedDoc.number, {
        fileName: '',
        fileUrl: '',
        fileSize: '',
        uploadDate: ''
      });
      setSelectedDoc({ ...selectedDoc, ...updated, fileName: undefined, fileUrl: undefined });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const totalItems = docs.length; // untuk SK/PERDIR
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = docs.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const getPreviousCancelledNumber = (number?: string) =>
    numberingHistory.find((r: any) => r.number === number)?.previousCancelledNumber;


  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Surat Umum / Dinas</h2>
          <p className="text-xs text-slate-500">Penomoran otomatis format: &#123;NO&#125;/RSSBK/&#123;UNIT&#125;/&#123;BULAN_ROMAWI&#125;/&#123;TAHUN&#125;</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Surat Umum</span>
        </button>
      </div>

      {/* Sync Banner Notice */}
      <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-start md:items-center gap-3 text-xs text-sky-900 shadow-2xs">
        <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5 md:mt-0" />
        <div>
          <span className="font-bold">Otomatis Terintegrasi ke Dokumen Surat Umum:</span> Penomoran kode jenis <strong className="text-indigo-700">UMUM</strong> yang dipesan melalui Telegram Bot atau WhatsApp Baileys <strong className="text-emerald-700 font-bold">otomatis terbit dan muncul di daftar Dokumen Surat Umum</strong> secara realtime! Anda dapat mengedit perihal, tujuan, serta mengunggah file dokumen fisik secara langsung.
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-medium">Memuat surat umum...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[750px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Nomor Surat</th>
                  <th className="p-3.5">Kanal</th>
                  <th className="p-3.5">Unit</th>
                  <th className="p-3.5">Tujuan Surat</th>
                  <th className="p-3.5">Perihal</th>
                  <th className="p-3.5">Lampiran Dokumen</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Keterangan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedItems.map((d) => (
                  <tr key={d.id || d.number} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{d.number}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        d.channel === 'TELEGRAM'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : d.channel === 'WHATSAPP'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {d.channel || 'WEB'}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">{d.unitCode}</td>
                    <td className="p-3.5 font-bold text-slate-900">{d.destination || 'Internal / General'}</td>
                    <td className="p-3.5 text-slate-800 max-w-xs truncate">{d.subject}</td>
                    <td className="p-3.5">
                      {d.fileUrl ? (
                        <a 
                          href={d.fileUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{d.fileName || 'Dokumen'}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Belum Ada File</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-500">{d.date}</td>
                    <td className="p-3.5">{getPreviousCancelledNumber(d.number) ? (
                      <span className="text-red-600 font-semibold text-[11px]">
                        Melanjutkan setelah {getPreviousCancelledNumber(d.number)} dibatalkan
                      </span>
                    ) : <span className="text-slate-400">-</span>}</td>
                    <td className="p-3.5 text-right space-x-1">
                      <button 
                        onClick={() => setSelectedDoc(d)} 
                        title="Lihat Detail & Upload" 
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg bg-slate-100 cursor-pointer transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openEditModal(d)} 
                        title="Edit Dokumen" 
                        className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[11px] text-slate-500">
              Menampilkan{' '}
              <span className="font-bold text-slate-700">
                {startIndex + 1}
              </span>
              {' - '}
              <span className="font-bold text-slate-700">
                {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
              </span>
              {' dari '}
              <span className="font-bold text-slate-700">
                {totalItems}
              </span>
              {' data'}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.max(1, p - 1))
                }
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold disabled:opacity-40"
              >
                Sebelumnya
              </button>

              <span className="px-3 py-1.5 text-xs font-bold">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}

      {/* Modal Add / Create */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Buat Surat Umum / Dinas Baru</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Unit Pengirim</label>
                <select value={unitCode} onChange={(e) => setUnitCode(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50">
                  <option value="ADM">ADM - Administrasi & Umum</option>
                  <option value="SDM">SDM - Sumber Daya Manusia</option>
                  <option value="KEP">KEP - Keperawatan</option>
                  <option value="MUTU">MUTU - Komite Mutu</option>
                  <option value="FAR">FAR - Farmasi</option>
                  <option value="KEU">KEU - Keuangan</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Tujuan Surat *</label>
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Contoh: Kepala Dinas Kesehatan Kab. Pati" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Perihal *</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Perihal surat umum" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Ringkasan / Isi Surat *</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ketik ringkasan atau poin-poin surat" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500" rows={3} />
              </div>

              {/* Upload File Dokumen */}
              <div className="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                <label className="font-bold text-slate-700 block flex items-center justify-between">
                  <span>Unggah File Surat Physical (PDF / DOCX / Image)</span>
                  {uploading && <span className="text-emerald-600 text-[11px] animate-pulse">Mengunggah...</span>}
                </label>
                {createFile ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="font-bold truncate">{createFile.fileName}</span>
                      <span className="text-[10px] text-emerald-600">({createFile.fileSize})</span>
                    </div>
                    <button onClick={() => setCreateFile(null)} className="text-emerald-700 hover:text-red-600 font-bold text-xs p-1">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors text-slate-600">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs">Pilih File dari Komputer PC</span>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'create')} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Batal</button>
              <button onClick={handleCreate} className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer">Terbitkan Surat</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Surat Umum</h3>
                <span className="text-xs font-mono font-bold text-emerald-600">{editingDoc.number}</span>
              </div>
              <button onClick={() => setEditingDoc(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Unit Pengirim</label>
                <select value={editUnitCode} onChange={(e) => setEditUnitCode(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50">
                  <option value="ADM">ADM - Administrasi & Umum</option>
                  <option value="SDM">SDM - Sumber Daya Manusia</option>
                  <option value="KEP">KEP - Keperawatan</option>
                  <option value="MUTU">MUTU - Komite Mutu</option>
                  <option value="FAR">FAR - Farmasi</option>
                  <option value="KEU">KEU - Keuangan</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Tujuan Surat</label>
                <input type="text" value={editDestination} onChange={(e) => setEditDestination(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Perihal Surat</label>
                <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Ringkasan / Isi Surat</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" rows={3} />
              </div>

              {/* Upload / Replace File Dokumen */}
              <div className="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                <label className="font-bold text-slate-700 block flex items-center justify-between">
                  <span>Lampiran Dokumen Surat (PC Local File)</span>
                  {uploading && <span className="text-emerald-600 text-[11px] animate-pulse">Mengunggah...</span>}
                </label>
                {editFile ? (
                  <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 shrink-0 text-indigo-600" />
                      <span className="font-bold truncate">{editFile.fileName}</span>
                      <span className="text-[10px] text-indigo-500">({editFile.fileSize})</span>
                    </div>
                    <button onClick={() => setEditFile(null)} className="text-red-500 hover:text-red-700 font-bold text-xs p-1">Hapus</button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors text-slate-600">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs">Upload File Baru dari PC</span>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'edit')} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingDoc(null)} className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Batal</button>
              <button onClick={handleSaveEdit} className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail & Upload Direct */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Detail Surat Umum</h3>
                <span className="text-[10px] uppercase font-bold text-slate-400">Penerbitan via {selectedDoc.channel || 'WEB'}</span>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-800">
              <div className="font-mono font-bold text-emerald-700 text-sm bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <span>{selectedDoc.number}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">{selectedDoc.status || 'ISSUED'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">Unit Pengirim</span>
                  <span className="font-bold text-slate-700">{selectedDoc.unitCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Tanggal Diterbitkan</span>
                  <span className="font-bold text-slate-700">{selectedDoc.date}</span>
                </div>
              </div>

              <div>
                <strong className="text-slate-500 block mb-0.5">Tujuan / Kepada:</strong>
                <span className="font-bold text-slate-900 text-sm">{selectedDoc.destination || 'Internal RS'}</span>
              </div>

              <div>
                <strong className="text-slate-500 block mb-0.5">Perihal:</strong>
                <span className="font-bold text-slate-800">{selectedDoc.subject}</span>
              </div>

              <div>
                <strong className="text-slate-500 block mb-0.5">Ringkasan / Isi Surat:</strong>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-slate-700 whitespace-pre-line font-normal leading-relaxed">
                  {selectedDoc.content || selectedDoc.summary || 'Tidak ada ringkasan.'}
                </div>
              </div>

              {/* Section File Dokumen PC */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <strong className="text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Paperclip className="w-4 h-4 text-emerald-600" /> File Dokumen Fisik (PC Storage)</span>
                  {uploading && <span className="text-emerald-600 text-[10px] animate-pulse">Mengunggah...</span>}
                </strong>

                {selectedDoc.fileUrl ? (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <p className="font-bold text-emerald-900 truncate text-xs">{selectedDoc.fileName || 'Dokumen Surat'}</p>
                          <p className="text-[10px] text-emerald-600">{selectedDoc.fileSize || 'FILE'} • Diunggah {selectedDoc.uploadDate || selectedDoc.date}</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleRemoveFileFromDetail} 
                        title="Hapus File" 
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <a 
                        href={selectedDoc.fileUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka / Lihat File</span>
                      </a>
                      <a 
                        href={selectedDoc.fileUrl} 
                        download={selectedDoc.fileName || 'Surat_Umum'} 
                        className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download File</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                    <p className="text-slate-500 text-[11px]">Belum ada file dokumen fisik yang diunggah untuk surat ini.</p>
                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah File Dokumen dari PC</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, 'detail')} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => {
                  const doc = selectedDoc;
                  setSelectedDoc(null);
                  openEditModal(doc);
                }} 
                className="w-1/2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Data Surat</span>
              </button>
              <button onClick={() => setSelectedDoc(null)} className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
