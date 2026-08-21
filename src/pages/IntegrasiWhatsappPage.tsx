import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  MessageSquare, Send, RefreshCw, QrCode, CheckCircle2,
  ShieldCheck, Phone, Smartphone, Paperclip, FileText, UserCheck,
  Zap, Bot, Sparkles, Check, X, ArrowRight, CornerDownLeft
} from 'lucide-react';

interface SimulatorPersona {
  name: string;
  role: string;
  jid: string;
  avatarBg: string;
}

const PERSONAS: SimulatorPersona[] = [
  {
    name: 'Sekretariat RS (Admin)',
    role: 'Penginput Surat & Disposisi',
    jid: '628122650582@s.whatsapp.net',
    avatarBg: 'bg-emerald-600'
  },
  {
    name: 'dr. H. Budi Santoso, Sp.A (Direktur)',
    role: 'Pemberi Persetujuan (ACC / Tolak / Revisi)',
    jid: '6281299990001@s.whatsapp.net',
    avatarBg: 'bg-indigo-600'
  },
  {
    name: 'Ns. Siti Rahmawati, S.Kep (Kabid Keperawatan)',
    role: 'Penerima Tindak Lanjut Disposisi',
    jid: '6281299990003@s.whatsapp.net',
    avatarBg: 'bg-purple-600'
  }
];

export const IntegrasiWhatsappPage: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [selectedPersona, setSelectedPersona] = useState<SimulatorPersona>(PERSONAS[0]);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; senderName?: string; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🟢 *WhatsApp Bot Service RSSBK (Baileys Adapter Active)*\n\nSelamat datang di Layanan WhatsApp SIM-Surat RS Sebening Kasih.\n\nKirimkan berkas *PDF / Foto Surat Masuk* untuk diproses otomatis oleh OCR AI, atau ketik *menu* untuk melihat perintah lainnya.',
      time: '08:00'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = () => {
    apiService.getWhatsappSession().then(setSession).catch(console.error);
  };

  const handleRefreshQR = async () => {
    try {
      setLoadingQR(true);
      const res = await apiService.refreshWhatsappQR();
      setSession(res);
    } catch (e: any) {
      alert(`Gagal mereset QR Code: ${e.message}`);
    } finally {
      setLoadingQR(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Yakin ingin disconnect WhatsApp?')) return;
    try {
      await apiService.disconnectWhatsapp();
      setSession({
        status: 'DISCONNECTED',
        accountName: 'WA Bot RSSBK',
        jid: '',
        qrCodeUrl: '',
      });
    } catch (e: any) {
      alert(`Gagal disconnect WhatsApp: ${e.message}`);
    }
  };

  const sendTextMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, {
      sender: 'user',
      senderName: selectedPersona.name,
      text: textToSend,
      time: now
    }]);
    setInputText('');
    setSending(true);

    try {
      const res = await apiService.simulateWhatsappMsg(
        textToSend,
        selectedPersona.jid,
        selectedPersona.name
      );
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: res.reply,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: `❌ Terjadi kesalahan: ${e.message}`,
        time: now
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    sendTextMessage(inputText);
  };

  // Simulate sending sample document
  const handleSimulateSamplePDF = async () => {
    const sampleFileName = `Surat_Dinkes_Akreditasi_${Date.now()}.pdf`;
    const sampleBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCg==';
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, {
      sender: 'user',
      senderName: selectedPersona.name,
      text: `📎 [Mengunggah Berkas Lampiran]: ${sampleFileName}`,
      time: now
    }]);

    setUploadingMedia(true);
    try {
      const res = await apiService.simulateWhatsappMedia(
        sampleBase64,
        sampleFileName,
        'application/pdf',
        selectedPersona.jid,
        selectedPersona.name
      );

      setMessages(prev => [...prev, {
        sender: 'bot',
        text: res.reply,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: `❌ Gagal memproses dokumen: ${e.message}`,
        time: now
      }]);
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Status */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Baileys WhatsApp Multi-Device Adapter</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Workflow Surat Masuk & Disposisi via WhatsApp</h1>
          <p className="text-xs text-slate-500 mt-1">
            Ekstraksi OCR AI otomatis, pembuatan lembar disposisi, approval Direktur, dan notifikasi staf langsung di WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Baileys Bot Active</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code & Workflow Guidance (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* QR Code & Session Manager */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Pairing Multi-Device</span>
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                session?.status === 'CONNECTED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : session?.status === 'PAIRING'
                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {session?.status === 'CONNECTED' ? 'TERHUBUNG' : session?.status === 'PAIRING' ? 'SIAP PINDAI QR' : 'TERPUTUS'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[170px]">
              {session?.qrCodeUrl ? (
                <div className="space-y-2">
                  <img
                    src={session.qrCodeUrl}
                    alt="WhatsApp QR Code"
                    className="w-40 h-40 rounded-xl mx-auto border border-slate-200 object-contain shadow-xs bg-white p-1"
                  />
                  <p className="text-[11px] text-slate-500 font-medium">Buka WA &gt; Perangkat Tertaut &gt; Pindai QR</p>
                </div>
              ) : session?.status === 'CONNECTED' ? (
                <div className="text-center py-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">WhatsApp Aktif & Terhubung</p>
                  <p className="text-[11px] text-slate-500">Siap menerima dokumen & disposisi real-time</p>
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">QR Code Siap Digenerate</p>
                  <p className="text-[11px] text-slate-400">Klik tombol "Reset QR" di bawah untuk pairing</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">Akun Bot:</span>
                <span className="font-bold text-slate-800">{session?.accountName || 'SIM-Surat Bot RSSBK'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">JID Server:</span>
                <span className="font-mono font-semibold text-slate-800">{session?.jid || '628122650582@s.whatsapp.net'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefreshQR}
                disabled={loadingQR}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQR ? 'animate-spin' : ''}`} />
                <span>Reset QR</span>
              </button>
              <button
                onClick={handleDisconnect}
                disabled={session?.status !== 'CONNECTED'}
                className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Workflow Guide */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Panduan Alur Kerja WhatsApp</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <strong className="text-emerald-900 block text-[11px]">1. Sekretariat Kirim Berkas</strong>
                <span>Kirim berkas PDF/Foto surat masuk. AI Gemini mengekstrak nomor, tanggal, pengirim, & perihal.</span>
              </div>
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <strong className="text-indigo-900 block text-[11px]">2. Verifikasi & Disposisi</strong>
                <span>Sekretariat ketik <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">YA</code> lalu buat disposisi dengan memilih unit tujuan.</span>
              </div>
              <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl">
                <strong className="text-purple-900 block text-[11px]">3. Approval Direktur</strong>
                <span>Direktur menerima notifikasi WhatsApp dan membalas <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">ACC</code> / <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">TOLAK</code> / <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">REVISI</code>.</span>
              </div>
              <div className="p-2.5 bg-sky-50/70 border border-sky-100 rounded-xl">
                <strong className="text-sky-900 block text-[11px]">4. Tindak Lanjut Unit</strong>
                <span>Unit penerima mendapat lembar disposisi resmi dan membalas <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">SELESAI</code> setelah selesai ditindaklanjuti.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive WhatsApp Emulator (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[650px]">
          {/* Top Persona Selector Bar */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Simulasikan Sebagai:</span>
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {PERSONAS.map(p => (
                  <button
                    key={p.jid}
                    onClick={() => setSelectedPersona(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedPersona.jid === p.jid
                        ? `${p.avatarBg} text-white shadow-xs`
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.name.split(' ')[0]} ({p.name.includes('Direktur') ? 'Direktur' : p.name.includes('Keperawatan') ? 'Unit' : 'Sekretariat'})
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] font-mono text-emerald-400 truncate max-w-xs">
              JID: {selectedPersona.jid}
            </div>
          </div>

          {/* Quick Action Shortcut Pills */}
          <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Pintasan Cepat:</span>
            <button
              onClick={handleSimulateSamplePDF}
              disabled={uploadingMedia}
              className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-bold text-[11px] rounded-lg inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Paperclip className="w-3 h-3" />
              <span>Unggah Surat Masuk PDF (AI OCR)</span>
            </button>
            <button
              onClick={() => sendTextMessage('YA')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
            >
              YA (Verifikasi)
            </button>
            <button
              onClick={() => sendTextMessage('1')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
            >
              1 (Pilih / Ya)
            </button>
            <button
              onClick={() => sendTextMessage('ACC')}
              className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
            >
              ACC (Direktur)
            </button>
            <button
              onClick={() => sendTextMessage('SELESAI')}
              className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
            >
              SELESAI (Unit)
            </button>
            <button
              onClick={() => sendTextMessage('help')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
            >
              help
            </button>
          </div>

          {/* Messages Area */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3 font-sans text-xs bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 space-y-1.5 shadow-md ${
                  m.sender === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-none'
                    : 'bg-slate-950 text-slate-100 border border-slate-800 rounded-bl-none'
                }`}>
                  {m.sender === 'user' && m.senderName && (
                    <div className="text-[10px] font-bold text-emerald-200 border-b border-emerald-600/50 pb-1">
                      {m.senderName}
                    </div>
                  )}
                  <p className="whitespace-pre-line leading-relaxed font-sans font-medium">{m.text}</p>
                  <p className={`text-[9px] text-right ${m.sender === 'user' ? 'text-emerald-200' : 'text-slate-500'}`}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}
            {(sending || uploadingMedia) && (
              <div className="flex justify-start">
                <div className="bg-slate-950 text-emerald-400 border border-emerald-900/40 rounded-2xl p-3 text-xs italic flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>{uploadingMedia ? 'AI Gemini sedang mengekstrak dokumen surat masuk...' : 'WhatsApp Bot sedang merespon...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <button
              onClick={handleSimulateSamplePDF}
              disabled={uploadingMedia}
              title="Kirim Berkas PDF Surat Masuk"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ketik balasan (${selectedPersona.name.split(' ')[0]})...`}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 text-white text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSend}
              disabled={sending || !inputText.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
