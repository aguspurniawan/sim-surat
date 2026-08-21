import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { ILetterType, IUnit, ILetterTemplate, INumberReservation } from '../types';
import {
  Hash, Sparkles, Check, Copy, AlertCircle, RefreshCw,
  FileText, Building2, Send, CheckCircle2, ArrowRight
} from 'lucide-react';

export const AmbilNomorPage: React.FC = () => {
  const [types, setTypes] = useState<ILetterType[]>([]);
  const [units, setUnits] = useState<IUnit[]>([]);
  const [templates, setTemplates] = useState<ILetterTemplate[]>([]);

  const [selectedType, setSelectedType] = useState<string>('UMUM');
  const [selectedUnit, setSelectedUnit] = useState<string>('ADM');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [subject, setSubject] = useState<string>('SPTJM Pelayanan Bulan Agustus 2026');

  const [previewNumber, setPreviewNumber] = useState<string>('...');
  const [loading, setLoading] = useState<boolean>(false);
  const [reserving, setReserving] = useState<boolean>(false);

  const [successResult, setSuccessResult] = useState<INumberReservation | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const currentTypeObj = types.find(t => t.code === selectedType);

  // Load types, units, templates on mount
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [tList, uList, tplList] = await Promise.all([
          apiService.getLetterTypes(),
          apiService.getUnits(),
          apiService.getTemplates()
        ]);
        setTypes(tList);
        setUnits(uList);
        setTemplates(tplList);

        if (tList.length > 0) setSelectedType(tList[0].code);
        if (uList.length > 0) setSelectedUnit(uList[0].code);
      } catch (err) {
        console.error('Error initializing numbering options:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Update real-time number preview whenever type, format, or unit changes
  useEffect(() => {
    const updatePreview = async () => {
      if (!currentTypeObj) return;
      try {
        const res = await apiService.previewNumber({
          format: currentTypeObj.format,
          typeCode: currentTypeObj.code,
          unitCode: selectedUnit,
          padding: currentTypeObj.padding || 3
        });
        setPreviewNumber(res.preview);
      } catch (e) {
        console.error('Preview error:', e);
      }
    };
    updatePreview();
  }, [selectedType, selectedUnit, currentTypeObj]);

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = templates.find(t => t.id === templateId);
    if (tpl) {
      // Replace variables dynamically if possible
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const now = new Date();
      let filled = tpl.contentPattern
        .replace(/{BULAN}/g, monthNames[now.getMonth()])
        .replace(/{TAHUN}/g, String(now.getFullYear()))
        .replace(/{UNIT}/g, selectedUnit);

      setSubject(filled);
      setTitle(filled);
    }
  };

  const handleReserve = async () => {
    if (currentTypeObj?.requiresSubject && !subject.trim()) {
      alert('Perihal wajib diisi untuk jenis surat ini.');
      return;
    }
    if (currentTypeObj?.requiresTitle && !title.trim() && !subject.trim()) {
      alert('Judul / Perihal wajib diisi.');
      return;
    }

    try {
      setReserving(true);
      const reqId = `WEB-REQ-${Date.now()}-${Math.random()}`;
      const reservation = await apiService.reserveNumber({
        typeCode: selectedType,
        unitCode: selectedUnit,
        title: title || subject,
        subject: subject || title,
        requestId: reqId
      });
      setSuccessResult(reservation);
    } catch (err: any) {
      alert(`Gagal mengambil nomor: ${err.message}`);
    } finally {
      setReserving(false);
    }
  };

  const copyToClipboard = () => {
    if (successResult) {
      navigator.clipboard.writeText(successResult.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
        <p>Memuat konfigurasi penomoran...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Atomic Numbering Service</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Form Pengambilan Nomor Surat</h2>
          <p className="text-xs text-slate-500">Pilih jenis surat, unit, dan template judul/perihal untuk memperoleh nomor surat otomatis</p>
        </div>
        <div className="text-right font-mono bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold shadow-inner border border-slate-800">
          Preview: {previewNumber}
        </div>
      </div>

      {/* Main Reservation Wizard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step Form Options */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          {/* 1. Jenis Surat */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-600" />
              <span>1. Jenis Surat</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {types.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setSelectedType(t.code)}
                  className={`p-3 rounded-xl border text-left transition-all duration-150 ${
                    selectedType === t.code
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 font-bold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">{t.code}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Unit Kerja */}
          {currentTypeObj?.requiresUnit && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>2. Unit Kerja / Pengaju</span>
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium text-slate-800"
              >
                {units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code} - {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Template Judul/Perihal Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <span>3. Pilih Template Perihal (Opsional)</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium text-slate-700"
            >
              <option value="">-- Ketik Manual atau Pilih Template --</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.contentPattern})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Input Judul / Perihal */}
          {currentTypeObj?.requiresSubject && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Perihal Surat *</label>
              <textarea
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                rows={2}
                placeholder="Masukkan perihal surat, contoh: SPTJM Pelayanan Bulan Agustus 2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          )}

          {currentTypeObj?.requiresTitle && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Judul Dokumen *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masukkan judul dokumen, contoh: Prosedur Triase Pasien Gawat Darurat"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              onClick={handleReserve}
              disabled={reserving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {reserving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Atomic Increment...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>AMBIL & CADANGKAN NOMOR</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Configuration Summary Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-md space-y-4 border border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Format & Pattern Rule</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Active</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Format Pattern:</span>
                <span className="font-mono text-emerald-300 font-bold">{currentTypeObj?.format}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Sequence Scope:</span>
                <span className="font-semibold text-slate-200">{currentTypeObj?.scope}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Reset Policy:</span>
                <span className="font-semibold text-amber-300">{currentTypeObj?.resetSequence}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Padding Format:</span>
                <span className="font-semibold text-slate-200">{currentTypeObj?.padding} digit ({'0'.repeat(currentTypeObj?.padding || 3)})</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-800/50 text-[11px] text-emerald-300 leading-relaxed">
              💡 <strong>Atomic Concurrency Guarantee:</strong> Seluruh transaksi pengambilan nomor melewati MongoDB atomic counter dengan idempotency key untuk mencegah penomoran ganda saat jaringan lambat.
            </div>
          </div>
        </div>
      </div>

      {/* Success Dialog Modal */}
      {successResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900">Nomor Berhasil Dicadangkan!</h3>
              <p className="text-xs text-slate-500">Nomor surat telah tersimpan secara resmi di database MongoDB Atlas.</p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-2xl text-center space-y-2 relative group">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Nomor Surat Resmi</p>
              <div className="font-mono text-xl font-extrabold text-emerald-400 tracking-wide select-all">
                {successResult.number}
              </div>
              <button
                onClick={copyToClipboard}
                className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Nomor'}</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex justify-between"><span className="text-slate-400">Jenis Surat:</span> <span className="font-bold">{successResult.typeCode}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unit Kerja:</span> <span className="font-bold">{successResult.unitCode}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Perihal:</span> <span className="font-semibold text-slate-900 truncate max-w-[200px]">{successResult.subject || successResult.title}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Status:</span> <span className="font-bold text-amber-600">{successResult.status}</span></div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSuccessResult(null)}
                className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                Tutup & Ambil Nomor Lain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
