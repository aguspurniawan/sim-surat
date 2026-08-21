import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import {
  Bot, Send, User, CheckCircle2, ShieldCheck, RefreshCw, Terminal,
  FileText, Upload, Bell, CheckSquare, XCircle, Edit3, ArrowRight, UserCheck
} from 'lucide-react';

interface SimulatedUser {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
}

const SIMULATED_USERS: SimulatedUser[] = [
  { id: 'tg_sekretariat', name: 'Sekretariat RS', role: 'SEKRETARIAT (Unggah & Disposisi)', avatarColor: 'bg-emerald-600' },
  { id: 'tg_direktur', name: 'dr. Indah Restiyanti (Direktur)', role: 'PIMPINAN (Persetujuan / ACC)', avatarColor: 'bg-amber-600' },
  { id: 'tg_sdm', name: 'Okta Wulan Panjumaulida, Amd. Keb (Kepala SDM)', role: 'STAFF UNIT (Penerima Disposisi)', avatarColor: 'bg-sky-600' },
  { id: 'tg_keperawatan', name: 'Ahmad Subandi (Kepala Keperawatan)', role: 'STAFF UNIT (Penerima Disposisi)', avatarColor: 'bg-indigo-600' },
];

export const IntegrasiTelegramPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<SimulatedUser>(SIMULATED_USERS[0]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string; userName?: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Selamat datang di Telegram Bot SIM Surat RSSBK!*\n\nAnda dapat:\n1. Kirim file PDF/Foto berkas Surat Masuk untuk ekstraksi & disposisi.\n2. Ketik `/nomor` untuk mengambil nomor surat keluar.\n3. Ketik `disposisi` untuk memantau status lembar disposisi.',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchStatusAndNotifications = () => {
    apiService.getTelegramStatus().then(setStatus).catch(console.error);
    apiService.getTelegramNotifications().then(setNotifications).catch(console.error);
  };

  const handleReconnectBot = async () => {
    setReconnecting(true);
    try {
      await apiService.restartTelegramBot();
      fetchStatusAndNotifications();
    } catch (err: any) {
      console.error('Reconnect failed:', err);
    } finally {
      setReconnecting(false);
    }
  };

  useEffect(() => {
    fetchStatusAndNotifications();
    const interval = setInterval(fetchStatusAndNotifications, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [
      ...prev,
      { sender: 'user', text: textToSend, time: now, userName: selectedUser.name }
    ]);
    if (!customText) setInputText('');
    setSending(true);

    try {
      const res = await apiService.simulateTelegramMsg(textToSend, selectedUser.id, selectedUser.name);
      setMessages(prev => [...prev, { sender: 'bot', text: res.reply, time: now }]);
      fetchStatusAndNotifications();
    } catch (e: any) {
      setMessages(prev => [...prev, { sender: 'bot', text: `❌ Error: ${e.message}`, time: now }]);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [
        ...prev,
        {
          sender: 'user',
          text: `📎 [Mengirim Berkas]: ${file.name} (${Math.round(file.size / 1024)} KB)`,
          time: now,
          userName: selectedUser.name
        }
      ]);
      setSending(true);

      try {
        const res = await apiService.simulateTelegramMedia(
          base64,
          file.name,
          file.type || 'application/pdf',
          selectedUser.id,
          selectedUser.name
        );
        setMessages(prev => [...prev, { sender: 'bot', text: res.reply, time: now }]);
        fetchStatusAndNotifications();
      } catch (err: any) {
        setMessages(prev => [...prev, { sender: 'bot', text: `❌ Gagal memproses berkas: ${err.message}`, time: now }]);
      } finally {
        setSending(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateSampleDinkesPdf = async () => {
    const sampleText = `%PDF-1.4
% Sample Dinkes Invitation
DINAS KESEHATAN KABUPATEN PATI
Nomor: 005/1420/DINKES/VIII/2026
Tanggal: 18 Agustus 2026
Hal: Undangan Rapat Koordinasi Akreditasi Faskes
Kepada: Direktur RS Sebening Kasih`;

    const base64 = btoa(unescape(encodeURIComponent(sampleText)));
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [
      ...prev,
      {
        sender: 'user',
        text: `📎 [Unggah Berkas Surat Masuk]: Surat_Undangan_Dinkes_Akreditasi.pdf (142 KB)`,
        time: now,
        userName: selectedUser.name
      }
    ]);
    setSending(true);

    try {
      const res = await apiService.simulateTelegramMedia(
        `data:application/pdf;base64,${base64}`,
        'Surat_Undangan_Dinkes_Akreditasi.pdf',
        'application/pdf',
        selectedUser.id,
        selectedUser.name
      );
      setMessages(prev => [...prev, { sender: 'bot', text: res.reply, time: now }]);
      fetchStatusAndNotifications();
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'bot', text: `❌ Error: ${err.message}`, time: now }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Status */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 text-xs font-semibold mb-1">
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram Bot Service SIM Surat</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Workflow Surat Masuk & Disposisi via Telegram</h2>
          <p className="text-xs text-slate-500">
            Unggah dokumen PDF/Foto → Ekstraksi AI/OCR → Verifikasi & Simpan → Disposisi ke Direktur → ACC/Tolak/Revisi → Tindak Lanjut Penerima.
          </p>
          {status?.status === 'POLLING_CONFLICT' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-2 inline-block">
              ℹ️ Polling otomatis dinonaktifkan sementara karena instance bot lain sedang aktif. Pengiriman pesan keluar & simulator web tetap berfungsi penuh.
            </p>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {status?.status === 'ONLINE' ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Bot Online ({status?.botUsername || '@RSSBK_Surat_Bot'})
            </span>
          ) : status?.status === 'POLLING_CONFLICT' ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Instance Terhubung (Mode Pasif / REST)
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              Simulator Web Aktif
            </span>
          )}
          <button
            onClick={handleReconnectBot}
            disabled={reconnecting}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            title="Hubungkan Ulang Polling"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
            <span>{reconnecting ? 'Menghubungkan...' : 'Refresh Koneksi'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chat Simulator + Notification Feed & Quick Help */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Chat Emulator Box */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[640px]">
          {/* Chat Header with Role Switcher */}
          <div className="p-4 bg-slate-800/90 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">RSSBK Telegram Bot Simulator</h4>
                <p className="text-[10px] text-sky-400 font-medium">Live Terminal • Multi-Role State Machine</p>
              </div>
            </div>

            {/* Simulated User Selector */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 px-2 font-medium flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-sky-400" /> Peran:
              </span>
              <select
                value={selectedUser.id}
                onChange={(e) => {
                  const u = SIMULATED_USERS.find(user => user.id === e.target.value);
                  if (u) setSelectedUser(u);
                }}
                className="bg-slate-800 text-white text-xs font-semibold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
              >
                {SIMULATED_USERS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Action Shortcuts Bar */}
          <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <button
              onClick={handleSimulateSampleDinkesPdf}
              disabled={sending}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 shrink-0 transition"
            >
              <Upload className="w-3 h-3" /> Simulasikan PDF Dinkes
            </button>
            <button
              onClick={() => handleSend('/nomor')}
              disabled={sending}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 shrink-0 transition"
            >
              /nomor
            </button>
            <button
              onClick={() => handleSend('disposisi')}
              disabled={sending}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 shrink-0 transition"
            >
              disposisi
            </button>
            <button
              onClick={() => handleSend('1')}
              disabled={sending}
              className="px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold shrink-0 transition"
              title="Pilihan 1 (Simpan / Ya / ACC / Terima)"
            >
              1 (Ya/ACC)
            </button>
            <button
              onClick={() => handleSend('2')}
              disabled={sending}
              className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-bold shrink-0 transition"
              title="Pilihan 2 (Edit / Tidak / Tolak / Proses)"
            >
              2 (Edit/Tolak)
            </button>
            <button
              onClick={() => handleSend('3')}
              disabled={sending}
              className="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold shrink-0 transition"
              title="Pilihan 3 (Batal / Revisi / Selesai)"
            >
              3 (Revisi/Selesai)
            </button>
            <button
              onClick={() => handleSend('batal')}
              disabled={sending}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 shrink-0 transition"
            >
              batal
            </button>
          </div>

          {/* Messages Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3 font-sans text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 space-y-1.5 shadow-md ${
                  m.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                }`}>
                  {m.userName && m.sender === 'user' && (
                    <p className="text-[10px] font-bold text-sky-200 border-b border-sky-500/40 pb-0.5">
                      👤 {m.userName}
                    </p>
                  )}
                  <p className="whitespace-pre-line leading-relaxed font-sans">{m.text}</p>
                  <p className={`text-[9px] text-right ${m.sender === 'user' ? 'text-sky-200' : 'text-slate-400'}`}>{m.time}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 rounded-2xl p-3 text-xs italic animate-pulse flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  Bot sedang memproses berkas / perintah Telegram...
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-800/90 border-t border-slate-700/80 flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl transition"
              title="Unggah Dokumen / Foto Surat Masuk"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ketik pesan sebagai ${selectedUser.name} (contoh: 1, ACC, PROSES, /nomor)...`}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !inputText.trim()}
              className="p-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sidebar: Notification Feed & Flow Reference */}
        <div className="space-y-6 flex flex-col h-[640px]">
          {/* Live Notification Broadcasts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Notifikasi Otomatis Bot</span>
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                {notifications.length} Terkirim
              </span>
            </h3>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs mt-2 space-y-2 pr-1">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  Belum ada notifikasi broadcast disposisi. Unggah surat atau buat disposisi untuk melihat simulasi notifikasi ke Direktur/Penerima.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="pt-2 pb-1 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700">Kepada: {n.targetName}</span>
                      <span>{new Date(n.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-sans whitespace-pre-line text-slate-700">
                      {n.message}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Workflow Guide Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-600" />
              <span>Panduan Workflow Surat & Disposisi</span>
            </h4>
            <div className="space-y-1.5 text-[11px]">
              <p className="flex items-start gap-1">
                <span className="font-bold text-emerald-700">1. Sekretariat:</span> Unggah PDF/Foto → Bot ekstrak OCR → Pilih 1 (SIMPAN) → Pilih 1 (YA Disposisi) → Pilih Unit & Deadline.
              </p>
              <p className="flex items-start gap-1">
                <span className="font-bold text-amber-700">2. Direktur:</span> Ganti peran ke Direktur → Kirim `ACC &lt;ID&gt;`, `TOLAK &lt;ID&gt;`, atau `REVISI &lt;ID&gt;`.
              </p>
              <p className="flex items-start gap-1">
                <span className="font-bold text-sky-700">3. Penerima:</span> Ganti peran ke Kepala SDM → Kirim `PROSES &lt;ID&gt;` → `SELESAI &lt;ID&gt;`.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
