import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { IOutgoingLetter } from '../types';
import { Plus, RefreshCw, Eye, CheckCircle2 } from 'lucide-react';

export const SuratKeluarPage: React.FC = () => {
  const [letters, setLetters] = useState<IOutgoingLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<IOutgoingLetter | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [typeCode, setTypeCode] = useState('UMUM');
  const [unitCode, setUnitCode] = useState('ADM');
  const [destination, setDestination] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getOutgoingLetters();
      setLetters(data);
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
    if (!destination.trim() || !subject.trim()) {
      alert('Mohon isi Tujuan dan Perihal surat keluar.');
      return;
    }

    try {
      await apiService.createOutgoingLetter({
        typeCode,
        unitCode,
        destination: destination.trim(),
        destinationAddress: destinationAddress.trim() || undefined,
        subject: subject.trim(),
        content: content.trim()
      });

      setShowModal(false);

      setDestination('');
      setDestinationAddress('');
      setSubject('');
      setContent('');

      await loadData();
    } catch (e: any) {
      alert(e.message || 'Gagal membuat surat keluar.');
    }
  };

  const totalItems = letters.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLetters = letters.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const getKeterangan = (letter: IOutgoingLetter) => {
    const previousCancelledNumber = (letter as any).previousCancelledNumber;

    if (previousCancelledNumber) {
      return `Melanjutkan setelah ${previousCancelledNumber} dibatalkan`;
    }

    if (
      letter.status === 'CANCELLED' ||
      letter.status === 'VOID' ||
      (letter as any).cancelledAt
    ) {
      return 'Nomor dibatalkan';
    }

    return '-';
  };

  const isRedKeterangan = (letter: IOutgoingLetter) => {
    const previousCancelledNumber = (letter as any).previousCancelledNumber;

    return Boolean(
      previousCancelledNumber ||
        letter.status === 'CANCELLED' ||
        letter.status === 'VOID' ||
        (letter as any).cancelledAt
    );
  };

  const closeCreateModal = () => {
    setShowModal(false);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Surat Keluar
          </h2>

          <p className="text-xs text-slate-500">
            Penerbitan surat keluar instansi dengan alokasi nomor atomic otomatis
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Surat Keluar</span>
        </button>
      </div>

      {/* Sync Banner Notice */}
      <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-start md:items-center gap-3 text-xs text-indigo-900 shadow-2xs">
        <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 md:mt-0" />

        <div>
          <span className="font-bold">
            Otomatis Terintegrasi Multi-Channel:
          </span>{' '}
          Nomor surat yang diambil via{' '}
          <strong className="text-sky-700">Telegram Bot</strong> atau{' '}
          <strong className="text-emerald-700">
            WhatsApp Baileys
          </strong>{' '}
          secara otomatis muncul dan tersinkronisasi di tabel Manajemen Surat
          Keluar ini tanpa perlu input ulang.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-medium">
              Memuat surat keluar...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[900px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Nomor Surat</th>
                  <th className="p-3.5">Kanal</th>
                  <th className="p-3.5">Jenis</th>
                  <th className="p-3.5">Unit</th>
                  <th className="p-3.5">Tujuan</th>
                  <th className="p-3.5">Perihal</th>
                  <th className="p-3.5">Pembuat</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Keterangan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedLetters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-10 text-center text-slate-400"
                    >
                      Belum ada surat keluar.
                    </td>
                  </tr>
                ) : (
                  paginatedLetters.map((l) => {
                    const keterangan = getKeterangan(l);
                    const redKeterangan = isRedKeterangan(l);

                    return (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Nomor */}
                        <td className="p-3.5 font-mono font-bold text-slate-900">
                          {l.letterNumber || l.number}
                        </td>

                        {/* Kanal */}
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              l.channel === 'TELEGRAM'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : l.channel === 'WHATSAPP'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            {l.channel || 'WEB'}
                          </span>
                        </td>

                        {/* Jenis */}
                        <td className="p-3.5 font-bold text-slate-700">
                          {l.typeCode}
                        </td>

                        {/* Unit */}
                        <td className="p-3.5">
                          {l.unitCode}
                        </td>

                        {/* Tujuan */}
                        <td className="p-3.5 font-bold text-slate-800">
                          {l.destination ||
                            (l as any).recipient ||
                            'Internal / Umum'}
                        </td>

                        {/* Perihal */}
                        <td className="p-3.5 text-slate-800 max-w-xs truncate">
                          {l.subject || l.title}
                        </td>

                        {/* Pembuat */}
                        <td className="p-3.5">
                          {l.creatorName ||
                            (l as any).signer ||
                            'Sistem'}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.status === 'CANCELLED' ||
                              l.status === 'VOID'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>

                        {/* Keterangan */}
                        <td className="p-3.5 min-w-[220px]">
                          <span
                            className={
                              redKeterangan
                                ? 'text-red-600 font-semibold'
                                : 'text-slate-400'
                            }
                          >
                            {redKeterangan
                              ? `🔴 ${keterangan}`
                              : keterangan}
                          </span>
                        </td>

                        {/* Aksi */}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedLetter(l)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[11px] text-slate-500">
              Menampilkan{' '}
              <span className="font-bold text-slate-700">
                {startIndex + 1}
              </span>
              -
              <span className="font-bold text-slate-700">
                {Math.min(
                  startIndex + ITEMS_PER_PAGE,
                  totalItems
                )}
              </span>{' '}
              dari{' '}
              <span className="font-bold text-slate-700">
                {totalItems}
              </span>{' '}
              data
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.max(1, p - 1))
                }
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Sebelumnya
              </button>

              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(totalPages, p + 1)
                  )
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base">
              Buat Surat Keluar Baru
            </h3>

            <div className="space-y-3 text-xs">
              {/* Jenis + Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">
                    Jenis Surat
                  </label>

                  <select
                    value={typeCode}
                    onChange={(e) => setTypeCode(e.target.value)}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  >
                    <option value="UMUM">UMUM</option>
                    <option value="SPO">SPO</option>
                    <option value="PERDIR">PERDIR</option>
                    <option value="SK">SK</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">
                    Unit Pengirim
                  </label>

                  <select
                    value={unitCode}
                    onChange={(e) => setUnitCode(e.target.value)}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  >
                    <option value="ADM">
                      ADM - Administrasi
                    </option>
                    <option value="SDM">
                      SDM - Sumber Daya Manusia
                    </option>
                    <option value="KEP">
                      KEP - Keperawatan
                    </option>
                  </select>
                </div>
              </div>

              {/* Tujuan */}
              <div>
                <label className="font-bold text-slate-700">
                  Tujuan Surat *
                </label>

                <input
                  type="text"
                  value={destination}
                  onChange={(e) =>
                    setDestination(e.target.value)
                  }
                  placeholder="Instansi / Pihak Tujuan"
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              {/* Alamat Tujuan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Alamat Tujuan
                  </label>

                  <span className="text-[10px] font-medium text-slate-400">
                    Opsional
                  </span>
                </div>

                <textarea
                  value={destinationAddress}
                  onChange={(e) =>
                    setDestinationAddress(e.target.value)
                  }
                  placeholder="Alamat lengkap tujuan surat (opsional)"
                  className="w-full p-2.5 border rounded-xl resize-none"
                  rows={2}
                />
              </div>

              {/* Perihal */}
              <div>
                <label className="font-bold text-slate-700">
                  Perihal Surat *
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  placeholder="Perihal surat keluar"
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              {/* Content */}
              <div>
                <label className="font-bold text-slate-700">
                  Ringkasan / Isi Surat
                </label>

                <textarea
                  value={content}
                  onChange={(e) =>
                    setContent(e.target.value)
                  }
                  placeholder="Ringkasan poin surat keluar"
                  className="w-full p-2.5 border rounded-xl resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={closeCreateModal}
                className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                Batal
              </button>

              <button
                onClick={handleCreate}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Terbitkan Surat Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {selectedLetter && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base">
                Detail Surat Keluar
              </h3>

              <button
                onClick={() => setSelectedLetter(null)}
                className="font-bold text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-800">
              {/* Nomor */}
              <div className="font-mono font-bold text-emerald-700 text-sm bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                {selectedLetter.letterNumber ||
                  selectedLetter.number}
              </div>

              <div>
                <strong>Jenis:</strong>{' '}
                {selectedLetter.typeCode}
              </div>

              <div>
                <strong>Unit:</strong>{' '}
                {selectedLetter.unitCode}
              </div>

              <div>
                <strong>Kanal:</strong>{' '}
                {selectedLetter.channel || 'WEB'}
              </div>

              <div>
                <strong>Kepada:</strong>{' '}
                {selectedLetter.destination || '-'}
              </div>

              {/* Alamat Tujuan */}
              <div>
                <strong>Alamat Tujuan:</strong>

                <div className="bg-slate-50 p-2.5 rounded-xl mt-1 border whitespace-pre-line">
                  {selectedLetter.destinationAddress || '-'}
                </div>
              </div>

              <div>
                <strong>Perihal:</strong>{' '}
                {selectedLetter.subject || '-'}
              </div>

              <div>
                <strong>Status:</strong>{' '}
                {selectedLetter.status}
              </div>

              <div>
                <strong>Keterangan:</strong>{' '}
                <span
                  className={
                    isRedKeterangan(selectedLetter)
                      ? 'text-red-600 font-semibold'
                      : 'text-slate-500'
                  }
                >
                  {isRedKeterangan(selectedLetter)
                    ? `🔴 ${getKeterangan(selectedLetter)}`
                    : getKeterangan(selectedLetter)}
                </span>
              </div>

              <div>
                <strong>Ringkasan:</strong>

                <p className="bg-slate-50 p-2.5 rounded-xl mt-1 border whitespace-pre-line">
                  {selectedLetter.content || '-'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedLetter(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};