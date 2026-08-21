import { numberingService } from '../../services/numbering.service';
import { incomingLetterService } from '../../services/incoming-letter.service';
import { storageService } from '../../services/storage.service';
import { documentExtractorService, ExtractedLetterData } from '../../services/document-extractor.service';
import { auditService } from '../../services/audit.service';
import { inMemoryDB, isAtlasConnected } from '../../config/database';
import { LetterTypeModel, UnitModel, UserModel, IncomingLetterModel } from '../../models';
import { ChannelType, RoleName, IIncomingLetter, IDisposition } from '../../../types';
import { sendTelegramMessage } from './telegram.bot';

export interface TelegramState {
  step:
    | 'IDLE'
    | 'SELECT_TYPE'
    | 'SELECT_UNIT'
    | 'INPUT_QUANTITY'
    | 'SELECT_SUBJECT_MODE'
    | 'INPUT_SUBJECT'
    | 'INPUT_SUBJECTS'
    | 'CONFIRM'
    // Workflow Surat Masuk & Disposisi
    | 'VERIFY_INCOMING_LETTER'
    | 'EDIT_FIELD_SELECT'
    | 'EDIT_FIELD_INPUT'
    | 'ASK_CREATE_DISPOSITION'
    | 'SELECT_DISPOSITION_TARGET'
    | 'INPUT_DISPOSITION_INSTRUCTION'
    | 'INPUT_DISPOSITION_DEADLINE'
    | 'INPUT_REJECTION_REASON'
    | 'INPUT_REVISION_NOTES';

  // Numbering fields
  typeCode?: string;
  unitCode?: string;
  quantity?: number;
  subjectMode?: 'SAME' | 'DIFFERENT';
  subject?: string;
  subjects?: string[];
  previewNumber?: string;
  previewNumbers?: string[];
  requestId?: string;

  // Surat Masuk & Disposisi fields
  draftIncoming?: Partial<IIncomingLetter>;
  editingField?: string;
  savedLetter?: IIncomingLetter;
  availableUnits?: any[];
  draftDisposition?: {
    incomingLetterId: string;
    toUserOrUnit: string;
    targetUnitCode?: string;
    toTelegramId?: string;
    instruction?: string;
    deadline?: string;
  };
  activeDispRef?: string;
}

// In-memory sessions
const telegramUserSessions = new Map<string, TelegramState>();

// In-memory notification log for simulator & audit inspection
export interface ITelegramNotificationLog {
  id: string;
  targetTelegramId: string;
  targetName: string;
  message: string;
  timestamp: string;
  type: 'DISPOSITION_APPROVAL_REQ' | 'DISPOSITION_APPROVED' | 'DISPOSITION_REJECTED' | 'DISPOSITION_REVISION' | 'DISPOSITION_UPDATE';
}

const telegramNotificationLogs: ITelegramNotificationLog[] = [];

export class TelegramService {
  public getSession(telegramUserId: string): TelegramState {
    if (!telegramUserSessions.has(telegramUserId)) {
      telegramUserSessions.set(telegramUserId, { step: 'IDLE' });
    }
    return telegramUserSessions.get(telegramUserId)!;
  }

  public setSession(telegramUserId: string, state: TelegramState) {
    telegramUserSessions.set(telegramUserId, state);
  }

  public resetSession(telegramUserId: string) {
    telegramUserSessions.set(telegramUserId, { step: 'IDLE' });
  }

  public getNotificationLogs(): ITelegramNotificationLog[] {
    return telegramNotificationLogs;
  }

  /**
   * Helper: Find database User by Telegram User ID / Account ID / Sender Name
   */
  public async findUserByTelegramId(telegramUserId: string, senderName?: string): Promise<any> {
    const rawId = String(telegramUserId).trim();
    const cleanId = rawId.toLowerCase();

    let user: any = null;

    if (isAtlasConnected()) {
      user = await UserModel.findOne({
        $or: [
          { telegramAccountId: rawId },
          { telegramAccountId: cleanId },
          { username: cleanId },
          { id: rawId }
        ]
      });
    } else {
      user = inMemoryDB.users.find(
        u =>
          u.telegramAccountId === rawId ||
          u.telegramAccountId === cleanId ||
          u.username.toLowerCase() === cleanId ||
          u.id === rawId
      );
    }

    if (user) return user;

    // Fallback heuristic mapping for testing / simulation & common handles
    if (cleanId.includes('pimpinan') || cleanId.includes('direktur') || cleanId === '1003' || cleanId === 'tg_direktur') {
      return inMemoryDB.users.find(u => u.role === RoleName.PIMPINAN) || {
        id: 'usr-3',
        fullName: 'dr. H. Budi Santoso, Sp.A (Direktur)',
        username: 'pimpinan',
        role: RoleName.PIMPINAN,
        unitCode: 'ADM',
        telegramAccountId: 'tg_direktur'
      };
    }

    if (cleanId.includes('admin') || cleanId.includes('sekretariat') || cleanId === '1002' || cleanId === 'tg_sekretariat') {
      return inMemoryDB.users.find(u => u.role === RoleName.SEKRETARIAT || u.role === RoleName.ADMIN) || {
        id: 'usr-2',
        fullName: 'Sekretariat RS',
        username: 'admin',
        role: RoleName.SEKRETARIAT,
        unitCode: 'ADM',
        telegramAccountId: 'tg_sekretariat'
      };
    }

    if (cleanId.includes('sdm') || cleanId === '1004' || cleanId === 'tg_sdm') {
      return inMemoryDB.users.find(u => u.unitCode === 'SDM') || {
        id: 'usr-4',
        fullName: 'Siti Rahmawati (Kepala SDM)',
        username: 'sdm',
        role: RoleName.STAFF,
        unitCode: 'SDM',
        telegramAccountId: 'tg_sdm'
      };
    }

    if (cleanId.includes('keperawatan') || cleanId.includes('kep') || cleanId === '1005' || cleanId === 'tg_keperawatan') {
      return inMemoryDB.users.find(u => u.unitCode === 'KEP') || {
        id: 'usr-5',
        fullName: 'Ahmad Subandi (Kepala Keperawatan)',
        username: 'keperawatan',
        role: RoleName.USER,
        unitCode: 'KEP',
        telegramAccountId: 'tg_keperawatan'
      };
    }

    // Default fallback: check if senderName indicates a role
    if (senderName) {
      const sName = senderName.toLowerCase();
      if (sName.includes('direktur') || sName.includes('pimpinan')) {
        return inMemoryDB.users.find(u => u.role === RoleName.PIMPINAN);
      }
      if (sName.includes('sekretariat') || sName.includes('admin')) {
        return inMemoryDB.users.find(u => u.role === RoleName.SEKRETARIAT || u.role === RoleName.ADMIN);
      }
      if (sName.includes('sdm')) {
        return inMemoryDB.users.find(u => u.unitCode === 'SDM');
      }
    }

    // Default user object for generic telegram user
    return {
      id: `tg-${telegramUserId}`,
      username: `tg_${telegramUserId}`,
      fullName: senderName || `Telegram User (${telegramUserId})`,
      role: RoleName.USER,
      unitCode: 'ADM',
      telegramAccountId: telegramUserId
    };
  }

  /**
   * Helper: Get Direktur User & Telegram Chat ID
   */
  public async getDirektur(): Promise<{ user: any; telegramId: string }> {
    let direktur: any = null;
    if (isAtlasConnected()) {
      direktur = await UserModel.findOne({
        $or: [{ role: RoleName.PIMPINAN }, { role: RoleName.DIREKSI }]
      });
    } else {
      direktur = inMemoryDB.users.find(u => u.role === RoleName.PIMPINAN || u.role === RoleName.DIREKSI);
    }

    const defaultId = direktur?.telegramAccountId || 'tg_direktur';
    return {
      user: direktur || {
        fullName: 'dr. H. Budi Santoso, Sp.A (Direktur)',
        role: RoleName.PIMPINAN
      },
      telegramId: defaultId
    };
  }

  /**
   * Helper: Get Unit PIC Telegram ID
   */
  public async getUnitPicTelegramId(unitCodeOrName: string): Promise<{ user: any; telegramId: string }> {
    const s = (unitCodeOrName || '').toUpperCase();
    let picUser: any = null;

    if (isAtlasConnected()) {
      picUser = await UserModel.findOne({
        $or: [
          { unitCode: new RegExp(s, 'i') },
          { fullName: new RegExp(unitCodeOrName, 'i') }
        ]
      });
    } else {
      picUser = inMemoryDB.users.find(
        u =>
          (u.unitCode && s.includes(u.unitCode)) ||
          (u.fullName && u.fullName.toLowerCase().includes(unitCodeOrName.toLowerCase()))
      );
    }

    if (picUser?.telegramAccountId) {
      return { user: picUser, telegramId: picUser.telegramAccountId };
    }

    if (s.includes('SDM')) return { user: picUser || { fullName: 'Kepala SDM' }, telegramId: 'tg_sdm' };
    if (s.includes('KEP') || s.includes('RAWAT')) return { user: picUser || { fullName: 'Kepala Keperawatan' }, telegramId: 'tg_keperawatan' };
    if (s.includes('MUTU')) return { user: picUser || { fullName: 'Komite Mutu' }, telegramId: 'tg_mutu' };

    return { user: picUser || { fullName: unitCodeOrName }, telegramId: 'tg_sekretariat' };
  }

  /**
   * Send notification via Telegram & record in logs
   */
  private async notifyTelegram(
    telegramId: string,
    targetName: string,
    message: string,
    type: ITelegramNotificationLog['type']
  ) {
    // Record log
    const logEntry: ITelegramNotificationLog = {
      id: `notif-tg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetTelegramId: telegramId,
      targetName,
      message,
      timestamp: new Date().toISOString(),
      type
    };
    telegramNotificationLogs.unshift(logEntry);
    if (telegramNotificationLogs.length > 50) telegramNotificationLogs.pop();

    // Send via live Bot API if active
    await sendTelegramMessage(telegramId, message);
  }

  private async getActiveLetterTypes(): Promise<any[]> {
    if (isAtlasConnected()) {
      return await LetterTypeModel.find({ isActive: true });
    }
    return inMemoryDB.letterTypes.filter(t => t.isActive !== false);
  }

  private async getActiveUnits(): Promise<any[]> {
    if (isAtlasConnected()) {
      return await UnitModel.find({ isActive: true });
    }
    return inMemoryDB.units.filter(u => u.isActive !== false);
  }

  private parseSubjects(text: string, count: number): string[] {
    const subjects = text
      .split(/\r?\n/)
      .map(v => v.trim())
      .filter(Boolean);

    if (subjects.length !== count) {
      throw new Error(
        `Jumlah perihal harus ${count} baris. Anda mengirim ${subjects.length} baris.`
      );
    }

    if (subjects.some(v => v.length < 3)) {
      throw new Error('Semua perihal harus minimal 3 karakter.');
    }

    return subjects;
  }

  /**
   * =========================================================================
   * 1. MEDIA HANDLING: INCOMING LETTER PDF/IMAGE UPLOAD & OCR EXTRACTION
   * =========================================================================
   */
  public async handleMediaMessage(
    telegramUserId: string,
    senderName: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const user = await this.findUserByTelegramId(telegramUserId, senderName);

    // 1. Save media to permanent storage
    const savedFile = await storageService.saveFile(fileBuffer, fileName, mimeType);

    // 2. Perform OCR and structured extraction (via Gemini AI or Heuristic extraction)
    const extracted: ExtractedLetterData = await documentExtractorService.extract(
      fileBuffer,
      fileName,
      mimeType
    );

    // 3. Build Draft in Session State
    const session = this.getSession(telegramUserId);
    session.step = 'VERIFY_INCOMING_LETTER';
    session.draftIncoming = {
      letterNumber: extracted.letterNumber,
      letterDate: extracted.letterDate,
      receivedDate: extracted.receivedDate,
      sender: extracted.sender,
      senderAddress: extracted.senderAddress || '-',
      subject: extracted.subject,
      recipient: extracted.recipient || 'Direktur RS Sebening Kasih',
      receiverUnitCode: 'ADM',
      classification: extracted.classification || 'Biasa',
      urgency: extracted.urgency || 'Biasa',
      fileName: savedFile.originalName,
      fileUrl: savedFile.url,
      fileSize: `${Math.round(savedFile.size / 1024)} KB`,
      mimeType: savedFile.mimeType,
      uploadedBy: `${user.fullName || senderName} (Telegram)`,
      channel: ChannelType.TELEGRAM,
    };

    return this.renderVerificationPrompt(session.draftIncoming);
  }

  private renderVerificationPrompt(draft?: Partial<IIncomingLetter>): string {
    if (!draft) return '⚠️ Draft surat tidak ditemukan.';

    return `📄 *SURAT MASUK BERHASIL DIBACA*

• *Nomor Surat*:
${draft.letterNumber || '-'}

• *Tanggal Surat*:
${draft.letterDate || '-'}

• *Pengirim*:
${draft.sender || '-'}

• *Alamat Pengirim*:
${draft.senderAddress || '-'}

• *Perihal*:
${draft.subject || '-'}

• *Tujuan*:
${draft.recipient || 'Direktur RS'}

• *Tanggal Diterima*:
${draft.receivedDate || '-'}

• *Lampiran*:
📎 \`${draft.fileName || 'Dokumen.pdf'}\` (${draft.fileSize || '-'})

---
Mohon verifikasi:

1. ✅ *SIMPAN*
2. ✏️ *EDIT*
3. ❌ *BATAL*

Ketik angka pilihan (*1*, *2*, atau *3*).`;
  }

  private renderEditMenu(draft?: Partial<IIncomingLetter>): string {
    return `✏️ *PILIH FIELD YANG INGIN DIEDIT*

1. Nomor Surat: \`${draft?.letterNumber || '-'}\`
2. Tanggal Surat: \`${draft?.letterDate || '-'}\`
3. Pengirim: \`${draft?.sender || '-'}\`
4. Alamat Pengirim: \`${draft?.senderAddress || '-'}\`
5. Perihal: \`${draft?.subject || '-'}\`
6. Tujuan: \`${draft?.recipient || '-'}\`
7. Tanggal Diterima: \`${draft?.receivedDate || '-'}\`
8. Sifat / Urgensi: \`${draft?.classification || 'Biasa'} / ${draft?.urgency || 'Biasa'}\`
9. ✅ *Selesai Edit & Kembali ke Verifikasi*

Ketik angka pilihan (1-9):`;
  }

  /**
   * =========================================================================
   * 2. NOTIFICATION RENDERERS
   * =========================================================================
   */
  private renderDirectorApprovalNotification(letter: IIncomingLetter, disp: IDisposition): string {
    return `🔔 *DISPOSISI MENUNGGU PERSETUJUAN DIREKTUR*

• *ID Disposisi*: \`${disp.referenceNumber || disp.id}\`
• *No. Agenda*: \`${letter.agendaNumber}\`
• *No. Surat*: \`${letter.letterNumber}\`
• *Pengirim*: ${letter.sender}
• *Perihal*: ${letter.subject}
• *Disposisi kepada*: *${disp.toUserOrUnit}*
• *Instruksi*: ${disp.instruction}
• *Deadline*: ${disp.deadline || 'Tanpa deadline'}
• *Status*: ⏳ *PENDING APPROVAL*

---
Balas:

1. ✅ *ACC* (Setujui Disposisi)
2. ❌ *TOLAK* (Tolak Disposisi)
3. ✏️ *REVISI* (Minta Revisi)

Atau ketik: \`ACC ${disp.referenceNumber || disp.id}\`, \`TOLAK ${disp.referenceNumber || disp.id}\`, \`REVISI ${disp.referenceNumber || disp.id}\``;
  }

  private renderRecipientNotification(letter: IIncomingLetter, disp: IDisposition, approverName: string): string {
    return `📬 *DISPOSISI BARU*

• *ID Disposisi*: \`${disp.referenceNumber || disp.id}\`
• *No. Surat*: \`${letter.letterNumber}\`
• *Pengirim*: ${letter.sender}
• *Perihal*: ${letter.subject}
• *Dari*: ${approverName || 'Direktur RS'}
• *Instruksi*: *${disp.instruction}*
• *Deadline*: *${disp.deadline || 'Biasa'}*
• *Status*: ✅ *APPROVED*

---
Balas untuk menindaklanjuti:

1. 📥 *TERIMA* (Mulai proses tindak lanjut)
2. ⚙️ *PROSES* (Sedang diproses)
3. ✅ *SELESAI* (Telah selesai ditindaklanjuti)

Atau ketik: \`PROSES ${disp.referenceNumber || disp.id}\` atau \`SELESAI ${disp.referenceNumber || disp.id}\``;
  }

  /**
   * =========================================================================
   * 3. MAIN MESSAGE ROUTER & STATE MACHINE
   * =========================================================================
   */
  public async handleMessage(
    telegramUserId: string,
    senderName: string,
    text: string
  ): Promise<string> {
    const rawText = text.trim();
    const command = rawText.toLowerCase();
    const session = this.getSession(telegramUserId);
    const user = await this.findUserByTelegramId(telegramUserId, senderName);

    /**
     * GLOBAL CANCEL
     */
    if (
      command === 'batal' ||
      command === '/batal' ||
      command === 'cancel'
    ) {
      this.resetSession(telegramUserId);
      return '❌ Transaksi / proses Telegram dibatalkan.';
    }

    /**
     * HELP / MENU
     */
    if (command === 'help' || command === '/help' || command === 'bantuan' || command === 'menu') {
      return `📌 *Layanan Telegram Bot SIM Surat RS Sebening Kasih*

📋 *Layanan Penomoran Surat*:
1. \`/nomor\` - Ambil / cadangkan nomor surat keluar (SPO, PERDIR, SK, UMUM)
2. \`status <nomor>\` - Cek status nomor surat
3. \`riwayat\` - Lihat riwayat reservasi nomor surat Anda

📨 *Layanan Surat Masuk & Disposisi*:
• Kirim file PDF atau Foto berkas surat masuk untuk ekstraksi otomatis (OCR) & pembuatan disposisi.
• \`disposisi\` - Cek daftar disposisi aktif & status persetujuan
• \`ACC <ID>\` - Direktur menyetujui disposisi
• \`TOLAK <ID>\` - Direktur menolak disposisi
• \`REVISI <ID>\` - Direktur meminta revisi disposisi
• \`TERIMA <ID>\` / \`PROSES <ID>\` - Penerima mulai menindaklanjuti
• \`SELESAI <ID>\` - Penerima menyelesaikan disposisi

*Ketik \`batal\` untuk membatalkan proses yang sedang berlangsung.*`;
    }

    /**
     * DISPOSITION LIST / INQUIRY COMMAND
     */
    if (command === 'disposisi' || command === '/disposisi' || command === 'cek disposisi') {
      let letters: any[] = [];
      if (isAtlasConnected()) {
        letters = await IncomingLetterModel.find({ 'dispositions.0': { $exists: true } })
          .sort({ createdAt: -1 })
          .limit(10);
      } else {
        letters = inMemoryDB.incomingLetters.filter(l => l.dispositions && l.dispositions.length > 0);
      }

      if (letters.length === 0) {
        return '📭 Belum ada lembar disposisi yang tercatat.';
      }

      let resp = '📑 *DAFTAR DISPOSISI TERKINI*\n\n';
      let count = 0;
      for (const l of letters) {
        for (const d of l.dispositions) {
          count++;
          if (count > 6) break;
          const statusIcon =
            d.status === 'APPROVED' ? '✅' :
            d.status === 'PENDING_APPROVAL' ? '⏳' :
            d.status === 'REVISION_REQUIRED' ? '✏️' :
            d.status === 'REJECTED' ? '❌' :
            d.status === 'COMPLETED' ? '🎉' : '📥';

          resp += `${statusIcon} *${d.referenceNumber || d.id}*\n`;
          resp += `• No. Asal: \`${l.letterNumber}\`\n`;
          resp += `• Tujuan: *${d.toUserOrUnit}*\n`;
          resp += `• Status: *${d.status}*\n`;
          resp += `• Instruksi: ${d.instruction.slice(0, 45)}${d.instruction.length > 45 ? '...' : ''}\n\n`;
        }
      }

      resp += 'Ketik `ACC <ID>`, `TOLAK <ID>`, `PROSES <ID>`, atau `SELESAI <ID>` untuk menindaklanjuti.';
      return resp;
    }

    /**
     * DIRECT ACTIONS: ACC, TOLAK, REVISI, PROSES, SELESAI
     */

    // 1. ACC (Persetujuan Direktur)
    if (command.startsWith('acc') || command.startsWith('/acc')) {
      const parts = rawText.split(/\s+/);
      const dispRef = parts[1] || session.activeDispRef;

      if (!dispRef) {
        return '⚠️ Format perintah: `ACC <ID_DISPOSISI>` (contoh: `ACC DISP-2026-00001`)';
      }

      // Security check: Only Direktur / Pimpinan / SuperAdmin can ACC
      const isDirector =
        user.role === RoleName.PIMPINAN ||
        user.role === RoleName.DIREKSI ||
        user.role === RoleName.SUPER_ADMIN;

      if (!isDirector) {
        return '❌ Anda tidak memiliki hak untuk menyetujui disposisi ini (Hanya Direktur RS).';
      }

      try {
        const result = await incomingLetterService.approveDisposition(
          dispRef,
          user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
          'Disetujui via Telegram Bot',
          ChannelType.TELEGRAM
        );

        this.resetSession(telegramUserId);

        // Notify Recipient
        const { telegramId: recipientTgId } = await this.getUnitPicTelegramId(
          result.disposition.targetUnitCode || result.disposition.toUserOrUnit
        );

        const recipientMsg = this.renderRecipientNotification(
          result.letter,
          result.disposition,
          user.fullName
        );

        await this.notifyTelegram(
          recipientTgId,
          result.disposition.toUserOrUnit,
          recipientMsg,
          'DISPOSITION_APPROVED'
        );

        return `✅ *DISPOSISI DISETUJUI*

• *ID*: \`${dispRef}\`
• *Diteruskan kepada*: *${result.disposition.toUserOrUnit}*
• *Status*: ✅ *APPROVED*

Notifikasi telah dikirimkan ke penerima disposisi via Telegram.`;
      } catch (err: any) {
        return `⚠️ Gagal menyetujui disposisi: ${err.message || 'ID disposisi tidak ditemukan'}`;
      }
    }

    // 2. TOLAK (Penolakan Direktur)
    if (command.startsWith('tolak') || command.startsWith('/tolak')) {
      const parts = rawText.split(/\s+/);
      const dispRef = parts[1] || session.activeDispRef;

      if (!dispRef) {
        return '⚠️ Format perintah: `TOLAK <ID_DISPOSISI>` (contoh: `TOLAK DISP-2026-00001`)';
      }

      const isDirector =
        user.role === RoleName.PIMPINAN ||
        user.role === RoleName.DIREKSI ||
        user.role === RoleName.SUPER_ADMIN;

      if (!isDirector) {
        return '❌ Anda tidak memiliki hak untuk menolak disposisi ini (Hanya Direktur RS).';
      }

      session.step = 'INPUT_REJECTION_REASON';
      session.activeDispRef = dispRef;
      return `✏️ *MASUKKAN ALASAN PENOLAKAN*

ID Disposisi: \`${dispRef}\`
Ketik alasan penolakan disposisi ini:`;
    }

    if (session.step === 'INPUT_REJECTION_REASON') {
      const dispRef = session.activeDispRef!;
      const reason = rawText;

      try {
        const result = await incomingLetterService.rejectDisposition(
          dispRef,
          reason,
          user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
          ChannelType.TELEGRAM
        );

        this.resetSession(telegramUserId);

        // Notify Sekretariat
        const sekrMsg = `❌ *DISPOSISI DITOLAK OLEH DIREKTUR*

• *ID Disposisi*: \`${dispRef}\`
• *No. Surat*: \`${result.letter.letterNumber}\`
• *Perihal*: ${result.letter.subject}
• *Alasan Penolakan*:
"${reason}"

Silakan lakukan penyesuaian atau koordinasi lebih lanjut.`;

        await this.notifyTelegram(
          'tg_sekretariat',
          'Sekretariat RS',
          sekrMsg,
          'DISPOSITION_REJECTED'
        );

        return `❌ *DISPOSISI BERHASIL DITOLAK*

• *ID*: \`${dispRef}\`
• *Status*: *REJECTED*
• *Alasan*: ${reason}

Notifikasi penolakan telah diteruskan ke Sekretariat RS.`;
      } catch (err: any) {
        this.resetSession(telegramUserId);
        return `⚠️ Gagal menolak disposisi: ${err.message}`;
      }
    }

    // 3. REVISI (Permintaan Revisi dari Direktur)
    if (command.startsWith('revisi') || command.startsWith('/revisi')) {
      const parts = rawText.split(/\s+/);
      const dispRef = parts[1] || session.activeDispRef;

      if (!dispRef) {
        return '⚠️ Format perintah: `REVISI <ID_DISPOSISI>` (contoh: `REVISI DISP-2026-00001`)';
      }

      const isDirector =
        user.role === RoleName.PIMPINAN ||
        user.role === RoleName.DIREKSI ||
        user.role === RoleName.SUPER_ADMIN;

      if (!isDirector) {
        return '❌ Anda tidak memiliki hak untuk meminta revisi disposisi ini.';
      }

      session.step = 'INPUT_REVISION_NOTES';
      session.activeDispRef = dispRef;
      return `✏️ *MASUKKAN CATATAN REVISI*

ID Disposisi: \`${dispRef}\`
Ketik catatan arahan perbaikan untuk Sekretariat:`;
    }

    if (session.step === 'INPUT_REVISION_NOTES') {
      const dispRef = session.activeDispRef!;
      const notes = rawText;

      try {
        const result = await incomingLetterService.requestRevision(
          dispRef,
          notes,
          user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
          ChannelType.TELEGRAM
        );

        this.resetSession(telegramUserId);

        // Notify Sekretariat
        const sekrMsg = `⚠️ *DISPOSISI MEMERLUKAN REVISI*

• *ID Disposisi*: \`${dispRef}\`
• *No. Surat*: \`${result.letter.letterNumber}\`
• *Perihal*: ${result.letter.subject}
• *Catatan Direktur*:
"${notes}"

Silakan perbaiki data disposisi di SIM Surat.`;

        await this.notifyTelegram(
          'tg_sekretariat',
          'Sekretariat RS',
          sekrMsg,
          'DISPOSITION_REVISION'
        );

        return `✏️ *PERMINTAAN REVISI DIKIRIM*

• *ID*: \`${dispRef}\`
• *Status*: *REVISION_REQUIRED*
• *Catatan*: ${notes}

Notifikasi revisi telah diteruskan ke Sekretariat RS.`;
      } catch (err: any) {
        this.resetSession(telegramUserId);
        return `⚠️ Gagal meminta revisi: ${err.message}`;
      }
    }

    // 4. TERIMA / PROSES (Tindak Lanjut Penerima)
    if (command.startsWith('terima') || command.startsWith('proses') || command.startsWith('/terima') || command.startsWith('/proses')) {
      const parts = rawText.split(/\s+/);
      const dispRef = parts[1] || session.activeDispRef;

      if (!dispRef) {
        return '⚠️ Format perintah: `PROSES <ID_DISPOSISI>` atau `TERIMA <ID_DISPOSISI>`';
      }

      try {
        const result = await incomingLetterService.processDisposition(
          dispRef,
          user.fullName || senderName,
          ChannelType.TELEGRAM
        );

        this.resetSession(telegramUserId);

        return `📥 *DISPOSISI SEDANG DIPROSES*

• *ID*: \`${dispRef}\`
• *Status*: ⚙️ *IN_PROGRESS*
• *No. Surat*: \`${result.letter.letterNumber}\`
• *Ditangani oleh*: ${user.fullName || senderName}

Langkah tindak lanjut telah dicatat dalam log audit sistem.`;
      } catch (err: any) {
        return `⚠️ Gagal memproses disposisi: ${err.message}`;
      }
    }

    // 5. SELESAI (Penyelesaian oleh Penerima)
    if (command.startsWith('selesai') || command.startsWith('/selesai')) {
      const parts = rawText.split(/\s+/);
      const dispRef = parts[1] || session.activeDispRef;

      if (!dispRef) {
        return '⚠️ Format perintah: `SELESAI <ID_DISPOSISI>` (contoh: `SELESAI DISP-2026-00001`)';
      }

      try {
        const result = await incomingLetterService.completeDisposition(
          dispRef,
          user.fullName || senderName,
          ChannelType.TELEGRAM
        );

        this.resetSession(telegramUserId);

        return `✅ *DISPOSISI TELAH SELESAI*

• *ID*: \`${dispRef}\`
• *Status*: 🎉 *COMPLETED*
• *No. Surat*: \`${result.letter.letterNumber}\`
• *Perihal*: ${result.letter.subject}
• *Diselesaikan oleh*: ${user.fullName || senderName}

Disposisi dinyatakan selesai dan terarsipkan.`;
      } catch (err: any) {
        return `⚠️ Gagal menyelesaikan disposisi: ${err.message}`;
      }
    }

    /**
     * =========================================================================
     * 4. SURAT MASUK STATE MACHINE: VERIFY -> EDIT -> SAVE -> DISPOSITION FLOW
     * =========================================================================
     */

    // STEP: VERIFY_INCOMING_LETTER
    if (session.step === 'VERIFY_INCOMING_LETTER') {
      console.log('🔎 TELEGRAM VERIFY STATE:', {
        telegramUserId,
        rawText,
        sessionStep: session.step,
        draft: session.draftIncoming,
      });

      // 1. SIMPAN
      if (
        rawText === '1' ||
        command === 'simpan' ||
        command === 'ya' ||
        command === 'ok'
      ) {
        console.log('💾 Telegram meminta SIMPAN surat masuk');

        const draft = session.draftIncoming;

        if (!draft) {
          console.error(
            '❌ Draft surat tidak ditemukan saat SIMPAN'
          );

          this.resetSession(telegramUserId);

          return '⚠️ Draft surat hilang. Silakan kirim ulang berkas surat.';
        }

        console.log(
          '📝 Data draft yang akan disimpan:',
          draft
        );

        try {
          console.log(
            '⏳ Memanggil incomingLetterService.createIncomingLetter()...'
          );

          const savedLetter =
            await incomingLetterService.createIncomingLetter({
              letterNumber:
                draft.letterNumber || '',
              letterDate:
                draft.letterDate ||
                new Date()
                  .toISOString()
                  .split('T')[0],
              receivedDate:
                draft.receivedDate ||
                new Date()
                  .toISOString()
                  .split('T')[0],
              sender:
                draft.sender || '',
              senderAddress:
                draft.senderAddress || '-',
              subject:
                draft.subject || '',
              recipient:
                draft.recipient ||
                'Direktur RS Sebening Kasih',
              receiverUnitCode:
                draft.receiverUnitCode || 'ADM',
              classification:
                draft.classification || 'Biasa',
              urgency:
                draft.urgency || 'Biasa',
              fileName:
                draft.fileName,
              fileUrl:
                draft.fileUrl,
              fileSize:
                draft.fileSize,
              mimeType:
                draft.mimeType,
              channel:
                ChannelType.TELEGRAM,
              userId:
                user.id || telegramUserId,
              userName:
                `${user.fullName || senderName} (Telegram)`,
            });

          console.log(
            '✅ Surat masuk berhasil disimpan:',
            {
              id: savedLetter?.id,
              agendaNumber:
                savedLetter?.agendaNumber,
              letterNumber:
                savedLetter?.letterNumber,
            }
          );

          session.savedLetter = savedLetter;
          session.step = 'ASK_CREATE_DISPOSITION';

          const reply = `✅ *SURAT MASUK TERSIMPAN*

    • *Agenda*:
    \`${savedLetter.agendaNumber || '-'}\`

    • *Nomor*:
    \`${savedLetter.letterNumber || '-'}\`

    • *Pengirim*:
    ${savedLetter.sender || '-'}

    • *Perihal*:
    ${savedLetter.subject || '-'}

    ---

    📋 *SURAT TELAH TERSIMPAN*

    Apakah surat ini perlu disposisi?

    1. ✅ *YA*
    2. ❌ *TIDAK*

    Ketik *1* atau *2*.`;

          console.log(
            '📤 Response SIMPAN siap dikirim ke Telegram'
          );

          return reply;

        } catch (err: any) {
          console.error(
            '❌ ERROR createIncomingLetter:',
            err
          );

          return `❌ Gagal menyimpan surat masuk: ${
            err?.message || 'Kesalahan database'
          }`;
        }
      }
      // 2. EDIT
      if (rawText === '2' || command === 'edit' || command === 'ubah') {
        session.step = 'EDIT_FIELD_SELECT';
        return this.renderEditMenu(session.draftIncoming);
      }

      // 3. BATAL
      if (rawText === '3' || command === 'batal' || command === 'cancel') {
        this.resetSession(telegramUserId);
        return '❌ Proses verifikasi surat masuk dibatalkan.';
      }

      return '⚠️ Ketik *1* untuk SIMPAN, *2* untuk EDIT, atau *3* untuk BATAL.';
    }

    // STEP: EDIT_FIELD_SELECT
    if (session.step === 'EDIT_FIELD_SELECT') {
      const choice = parseInt(rawText, 10);

      switch (choice) {
        case 1:
          session.editingField = 'letterNumber';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Nomor Surat yang benar:*';
        case 2:
          session.editingField = 'letterDate';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Tanggal Surat yang benar (contoh: 2026-08-18 atau 18/08/2026):*';
        case 3:
          session.editingField = 'sender';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Nama Pengirim / Instansi Asal yang benar:*';
        case 4:
          session.editingField = 'senderAddress';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Alamat Pengirim yang benar:*';
        case 5:
          session.editingField = 'subject';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Perihal Surat yang benar:*';
        case 6:
          session.editingField = 'recipient';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Tujuan Surat yang benar (contoh: Direktur RS):*';
        case 7:
          session.editingField = 'receivedDate';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Tanggal Diterima yang benar:*';
        case 8:
          session.editingField = 'urgency';
          session.step = 'EDIT_FIELD_INPUT';
          return '✏️ *Ketik Sifat/Urgensi (Biasa / Penting / Rahasia / Sangat Segera):*';
        case 9:
          session.step = 'VERIFY_INCOMING_LETTER';
          return this.renderVerificationPrompt(session.draftIncoming);
        default:
          return '⚠️ Pilihan tidak valid. Masukkan angka 1 sampai 9:';
      }
    }

    // STEP: EDIT_FIELD_INPUT
    if (session.step === 'EDIT_FIELD_INPUT') {
      const field = session.editingField;
      if (field && session.draftIncoming) {
        (session.draftIncoming as any)[field] = rawText;
      }

      session.step = 'EDIT_FIELD_SELECT';
      return `✅ *Data berhasil diperbarui.*\n\n${this.renderEditMenu(session.draftIncoming)}`;
    }

    // STEP: ASK_CREATE_DISPOSITION
    if (session.step === 'ASK_CREATE_DISPOSITION') {
      if (rawText === '1' || command === 'ya' || command === 'disposisi') {
        const units = await this.getActiveUnits();
        session.availableUnits = units;
        session.step = 'SELECT_DISPOSITION_TARGET';

        let menu = `📝 *PILIH TUJUAN DISPOSISI*\n\n`;
        menu += `1. 👔 *Direktur (Pimpinan RS)*\n`;
        units.forEach((u, idx) => {
          menu += `${idx + 2}. *${u.code}* - ${u.name}\n`;
        });
        menu += `\nKetik angka pilihan (1, 2, ...) atau ketik nama/kode unit:`;
        return menu;
      }

      if (rawText === '2' || command === 'tidak' || command === 'selesai') {
        const saved = session.savedLetter;
        this.resetSession(telegramUserId);
        return `✅ *Surat masuk telah tersimpan tanpa disposisi.*\n\n• No. Agenda: \`${saved?.agendaNumber}\`\n• No. Surat: \`${saved?.letterNumber}\`\n\nTerima kasih.`;
      }

      return '⚠️ Ketik *1* untuk YA (Buat Disposisi) atau *2* untuk TIDAK.';
    }

    // STEP: SELECT_DISPOSITION_TARGET
    if (session.step === 'SELECT_DISPOSITION_TARGET') {
      const units = session.availableUnits || (await this.getActiveUnits());
      const selectedIdx = parseInt(rawText, 10);
      let targetName = '';
      let targetCode = '';

      if (selectedIdx === 1) {
        targetName = 'dr. H. Budi Santoso, Sp.A (Direktur)';
        targetCode = 'DIR';
      } else if (!Number.isNaN(selectedIdx) && selectedIdx >= 2 && selectedIdx <= units.length + 1) {
        const targetUnit = units[selectedIdx - 2];
        targetName = `${targetUnit.name} (${targetUnit.code})`;
        targetCode = targetUnit.code;
      } else {
        const matchedUnit = units.find(
          u =>
            u.code.toLowerCase() === command ||
            u.name.toLowerCase().includes(command)
        );
        if (matchedUnit) {
          targetName = `${matchedUnit.name} (${matchedUnit.code})`;
          targetCode = matchedUnit.code;
        } else if (rawText.length >= 2) {
          targetName = rawText;
          targetCode = 'UNIT';
        }
      }

      if (!targetName) {
        return '⚠️ Tujuan disposisi tidak dikenali. Pilih angka yang terdaftar atau ketik nama unit:';
      }

      session.draftDisposition = {
        incomingLetterId: session.savedLetter?.id || '',
        toUserOrUnit: targetName,
        targetUnitCode: targetCode
      };

      session.step = 'INPUT_DISPOSITION_INSTRUCTION';
      return `✅ Tujuan Disposisi: *${targetName}*\n\n✏️ *MASUKKAN INSTRUKSI DISPOSISI*\n\nContoh:\n• Mohon ditindaklanjuti & dikoordinasikan segera.\n• Pelajari dan siapkan laporan tanggapan.\n• Hadiri rapat dan laporkan hasilnya.`;
    }

    // STEP: INPUT_DISPOSITION_INSTRUCTION
    if (session.step === 'INPUT_DISPOSITION_INSTRUCTION') {
      if (rawText.length < 3) {
        return '⚠️ Instruksi terlalu pendek. Masukkan instruksi yang jelas:';
      }

      if (!session.draftDisposition) {
        this.resetSession(telegramUserId);
        return '⚠️ Sesi disposisi berakhir. Silakan ulangi.';
      }

      session.draftDisposition.instruction = rawText;
      session.step = 'INPUT_DISPOSITION_DEADLINE';

      return `⏰ *MASUKKAN DEADLINE*

Contoh:
• 25/08/2026
• 3 Hari Kerja
• Segera

Balas *0* jika tidak ada deadline.`;
    }

    // STEP: INPUT_DISPOSITION_DEADLINE
    if (session.step === 'INPUT_DISPOSITION_DEADLINE') {
      const deadline =
        rawText === '0' || command === 'tidak ada' || command === 'tanpa deadline'
          ? 'Biasa / Tanpa Deadline'
          : rawText;

      const draftDisp = session.draftDisposition;
      const letter = session.savedLetter;

      if (!draftDisp || !letter) {
        this.resetSession(telegramUserId);
        return '⚠️ Sesi pembuatan disposisi tidak valid. Silakan ulangi.';
      }

      try {
        // Save disposition in Database
        const result = await incomingLetterService.createDisposition({
          incomingLetterId: letter.id,
          fromUser: user.fullName || `${senderName} (Sekretariat)`,
          fromJid: `tg_${telegramUserId}`,
          toUserOrUnit: draftDisp.toUserOrUnit,
          targetUnitCode: draftDisp.targetUnitCode,
          instruction: draftDisp.instruction || 'Mohon ditindaklanjuti',
          deadline,
          channel: ChannelType.TELEGRAM
        });

        this.resetSession(telegramUserId);

        // 1. Notify Direktur via Telegram
        const { telegramId: dirTgId } = await this.getDirektur();
        const dirNotification = this.renderDirectorApprovalNotification(
          result.letter,
          result.disposition
        );

        await this.notifyTelegram(
          dirTgId,
          'dr. H. Budi Santoso, Sp.A (Direktur)',
          dirNotification,
          'DISPOSITION_APPROVAL_REQ'
        );

        // 2. Reply to Sekretariat
        return `✅ *DISPOSISI BERHASIL DIBUAT*

• *ID Disposisi*:
\`${result.disposition.referenceNumber || result.disposition.id}\`

• *No. Surat*:
\`${result.letter.letterNumber}\`

• *Pengirim*:
${result.letter.sender}

• *Perihal*:
${result.letter.subject}

• *Diteruskan kepada*:
*${result.disposition.toUserOrUnit}*

• *Instruksi*:
${result.disposition.instruction}

• *Deadline*:
${result.disposition.deadline}

• *Status*:
⏳ *PENDING APPROVAL*

---
Notifikasi otomatis telah dikirimkan ke Telegram Direktur untuk persetujuan.`;
      } catch (err: any) {
        this.resetSession(telegramUserId);
        return `❌ Gagal membuat lembar disposisi: ${err.message}`;
      }
    }

    /**
     * =========================================================================
     * 5. NUMBERING COMMANDS & FLOW (/nomor, status, riwayat)
     * =========================================================================
     */

    // Status Check
    if (command === 'status' || command.startsWith('status ') || command.startsWith('/status')) {
      const parts = rawText.split(/\s+/);
      if (parts.length < 2) {
        return '⚠️ Format salah. Gunakan: `status <nomor_surat>` (contoh: `status SPO/001/KEP/2026`)';
      }

      const numStr = parts.slice(1).join(' ').trim();
      const statusObj = await numberingService.getNumberStatus(numStr);

      if (!statusObj) {
        return `🔍 Nomor surat \`${numStr}\` tidak ditemukan di sistem.`;
      }

      return `📄 *Detail Nomor Surat*
• *Nomor*: \`${statusObj.number}\`
• *Jenis*: ${statusObj.typeCode}
• *Unit*: ${statusObj.unitCode || '-'}
• *Perihal*: ${statusObj.subject || statusObj.title || '-'}
• *Pemohon*: ${statusObj.userName}
• *Kanal*: ${statusObj.channel}
• *Status*: *${statusObj.status}*`;
    }

    // Riwayat
    if (command === 'riwayat' || command === '/riwayat') {
      const all = await numberingService.listReservations();
      const userRes = all
        .filter(r => r.channel === ChannelType.TELEGRAM || r.userId === telegramUserId || r.userId === user.id)
        .slice(0, 5);

      if (userRes.length === 0) {
        return '📭 Belum ada riwayat nomor surat yang diambil via Telegram.';
      }

      let resp = '📋 *5 Riwayat Nomor Surat Terakhir*:\n\n';
      userRes.forEach((r, idx) => {
        resp += `${idx + 1}. \`${r.number}\` | ${r.typeCode} | *${r.status}*\n`;
        resp += `   *Perihal*: ${r.subject || r.title || '-'}\n`;
      });
      return resp;
    }

    // Start numbering flow
    if (command === '/nomor' || command === 'nomor' || command === '/start') {
      this.setSession(telegramUserId, { step: 'SELECT_TYPE' });

      const types = await this.getActiveLetterTypes();
      if (types.length === 0) {
        return '⚠️ Belum ada jenis surat aktif.';
      }

      let resp = '📋 *PILIH JENIS SURAT KELUAR*:\n\n';
      types.forEach((t, idx) => {
        resp += `${idx + 1}. *${t.code}* - ${t.name}\n`;
      });
      resp += '\n*Ketik angka pilihan Anda (1, 2, ...):*';
      return resp;
    }

    // STEP 1: SELECT_TYPE
    if (session.step === 'SELECT_TYPE') {
      const types = await this.getActiveLetterTypes();
      const selectedIdx = parseInt(rawText, 10) - 1;
      let selectedType: any = null;

      if (!Number.isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < types.length) {
        selectedType = types[selectedIdx];
      } else {
        selectedType = types.find(t => t.code.toLowerCase() === command);
      }

      if (!selectedType) {
        return '⚠️ Pilihan jenis surat tidak valid. Ketik angka yang terdaftar atau `batal`.';
      }

      if (selectedType.isLocked === true) {
        return `🔒 *JENIS SURAT MASIH TERKUNCI*\n\nJenis Surat *${selectedType.code}* masih terkunci.\nHubungi Sekretariat untuk membuka pengambilan nomor.`;
      }

      session.typeCode = selectedType.code;

      if (!selectedType.requiresUnit) {
        session.step = 'INPUT_QUANTITY';
        return `✅ Jenis Surat: *${selectedType.code}*\n\n🔢 *Berapa nomor yang diperlukan?*\n\nMasukkan jumlah, misalnya: 1, 2, 3, 10.`;
      }

      session.step = 'SELECT_UNIT';
      const units = await this.getActiveUnits();

      if (units.length === 0) {
        this.resetSession(telegramUserId);
        return '⚠️ Belum ada unit kerja aktif.';
      }

      let resp = `✅ Jenis Surat: *${selectedType.code}*\n\n🏬 *Pilih Unit Kerja*:\n\n`;
      units.forEach((u, idx) => {
        resp += `${idx + 1}. *${u.code}* - ${u.name}\n`;
      });
      resp += '\n*Ketik angka pilihan unit (1, 2, ...):*';
      return resp;
    }

    // STEP 2: SELECT_UNIT
    if (session.step === 'SELECT_UNIT') {
      const units = await this.getActiveUnits();
      const selectedIdx = parseInt(rawText, 10) - 1;
      let selectedUnit: any = null;

      if (!Number.isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < units.length) {
        selectedUnit = units[selectedIdx];
      } else {
        selectedUnit = units.find(u => u.code.toLowerCase() === command);
      }

      if (!selectedUnit) {
        return '⚠️ Pilihan unit tidak valid. Ketik angka pilihan unit atau `batal`.';
      }

      session.unitCode = selectedUnit.code;
      session.step = 'INPUT_QUANTITY';

      return `✅ Unit: *${selectedUnit.code} - ${selectedUnit.name}*\n\n🔢 *Berapa nomor yang diperlukan?*\n\nMasukkan jumlah, misalnya: 1, 2, 3, 10.`;
    }

    // STEP 3: INPUT_QUANTITY
    if (session.step === 'INPUT_QUANTITY') {
      const quantity = Number(rawText);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return '⚠️ Jumlah tidak valid. Masukkan angka antara 1 sampai 100.';
      }

      session.quantity = quantity;
      session.step = 'SELECT_SUBJECT_MODE';

      return `🔢 Jumlah nomor: *${quantity}*

📝 *Bagaimana perihalnya?*

1. Perihal sama untuk semua nomor
2. Perihal berbeda untuk setiap nomor

Ketik *1* atau *2*.`;
    }

    // STEP 4: SELECT_SUBJECT_MODE
    if (session.step === 'SELECT_SUBJECT_MODE') {
      if (rawText === '1' || command === 'sama') {
        session.subjectMode = 'SAME';
        session.step = 'INPUT_SUBJECT';
        return '📝 *Masukkan perihal/judul surat:*';
      }

      if (rawText === '2' || command === 'beda' || command === 'berbeda') {
        session.subjectMode = 'DIFFERENT';
        session.step = 'INPUT_SUBJECTS';
        return `📝 *Masukkan ${session.quantity} perihal*, masing-masing satu baris.

Contoh:
Penetapan Tim A
Penetapan Tim B
Penetapan Tim C`;
      }

      return '⚠️ Pilih 1 untuk perihal sama atau 2 untuk perihal berbeda.';
    }

    // STEP 5A: SAME SUBJECT
    if (session.step === 'INPUT_SUBJECT') {
      if (rawText.length < 3) {
        return '⚠️ Perihal terlalu pendek. Masukkan perihal yang jelas:';
      }

      session.subject = rawText;
      session.subjects = Array(session.quantity || 1).fill(rawText);
      session.requestId = `TG-${telegramUserId}-${Date.now()}`;

      const previewNumbers = await numberingService.previewMultipleNumbers({
        typeCode: session.typeCode!,
        unitCode: session.unitCode,
        count: session.quantity!,
      });

      session.previewNumbers = previewNumbers;
      session.step = 'CONFIRM';

      let preview = '🔍 *PREVIEW PENGAMBILAN NOMOR*\n\n';
      preview += `• *Jenis*: ${session.typeCode}\n`;
      preview += `• *Unit*: ${session.unitCode || '-'}\n`;
      preview += `• *Jumlah*: ${session.quantity}\n`;
      preview += `• *Perihal*: ${session.subject}\n\n`;
      preview += '*Nomor yang akan dicadangkan:*\n';
      previewNumbers.forEach((number, index) => {
        preview += `${index + 1}. \`${number}\`\n`;
      });
      preview += '\nKetik:\n*1* - ✅ *AMBIL SEMUA*\n*2* - ❌ *BATAL*';
      return preview;
    }

    // STEP 5B: DIFFERENT SUBJECTS
    if (session.step === 'INPUT_SUBJECTS') {
      try {
        const subjects = this.parseSubjects(rawText, session.quantity!);
        session.subjects = subjects;
        session.requestId = `TG-${telegramUserId}-${Date.now()}`;

        const previewNumbers = await numberingService.previewMultipleNumbers({
          typeCode: session.typeCode!,
          unitCode: session.unitCode,
          count: session.quantity!,
        });

        session.previewNumbers = previewNumbers;
        session.step = 'CONFIRM';

        let preview = '🔍 *PREVIEW PENGAMBILAN NOMOR*\n\n';
        preview += `• *Jenis*: ${session.typeCode}\n`;
        preview += `• *Unit*: ${session.unitCode || '-'}\n`;
        preview += `• *Jumlah*: ${session.quantity}\n\n`;
        preview += '*Nomor & Perihal:*\n';

        previewNumbers.forEach((number, index) => {
          preview += `${index + 1}. \`${number}\`\n   ${subjects[index]}\n`;
        });

        preview += '\nKetik:\n*1* - ✅ *AMBIL SEMUA*\n*2* - ❌ *BATAL*';
        return preview;
      } catch (error: any) {
        return `⚠️ ${error.message}`;
      }
    }

    // STEP 6: CONFIRM
    if (session.step === 'CONFIRM') {
      if (rawText === '1' || command === 'ya' || command === 'ambil') {
        try {
          const reservations = await numberingService.reserveMultipleNumbers({
            typeCode: session.typeCode!,
            unitCode: session.unitCode,
            count: session.quantity!,
            subjects: session.subjects,
            titles: session.subjects,
            userId: user.id || telegramUserId,
            userName: `${user.fullName || senderName} (Telegram)`,
            channel: ChannelType.TELEGRAM,
            requestId: session.requestId!,
          });

          this.resetSession(telegramUserId);

          let response = `✅ *${reservations.count} NOMOR BERHASIL DICADANGKAN*\n\n`;
          response += `*Batch*: \`${reservations.batchId}\`\n`;
          response += '*Daftar Nomor:*\n';

          reservations.reservations.forEach((r: any, index: number) => {
            response += `${index + 1}. \`${r.number}\`\n`;
            response += `   *Perihal*: ${r.subject || r.title || '-'}\n`;
          });

          response += '\n*Status*: RESERVED';
          return response;
        } catch (err: any) {
          this.resetSession(telegramUserId);
          return `❌ Gagal mengambil nomor: ${err?.message || 'Unknown error'}`;
        }
      }

      this.resetSession(telegramUserId);
      return '❌ Pembuatan nomor surat dibatalkan.';
    }

    // IDLE / Unhandled
    return '💬 Ketik `help` untuk melihat panduan layanan bot atau kirim berkas PDF/Foto dokumen surat masuk.';
  }
}

export const telegramService = new TelegramService();
