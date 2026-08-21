import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { ILetterType, IUnit, ILetterTemplate } from '../types';
import { Settings, Hash, Building2, FileText, Plus, Edit2, Trash2, CheckCircle2, X, RotateCcw, AlertTriangle, ShieldAlert, Sliders } from 'lucide-react';

export const PengaturanPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'types' | 'units' | 'templates' | 'production'>('types');
  const [types, setTypes] = useState<ILetterType[]>([]);
  const [units, setUnits] = useState<IUnit[]>([]);
  const [templates, setTemplates] = useState<ILetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Type Edit Form State
  const [editingType, setEditingType] = useState<ILetterType | null>(null);

  // Counter Override Modal State
  const [counterTypeModal, setCounterTypeModal] = useState<ILetterType | null>(null);
  const [counterValue, setCounterValue] = useState<number>(0);

  // Unit CRUD State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<IUnit | null>(null);
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitCategory, setUnitCategory] = useState('Administrasi');
  const [unitDescription, setUnitDescription] = useState('');

  // Template CRUD State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ILetterTemplate | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplTypeCode, setTplTypeCode] = useState('UMUM');
  const [tplCategory, setTplCategory] = useState('UMUM');
  const [tplPattern, setTplPattern] = useState('');


  const loadData = async () => {
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Type Handlers ---
  const handleToggleTypeLock = async (type: ILetterType) => {
    const nextLocked = !type.isLocked;
    const identifier = type.code || type.id;

    // Optimistic UI update
    setTypes(prev =>
      prev.map(t => (t.code === type.code || t.id === type.id ? { ...t, isLocked: nextLocked } : t))
    );

    try {
      await apiService.setLetterTypeLock(identifier, nextLocked);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Gagal mengubah status kunci jenis surat.');
      await loadData();
    }
  };

  const handleSaveType = async () => {
    if (!editingType) return;
    try {
      await apiService.updateLetterType(editingType.code, editingType);
      setEditingType(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const sharedCounterCodes = ['UMUM', 'SK', 'PERDIR'];

  const isSharedCounterType = (code: string) =>
    sharedCounterCodes.includes(code.toUpperCase());

  const getSharedCounterType = () =>
    types.find(t => t.code === 'UMUM') ||
    types.find(t => t.code === 'SK') ||
    types.find(t => t.code === 'PERDIR');

  const openCounterModal = (type: ILetterType) => {
    setCounterTypeModal(type);
    setCounterValue((type.startingNumber || 1) - 1);
  };

  const handleSaveCounter = async () => {
    if (!counterTypeModal) return;

    try {
      const targetTypeCode = isSharedCounterType(counterTypeModal.code)
        ? 'GENERAL'
        : counterTypeModal.code;

      await apiService.setCounter({
        typeCode: targetTypeCode,
        sequenceNumber: Number(counterValue)
      });

      const label = isSharedCounterType(counterTypeModal.code)
        ? 'UMUM / SK / PERDIR'
        : counterTypeModal.code;

      alert(
        `Counter ${label} berhasil diatur ke ${counterValue}. ` +
        `Nomor berikutnya adalah ${String(Number(counterValue) + 1).padStart(counterTypeModal.padding || 3, '0')}.`
      );

      setCounterTypeModal(null);
      await loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResetProductionData = async () => {
    if (!confirm('PERHATIAN SANGAT PENTING!\n\nApakah Anda yakin ingin MEMBERSIHKAN SELURUH DATA TRANSAKSI UJI COBA?\n\nTindakan ini akan menghapus:\n- Seluruh Surat Keluar & Dokumen Umum\n- Seluruh SPO, SK, PERDIR\n- Seluruh Reservasi Nomor & Counter Penomoran\n- Seluruh Audit Log\n\nData Master Unit Kerja, Jenis Surat, Template, dan User AKAN TETAP AMAN.')) return;

    try {
      await apiService.resetProduction();
      alert('Sistem berhasil dibersihkan dari data uji coba! Seluruh counter penomoran di-reset dan siap digunakan untuk Production.');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };


  // --- Unit Handlers ---
  const openAddUnitModal = () => {
    setEditingUnit(null);
    setUnitCode('');
    setUnitName('');
    setUnitCategory('Administrasi');
    setUnitDescription('');
    setShowUnitModal(true);
  };

  const openEditUnitModal = (unit: IUnit) => {
    setEditingUnit(unit);
    setUnitCode(unit.code);
    setUnitName(unit.name);
    setUnitCategory((unit as any).category || 'Administrasi');
    setUnitDescription(unit.description || '');
    setShowUnitModal(true);
  };

  const handleSaveUnit = async () => {
    if (!unitCode || !unitName) {
      alert('Kode Unit dan Nama Unit wajib diisi.');
      return;
    }
    try {
      if (editingUnit) {
        await apiService.updateUnit(editingUnit.id || editingUnit.code, {
          code: unitCode,
          name: unitName,
          category: unitCategory,
          description: unitDescription
        });
      } else {
        await apiService.createUnit({
          code: unitCode,
          name: unitName,
          category: unitCategory,
          description: unitDescription
        });
      }
      setShowUnitModal(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUnit = async (unit: IUnit) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus unit kerja "${unit.code} - ${unit.name}"?`)) return;
    try {
      await apiService.deleteUnit(unit.id || unit.code);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // --- Template Handlers ---
  const openAddTemplateModal = () => {
    setEditingTemplate(null);
    setTplTitle('');
    setTplTypeCode('UMUM');
    setTplCategory('UMUM');
    setTplPattern('{NO}/RSSBK/{UNIT}/{BULAN_ROMAWI}/{TAHUN}');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tpl: ILetterTemplate) => {
    setEditingTemplate(tpl);
    setTplTitle(tpl.title);
    setTplTypeCode((tpl as any).typeCode || tpl.category || 'UMUM');
    setTplCategory(tpl.category || 'UMUM');
    setTplPattern(tpl.contentPattern);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!tplTitle || !tplPattern) {
      alert('Judul Template dan Pattern Perihal wajib diisi.');
      return;
    }
    try {
      if (editingTemplate) {
        await apiService.updateTemplate(editingTemplate.id, {
          title: tplTitle,
          typeCode: tplTypeCode,
          category: tplCategory || tplTypeCode,
          contentPattern: tplPattern
        });
      } else {
        await apiService.createTemplate({
          title: tplTitle,
          typeCode: tplTypeCode,
          category: tplCategory || tplTypeCode,
          contentPattern: tplPattern
        });
      }
      setShowTemplateModal(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteTemplate = async (tpl: ILetterTemplate) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus template perihal "${tpl.title}"?`)) return;
    try {
      await apiService.deleteTemplate(tpl.id);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Pengaturan Sistem Penomoran</h2>
          <p className="text-xs text-slate-500">Konfigurasi format penomoran, padding digit, reset policy, unit kerja, dan template perihal</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'types', label: 'Jenis Surat & Format Pattern', icon: Hash },
          { id: 'units', label: 'Unit Kerja / Satker', icon: Building2 },
          { id: 'templates', label: 'Template Perihal', icon: FileText },
          { id: 'production', label: 'Reset & Set Nomor Awalan (Production)', icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isProdTab = tab.id === 'production';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? isProdTab ? 'bg-amber-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Jenis Surat */}
      {activeTab === 'types' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daftar Konfigurasi Jenis Surat</h3>
              <p className="text-xs text-slate-500">Atur pattern format penomoran dan nomor urut awalan untuk tiap jenis surat</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {types.map((t) => (
              <div key={t.code} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-sm text-slate-900">{t.code} - {t.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openCounterModal(t)}
                      className="px-2.5 py-1 text-xs bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-lg hover:bg-amber-200 cursor-pointer"
                    >
                      Atur Nomor Awalan
                    </button>
                    <button
                      onClick={() => handleToggleTypeLock(t)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                        t.isLocked
                          ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                      }`}
                    >
                      {t.isLocked ? '🔒 Terkunci' : '🔓 Terbuka'}
                    </button>
                    <button
                      onClick={() => setEditingType(t)}
                      className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                    >
                      Edit Format
                    </button>
                  </div>
                </div>
                <div className="text-xs space-y-1 font-mono">
                  <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg font-bold">{t.format}</div>
                  <div className="text-slate-600 pt-1 font-sans flex justify-between items-center text-[11px]">
                    <span>Scope: <strong>{t.scope}</strong> | Reset: <strong>{t.resetSequence}</strong></span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold font-mono">
                      Awalan: {t.startingNumber || 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Tab 2: Unit Kerja */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Master Unit Kerja / Satuan Kerja</h3>
              <p className="text-xs text-slate-500">Kelola daftar unit pengirim dan kode unit pada penomoran surat</p>
            </div>
            <button
              onClick={openAddUnitModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Unit Kerja</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map((u) => (
              <div key={u.id || u.code} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-slate-100/80 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-800 text-sm">{u.code}</span>
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-700">
                      {(u as any).category || 'Administrasi'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 font-bold">{u.name}</div>
                  {u.description && <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{u.description}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditUnitModal(u)}
                    title="Edit Unit Kerja"
                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUnit(u)}
                    title="Hapus Unit Kerja"
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg bg-red-50 border border-red-200 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Template Perihal */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Master Template Judul & Perihal Surat</h3>
              <p className="text-xs text-slate-500">Kelola daftar template pattern perihal untuk pemesanan surat cepat</p>
            </div>
            <button
              onClick={openAddTemplateModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Template Perihal</span>
            </button>
          </div>

          <div className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{tpl.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
                      {(tpl as any).typeCode || tpl.category || 'UMUM'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-emerald-800 bg-white p-2.5 rounded-xl border border-slate-200 font-semibold truncate">
                    {tpl.contentPattern}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditTemplateModal(tpl)}
                    title="Edit Template"
                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl)}
                    title="Hapus Template"
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg bg-red-50 border border-red-200 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Production & Reset Counter */}
      {activeTab === 'production' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Manajemen Penomoran Awalan & Pembersihan Data Launching</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Sebelum sistem resmi diluncurkan (*Go Live Production*), Anda dapat menentukan **Nomor Urut Awalan** untuk melanjutkan penomoran surat manual sebelumnya. Anda juga dapat membersihkan data transaksi uji coba agar database bersih dan ringan.
            </p>
          </div>

          {/* Card Atur Counter Awalan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Atur Nomor Urut Awalan Penomoran</h3>
              <p className="text-xs text-slate-500">
                Tentukan nomor urut terakhir yang pernah diterbitkan secara manual. Sistem akan secara otomatis menerbitkan nomor berikutnya (N+1).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {types.filter(t => t.code === 'SPO').map((t) => (
                <div key={t.code} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900">SPO</span>
                      <div className="text-xs text-slate-500 font-medium">Counter sendiri per unit</div>
                    </div>
                    <button
                      onClick={() => openCounterModal(t)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Set Nomor</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Terakhir Digunakan:</span>
                      <strong className="font-mono text-slate-900">
                        {Math.max(0, (t.startingNumber || 1) - 1)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-100">
                      <span>Nomor Berikutnya:</span>
                      <strong className="font-mono text-emerald-600 text-sm">
                        {String(t.startingNumber || 1).padStart(t.padding || 3, '0')}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}

              {(() => {
                const shared = getSharedCounterType();
                if (!shared) return null;

                const last = Math.max(0, (shared.startingNumber || 1) - 1);
                const next = String(shared.startingNumber || 1).padStart(shared.padding || 3, '0');

                return (
                  <div key="GENERAL" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-sm text-slate-900">
                          UMUM / SK / PERDIR
                        </span>
                        <div className="text-xs text-slate-500 font-medium">
                          Satu counter bersama: GENERAL
                        </div>
                      </div>
                      <button
                        onClick={() => openCounterModal(shared)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Set Counter</span>
                      </button>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Terakhir Digunakan:</span>
                        <strong className="font-mono text-slate-900">{last}</strong>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-100">
                        <span>Nomor Berikutnya:</span>
                        <strong className="font-mono text-emerald-600 text-sm">{next}</strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 leading-relaxed">
                      Sequence berlanjut lintas UMUM, SK, dan PERDIR.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Area Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Danger Zone: Pembersihan Data Uji Coba (Production Reset)</span>
            </div>
            <p className="text-xs text-red-800 leading-relaxed">
              Gunakan fitur ini hanya ketika Anda siap meluncurkan aplikasi secara resmi. Semua data surat keluar, reservasi penomoran uji coba, dokumen umum, SPO/SK/PERDIR, dan audit log akan dihapus total. Data Master Unit Kerja, User, dan Jenis Surat tetap tersimpan aman.
            </p>

            <button
              onClick={handleResetProductionData}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Bersihkan Data Uji Coba & Siapkan untuk Production</span>
            </button>
          </div>
        </div>
      )}

      {/* Counter Override Modal */}
      {counterTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Set Nomor Urut Awalan: {isSharedCounterType(counterTypeModal.code) ? 'UMUM / SK / PERDIR' : counterTypeModal.code}
              </h3>
              <button onClick={() => setCounterTypeModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                Masukkan **nomor urut manual terakhir** yang sudah digunakan. Misalnya jika surat manual terakhir nomor **044**, masukkan angka **44**.
              </div>

              <div>
                <label className="font-bold text-slate-700">Nomor Urut Terakhir yang Sudah Ada</label>
                <input
                  type="number"
                  value={counterValue}
                  onChange={(e) => setCounterValue(Number(e.target.value))}
                  placeholder="Contoh: 44"
                  className="w-full p-3 border border-slate-200 rounded-xl font-mono text-base font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-xs space-y-1">
                <div className="text-slate-400 font-sans text-[10px]">PREVIEW NOMOR OTOMATIS BERIKUTNYA:</div>
                <div className="font-bold text-sm">
                  {String(Number(counterValue) + 1).padStart(counterTypeModal.padding || 3, '0')}
                  /RSSBK/ADM/VIII/2026
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCounterTypeModal(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveCounter}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Simpan Counter Awalan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}

      {editingType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Edit Format Pattern {editingType.code}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Format Template *</label>
                <input
                  type="text"
                  value={editingType.format}
                  onChange={(e) => setEditingType({ ...editingType, format: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">Variabel tersedia: &#123;NO&#125;, &#123;UNIT&#125;, &#123;BULAN_ROMAWI&#125;, &#123;TAHUN&#125;, &#123;BULAN&#125;</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Padding Sequence</label>
                  <input
                    type="number"
                    value={editingType.padding}
                    onChange={(e) => setEditingType({ ...editingType, padding: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Reset Policy</label>
                  <select
                    value={editingType.resetSequence}
                    onChange={(e) => setEditingType({ ...editingType, resetSequence: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50"
                  >
                    <option value="YEARLY">YEARLY (Tahunan)</option>
                    <option value="MONTHLY">MONTHLY (Bulanan)</option>
                    <option value="NEVER">NEVER (Kontinu)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingType(null)} className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Batal</button>
              <button onClick={handleSaveType} className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unit Kerja (Tambah / Edit) */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUnit ? `Edit Unit Kerja: ${editingUnit.code}` : 'Tambah Unit Kerja / Satker Baru'}
              </h3>
              <button onClick={() => setShowUnitModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Kode Unit * (singkatan uppercase)</label>
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: ADM, KEP, SDM, LAB"
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Nama Unit Kerja *</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="Contoh: Administrasi & Umum"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Kategori Unit</label>
                <select
                  value={unitCategory}
                  onChange={(e) => setUnitCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50"
                >
                  <option value="Administrasi">Administrasi & Umum</option>
                  <option value="Medis">Pelayanan Medis</option>
                  <option value="Keperawatan">Keperawatan</option>
                  <option value="Penunjang">Penunjang Medis / Lab</option>
                  <option value="Manajemen">Manajemen & Pimpinan</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Deskripsi Ringkas</label>
                <textarea
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  placeholder="Deskripsi tugas atau peranan unit kerja..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowUnitModal(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveUnit}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                {editingUnit ? 'Simpan Perubahan' : 'Tambah Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Template Perihal (Tambah / Edit) */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingTemplate ? 'Edit Template Perihal' : 'Tambah Template Perihal Baru'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Judul / Nama Template *</label>
                <input
                  type="text"
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  placeholder="Contoh: SPTJM Pelayanan Kesehatan"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Kode Jenis Surat</label>
                  <select
                    value={tplTypeCode}
                    onChange={(e) => {
                      setTplTypeCode(e.target.value);
                      setTplCategory(e.target.value);
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50"
                  >
                    <option value="UMUM">UMUM - Surat Umum / Dinas</option>
                    <option value="SPO">SPO - Standard Operating Procedure</option>
                    <option value="SK">SK - Surat Keputusan</option>
                    <option value="PERDIR">PERDIR - Peraturan Direksi</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Kategori</label>
                  <input
                    type="text"
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Pattern / Isi Template Perihal *</label>
                <textarea
                  value={tplPattern}
                  onChange={(e) => setTplPattern(e.target.value)}
                  placeholder="Contoh: Surat Tugas Tim Akreditasi Bulan {BULAN} {TAHUN}"
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
                <p className="text-[10px] text-slate-400 mt-1">Gunakan tempat penampung variabel seperti &#123;BULAN&#125;, &#123;TAHUN&#125;, &#123;UNIT&#125;</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTemplate}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                {editingTemplate ? 'Simpan Perubahan' : 'Tambah Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};