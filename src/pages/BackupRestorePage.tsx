import React, { useState } from 'react';
import {
  Database, Download, Upload, ShieldCheck, AlertTriangle,
  CheckCircle, RefreshCw, HardDrive, FileJson, Clock, Check, ArrowRight
} from 'lucide-react';
import { apiService } from '../services/api';

export const BackupRestorePage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [includeAuditLogs, setIncludeAuditLogs] = useState(true);

  const handleExportBackup = async () => {
    setExporting(true);
    setExportSuccess(false);
    setStatusMessage('');
    try {
      const response = await fetch(`/api/backup/export?includeAudit=${includeAuditLogs}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Gagal mengekspor data sistem');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `backup_sim_surat_rssbk_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(true);
      setStatusMessage('File cadangan database berhasil diunduh ke komputer Anda.');
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setRestoreSuccess(false);
    setStatusMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setBackupPreview({
          version: json.version || '1.0',
          exportedAt: json.exportedAt || 'Tidak diketahui',
          appName: json.appName || 'SIM-Surat RS Sebening Kasih',
          counts: {
            users: json.data?.users?.length || 0,
            units: json.data?.units?.length || 0,
            letterTypes: json.data?.letterTypes?.length || 0,
            numberReservations: json.data?.numberReservations?.length || 0,
            incomingLetters: json.data?.incomingLetters?.length || 0,
            outgoingLetters: json.data?.outgoingLetters?.length || 0,
            sopDocuments: json.data?.sopDocuments?.length || 0,
            perdirDocuments: json.data?.perdirDocuments?.length || 0,
            skDocuments: json.data?.skDocuments?.length || 0,
            generalLetters: json.data?.generalLetters?.length || 0,
            auditLogs: json.data?.auditLogs?.length || 0,
          }
        });
      } catch (err) {
        alert('File JSON backup tidak valid.');
        setSelectedFile(null);
        setBackupPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreSubmit = async () => {
    if (!selectedFile) return;

    const confirmRestore = window.confirm(
      'PERINGATAN: Memulihkan database akan menimpa/memperbarui data sistem dengan isi file backup ini. Anda yakin ingin melanjutkan?'
    );
    if (!confirmRestore) return;

    setRestoring(true);
    setRestoreSuccess(false);
    setStatusMessage('');

    try {
      const fileText = await selectedFile.text();
      const backupData = JSON.parse(fileText);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(backupData)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memulihkan data');
      }

      setRestoreSuccess(true);
      setStatusMessage(json.message || 'Database sistem berhasil dipulihkan secara menyeluruh!');
    } catch (err: any) {
      alert(`Restore error: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-2">
            <Database className="w-3.5 h-3.5" />
            <span>Pusat Data & Pemulihan Sistem</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Backup & Restore Database</h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadangkan seluruh master data penomoran, berkas surat masuk, disposisi, dan audit trail ke berkas JSON terenkripsi.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 ${
          exportSuccess || restoreSuccess ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
        }`}>
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid 2 Columns: Backup vs Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPORT BACKUP */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm md:text-base">Ekspor Cadangan (Backup)</h2>
                <p className="text-[11px] text-slate-500">Unduh data database ke dalam format JSON tunggal</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs text-slate-600">
              <p className="font-bold text-slate-800">Item data yang dicadangkan:</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                <li>Akun Pengguna & Unit Kerja (ADM, SDM, KEP, MUTU, dll.)</li>
                <li>Master Jenis Surat & Konfigurasi Lock/Unlock (SPO, PERDIR, SK, UMUM)</li>
                <li>Seluruh Riwayat Nomor & State Counter Penomoran</li>
                <li>Surat Masuk & Lembar Disposisi WhatsApp / Web</li>
                <li>Dokumen Regulasi (SPO, Perdir, SK, Surat Keluar, Umum)</li>
                <li>Jejak Rekam Jejak Audit Log Aktivitas</li>
              </ul>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAuditLogs}
                onChange={(e) => setIncludeAuditLogs(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
              />
              <span className="font-semibold">Sertakan seluruh histori Audit Log (Ukuran file lebih besar)</span>
            </label>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={exporting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sedang Mengemas Data...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh File Backup JSON</span>
              </>
            )}
          </button>
        </div>

        {/* RESTORE DATABASE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm md:text-base">Pulihkan Cadangan (Restore)</h2>
                <p className="text-[11px] text-slate-500">Unggah berkas JSON cadangan untuk memulihkan sistem</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Perhatian Keamanan</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Pastikan berkas backup berasal dari sistem SIM-Surat RS Sebening Kasih yang valid. Tindakan pemulihan akan merekonsiliasi seluruh data ke status saat backup dibuat.
              </p>
            </div>

            {/* File Picker */}
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center transition-all bg-slate-50/50">
              <input
                type="file"
                id="restore-file-input"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="restore-file-input" className="cursor-pointer block space-y-2">
                <FileJson className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                  {selectedFile ? selectedFile.name : 'Pilih file backup .JSON'}
                </div>
                <p className="text-[10px] text-slate-400">Format yang didukung: JSON Backup File</p>
              </label>
            </div>

            {/* Backup Preview Info */}
            {backupPreview && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200 pb-1.5">
                  <span>Pratinjau Isi File Backup</span>
                  <span className="text-indigo-600">v{backupPreview.version}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>👥 Pengguna: <strong>{backupPreview.counts.users}</strong></div>
                  <div>🏢 Unit Kerja: <strong>{backupPreview.counts.units}</strong></div>
                  <div>🔢 Nomor Surat: <strong>{backupPreview.counts.numberReservations}</strong></div>
                  <div>📥 Surat Masuk: <strong>{backupPreview.counts.incomingLetters}</strong></div>
                  <div>📤 Surat Keluar: <strong>{backupPreview.counts.outgoingLetters}</strong></div>
                  <div>📜 Dokumen Regulasi: <strong>{backupPreview.counts.sopDocuments + backupPreview.counts.perdirDocuments + backupPreview.counts.skDocuments}</strong></div>
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  Waktu Ekspor: {new Date(backupPreview.exportedAt).toLocaleString('id-ID')}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRestoreSubmit}
            disabled={!selectedFile || restoring}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {restoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memulihkan Database...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Mulai Proses Pemulihan (Restore)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
