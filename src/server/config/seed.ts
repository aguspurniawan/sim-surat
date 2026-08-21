import bcrypt from 'bcryptjs';
import { isAtlasConnected, inMemoryDB } from './database';
import {
  UserModel, UnitModel, LetterTypeModel, LetterTemplateModel,
  IncomingLetterModel, OutgoingLetterModel, SopDocumentModel,
  PerdirDocumentModel, SkDocumentModel, GeneralLetterModel,
  NumberReservationModel, AuditLogModel
} from '../models';
import { RoleName, ChannelType, NumberStatus, SequenceScope, SequenceReset } from '../../types';

export async function seedInitialData() {
  console.log('🌱 Checking and initializing seed data...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Initial Users
  const defaultUsers = [
    {
      id: 'usr-1',
      username: 'superadmin',
      password: hashedPassword,
      fullName: 'Super Administrator',
      email: 'superadmin@rssbk.co.id',
      role: RoleName.SUPER_ADMIN,
      unitCode: 'ADM',
      telegramAccountId: 'tg_superadmin',
      whatsappJid: '6281111111111@s.whatsapp.net',
      isActive: true
    },
    {
      id: 'usr-2',
      username: 'admin',
      password: hashedPassword,
      fullName: 'Sekretariat RS',
      email: 'admin@rssbk.co.id',
      role: RoleName.SEKRETARIAT,
      unitCode: 'ADM',
      telegramAccountId: 'tg_sekretariat',
      whatsappJid: '6281234567890@s.whatsapp.net',
      isActive: true
    },
    {
      id: 'usr-3',
      username: 'pimpinan',
      password: hashedPassword,
      fullName: 'dr. H. Budi Santoso, Sp.A (Direktur)',
      email: 'direktur@rssbk.co.id',
      role: RoleName.PIMPINAN,
      unitCode: 'ADM',
      telegramAccountId: 'tg_direktur',
      whatsappJid: '6281298765432@s.whatsapp.net',
      isActive: true
    },
    {
      id: 'usr-4',
      username: 'sdm',
      password: hashedPassword,
      fullName: 'Siti Rahmawati (Kepala SDM)',
      email: 'sdm@rssbk.co.id',
      role: RoleName.STAFF,
      unitCode: 'SDM',
      telegramAccountId: 'tg_sdm',
      whatsappJid: '6281311223344@s.whatsapp.net',
      isActive: true
    },
    {
      id: 'usr-5',
      username: 'keperawatan',
      password: hashedPassword,
      fullName: 'Ahmad Subandi (Kepala Keperawatan)',
      email: 'keperawatan@rssbk.co.id',
      role: RoleName.USER,
      unitCode: 'KEP',
      telegramAccountId: 'tg_keperawatan',
      whatsappJid: '6281355667788@s.whatsapp.net',
      isActive: true
    },
    {
      id: 'usr-6',
      username: 'viewer',
      password: hashedPassword,
      fullName: 'Dewi Lestari (Auditor)',
      email: 'viewer@rssbk.co.id',
      role: RoleName.VIEWER,
      unitCode: 'MUTU',
      telegramAccountId: 'tg_mutu',
      whatsappJid: '6281399887766@s.whatsapp.net',
      isActive: true
    }
  ];

  // 2. Units (KEP, SDM, ADM, MUTU, FAR, LAB)
  const defaultUnits = [
    { id: 'u-1', code: 'KEP', name: 'Keperawatan', description: 'Divisi Pelayanan Keperawatan & Kebidanan', isActive: true },
    { id: 'u-2', code: 'SDM', name: 'Sumber Daya Manusia', description: 'Divisi Kepegawaian & Diklat', isActive: true },
    { id: 'u-3', code: 'ADM', name: 'Administrasi', description: 'Sekretariat & Administrasi Umum', isActive: true },
    { id: 'u-4', code: 'MUTU', name: 'Komite Mutu', description: 'Komite Peningkatan Mutu & Keselamatan Pasien', isActive: true },
    { id: 'u-5', code: 'FAR', name: 'Farmasi', description: 'Instalasi Farmasi RS', isActive: true },
    { id: 'u-6', code: 'LAB', name: 'Laboratorium', description: 'Instalasi Laboratorium Klinik', isActive: true }
  ];

  // 3. Letter Types (SPO, PERDIR, SK, UMUM)
  const defaultLetterTypes = [
    {
      id: 'lt-1',
      code: 'SPO',
      name: 'Standard Operating Procedure',
      format: '{NO}/SPO/{UNIT}/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
      scope: SequenceScope.TYPE_UNIT_YEAR,
      resetSequence: SequenceReset.YEARLY,
      startingNumber: 1,
      padding: 3,
      requiresUnit: true,
      requiresTitle: true,
      requiresSubject: false,
      isActive: true,
      isLocked: true
    },
    {
      id: 'lt-2',
      code: 'PERDIR',
      name: 'Peraturan Direksi',
      format: '{NO}/PERDIR/DIR/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
      scope: SequenceScope.TYPE_YEAR,
      resetSequence: SequenceReset.YEARLY,
      startingNumber: 1,
      padding: 3,
      requiresUnit: false,
      requiresTitle: true,
      requiresSubject: false,
      isActive: true,
      isLocked: true
    },
    {
      id: 'lt-3',
      code: 'SK',
      name: 'Surat Keputusan',
      format: '{NO}/SK/DIR/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
      scope: SequenceScope.TYPE_UNIT_YEAR,
      resetSequence: SequenceReset.YEARLY,
      startingNumber: 1,
      padding: 3,
      requiresUnit: false,
      requiresTitle: true,
      requiresSubject: false,
      isActive: true,
      isLocked: true
    },
    {
      id: 'lt-4',
      code: 'UMUM',
      name: 'Surat Umum / Dinas',
      format: '{NO}/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
      scope: SequenceScope.TYPE_YEAR,
      resetSequence: SequenceReset.YEARLY,
      startingNumber: 1,
      padding: 3,
      requiresUnit: false,
      requiresTitle: false,
      requiresSubject: true,
      isActive: true,
      isLocked: false
    }
  ];

  // 4. Templates
  const defaultTemplates = [
    { id: 'tpl-1', title: 'SPTJM Pelayanan', category: 'UMUM', contentPattern: 'SPTJM Pelayanan Bulan {BULAN} {TAHUN}', variables: ['BULAN', 'TAHUN'] },
    { id: 'tpl-2', title: 'Penghapusan Jadwal HFIS Dokter', category: 'UMUM', contentPattern: 'Pemberitahuan Penghapusan Jadwal HFIS Dokter Spesialis', variables: [] },
    { id: 'tpl-3', title: 'Undangan Kegiatan', category: 'UMUM', contentPattern: 'Undangan {KEGIATAN}', variables: ['KEGIATAN'] },
    { id: 'tpl-4', title: 'Pemberitahuan Kegiatan', category: 'UMUM', contentPattern: 'Pemberitahuan {KEGIATAN}', variables: ['KEGIATAN'] },
    { id: 'tpl-5', title: 'Permohonan Keperluan', category: 'UMUM', contentPattern: 'Permohonan {KEPERLUAN}', variables: ['KEPERLUAN'] }
  ];

  // 5. Initial Sample Reservations
  const defaultReservations = [
    {
      id: 'RES-001',
      number: '001/SPO/KEP/RSSBK/VIII/2026',
      typeCode: 'SPO',
      unitCode: 'KEP',
      instansi: 'RSSBK',
      title: 'Prosedur Triase Pasien Gawat Darurat',
      subject: '',
      status: NumberStatus.ISSUED,
      channel: ChannelType.WEB,
      userId: 'usr-2',
      userName: 'Sekretariat RS',
      createdAt: new Date('2026-08-01T08:00:00.000Z').toISOString(),
      year: 2026,
      month: 8,
      sequenceNumber: 1
    },
    {
      id: 'RES-002',
      number: '001/PERDIR/RSSBK/VIII/2026',
      typeCode: 'PERDIR',
      unitCode: 'ADM',
      instansi: 'RSSBK',
      title: 'Peraturan Tata Tertib Pelayanan Rawat Inap',
      subject: '',
      status: NumberStatus.ISSUED,
      channel: ChannelType.WEB,
      userId: 'usr-3',
      userName: 'dr. H. Budi Santoso',
      createdAt: new Date('2026-08-02T09:30:00.000Z').toISOString(),
      year: 2026,
      month: 8,
      sequenceNumber: 1
    },
    {
      id: 'RES-003',
      number: '001/SK/SDM/RSSBK/VIII/2026',
      typeCode: 'SK',
      unitCode: 'SDM',
      instansi: 'RSSBK',
      title: 'Pengangkatan Tim Penanggulangan Bencana',
      subject: '',
      status: NumberStatus.APPROVED,
      channel: ChannelType.TELEGRAM,
      userId: 'usr-4',
      userName: 'Siti Rahmawati (Telegram)',
      createdAt: new Date('2026-08-05T10:15:00.000Z').toISOString(),
      year: 2026,
      month: 8,
      sequenceNumber: 1
    },
    {
      id: 'RES-004',
      number: '001/RSSBK/VIII/2026',
      typeCode: 'UMUM',
      unitCode: 'ADM',
      instansi: 'RSSBK',
      title: 'SPTJM Pelayanan Bulan Agustus 2026',
      subject: 'SPTJM Pelayanan Bulan Agustus 2026',
      status: NumberStatus.RESERVED,
      channel: ChannelType.WEB,
      userId: 'usr-2',
      userName: 'Sekretariat RS',
      createdAt: new Date('2026-08-10T11:00:00.000Z').toISOString(),
      year: 2026,
      month: 8,
      sequenceNumber: 1
    },
    {
      id: 'RES-005',
      number: '002/RSSBK/VIII/2026',
      typeCode: 'UMUM',
      unitCode: 'ADM',
      instansi: 'RSSBK',
      title: 'Pemberitahuan Penghapusan Jadwal HFIS Dokter Spesialis',
      subject: 'Pemberitahuan Penghapusan Jadwal HFIS Dokter Spesialis',
      status: NumberStatus.RESERVED,
      channel: ChannelType.WHATSAPP,
      userId: '6281234567890@s.whatsapp.net',
      userName: 'WA User (WhatsApp)',
      createdAt: new Date('2026-08-11T14:20:00.000Z').toISOString(),
      year: 2026,
      month: 8,
      sequenceNumber: 2
    }
  ];

  // 6. Initial Sample Incoming Letters
  const defaultIncomingLetters = [
    {
      id: 'INC-2026-001',
      agendaNumber: 'SM-2026-00001',
      letterNumber: '440/123/DINKES/VIII/2026',
      letterDate: '2026-08-10',
      receivedDate: '2026-08-11',
      sender: 'Dinas Kesehatan Kabupaten',
      senderAddress: 'Jl. Kesehatan No. 10, Pati',
      subject: 'Koordinasi Pelayanan Akreditasi Rumah Sakit Tahun 2026',
      recipient: 'Direktur RS Sebening Kasih',
      receiverUnitCode: 'ADM',
      classification: 'Penting',
      urgency: 'Segera',
      attachments: ['Undangan_Dinkes.pdf'],
      fileName: 'Undangan_Dinkes.pdf',
      fileUrl: '/uploads/sample_undangan_dinkes.pdf',
      fileSize: '1.2 MB',
      mimeType: 'application/pdf',
      uploadedBy: 'Sekretariat RS (WhatsApp)',
      uploadedAt: '2026-08-11T08:30:00.000Z',
      channel: ChannelType.WHATSAPP,
      notes: 'Surat masuk diproses via WhatsApp Bot Baileys',
      status: 'DISPOSITIONED',
      dispositions: [
        {
          id: 'DISP-2026-00001',
          referenceNumber: 'DISP-2026-00001',
          incomingLetterId: 'INC-2026-001',
          fromUser: 'Sekretariat RS',
          fromJid: '6281234567890@s.whatsapp.net',
          toUserOrUnit: 'Siti Rahmawati (Kepala SDM)',
          toJid: '6281311223344@s.whatsapp.net',
          targetUnitCode: 'SDM',
          instruction: 'Tindak lanjuti penyiapan berkas personil akreditasi dan koordinasikan dengan Komite Mutu',
          deadline: '2026-08-20',
          status: 'APPROVED',
          approvedBy: 'dr. H. Budi Santoso, Sp.A (Direktur)',
          approvedAt: '2026-08-11T09:15:00.000Z',
          createdAt: new Date('2026-08-11T08:45:00.000Z').toISOString()
        }
      ],
      activityHistory: [
        {
          id: 'ACT-1',
          user: 'Sekretariat RS (WhatsApp)',
          action: 'UPLOAD',
          details: 'Surat masuk diterima dan diekstrak via Baileys WhatsApp Bot',
          timestamp: '2026-08-11T08:30:00.000Z'
        },
        {
          id: 'ACT-2',
          user: 'dr. H. Budi Santoso, Sp.A',
          action: 'APPROVE_DISPOSITION',
          details: 'Disposisi disetujui untuk diteruskan ke Kepala SDM',
          timestamp: '2026-08-11T09:15:00.000Z'
        }
      ],
      createdAt: '2026-08-11T08:30:00.000Z'
    }
  ];

  // Seed in-memory store always
  inMemoryDB.users = [...defaultUsers];
  inMemoryDB.units = [...defaultUnits];
  inMemoryDB.letterTypes = [...defaultLetterTypes];
  inMemoryDB.letterTemplates = [...defaultTemplates];
  inMemoryDB.numberReservations = [...defaultReservations];
  inMemoryDB.incomingLetters = [...defaultIncomingLetters];

  // Seed counters in memory
  inMemoryDB.numberCounters.set('SPO:KEP:2026', 1);
  inMemoryDB.numberCounters.set('GENERAL:2026', 2);

  // If Atlas is connected, insert missing seed records into Atlas
  if (isAtlasConnected()) {
    try {
      const userCount = await UserModel.countDocuments();
      if (userCount === 0) {
        await UserModel.insertMany(defaultUsers.map(u => ({ ...u, createdAt: new Date() })));
        console.log('✅ Seeded Users to MongoDB Atlas');
      }

      const unitCount = await UnitModel.countDocuments();
      if (unitCount === 0) {
        await UnitModel.insertMany(defaultUnits);
        console.log('✅ Seeded Units to MongoDB Atlas');
      }

      const typeCount = await LetterTypeModel.countDocuments();
      if (typeCount === 0) {
        await LetterTypeModel.insertMany(defaultLetterTypes);
        console.log('✅ Seeded LetterTypes to MongoDB Atlas');
      } else {
        // Migrasi aman: tambahkan default lock hanya pada jenis lama yang belum memiliki field isLocked.
        await LetterTypeModel.updateOne({ code: 'SPO', isLocked: { $exists: false } }, { $set: { isLocked: true } });
        await LetterTypeModel.updateOne({ code: 'PERDIR', isLocked: { $exists: false } }, { $set: { isLocked: true } });
        await LetterTypeModel.updateOne({ code: 'SK', isLocked: { $exists: false } }, { $set: { isLocked: true } });
        await LetterTypeModel.updateOne({ code: 'UMUM', isLocked: { $exists: false } }, { $set: { isLocked: false } });
        console.log('✅ LetterType lock defaults checked');
      }

      const tplCount = await LetterTemplateModel.countDocuments();
      if (tplCount === 0) {
        await LetterTemplateModel.insertMany(defaultTemplates);
        console.log('✅ Seeded LetterTemplates to MongoDB Atlas');
      }

      const resCount = await NumberReservationModel.countDocuments();
      if (resCount === 0) {
        await NumberReservationModel.insertMany(defaultReservations.map(r => ({ ...r, createdAt: new Date(r.createdAt) })));
        console.log('✅ Seeded NumberReservations to MongoDB Atlas');
      }
    } catch (e) {
      console.warn('⚠️ Seed error in Atlas:', e);
    }
  }

  console.log('🌱 Seed initialization completed successfully!');
}