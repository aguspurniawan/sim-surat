import React, { useState } from 'react';
import { apiService } from '../services/api';
import { BarChart3, Download, FileSpreadsheet, FileText, Calendar, Filter, CheckCircle2 } from 'lucide-react';

export const LaporanPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [typeCode, setTypeCode] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const history = await apiService.getNumberHistory({ typeCode });
      // Generate CSV
      const headers = ['Nomor Surat', 'Jenis', 'Unit', 'Perihal/Judul', 'Pemohon', 'Kanal', 'Tanggal', 'Status'];
      const rows = history.map(h => [
        `"${h.number}"`,
        `"${h.typeCode}"`,
        `"${h.unitCode}"`,
        `"${(h.subject || h.title || '').replace(/"/g, '""')}"`,
        `"${h.userName}"`,
        `"${h.channel}"`,
        `"${new Date(h.createdAt).toLocaleDateString('id-ID')}"`,
        `"${h.status}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Laporan_Surat_RSSBK_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Laporan & Ekspor Data</h2>
          <p className="text-xs text-slate-500">Rekapitulasi transaksi penomoran dan laporan arsip surat format Excel (CSV)</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <h3 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter Laporan Rekapitulasi</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700">Periode Awal</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2.5 border rounded-xl" />
          </div>
          <div>
            <label className="font-bold text-slate-700">Periode Akhir</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2.5 border rounded-xl" />
          </div>
          <div>
            <label className="font-bold text-slate-700">Kategori Surat</label>
            <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} className="w-full p-2.5 border rounded-xl font-semibold">
              <option value="">Semua Jenis Surat</option>
              <option value="SPO">SPO</option>
              <option value="PERDIR">PERDIR</option>
              <option value="SK">SK</option>
              <option value="UMUM">UMUM</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Laporan Rekapitulasi (.CSV / Excel)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
