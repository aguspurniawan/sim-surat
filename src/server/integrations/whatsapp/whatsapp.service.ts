import QRCode from 'qrcode';
import pino from 'pino';
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import fs from 'fs/promises';

import { numberingService } from '../../services/numbering.service';
import { incomingLetterService } from '../../services/incoming-letter.service';
import { documentExtractorService, ExtractedLetterData } from '../../services/document-extractor.service';
import { storageService } from '../../services/storage.service';
import { inMemoryDB, isAtlasConnected } from '../../config/database';
import { LetterTypeModel, UnitModel, UserModel, IncomingLetterModel } from '../../models';
import { ChannelType, IIncomingLetter, IDisposition, RoleName } from '../../../types';
import { formatPhoneToJid, normalizePhoneNumber } from '../../utils/whatsapp-helper';

export interface WhatsappState {
  step:
    | 'IDLE'
    | 'SELECT_TYPE'
    | 'SELECT_UNIT'
    | 'INPUT_QUANTITY'
    | 'SELECT_SUBJECT_MODE'
    | 'INPUT_SUBJECT'
    | 'INPUT_SUBJECTS'
    | 'CONFIRM'
    | 'VERIFY_INCOMING_LETTER'
    | 'EDIT_INCOMING_LETTER'
    | 'EDIT_INCOMING_FIELD'
    | 'PROMPT_CREATE_DISPOSITION'
    | 'SELECT_DISPOSITION_TARGET'
    | 'INPUT_DISPOSITION_INSTRUCTION'
    | 'INPUT_DISPOSITION_DEADLINE'
    | 'INPUT_DIRECTOR_REJECT_REASON'
    | 'INPUT_DIRECTOR_REVISION_NOTES';

  // Numbering state
  typeCode?: string;
  unitCode?: string;
  subject?: string;
  subjects?: string[];
  quantity?: number;
  subjectMode?: 'SAME' | 'DIFFERENT';
  previewNumbers?: string[];
  requestId?: string;

  // Incoming letter & OCR state
  draftIncoming?: Partial<IIncomingLetter>;
  fieldToEdit?: string;
  savedLetter?: IIncomingLetter;

  // Disposition state
  activeDispId?: string;
  availableDispositionTargets?: Array<{ label: string; name: string; unitCode: string; jid: string }>;
  dispositionDraft?: {
    toUserOrUnit?: string;
    toJid?: string;
    targetUnitCode?: string;
    instruction?: string;
    deadline?: string;
  };
}

const whatsappSessions = new Map<string, WhatsappState>();

export class WhatsappService {
  private sessionStatus: 'DISCONNECTED' | 'PAIRING' | 'CONNECTED' = 'DISCONNECTED';
  private accountName = 'WA Bot RSSBK';
  private jid = '';
  private qrCodeDataUrl = '';
  private socket: any = null;
  private reconnecting = false;

  constructor() {
    void this.startBaileys();
  }

  /**
   * ==========================================
   * BAILEYS SOCKET LIFECYCLE
   * ==========================================
   */
  private async startBaileys(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;

    try {
      const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-session');

      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        browser: ['SIM-Surat RS Sebening Kasih', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
      });

      this.socket = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          try {
            this.sessionStatus = 'PAIRING';
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              width: 320,
              margin: 2,
              color: { dark: '#111827', light: '#ffffff' },
            });
            console.log('📱 QR WhatsApp baru tersedia');
          } catch (error) {
            console.error('❌ Gagal membuat QR WhatsApp:', error);
          }
        }

        if (connection === 'open') {
          this.sessionStatus = 'CONNECTED';
          this.reconnecting = false;
          this.jid = sock.user?.id || '';
          this.accountName = sock.user?.name || 'WA Bot RSSBK';
          this.qrCodeDataUrl = '';
          console.log('✅ WhatsApp connected. Account:', this.accountName, 'JID:', this.jid);
        }

        if (connection === 'close') {
          this.sessionStatus = 'DISCONNECTED';
          this.reconnecting = false;
          this.socket = null;

          const error = lastDisconnect?.error;
          const errorMessage = error?.message || (typeof error === 'string' ? error : '');
          const statusCode = (error as any)?.output?.statusCode;
          const isQrTimeout = errorMessage.includes('QR refs attempts ended') || errorMessage.includes('timed out');
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          console.log('❌ WhatsApp disconnected:', statusCode || errorMessage || 'Closed');

          if (isQrTimeout) {
            console.log('⏳ QR Code WhatsApp kedaluwarsa. Menunggu pengguna me-refresh QR.');
            this.qrCodeDataUrl = '';
          } else if (isLoggedOut) {
            console.log('🚪 WhatsApp logout. Pairing ulang diperlukan.');
            this.qrCodeDataUrl = '';
          } else {
            console.log('🔄 Reconnecting WhatsApp dalam 5 detik...');
            setTimeout(() => void this.startBaileys(), 5000);
          }
        }
      });

      /**
       * Handle incoming Baileys messages
       */
      sock.ev.on('messages.upsert', async (event: any) => {
        try {
          const messages = event?.messages || [];

          for (const msg of messages) {
            if (msg?.key?.fromMe) continue;

            const remoteJid = msg?.key?.remoteJid;
            if (!remoteJid) continue;

            // Abaikan group, broadcast, status, newsletter
            if (
              remoteJid.endsWith('@g.us') ||
              remoteJid.endsWith('@broadcast') ||
              remoteJid === 'status@broadcast' ||
              remoteJid.endsWith('@newsletter')
            ) {
              continue;
            }

            const senderName = msg?.pushName || 'WhatsApp User';

            // Ambil teks lebih awal karena dipakai untuk validasi command publik
            const text =
              msg?.message?.conversation ||
              msg?.message?.extendedTextMessage?.text ||
              '';

            const command = text.trim().toLowerCase();

            // Cari user berdasarkan JID / nomor WhatsApp
            const senderUser = await this.findUserByJid(remoteJid);

            // Command yang boleh digunakan walaupun nomor belum terdaftar
            const isPublicCommand =
              command === 'menu' ||
              command === 'help' ||
              command === 'bantuan' ||
              command === 'start';

            // Kalau bukan user terdaftar dan bukan command publik,
            // jangan izinkan workflow lainnya.
            if (!senderUser) {
              // Nomor WhatsApp tidak terdaftar.
              // Hanya command publik yang boleh mendapat respons.
              //
              // Selain menu/help/bantuan/start:
              // - chat biasa  -> DIAM
              // - PDF/foto   -> DIAM
              // - command lain -> DIAM
              //
              // File TIDAK di-download dan TIDAK dikirim ke OCR.

              if (isPublicCommand) {
                console.log(
                  `ℹ️ Public command dari nomor belum terdaftar: ${remoteJid}`
                );
              } else {
                console.log(
                  `🚫 WhatsApp tidak terdaftar diabaikan: ${remoteJid}`
                );
                continue;
              }
            }

            if (senderUser) {
              console.log(
                `✅ WhatsApp user dikenali: ${senderUser.fullName} (${senderUser.role})`
              );
            } else {
              console.log(
                `ℹ️ Public command dari nomor belum terdaftar: ${remoteJid}`
              );
            }

            // Hak upload Surat Masuk
            const canUploadIncoming =
              !!senderUser &&
              [
                RoleName.ADMIN,
                RoleName.SUPER_ADMIN,
                // tambahkan role Sekretariat hanya jika memang
                // sudah ada di enum RoleName project Anda
                ...(Object.prototype.hasOwnProperty.call(RoleName, 'SEKRETARIAT')
                  ? [(RoleName as any).SEKRETARIAT]
                  : [])
              ].includes(senderUser.role);

            // ==========================================
            // FILE / FOTO SURAT MASUK
            // ==========================================
            if (
              msg.message?.documentMessage ||
              msg.message?.imageMessage
            ) {
              if (!canUploadIncoming) {
                await this.sendMessage(
                  remoteJid,
                  '❌ Anda tidak memiliki izin untuk mengirim Surat Masuk melalui WhatsApp.\n\nFitur upload Surat Masuk hanya dapat digunakan oleh Sekretariat/Admin.'
                );

                continue;
              }

              console.log(
                '📎 Document/Image received from:',
                remoteJid
              );

              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {}
                );

                const fileName =
                  msg.message?.documentMessage?.fileName ||
                  `Dokumen_Surat_${Date.now()}.${
                    msg.message?.documentMessage
                      ? 'pdf'
                      : 'jpg'
                  }`;

                const mimeType =
                  msg.message?.documentMessage?.mimetype ||
                  msg.message?.imageMessage?.mimetype ||
                  'application/pdf';

                const response =
                  await this.handleMediaMessage(
                    remoteJid,
                    senderName,
                    buffer,
                    fileName,
                    mimeType
                  );

                if (
                  response &&
                  response.trim().length > 0
                ) {
                  await this.sendMessage(
                    remoteJid,
                    response
                  );
                }
              } catch (mediaErr) {
                console.error(
                  '❌ Error downloading/processing media from WA:',
                  mediaErr
                );

                await this.sendMessage(
                  remoteJid,
                  '❌ Gagal memproses berkas surat yang dikirimkan. Pastikan format file PDF atau Gambar valid.'
                );
              }

              continue;
            }

            // ==========================================
            // PESAN TEKS
            // ==========================================
            if (!text) continue;

            console.log(
              '📩 WhatsApp text from:',
              remoteJid,
              text
            );

            const response =
              await this.handleMessage(
                remoteJid,
                senderName,
                text
              );

            if (
              response &&
              response.trim().length > 0
            ) {
              await this.sendMessage(
                remoteJid,
                response
              );
            }
          }
        } catch (error) {
          console.error(
            '❌ WhatsApp message handler error:',
            error
          );
        }
      });

      console.log('🟢 Baileys WhatsApp service started');
    } catch (error) {
      this.reconnecting = false;
      this.sessionStatus = 'DISCONNECTED';
      console.error('❌ Baileys startup error:', error);
      setTimeout(() => void this.startBaileys(), 5000);
    }
  }

  /**
   * Helper to send WhatsApp text to remote JID safely
   */
  public async sendMessage(toJid: string, text: string): Promise<boolean> {
    if (this.socket && this.sessionStatus === 'CONNECTED') {
      try {
        await this.socket.sendMessage(toJid, { text });
        return true;
      } catch (err) {
        console.warn(`Could not send WhatsApp message to ${toJid}:`, err);
      }
    }
    return false;
  }

  /**
   * Session control
   */
  public getSessionInfo() {
    return {
      status: this.sessionStatus,
      accountName: this.accountName,
      jid: this.jid,
      qrCodeUrl: this.qrCodeDataUrl,
      lastConnected: this.sessionStatus === 'CONNECTED' ? new Date().toISOString() : null,
    };
  }

  public async refreshQRCode() {
    this.qrCodeDataUrl = '';
    try {
      if (this.socket) this.socket.end(undefined);
    } catch (error) {
      console.error('Socket close error:', error);
    }

    this.socket = null;
    this.reconnecting = false;
    this.sessionStatus = 'PAIRING';

    try {
      await fs.rm('./whatsapp-session', { recursive: true, force: true });
      console.log('🗑️ Session WhatsApp lama dihapus');
    } catch (error) {
      console.error('❌ Gagal menghapus session WhatsApp:', error);
    }

    await this.startBaileys();

    for (let i = 0; i < 30; i++) {
      if (this.qrCodeDataUrl) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return this.getSessionInfo();
  }

  public async disconnectWhatsApp() {
    try {
      if (this.socket) await this.socket.logout();
    } catch (error) {
      console.error('❌ Logout WhatsApp error:', error);
    }

    this.socket = null;
    this.sessionStatus = 'DISCONNECTED';
    this.jid = '';
    this.accountName = 'WA Bot RSSBK';
    this.qrCodeDataUrl = '';
    this.reconnecting = false;
    console.log('🔴 WhatsApp disconnected');
  }

  public setStatus(status: 'DISCONNECTED' | 'PAIRING' | 'CONNECTED') {
    this.sessionStatus = status;
  }

  public getState(whatsappJid: string): WhatsappState {
    if (!whatsappSessions.has(whatsappJid)) {
      whatsappSessions.set(whatsappJid, { step: 'IDLE' });
    }
    return whatsappSessions.get(whatsappJid)!;
  }

  public resetState(whatsappJid: string) {
    whatsappSessions.set(whatsappJid, { step: 'IDLE' });
  }

  /**
   * Helper: Find user record by WhatsApp JID or phone
   */
  private async findUserByJid(jid: string): Promise<any | null> {
  const cleanJid = String(jid || '').toLowerCase().trim();

  if (!cleanJid) return null;

  // Contoh JID Baileys:
  // 628122650582:89@s.whatsapp.net
  // 628122650582@s.whatsapp.net
  const beforeDomain = cleanJid.split('@')[0];

  // Buang device suffix (:89)
  const phonePart = beforeDomain.split(':')[0];

  const phone = normalizePhoneNumber(phonePart);

  if (!phone) return null;

  const normalizedJid = formatPhoneToJid(phone);

  if (isAtlasConnected()) {
    const user = await UserModel.findOne({
      $or: [
        // JID persis dari Baileys
        { whatsappJid: cleanJid },

        // JID standar
        { whatsappJid: normalizedJid },

        // Nomor dalam berbagai format
        {
          whatsappJid: new RegExp(
            `^${phone}(?::\\d+)?@s\\.whatsapp\\.net$`,
            'i'
          )
        },

        // Fallback username = nomor
        { username: phone }
      ],
      isActive: true
    });

    if (user) return user;
  }

  // In-memory fallback
  const inMem = inMemoryDB.users.find((u: any) => {
    if (u.isActive === false) return false;

    if (u.whatsappJid) {
      const storedBeforeDomain = String(u.whatsappJid)
        .toLowerCase()
        .split('@')[0];

      const storedPhone = normalizePhoneNumber(
        storedBeforeDomain.split(':')[0]
      );

      if (storedPhone === phone) {
        return true;
      }
    }

    return u.username === phone;
  });

  return inMem || null;
}

  /**
   * Helper: Get Sekretariat / Admin WhatsApp JID for notifications
   */
  private async getSekretariatJid(): Promise<string> {
    let sek: any = null;
    if (isAtlasConnected()) {
      sek = await UserModel.findOne({
        role: { $in: [RoleName.SEKRETARIAT, RoleName.ADMIN, RoleName.SUPER_ADMIN] },
        whatsappJid: { $exists: true, $ne: '' },
        isActive: true
      });
    } else {
      sek = inMemoryDB.users.find(
        u => u.isActive !== false && (u.role === RoleName.SEKRETARIAT || u.role === RoleName.ADMIN || u.role === RoleName.SUPER_ADMIN) && !!u.whatsappJid
      );
    }
    return sek?.whatsappJid || '';
  }

  /**
   * Helper: Get Direktur WhatsApp JID for notifications
   */
  private async getDirekturJid(): Promise<string> {
    let direktur: any = null;
    if (isAtlasConnected()) {
      direktur = await UserModel.findOne({
        role: { $in: [RoleName.PIMPINAN, RoleName.DIREKSI] },
        whatsappJid: { $exists: true, $ne: '' },
        isActive: true
      });
    } else {
      direktur = inMemoryDB.users.find(
        u => u.isActive !== false && (u.role === RoleName.PIMPINAN || u.role === RoleName.DIREKSI) && !!u.whatsappJid
      );
    }
    return direktur?.whatsappJid || '';
  }

  /**
   * Helper: Get Unit PIC WhatsApp JID for notifications
   */
  private async getUnitPicJid(unitCodeOrName: string): Promise<string> {
    const s = unitCodeOrName.toUpperCase().trim();
    let picUser: any = null;
    if (isAtlasConnected()) {
      picUser = await UserModel.findOne({
        $or: [
          { unitCode: new RegExp(`^${s}$`, 'i') },
          { fullName: new RegExp(unitCodeOrName, 'i') }
        ],
        whatsappJid: { $exists: true, $ne: '' },
        isActive: true
      });
    } else {
      picUser = inMemoryDB.users.find(
        u => u.isActive !== false && !!u.whatsappJid && (
          (u.unitCode && u.unitCode.toUpperCase() === s) ||
          (u.fullName && u.fullName.toLowerCase().includes(unitCodeOrName.toLowerCase()))
        )
      );
    }
    return picUser?.whatsappJid || '';
  }

  /**
   * Helper: Build dynamic list of active users & units for disposition targets
   */
  public async getDispositionTargetList(): Promise<Array<{ label: string; name: string; unitCode: string; jid: string }>> {
    let users: any[] = [];
    let units: any[] = [];

    if (isAtlasConnected()) {
      users = await UserModel.find({ isActive: true }).select('fullName username role unitCode whatsappJid').lean();
      units = await UnitModel.find({ isActive: true }).select('code name').lean();
    } else {
      users = inMemoryDB.users.filter(u => u.isActive !== false);
      units = inMemoryDB.units.filter(u => u.isActive !== false);
    }

    const targets: Array<{ label: string; name: string; unitCode: string; jid: string }> = [];

    // Prioritize Direktur
    const direktur = users.find(u => u.role === RoleName.PIMPINAN || u.role === RoleName.DIREKSI);
    if (direktur) {
      targets.push({
        label: `Direktur (${direktur.fullName})`,
        name: direktur.fullName,
        unitCode: direktur.unitCode || 'ADM',
        jid: direktur.whatsappJid || ''
      });
    }

    // Add remaining users
    users
      .filter(u => u !== direktur)
      .forEach(u => {
        const unitLabel = u.unitCode ? `[${u.unitCode}] ` : '';
        targets.push({
          label: `${unitLabel}${u.fullName} (${u.role})`,
          name: u.fullName,
          unitCode: u.unitCode || 'ADM',
          jid: u.whatsappJid || ''
        });
      });

    // Add units that might not have a direct user listed
    units.forEach(un => {
      const alreadyHasUser = targets.some(t => t.unitCode === un.code);
      if (!alreadyHasUser) {
        targets.push({
          label: `Unit ${un.name} (${un.code})`,
          name: `Unit ${un.name}`,
          unitCode: un.code,
          jid: ''
        });
      }
    });

    return targets;
  }

  /**
   * =========================================================================
   * 1. MEDIA HANDLING: INCOMING LETTER PDF/IMAGE UPLOAD & OCR EXTRACTION
   * =========================================================================
   */
  public async handleMediaMessage(
    whatsappJid: string,
    senderName: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const state = this.getState(whatsappJid);

    // 1. Save media to permanent storage
    const savedFile = await storageService.saveFile(fileBuffer, fileName, mimeType);

    // 2. Perform OCR and structured extraction (via Gemini AI or Heuristic rules)
    const extracted: ExtractedLetterData = await documentExtractorService.extract(
      fileBuffer,
      fileName,
      mimeType
    );

    if (
        extracted.confidence === 0 &&
        !extracted.letterNumber &&
        !extracted.sender &&
        !extracted.subject
      ) {
        return `⚠️ *DOKUMEN BELUM BERHASIL DIBACA*

      Sistem belum berhasil membaca isi surat dari file:

      📎 ${fileName}

      Silakan kirim ulang dengan:
      • Foto lebih jelas
      • Seluruh halaman terlihat
      • Tidak terpotong
      • Tidak terlalu miring

      File belum disimpan sebagai Surat Masuk.`;
      }

    // 3. Build Draft in Session State
    state.step = 'VERIFY_INCOMING_LETTER';
    state.draftIncoming = {
      letterNumber: extracted.letterNumber,
      letterDate: extracted.letterDate,
      receivedDate: extracted.receivedDate,
      sender: extracted.sender,
      senderAddress: extracted.senderAddress || '-',
      subject: extracted.subject,
      recipient: extracted.recipient,
      receiverUnitCode: 'ADM',
      classification: extracted.classification,
      urgency: extracted.urgency,
      fileName: savedFile.originalName,
      fileUrl: savedFile.url,
      fileSize: `${Math.round(savedFile.size / 1024)} KB`,
      mimeType: savedFile.mimeType,
      uploadedBy: `${senderName} (WhatsApp)`,
      channel: ChannelType.WHATSAPP,
    };

    return this.renderVerificationPrompt(state.draftIncoming);
  }

  private renderVerificationPrompt(draft?: Partial<IIncomingLetter>): string {
    if (!draft) return '⚠️ Draft surat tidak ditemukan.';

    return `📄 *SURAT BERHASIL DIBACA & DIEKSTRAK*

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
${draft.recipient || 'Direktur RS Sebening Kasih'}

• *Sifat / Urgensi*:
${draft.classification || 'Biasa'} / ${draft.urgency || 'Biasa'}

• *Berkas Lampiran*:
📎 \`${draft.fileName || 'Dokumen.pdf'}\` (${draft.fileSize || '-'})

---
Mohon verifikasi kelengkapan data di atas:
1. ✅ *SIMPAN*
2. ✏️ *EDIT*
3. ❌ *BATAL*

Ketik angka *1*, *2*, atau *3*.`;
  }

  /**
   * =========================================================================
   * 2. DISPOSITION SUMMARY NOTIFICATION FOR DIREKTUR
   * =========================================================================
   */
  private renderDirectorApprovalNotification(letter: IIncomingLetter, disp: IDisposition): string {
    return `🔔 *DISPOSISI MENUNGGU PERSETUJUAN DIREKTUR*

• *ID Disposisi*: \`${disp.referenceNumber || disp.id}\`
• *No. Agenda*: \`${letter.agendaNumber}\`
• *No. Surat Asal*: \`${letter.letterNumber}\`
• *Pengirim*: ${letter.sender}
• *Perihal*: ${letter.subject}
• *Diteruskan Kepada*: *${disp.toUserOrUnit}*
• *Instruksi*: ${disp.instruction}
• *Deadline*: ${disp.deadline || 'Tanpa deadline'}
• *Status*: ⏳ *PENDING_APPROVAL*

---
Balas pesan ini untuk tindakan:
1. ✅ *ACC* (Setujui Disposisi)
2. ❌ *TOLAK* (Tolak Disposisi)
3. ✏️ *REVISI* (Minta Revisi ke Sekretariat)

Atau ketik: \`ACC ${disp.referenceNumber || disp.id}\`, \`TOLAK ${disp.referenceNumber || disp.id}\`, \`REVISI ${disp.referenceNumber || disp.id}\``;
  }

  /**
   * =========================================================================
   * 3. DISPOSITION NOTIFICATION FOR RECIPIENT
   * =========================================================================
   */
  private renderRecipientNotification(letter: IIncomingLetter, disp: IDisposition): string {
    return `📬 *DISPOSISI BARU DITERIMA (DISETUJUI DIREKTUR)*

• *ID Disposisi*: \`${disp.referenceNumber || disp.id}\`
• *No. Surat*: \`${letter.letterNumber}\`
• *Pengirim*: ${letter.sender}
• *Perihal*: ${letter.subject}
• *Pemberi Disposisi*: ${disp.approvedBy || 'dr. H. Budi Santoso, Sp.A (Direktur)'}
• *Instruksi*: *${disp.instruction}*
• *Batas Waktu (Deadline)*: *${disp.deadline || 'Biasa'}*
• *Status*: ✅ *APPROVED*

---
Ketik perintah untuk menindaklanjuti:
1. 📥 *PROSES* (Mulai tindak lanjut disposisi)
2. ✅ *SELESAI* (Telah selesai ditindaklanjuti)

Atau ketik: \`PROSES ${disp.referenceNumber || disp.id}\` atau \`SELESAI ${disp.referenceNumber || disp.id}\``;
  }

  /**
   * =========================================================================
   * 4. MAIN INTERACTIVE MESSAGE HANDLER
   * =========================================================================
   */
  public async handleMessage(
    whatsappJid: string,
    senderName: string,
    text: string
  ): Promise<string> {
    const rawText = text.trim();
    const command = rawText.toLowerCase();
    const state = this.getState(whatsappJid);
    const isActiveSession = state.step !== 'IDLE';

    /**
     * GLOBAL CANCEL
     */
    if (command === 'batal' || command === 'cancel') {
      this.resetState(whatsappJid);
      return '❌ Transaksi / proses WhatsApp dibatalkan.';
    }

    /**
     * HELP / MENU
     */
    if (command === 'help' || command === 'bantuan' || command === 'menu') {
      return `💬 *WhatsApp Bot Service RS Sebening Kasih*

📋 *Layanan Surat & Penomoran*:
1. *nomor* - Ambil nomor surat keluar (SPO, PERDIR, SK, UMUM)
2. *status <nomor>* - Cek status nomor surat
3. *riwayat* - Lihat riwayat reservasi nomor Anda
4. *disposisi* - Cek daftar disposisi aktif & status persetujuan

📨 *Layanan Surat Masuk & Disposisi*:
• Kirim file PDF atau Foto dokumen surat masuk ke bot ini untuk ekstraksi otomatis (OCR) & pembuatan disposisi.
• *ACC <ID>* - Direktur menyetujui lembar disposisi
• *TOLAK <ID>* - Direktur menolak lembar disposisi
• *REVISI <ID>* - Direktur meminta revisi lembar disposisi
• *PROSES <ID>* - Penerima mulai menindaklanjuti disposisi
• *SELESAI <ID>* - Penerima menyelesaikan disposisi

*batal* - Batalkan proses yang sedang berjalan`;
    }

    /**
     * DISPOSISI LIST / STATUS COMMAND
     */
    if (command === 'disposisi' || command === 'cek disposisi') {
      const allLetters = isAtlasConnected()
        ? await IncomingLetterModel.find().sort({ createdAt: -1 }).limit(10)
        : inMemoryDB.incomingLetters.slice(0, 10);

      const allDisps: { letter: IIncomingLetter; disp: IDisposition }[] = [];
      allLetters.forEach(l => {
        (l.dispositions || []).forEach((d: IDisposition) => {
          allDisps.push({ letter: l, disp: d });
        });
      });

      if (allDisps.length === 0) {
        return '📭 Belum ada lembar disposisi aktif.';
      }

      let resp = `📋 *DAFTAR DISPOSISI TERKINI*\n\n`;
      allDisps.slice(0, 5).forEach((item, idx) => {
        const statusBadge =
          item.disp.status === 'APPROVED'
            ? '✅ APPROVED'
            : item.disp.status === 'PENDING_APPROVAL'
            ? '⏳ PENDING_APPROVAL'
            : item.disp.status === 'IN_PROGRESS'
            ? '🔄 IN_PROGRESS'
            : item.disp.status === 'COMPLETED'
            ? '🎉 COMPLETED'
            : item.disp.status === 'REJECTED'
            ? '❌ REJECTED'
            : item.disp.status;

        resp += `${idx + 1}. \`${item.disp.referenceNumber || item.disp.id}\` [${statusBadge}]\n`;
        resp += `   • *Tujuan*: ${item.disp.toUserOrUnit}\n`;
        resp += `   • *Perihal*: ${item.letter.subject}\n`;
        resp += `   • *Instruksi*: ${item.disp.instruction}\n\n`;
      });

      resp += `Ketik *ACC <ID>*, *TOLAK <ID>*, *PROSES <ID>*, atau *SELESAI <ID>*.`;
      return resp;
    }

    /**
     * =========================================================================
     * DIREKTUR DIRECT APPROVAL COMMANDS: ACC, TOLAK, REVISI
     * =========================================================================
     */
    const accMatch = rawText.match(/^(?:acc|setujui|ok)(?:\s+([A-Za-z0-9\-_]+))?$/i);
    if (accMatch) {
      let targetId = accMatch[1];
      if (!targetId && state.activeDispId) targetId = state.activeDispId;

      if (!targetId) {
        // Look for the latest pending approval disposition
        const found = await this.findLatestPendingDisposition();
        if (found) targetId = found.disposition.referenceNumber || found.disposition.id;
      }

      if (!targetId) {
        return '⚠️ Mohon cantumkan ID Disposisi. Contoh: `ACC DISP-2026-00017`';
      }

      try {
        const { letter, disposition } = await incomingLetterService.approveDisposition(
          targetId,
          `${senderName} (Direktur)`,
          undefined,
          ChannelType.WHATSAPP
        );

        this.resetState(whatsappJid);

        // Notify Recipient via WhatsApp if socket is connected
        const picJid = disposition.toJid || (await this.getUnitPicJid(disposition.toUserOrUnit));
        await this.sendMessage(picJid, this.renderRecipientNotification(letter, disposition));

        return `✅ *DISPOSISI DISETUJUI*\n\n• *ID*: \`${disposition.referenceNumber || disposition.id}\`\n• *Surat*: ${letter.letterNumber}\n• *Diteruskan kepada*: ${disposition.toUserOrUnit}\n• *Status*: *APPROVED*\n\nNotifikasi dan instruksi telah otomatis diteruskan ke WhatsApp penerima disposisi.`;
      } catch (err: any) {
        return `❌ Gagal menyetujui disposisi: ${err.message}`;
      }
    }

    const tolakMatch = rawText.match(/^tolak(?:\s+([A-Za-z0-9\-_]+))?$/i);
    if (tolakMatch) {
      let targetId = tolakMatch[1] || state.activeDispId;
      if (!targetId) {
        const found = await this.findLatestPendingDisposition();
        if (found) targetId = found.disposition.referenceNumber || found.disposition.id;
      }

      if (!targetId) {
        return '⚠️ Mohon cantumkan ID Disposisi yang ditolak. Contoh: `TOLAK DISP-2026-00017`';
      }

      state.step = 'INPUT_DIRECTOR_REJECT_REASON';
      state.activeDispId = targetId;
      return `✏️ *PENOLAKAN DISPOSISI* \`${targetId}\`\n\nMasukkan alasan penolakan disposisi ini:`;
    }

    if (state.step === 'INPUT_DIRECTOR_REJECT_REASON') {
      const targetId = state.activeDispId!;
      const reason = rawText;
      try {
        const { letter, disposition } = await incomingLetterService.rejectDisposition(
          targetId,
          reason,
          `${senderName} (Direktur)`,
          ChannelType.WHATSAPP
        );
        this.resetState(whatsappJid);

        // Notify Sekretariat
        const sekJid =
          disposition.fromJid ||
          await this.getSekretariatJid();

        if (sekJid) {
          await this.sendMessage(
            sekJid,
            `❌ *DISPOSISI DITOLAK DIREKTUR*

        • *ID*: \`${disposition.referenceNumber || disposition.id}\`
        • *Surat*: ${letter.letterNumber}
        • *Alasan Penolakan*: ${reason}
        • *Status*: *REJECTED*`
          );
        }

        return `❌ *DISPOSISI DITOLAK*\n\n• *ID*: \`${disposition.referenceNumber || disposition.id}\`\n• *Alasan*: ${reason}\n• *Status*: *REJECTED*\n\nNotifikasi telah dikirimkan kembali ke Sekretariat.`;
      } catch (err: any) {
        this.resetState(whatsappJid);
        return `❌ Gagal menolak disposisi: ${err.message}`;
      }
    }

    const revisiMatch = rawText.match(/^revisi(?:\s+([A-Za-z0-9\-_]+))?$/i);
    if (revisiMatch) {
      let targetId = revisiMatch[1] || state.activeDispId;
      if (!targetId) {
        const found = await this.findLatestPendingDisposition();
        if (found) targetId = found.disposition.referenceNumber || found.disposition.id;
      }

      if (!targetId) {
        return '⚠️ Mohon cantumkan ID Disposisi yang perlu direvisi. Contoh: `REVISI DISP-2026-00017`';
      }

      state.step = 'INPUT_DIRECTOR_REVISION_NOTES';
      state.activeDispId = targetId;
      return `✏️ *PERMINTAAN REVISI DISPOSISI* \`${targetId}\`\n\nMasukkan catatan revisi untuk Sekretariat:`;
    }

    if (state.step === 'INPUT_DIRECTOR_REVISION_NOTES') {
      const targetId = state.activeDispId!;
      const notes = rawText;
      try {
        const { letter, disposition } = await incomingLetterService.requestRevision(
          targetId,
          notes,
          `${senderName} (Direktur)`,
          ChannelType.WHATSAPP
        );
        this.resetState(whatsappJid);

        // Notify Sekretariat
        const sekJid =
            disposition.fromJid ||
            await this.getSekretariatJid();

          if (sekJid) {
            await this.sendMessage(
              sekJid,
              `⚠️ *DISPOSISI MEMERLUKAN REVISI DARI DIREKTUR*

          • *ID*: \`${disposition.referenceNumber || disposition.id}\`
          • *Surat*: ${letter.letterNumber}
          • *Catatan*: ${notes}
          • *Status*: *REVISION_REQUIRED*`
            );
          }

        return `⚠️ *PERMINTAAN REVISI DIKIRIM*\n\n• *ID*: \`${disposition.referenceNumber || disposition.id}\`\n• *Catatan*: ${notes}\n• *Status*: *REVISION_REQUIRED*\n\nSekretariat telah dinotifikasi untuk melakukan perbaikan.`;
      } catch (err: any) {
        this.resetState(whatsappJid);
        return `❌ Gagal meminta revisi disposisi: ${err.message}`;
      }
    }

    /**
     * =========================================================================
     * RECIPIENT DIRECT ACTIONS: PROSES, SELESAI
     * =========================================================================
     */
    const prosesMatch = rawText.match(/^(?:proses|terima)(?:\s+([A-Za-z0-9\-_]+))?$/i);
    if (prosesMatch) {
      let targetId = prosesMatch[1];
      if (!targetId) {
        const latestApproved = await this.findLatestApprovedDisposition();
        if (latestApproved) targetId = latestApproved.disposition.referenceNumber || latestApproved.disposition.id;
      }

      if (!targetId) {
        return '⚠️ Format: `PROSES <ID_DISPOSISI>`\nContoh: `PROSES DISP-2026-00017`';
      }

      try {
        const { letter, disposition } = await incomingLetterService.processDisposition(
          targetId,
          senderName,
          ChannelType.WHATSAPP
        );

        return `⏳ *DISPOSISI SEDANG DITINDAKLANJUTI*\n\n• *ID*: \`${disposition.referenceNumber || disposition.id}\`\n• *Surat*: ${letter.letterNumber}\n• *Pelaksana*: ${senderName}\n• *Status*: *IN_PROGRESS*\n\nKetik \`SELESAI ${disposition.referenceNumber || disposition.id}\` apabila tindak lanjut telah selesai.`;
      } catch (err: any) {
        return `❌ Gagal memproses disposisi: ${err.message}`;
      }
    }

    const selesaiMatch = rawText.match(/^(?:selesai|tuntas)(?:\s+([A-Za-z0-9\-_]+))?$/i);
    if (selesaiMatch) {
      let targetId = selesaiMatch[1];
      if (!targetId) {
        const latestInProgress = await this.findLatestInProgressDisposition();
        if (latestInProgress) targetId = latestInProgress.disposition.referenceNumber || latestInProgress.disposition.id;
      }

      if (!targetId) {
        return '⚠️ Format: `SELESAI <ID_DISPOSISI>`\nContoh: `SELESAI DISP-2026-00017`';
      }

      try {
        const { letter, disposition } = await incomingLetterService.completeDisposition(
          targetId,
          senderName,
          ChannelType.WHATSAPP
        );

        return `🎉 *DISPOSISI DINYATAKAN SELESAI*\n\n• *ID*: \`${disposition.referenceNumber || disposition.id}\`\n• *Surat*: ${letter.letterNumber}\n• *Perihal*: ${letter.subject}\n• *Penyelesai*: ${senderName}\n• *Waktu*: ${new Date().toLocaleString('id-ID')}\n• *Status*: *COMPLETED*`;
      } catch (err: any) {
        return `❌ Gagal menyelesaikan disposisi: ${err.message}`;
      }
    }

    /**
     * =========================================================================
     * 5. INCOMING LETTER VERIFICATION & EDIT STATE MACHINE
     * =========================================================================
     */
    if (state.step === 'VERIFY_INCOMING_LETTER') {
      if (rawText === '1' || command === 'simpan' || command === 'save' || command === 'ya') {
        const draft = state.draftIncoming;
        if (!draft || !draft.letterNumber || !draft.sender || !draft.subject) {
          return '⚠️ Data surat belum lengkap. Silakan pilih 2 untuk EDIT atau 3 untuk BATAL.';
        }

        try {
          const savedLetter = await incomingLetterService.createIncomingLetter({
            letterNumber: draft.letterNumber!,
            letterDate: draft.letterDate || new Date().toISOString().split('T')[0],
            receivedDate: draft.receivedDate || new Date().toISOString().split('T')[0],
            sender: draft.sender!,
            senderAddress: draft.senderAddress || '-',
            subject: draft.subject!,
            recipient: draft.recipient || 'Direktur RS Sebening Kasih',
            receiverUnitCode: draft.receiverUnitCode || 'ADM',
            classification: draft.classification || 'Biasa',
            urgency: draft.urgency || 'Biasa',
            fileName: draft.fileName,
            fileUrl: draft.fileUrl,
            fileSize: draft.fileSize,
            mimeType: draft.mimeType,
            channel: ChannelType.WHATSAPP,
            uploadedBy: draft.uploadedBy || `${senderName} (WhatsApp)`,
            userName: `${senderName} (WhatsApp)`,
          });

          state.step = 'PROMPT_CREATE_DISPOSITION';
          state.savedLetter = savedLetter;

          return `✅ *SURAT MASUK TERSIMPAN DALAM SISTEM*

• *No. Agenda*: \`${savedLetter.agendaNumber}\`
• *No. Surat Asal*: \`${savedLetter.letterNumber}\`
• *Pengirim*: ${savedLetter.sender}
• *Perihal*: ${savedLetter.subject}
• *Tgl Terima*: ${savedLetter.receivedDate}

---
📋 *Apakah surat ini akan didisposisikan sekarang?*
1. ✅ *Ya, buat disposisi*
2. ❌ *Tidak (Simpan saja)*

Ketik *1* atau *2*.`;
        } catch (err: any) {
          return `❌ Gagal menyimpan surat masuk: ${err.message}`;
        }
      }

      if (rawText === '2' || command === 'edit' || command === 'ubah') {
        state.step = 'EDIT_INCOMING_LETTER';
        return `✏️ *PILIH DATA YANG AKAN DIUBAH*

1. Nomor Surat (Asal)
2. Tanggal Surat
3. Pengirim (Instansi)
4. Alamat Pengirim
5. Perihal Surat
6. Tujuan Surat (Penerima)
7. Sifat & Urgensi
8. Selesai Edit & Kembali ke Verifikasi

Ketik angka pilihan (1-8):`;
      }

      if (rawText === '3' || command === 'batal') {
        this.resetState(whatsappJid);
        return '❌ Perekaman surat masuk dibatalkan.';
      }

      return '⚠️ Pilihan tidak valid. Ketik *1* untuk SIMPAN, *2* untuk EDIT, atau *3* untuk BATAL.';
    }

    if (state.step === 'EDIT_INCOMING_LETTER') {
      const choice = rawText;
      if (choice === '1') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'letterNumber';
        return `✏️ *Nomor Surat Saat Ini*: \`${state.draftIncoming?.letterNumber || '-'}\`\n\nKetik nomor surat yang baru:`;
      }
      if (choice === '2') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'letterDate';
        return `✏️ *Tanggal Surat Saat Ini*: \`${state.draftIncoming?.letterDate || '-'}\`\n\nKetik tanggal surat yang baru (format YYYY-MM-DD):`;
      }
      if (choice === '3') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'sender';
        return `✏️ *Pengirim Saat Ini*: \`${state.draftIncoming?.sender || '-'}\`\n\nKetik nama instansi pengirim yang baru:`;
      }
      if (choice === '4') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'senderAddress';
        return `✏️ *Alamat Pengirim Saat Ini*: \`${state.draftIncoming?.senderAddress || '-'}\`\n\nKetik alamat pengirim yang baru:`;
      }
      if (choice === '5') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'subject';
        return `✏️ *Perihal Saat Ini*: \`${state.draftIncoming?.subject || '-'}\`\n\nKetik perihal surat yang baru:`;
      }
      if (choice === '6') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'recipient';
        return `✏️ *Tujuan Saat Ini*: \`${state.draftIncoming?.recipient || '-'}\`\n\nKetik tujuan penerima yang baru:`;
      }
      if (choice === '7') {
        state.step = 'EDIT_INCOMING_FIELD';
        state.fieldToEdit = 'urgency';
        return `✏️ *Sifat/Urgensi Saat Ini*: \`${state.draftIncoming?.classification} / ${state.draftIncoming?.urgency}\`\n\nKetik: Biasa / Penting / Sangat Segera`;
      }
      if (choice === '8' || choice.toLowerCase() === 'selesai') {
        state.step = 'VERIFY_INCOMING_LETTER';
        return this.renderVerificationPrompt(state.draftIncoming);
      }
      return '⚠️ Ketik angka 1 sampai 8.';
    }

    if (state.step === 'EDIT_INCOMING_FIELD') {
      const field = state.fieldToEdit!;
      if (!state.draftIncoming) state.draftIncoming = {};
      (state.draftIncoming as any)[field] = rawText;

      state.step = 'VERIFY_INCOMING_LETTER';
      return `✅ *Data berhasil diperbarui!*\n\n` + this.renderVerificationPrompt(state.draftIncoming);
    }

    /**
     * PROMPT CREATE DISPOSITION
     */
    if (state.step === 'PROMPT_CREATE_DISPOSITION') {
      if (rawText === '1' || command === 'ya' || command === 'disposisi') {
        state.step = 'SELECT_DISPOSITION_TARGET';
        state.dispositionDraft = {};

        const targets = await this.getDispositionTargetList();
        state.availableDispositionTargets = targets;

        const optionsText = targets
          .map((t, idx) => `${idx + 1}. *${t.label}*`)
          .join('\n');

        return `📝 *PILIH TUJUAN DISPOSISI*

${optionsText}
${targets.length + 1}. *Lainnya* (Ketik manual nama penerima)

Ketik angka pilihan (1-${targets.length + 1}):`;
      }

      if (rawText === '2' || command === 'tidak' || command === 'selesai') {
        const agenda = state.savedLetter?.agendaNumber || 'Surat Masuk';
        this.resetState(whatsappJid);
        return `✅ Perekaman surat masuk \`${agenda}\` selesai dan tersimpan di database.`;
      }

      return '⚠️ Ketik *1* untuk buat disposisi atau *2* untuk selesai.';
    }

    /**
     * SELECT DISPOSITION TARGET
     */
    if (state.step === 'SELECT_DISPOSITION_TARGET') {
      const choiceIndex = parseInt(rawText.trim(), 10) - 1;
      const targets = state.availableDispositionTargets || (await this.getDispositionTargetList());

      let target = '';
      let targetCode = 'ADM';
      let toJid = '';

      if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < targets.length) {
        const selected = targets[choiceIndex];
        target = selected.name;
        targetCode = selected.unitCode;
        toJid = selected.jid;
      } else {
        // Manual input or custom name
        target = rawText.trim();
        // Try to match target to existing user or unit
        const found = targets.find(
          t => t.name.toLowerCase().includes(target.toLowerCase()) ||
               t.label.toLowerCase().includes(target.toLowerCase())
        );
        if (found) {
          targetCode = found.unitCode;
          toJid = found.jid;
        }
      }

      state.dispositionDraft = {
        toUserOrUnit: target,
        targetUnitCode: targetCode,
        toJid,
      };

      state.step = 'INPUT_DISPOSITION_INSTRUCTION';
      return `🎯 *Tujuan Disposisi*: *${target}*${toJid ? ` (${toJid.split('@')[0]})` : ''}

✏️ *MASUKKAN INSTRUKSI DISPOSISI*
Contoh:
- Tindak lanjuti dan sosialisasikan kepada staf
- Pelajari dan siapkan tanggapan resmi
- Hadiri undangan rapat dan laporkan hasilnya

Ketik instruksi disposisi:`;
    }

    /**
     * INPUT DISPOSITION INSTRUCTION
     */
    if (state.step === 'INPUT_DISPOSITION_INSTRUCTION') {
      if (rawText.length < 3) {
        return '⚠️ Instruksi terlalu pendek. Masukkan instruksi disposisi yang jelas:';
      }

      state.dispositionDraft!.instruction = rawText;
      state.step = 'INPUT_DISPOSITION_DEADLINE';

      return `⏰ *MASUKKAN BATAS WAKTU (DEADLINE)*

Contoh format:
• \`25/08/2026\` atau \`2026-08-25\`
• Ketik *0* jika tanpa deadline khusus`;
    }

    /**
     * INPUT DISPOSITION DEADLINE -> SUBMIT DISPOSITION
     */
    if (state.step === 'INPUT_DISPOSITION_DEADLINE') {
      const deadline = rawText === '0' || rawText.toLowerCase() === 'tidak ada' ? '-' : rawText;
      const dispDraft = state.dispositionDraft!;
      const letter = state.savedLetter!;

      try {
        const { disposition } = await incomingLetterService.createDisposition({
          incomingLetterId: letter.id,
          fromUser: `${senderName} (Sekretariat)`,
          fromJid: whatsappJid,
          toUserOrUnit: dispDraft.toUserOrUnit!,
          toJid: dispDraft.toJid,
          targetUnitCode: dispDraft.targetUnitCode,
          instruction: dispDraft.instruction!,
          deadline,
          channel: ChannelType.WHATSAPP,
        });

        this.resetState(whatsappJid);

        // Send Notification to Direktur WhatsApp
        const dirJid = await this.getDirekturJid();
        await this.sendMessage(dirJid, this.renderDirectorApprovalNotification(letter, disposition));

        return `📋 *DISPOSISI DIBUAT (MENUNGGU PERSETUJUAN DIREKTUR)*

• *ID Disposisi*: \`${disposition.referenceNumber || disposition.id}\`
• *No. Agenda*: \`${letter.agendaNumber}\`
• *No. Surat Asal*: \`${letter.letterNumber}\`
• *Pengirim*: ${letter.sender}
• *Perihal*: ${letter.subject}
• *Diteruskan Kepada*: *${disposition.toUserOrUnit}*
• *Instruksi*: ${disposition.instruction}
• *Deadline*: ${disposition.deadline}
• *Status*: ⏳ *PENDING_APPROVAL*

Notifikasi persetujuan telah otomatis dikirimkan ke WhatsApp Direktur.`;
      } catch (err: any) {
        this.resetState(whatsappJid);
        return `❌ Gagal membuat lembar disposisi: ${err.message}`;
      }
    }

    /**
     * =========================================================================
     * 6. NUMBERING ENGINE FLOW (SPO, PERDIR, SK, UMUM)
     * =========================================================================
     */
    if (command === 'status' || command.startsWith('status ')) {
      const parts = rawText.split(/\s+/);
      if (parts.length < 2) {
        return `⚠️ Format: status <nomor_surat>\nContoh: status 001/RSSBK/VIII/2026`;
      }
      const numStr = parts.slice(1).join(' ').trim();
      const statusObj = await numberingService.getNumberStatus(numStr);
      if (!statusObj) {
        return `🔍 Nomor surat \`${numStr}\` tidak ditemukan.`;
      }
      return `📄 *Detail Surat (WhatsApp)*\n\n• *Nomor*: \`${statusObj.number}\`\n• *Jenis*: ${statusObj.typeCode}\n• *Unit*: ${statusObj.unitCode || '-'}\n• *Perihal*: ${statusObj.subject || statusObj.title || '-'}\n• *Pemohon*: ${statusObj.userName}\n• *Kanal*: ${statusObj.channel}\n• *Status*: *${statusObj.status}*`;
    }

    if (command === 'riwayat') {
      const all = await numberingService.listReservations();
      const userRes = all
        .filter(r => r.channel === ChannelType.WHATSAPP || r.userId === whatsappJid)
        .slice(0, 5);

      if (userRes.length === 0) {
        return '📭 Belum ada riwayat nomor surat via WhatsApp.';
      }

      let resp = '📋 *Riwayat WhatsApp*\n\n';
      userRes.forEach((r, idx) => {
        resp += `${idx + 1}. \`${r.number}\` | ${r.typeCode} | ${r.status}\n`;
        resp += `   *Perihal*: ${r.subject || r.title || '-'}\n\n`;
      });
      return resp;
    }

    if (command === 'nomor' || command === 'start') {
      state.step = 'SELECT_TYPE';

      let types: any[] = [];
      if (isAtlasConnected()) {
        types = await LetterTypeModel.find({ isActive: true });
      } else {
        types = inMemoryDB.letterTypes.filter(t => t.isActive !== false);
      }

      if (types.length === 0) {
        return '⚠️ Belum ada jenis surat aktif.';
      }

      let resp = '🟢 *PILIH JENIS SURAT*\n\n';
      types.forEach((t, idx) => {
        const lockBadge = t.isLocked ? '🔒 (Terkunci)' : '';
        resp += `${idx + 1}. *${t.code}* - ${t.name} ${lockBadge}\n`;
      });
      resp += '\nKetik angka pilihan Anda (1, 2, ...):';
      return resp;
    }

    if (state.step === 'SELECT_TYPE') {
      let types: any[] = [];
      if (isAtlasConnected()) {
        types = await LetterTypeModel.find({ isActive: true });
      } else {
        types = inMemoryDB.letterTypes.filter(t => t.isActive !== false);
      }

      const selectedIdx = parseInt(rawText, 10) - 1;
      let selectedType: any = null;

      if (!Number.isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < types.length) {
        selectedType = types[selectedIdx];
      } else {
        selectedType = types.find(t => t.code.toLowerCase() === command);
      }

      if (!selectedType) {
        return '⚠️ Pilihan jenis surat tidak valid. Ketik angka yang sesuai.';
      }

      if (selectedType.isLocked === true) {
        return `🔒 *JENIS SURAT MASIH TERKUNCI*\n\nJenis Surat *${selectedType.code}* masih terkunci.\nHubungi Sekretariat untuk membuka pengambilan nomor.`;
      }

      state.typeCode = selectedType.code;

      if (!selectedType.requiresUnit) {
        state.step = 'INPUT_QUANTITY';
        return `✅ Jenis: *${selectedType.code}*\n\n🔢 *Berapa nomor yang diperlukan?*\n\nKetik jumlahnya, misalnya: 1, 2, 3, 10, 12`;
      }

      state.step = 'SELECT_UNIT';
      let units: any[] = [];
      if (isAtlasConnected()) {
        units = await UnitModel.find({ isActive: true });
      } else {
        units = inMemoryDB.units.filter(u => u.isActive !== false);
      }

      if (units.length === 0) {
        state.step = 'IDLE';
        return '⚠️ Belum ada unit kerja aktif.';
      }

      let resp = `✅ Jenis: *${selectedType.code}*\n\n🏬 *PILIH UNIT KERJA*\n\n`;
      units.forEach((u, idx) => {
        resp += `${idx + 1}. *${u.code}* - ${u.name}\n`;
      });
      resp += '\nKetik angka pilihan unit (1, 2, ...):';
      return resp;
    }

    if (state.step === 'SELECT_UNIT') {
      let units: any[] = [];
      if (isAtlasConnected()) {
        units = await UnitModel.find({ isActive: true });
      } else {
        units = inMemoryDB.units.filter(u => u.isActive !== false);
      }

      const selectedIdx = parseInt(rawText, 10) - 1;
      let selectedUnit: any = null;

      if (!Number.isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < units.length) {
        selectedUnit = units[selectedIdx];
      } else {
        selectedUnit = units.find(u => u.code.toLowerCase() === command);
      }

      if (!selectedUnit) {
        return '⚠️ Unit tidak ditemukan. Ketik angka pilihan unit.';
      }

      state.unitCode = selectedUnit.code;
      state.step = 'INPUT_QUANTITY';
      return `✅ Unit: *${selectedUnit.code}*\n\n🔢 *Berapa nomor yang diperlukan?*\n\nKetik jumlahnya, misalnya: 1, 2, 3, 10, 12`;
    }

    if (state.step === 'INPUT_QUANTITY') {
      const quantity = Number(rawText);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return '⚠️ Jumlah tidak valid. Masukkan angka 1 sampai 100.';
      }

      state.quantity = quantity;
      state.step = 'SELECT_SUBJECT_MODE';

      return `🔢 Jumlah nomor: *${quantity}*\n\nBagaimana perihalnya?\n1. Perihal sama untuk semua nomor\n2. Perihal berbeda untuk setiap nomor\n\nKetik *1* atau *2*.`;
    }

    if (state.step === 'SELECT_SUBJECT_MODE') {
      if (rawText === '1') {
        state.subjectMode = 'SAME';
        state.step = 'INPUT_SUBJECT';
        return '📝 *Masukkan perihal/judul untuk semua nomor*:';
      }

      if (rawText === '2') {
        state.subjectMode = 'DIFFERENT';
        state.subjects = [];
        state.step = 'INPUT_SUBJECTS';
        return `📝 *Masukkan ${state.quantity} perihal/judul*, satu per baris.`;
      }

      return '⚠️ Pilihan tidak valid. Ketik 1 atau 2.';
    }

    if (state.step === 'INPUT_SUBJECT') {
      if (rawText.length < 3) {
        return '⚠️ Perihal terlalu pendek. Masukkan perihal yang jelas:';
      }

      state.subject = rawText;
      state.subjects = Array.from({ length: state.quantity || 1 }, () => rawText);
      state.requestId = `WA-${whatsappJid}-${Date.now()}`;
      state.step = 'CONFIRM';

      return await this.buildBulkConfirmation(whatsappJid, senderName, state);
    }

    if (state.step === 'INPUT_SUBJECTS') {
      const subjects = rawText
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean);

      if (subjects.length !== state.quantity) {
        return `⚠️ Anda meminta ${state.quantity} nomor, jadi harus mengirim tepat ${state.quantity} perihal, satu per baris. Saat ini terbaca ${subjects.length}.`;
      }

      const invalid = subjects.find(v => v.length < 3);
      if (invalid) {
        return '⚠️ Ada perihal yang terlalu pendek. Setiap perihal minimal 3 karakter.';
      }

      state.subjects = subjects;
      state.subject = subjects[0];
      state.requestId = `WA-${whatsappJid}-${Date.now()}`;
      state.step = 'CONFIRM';

      return await this.buildBulkConfirmation(whatsappJid, senderName, state);
    }

    if (state.step === 'CONFIRM') {
      if (rawText === '1' || command === 'ya' || command === 'ambil') {
        try {
          const result = await numberingService.reserveMultipleNumbers({
            typeCode: state.typeCode!,
            unitCode: state.unitCode,
            subjects: state.subjects || [],
            titles: state.subjects || [],
            count: state.quantity || 1,
            userId: whatsappJid,
            userName: `${senderName} (WhatsApp)`,
            channel: ChannelType.WHATSAPP,
            requestId: state.requestId!,
          });

          this.resetState(whatsappJid);

          let response = `✅ *${result.count} NOMOR BERHASIL DICADANGKAN*\n\n`;
          response += `• *Batch*: \`${result.batchId}\`\n`;
          response += `• *Jenis*: ${state.typeCode}\n`;
          response += `• *Unit*: ${state.unitCode || '-'}\n`;
          response += `• *Status*: *RESERVED*\n\n`;

          result.reservations.forEach((r: any, index: number) => {
            response += `${index + 1}. \`${r.number}\` — ${r.subject || r.title || '-'}\n`;
          });

          return response;
        } catch (err: any) {
          this.resetState(whatsappJid);
          return `❌ Gagal mengambil nomor: ${err?.message || 'Unknown error'}`;
        }
      }

      this.resetState(whatsappJid);
      return '❌ Pembuatan nomor surat dibatalkan.';
    }

    if (isActiveSession) {
      return '⚠️ Input tidak dikenali. Silakan ikuti pilihan yang diberikan atau ketik *batal*.';
    }

    return '';
  }

  private async buildBulkConfirmation(
    whatsappJid: string,
    senderName: string,
    state: WhatsappState
  ): Promise<string> {
    const preview = await numberingService.previewMultipleNumbers({
      typeCode: state.typeCode!,
      unitCode: state.unitCode,
      count: state.quantity || 1,
      instansi: 'RSSBK',
    });

    state.previewNumbers = preview;

    let response = `🔍 *KONFIRMASI PENGAMBILAN NOMOR*\n\n`;
    response += `• *Jenis*: ${state.typeCode}\n`;
    response += `• *Unit*: ${state.unitCode || '-'}\n`;
    response += `• *Jumlah*: ${state.quantity}\n\n`;
    response += `*Nomor yang akan dicadangkan:*\n`;

    preview.forEach((number, index) => {
      const subject = state.subjects?.[index] || state.subject || '-';
      response += `${index + 1}. \`${number}\` — ${subject}\n`;
    });

    response += `\nKetik:\n*1* - ✅ *AMBIL SEMUA*\n*2* - ❌ *BATAL*`;
    return response;
  }

  private async findLatestPendingDisposition(): Promise<{ letter: IIncomingLetter; disposition: IDisposition } | null> {
    const letters = isAtlasConnected()
      ? await IncomingLetterModel.find({ 'dispositions.status': 'PENDING_APPROVAL' }).sort({ createdAt: -1 })
      : inMemoryDB.incomingLetters;

    for (const l of letters) {
      const d = (l.dispositions || []).find((disp: IDisposition) => disp.status === 'PENDING_APPROVAL');
      if (d) return { letter: l, disposition: d };
    }
    return null;
  }

  private async findLatestApprovedDisposition(): Promise<{ letter: IIncomingLetter; disposition: IDisposition } | null> {
    const letters = isAtlasConnected()
      ? await IncomingLetterModel.find({ 'dispositions.status': 'APPROVED' }).sort({ createdAt: -1 })
      : inMemoryDB.incomingLetters;

    for (const l of letters) {
      const d = (l.dispositions || []).find((disp: IDisposition) => disp.status === 'APPROVED');
      if (d) return { letter: l, disposition: d };
    }
    return null;
  }

  private async findLatestInProgressDisposition(): Promise<{ letter: IIncomingLetter; disposition: IDisposition } | null> {
    const letters = isAtlasConnected()
      ? await IncomingLetterModel.find({ 'dispositions.status': 'IN_PROGRESS' }).sort({ createdAt: -1 })
      : inMemoryDB.incomingLetters;

    for (const l of letters) {
      const d = (l.dispositions || []).find((disp: IDisposition) => disp.status === 'IN_PROGRESS');
      if (d) return { letter: l, disposition: d };
    }
    return null;
  }
}

export const whatsappService = new WhatsappService();
