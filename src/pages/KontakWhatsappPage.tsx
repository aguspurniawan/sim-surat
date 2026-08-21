import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { IUser, IUnit, RoleName } from "../types";
import {
  Phone,
  MessageSquare,
  Plus,
  Search,
  Filter,
  Edit2,
  Send,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  UserCheck,
  Building2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Users,
  Sparkles,
  X,
  Info,
} from "lucide-react";

export const KontakWhatsappPage: React.FC = () => {
  const [users, setUsers] = useState<IUser[]>([]);
  const [units, setUnits] = useState<IUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappSession, setWhatsappSession] = useState<any>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HAS_WA" | "NO_WA">(
    "ALL",
  );

  // Edit Contact Modal State
  const [editingUser, setEditingUser] = useState<IUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUnitCode, setEditUnitCode] = useState("ADM");
  const [editRole, setEditRole] = useState<RoleName>(RoleName.USER);
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("ADM");
  const [newRole, setNewRole] = useState<RoleName>(RoleName.STAFF);
  const [savingCreate, setSavingCreate] = useState(false);

  // Test Message Modal State
  const [testUser, setTestUser] = useState<IUser | null>(null);
  const [testMessageText, setTestMessageText] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uList, unitList, session] = await Promise.all([
        apiService.getUsers(),
        apiService.getUnits(),
        apiService.getWhatsappSession().catch(() => null),
      ]);
      setUsers(uList);
      setUnits(unitList);
      setWhatsappSession(session);
    } catch (e) {
      console.error("Gagal memuat data kontak WhatsApp:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper formatting phone
  const normalizeInputPhone = (input: string) => {
    let clean = input.replace(/\D/g, "");
    if (clean.startsWith("08")) {
      clean = "628" + clean.slice(2);
    } else if (clean.startsWith("8")) {
      clean = "628" + clean.slice(1);
    } else if (clean.startsWith("0")) {
      clean = "62" + clean.slice(1);
    }
    return clean;
  };

  const getPreviewJid = (input: string) => {
    const clean = normalizeInputPhone(input);
    if (!clean) return "-";
    return `${clean}@s.whatsapp.net`;
  };

  const formatDisplayPhone = (jid?: string) => {
    if (!jid) return "-";
    const num = jid.split("@")[0].replace(/\D/g, "");
    if (!num) return "-";
    if (num.startsWith("62")) {
      const rest = num.slice(2);
      if (rest.length >= 8) {
        return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
      }
      return `+62 ${rest}`;
    }
    return num;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Edit Modal
  const handleOpenEdit = (u: IUser) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
    const cleanPhone = u.whatsappJid ? u.whatsappJid.split("@")[0] : "";
    setEditPhone(cleanPhone);
    setEditUnitCode(u.unitCode || "ADM");
    setEditRole(u.role || RoleName.USER);
    setEditIsActive(u.isActive !== false);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      setSavingEdit(true);

      const userId =
        editingUser.id || (editingUser as any)._id || editingUser.username;

      if (!userId) {
        throw new Error("ID pengguna tidak ditemukan.");
      }

      const normalizedJid = getPreviewJid(editPhone);

      if (normalizedJid === "-") {
        throw new Error("Nomor WhatsApp tidak valid.");
      }

      await apiService.updateUserWhatsapp(userId, {
        whatsappJid: normalizedJid,
        fullName: editFullName.trim(),
        unitCode: editUnitCode,
        role: editRole,
        isActive: editIsActive,
      });

      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan perubahan kontak WhatsApp");
    } finally {
      setSavingEdit(false);
    }
  };

  // Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim()) {
      alert("Username dan Nama Lengkap wajib diisi.");
      return;
    }
    try {
      setSavingCreate(true);
      await apiService.createUser({
        username: newUsername.trim(),
        fullName: newFullName.trim(),
        email:
          newEmail.trim() || `${newUsername.toLowerCase().trim()}@rssbk.co.id`,
        whatsappJid: newPhone.trim(),
        unitCode: newUnitCode,
        role: newRole,
        isActive: true,
      });
      setShowCreateModal(false);
      setNewUsername("");
      setNewFullName("");
      setNewEmail("");
      setNewPhone("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Gagal menambahkan pengguna baru.");
    } finally {
      setSavingCreate(false);
    }
  };

  // Open Test Message Modal
  const handleOpenTest = (u: IUser) => {
    setTestUser(u);
    setTestResult(null);
    setTestMessageText(
      `🔔 *Uji Verifikasi Kontak WhatsApp*\n\nYth. *${u.fullName}* (${u.role} - Unit ${u.unitCode || "RS"}),\n\nNomor WhatsApp Anda telah terverifikasi dalam Sistem Informasi Manajemen Surat & Disposisi RS Sebening Kasih.\n\nNotifikasi surat masuk dan disposisi akan dikirimkan otomatis ke nomor ini.`,
    );
  };

  // Execute Test Send
  const handleSendTestMessage = async () => {
    if (!testUser) return;
    try {
      setTestSending(true);
      setTestResult(null);
      const res = await apiService.testSendWhatsapp({
        userId: testUser.id,
        whatsappJid: testUser.whatsappJid,
        text: testMessageText,
      });
      setTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal mengirim pesan tes WhatsApp",
      });
    } finally {
      setTestSending(false);
    }
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.unitCode &&
        u.unitCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.whatsappJid &&
        u.whatsappJid.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchUnit = selectedUnit === "ALL" || u.unitCode === selectedUnit;
    const matchRole = selectedRole === "ALL" || u.role === selectedRole;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "HAS_WA" && !!u.whatsappJid) ||
      (statusFilter === "NO_WA" && !u.whatsappJid);

    return matchSearch && matchUnit && matchRole && matchStatus;
  });

  const totalWithWa = users.filter((u) => !!u.whatsappJid).length;
  const totalWithoutWa = users.length - totalWithWa;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Integration Info Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Manajemen Kontak WhatsApp Pengguna
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                User Model Bound
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola nomor WhatsApp penerima notifikasi penomoran, surat masuk,
              disposisi Direktur, dan tindak lanjut unit PIC.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Segarkan</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Pengguna
            </div>
            <div className="text-xl font-black text-slate-900">
              {users.length}{" "}
              <span className="text-xs font-normal text-slate-500">akun</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              WhatsApp Terdaftar
            </div>
            <div className="text-xl font-black text-emerald-700">
              {totalWithWa}{" "}
              <span className="text-xs font-normal text-slate-500">kontak</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Belum Ada Nomor
            </div>
            <div className="text-xl font-black text-amber-700">
              {totalWithoutWa}{" "}
              <span className="text-xs font-normal text-slate-500">
                pengguna
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Unit Terintegrasi
            </div>
            <div className="text-xl font-black text-teal-700">
              {units.length}{" "}
              <span className="text-xs font-normal text-slate-500">
                unit kerja
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, username, no WA..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter Unit */}
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Semua Unit</option>
              {units.map((u) => (
                <option key={u.id || u.code} value={u.code}>
                  {u.code} - {u.name}
                </option>
              ))}
            </select>

            {/* Filter Role */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Semua Role</option>
              {Object.values(RoleName).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Filter Status WA */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Semua Status WA</option>
              <option value="HAS_WA">Terdaftar WhatsApp</option>
              <option value="NO_WA">Belum Ada Nomor</option>
            </select>
          </div>
        </div>

        {/* User Contacts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-4">Role & Unit</th>
                <th className="py-3.5 px-4">Peran Workflow</th>
                <th className="py-3.5 px-4">Nomor WhatsApp / JID</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Memuat data kontak pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Tidak ada pengguna yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const hasWa = !!u.whatsappJid;
                  const displayPhone = formatDisplayPhone(u.whatsappJid);
                  const rawPhone = u.whatsappJid
                    ? u.whatsappJid.split("@")[0]
                    : "";
                  const isDirektur =
                    u.role === RoleName.PIMPINAN || u.role === RoleName.DIREKSI;
                  const isSekretariat =
                    u.role === RoleName.SEKRETARIAT ||
                    u.role === RoleName.ADMIN;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shadow-2xs shrink-0">
                            {u.fullName
                              ? u.fullName.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs leading-snug">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{u.username} • {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Unit */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isDirektur
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : isSekretariat
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {u.role}
                          </span>
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {u.unitCode || "ADM"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Workflow Role Tag */}
                      <td className="py-3.5 px-4">
                        {isDirektur ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                            <span>🎯</span>
                            <span>Persetujuan & Disposisi Direktur</span>
                          </div>
                        ) : isSekretariat ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">
                            <span>🏢</span>
                            <span>Penerima Surat Masuk & Notif</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-medium">
                            <span>🏥</span>
                            <span>PIC Unit Tindak Lanjut ({u.unitCode})</span>
                          </div>
                        )}
                      </td>

                      {/* WhatsApp / JID */}
                      <td className="py-3.5 px-4">
                        {hasWa ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-emerald-800 text-xs">
                                {displayPhone}
                              </span>
                              <button
                                onClick={() => handleCopy(rawPhone, u.id)}
                                title="Salin nomor WhatsApp"
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                              >
                                {copiedId === u.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div
                              className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]"
                              title={u.whatsappJid}
                            >
                              {u.whatsappJid}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3 text-slate-400" />
                            Belum Ada Nomor
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Nonaktif
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasWa && (
                            <>
                              <button
                                onClick={() => handleOpenTest(u)}
                                title="Uji Kirim Pesan WhatsApp"
                                className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px]">
                                  Tes Pesan
                                </span>
                              </button>

                              <a
                                href={`https://wa.me/${rawPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Buka Chat WhatsApp Web"
                                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs cursor-pointer transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Edit Kontak WhatsApp"
                            className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">
                              Edit
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT KONTAK WHATSAPP */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Kontak WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pengguna: @{editingUser.username}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Full Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Phone Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Nomor WhatsApp
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Format: 0812... / 62812...
                  </span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
                {editPhone && (
                  <div className="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/60 rounded-lg text-[11px] text-emerald-800 flex items-center justify-between font-mono">
                    <span>
                      Baileys JID: <strong>{getPreviewJid(editPhone)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Unit & Role Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Unit Kerja
                  </label>
                  <select
                    value={editUnitCode}
                    onChange={(e) => setEditUnitCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {units.map((u) => (
                      <option key={u.id || u.code} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Role Akun
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {Object.values(RoleName).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toggle Status */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="editIsActive"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Akun Aktif (Dapat menerima notifikasi persuratan)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Kontak</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UJI KIRIM PESAN WHATSAPP */}
      {testUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Uji Kirim Pesan WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Penerima: {testUser.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">
                    Nomor WhatsApp Tujuan
                  </div>
                  <div className="font-bold text-slate-800 font-mono">
                    {formatDisplayPhone(testUser.whatsappJid)}
                  </div>
                </div>
                <div className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  {testUser.whatsappJid}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Isi Pesan WhatsApp
                </label>
                <textarea
                  rows={6}
                  value={testMessageText}
                  onChange={(e) => setTestMessageText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {testResult.success
                        ? "Berhasil Terkirim"
                        : "Gagal Mengirim"}
                    </div>
                    <div>{testResult.message}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTestUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSendTestMessage}
                  disabled={testSending || !testUser.whatsappJid}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Kirim Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH PENGGUNA BARU */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tambah Pengguna & Kontak
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftarkan akun staf baru untuk integrasi persuratan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Username / NIP
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. dokter_agus"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. staf@rssbk.co.id"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. dr. Agus Purniawan, Sp.A"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Nomor WhatsApp
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Format: 0812...
                  </span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Contoh: 08122650582"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Unit Kerja
                  </label>
                  <select
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {units.map((u) => (
                      <option key={u.id || u.code} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Role Akun
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {Object.values(RoleName).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {savingCreate ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
