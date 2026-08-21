import React, { useState } from 'react';
import { apiService } from '../services/api';
import { Cpu, Play, CheckCircle2, AlertTriangle, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

export const ConcurrencyTestPage: React.FC = () => {
  const [count, setCount] = useState<number>(20);
  const [typeCode, setTypeCode] = useState<string>('UMUM');
  const [unitCode, setUnitCode] = useState<string>('ADM');

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleRunTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const res = await apiService.testConcurrency(count, typeCode, unitCode);
      setTestResult(res);
    } catch (err: any) {
      alert(`Test error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-800 text-xs font-semibold mb-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>Race Condition Stress Tester</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Pengujian Concurrency Race Condition</h2>
          <p className="text-xs text-slate-500">
            Menguji pengiriman N request penomoran secara paralel (Promise.all) untuk membuktikan jaminan 0% nomor ganda.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Control Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Konfigurasi Pengujian</h3>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700">Jumlah Request Simultan (Workers)</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full p-2.5 border rounded-xl font-bold bg-white"
            >
              <option value={10}>10 Concurrent Requests</option>
              <option value={20}>20 Concurrent Requests (Standar Benchmark)</option>
              <option value={50}>50 Concurrent Requests (High Load)</option>
            </select>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700">Jenis Surat</label>
            <select
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold bg-white"
            >
              <option value="UMUM">UMUM</option>
              <option value="SPO">SPO</option>
              <option value="PERDIR">PERDIR</option>
              <option value="SK">SK</option>
            </select>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700">Unit Kerja</label>
            <input
              type="text"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold"
            />
          </div>

          <button
            onClick={handleRunTest}
            disabled={testing}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menjalankan Worker Simultan...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Jalankan Stress Test ({count} Requests)</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Display */}
        <div className="lg:col-span-2 space-y-6">
          {testResult ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  {testResult.success ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {testResult.success ? 'PASSED: Jaminan Unique Zero Duplicates!' : 'FAILED: Terdapat Nomor Ganda'}
                    </h4>
                    <p className="text-xs text-slate-500">Waktu eksekusi: {testResult.durationMs} ms</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Total Request</div>
                  <div className="text-xl font-extrabold text-slate-800">{testResult.totalRequests}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Unique Generated</div>
                  <div className="text-xl font-extrabold text-emerald-700">{testResult.uniqueNumbersGenerated}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Duplicates</div>
                  <div className="text-xl font-extrabold text-slate-800">{testResult.hasDuplicates ? 'YA' : '0 (TIDAK ADA)'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Hasil Urutan Nomor Surat Tergenerasi:</label>
                <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs max-h-48 overflow-y-auto space-y-1">
                  {testResult.allNumbers.map((num: string, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-slate-800/80 py-0.5">
                      <span className="text-slate-500">Worker #{idx + 1}:</span>
                      <span className="font-bold">{num}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center text-slate-500 space-y-3">
              <Zap className="w-10 h-10 text-cyan-600 mx-auto" />
              <h4 className="font-bold text-slate-800">Siap Menjalankan Pengujian</h4>
              <p className="text-xs max-w-sm mx-auto">
                Pilih jumlah worker di panel kiri dan klik &quot;Jalankan Stress Test&quot; untuk menguji ketahanan atomic increment MongoDB Atlas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
