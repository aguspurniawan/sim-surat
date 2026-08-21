import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { IDocumentPerdir } from '../types';
import { ShieldAlert, Plus, RefreshCw, Eye } from 'lucide-react';

export const DokumenPerdirPage: React.FC = () => {
  const [docs, setDocs] = useState<IDocumentPerdir[]>([]);
  const [loading, setLoading] = useState(true);
  const [numberingHistory, setNumberingHistory] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<IDocumentPerdir | null>(null);

  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [body, setBody] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, history] = await Promise.all([
        apiService.getPerdirDocuments(),
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

  const handleCreate = async () => {
    if (!title || !about || !body) {
      alert('Mohon lengkapi Judul, Tentang, dan Isi PERDIR.');
      return;
    }
    try {
      await apiService.createPerdirDocument({
        title,
        about,
        legalBasis: legalBasis || 'UU No. 44 Tahun 2009 Tentang Rumah Sakit',
        body
      });
      setShowModal(false);
      setTitle('');
      setAbout('');
      setBody('');
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dokumen PERDIR (Peraturan Direksi)</h2>
          <p className="text-xs text-slate-500">Penomoran otomatis format: &#123;NO&#125;/PERDIR/RSSBK/&#123;BULAN_ROMAWI&#125;/&#123;TAHUN&#125;</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Buat PERDIR Baru</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-medium">Memuat dokumen PERDIR...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Nomor PERDIR</th>
                  <th className="p-3.5">Judul PERDIR</th>
                  <th className="p-3.5">Tentang</th>
                  <th className="p-3.5">Penandatangan</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Keterangan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedItems.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{d.number}</td>
                    <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate">{d.title}</td>
                    <td className="p-3.5 text-slate-700 max-w-xs truncate">{d.about}</td>
                    <td className="p-3.5">{d.signer}</td>
                    <td className="p-3.5">{d.date}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3.5">{getPreviousCancelledNumber(d.number) ? (
                      <span className="text-red-600 font-semibold text-[11px]">
                        Melanjutkan setelah {getPreviousCancelledNumber(d.number)} dibatalkan
                      </span>
                    ) : <span className="text-slate-400">-</span>}</td>
                    <td className="p-3.5 text-right">
                      <button onClick={() => setSelectedDoc(d)} className="p-1.5 text-slate-500 hover:text-slate-800 rounded bg-slate-100">
                        <Eye className="w-4 h-4" />
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

      {/* Modal Add */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Buat PERDIR Baru</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Judul PERDIR *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul Peraturan Direksi" className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Tentang *</label>
                <input type="text" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tentang Peraturan" className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Isi Peraturan *</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ringkasan atau teks lengkap isi PERDIR" className="w-full p-2.5 border rounded-xl" rows={4} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Batal</button>
              <button onClick={handleCreate} className="w-1/2 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md">Terbitkan PERDIR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base">Detail PERDIR</h3>
              <button onClick={() => setSelectedDoc(null)} className="font-bold text-slate-400">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-800">
              <div className="font-mono font-bold text-emerald-700 text-sm bg-emerald-50 p-2.5 rounded-xl border">{selectedDoc.number}</div>
              <div><strong>Judul:</strong> {selectedDoc.title}</div>
              <div><strong>Tentang:</strong> {selectedDoc.about}</div>
              <div><strong>Isi:</strong> <p className="bg-slate-50 p-2.5 rounded-xl mt-1 border whitespace-pre-line">{selectedDoc.body}</p></div>
            </div>
            <button onClick={() => setSelectedDoc(null)} className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
};