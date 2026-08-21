import { isAtlasConnected, inMemoryDB } from '../config/database';
import {
  NumberCounterModel, NumberReservationModel, LetterTypeModel,
  OutgoingLetterModel, GeneralLetterModel, SopDocumentModel,
  PerdirDocumentModel, SkDocumentModel
} from '../models';
import { formatLetterNumber } from '../utils/formatter';
import { NumberStatus, ChannelType, SequenceScope, SequenceReset } from '../../types';
import { auditService } from './audit.service';

export interface ReserveParams {
  typeCode: string;
  unitCode?: string;
  title?: string;
  subject?: string;
  userId: string;
  userName: string;
  channel?: ChannelType;
  requestId?: string;
  year?: number;
  month?: number;
  instansi?: string;
}

export interface ReserveMultipleParams {
  typeCode: string;
  unitCode?: string;
  titles?: string[];
  subjects?: string[];
  title?: string;
  subject?: string;
  count: number;
  userId: string;
  userName: string;
  channel?: ChannelType;
  requestId?: string;
  year?: number;
  month?: number;
  instansi?: string;
}

export class NumberingService {

  /**
   * Generates the counter key based on LetterType sequence scope & reset configuration.
   */
  public generateCounterKey(
    typeCode: string,
    unitCode: string | undefined,
    scope: SequenceScope,
    reset: SequenceReset,
    year: number,
    month: number
  ): string {
    let base = '';
    switch (scope) {
      case SequenceScope.GLOBAL:
        base = 'GLOBAL';
        break;
      case SequenceScope.TYPE:
        base = `${typeCode}`;
        break;
      case SequenceScope.UNIT:
        base = `UNIT:${unitCode || 'GLOBAL'}`;
        break;
      case SequenceScope.TYPE_UNIT:
        base = `${typeCode}:${unitCode || 'GLOBAL'}`;
        break;
      case SequenceScope.TYPE_YEAR:
        base = `${typeCode}`;
        break;
      case SequenceScope.TYPE_UNIT_MONTH:
        base = `${typeCode}:${unitCode || 'GLOBAL'}`;
        break;
      case SequenceScope.TYPE_UNIT_YEAR:
      default:
        base = `${typeCode}:${unitCode || 'GLOBAL'}`;
        break;
    }

    if (reset === SequenceReset.MONTHLY) {
      const monthStr = String(month).padStart(2, '0');
      return `${base}:${year}:${monthStr}`;
    } else if (reset === SequenceReset.YEARLY) {
      return `${base}:${year}`;
    }

    return base;
  }

  /**
   * Preview formatted letter number without incrementing counter
   */
  public async previewNumber(params: {
    format: string;
    typeCode: string;
    unitCode?: string;
    padding?: number;
    instansi?: string;
    year?: number;
    month?: number;
    sampleSeq?: number;
  }): Promise<string> {
    const {
      format,
      typeCode,
      unitCode = 'ADM',
      padding = 3,
      instansi = 'RSSBK',
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      sampleSeq = 1
    } = params;

    return formatLetterNumber(format, {
      sequenceNumber: sampleSeq,
      padding,
      typeCode,
      unitCode,
      instansi,
      year,
      month
    });
  }

  /**
   * Atomic increment of sequence counter using MongoDB findOneAndUpdate ($inc) or synchronized map
   */
  public async getNextNumber(params: {
    typeCode: string;
    unitCode?: string;
    year?: number;
    month?: number;
  }): Promise<{ sequenceNumber: number; counterKey: string; letterType: any }> {
    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month || (now.getMonth() + 1);
    const { typeCode, unitCode } = params;

    let letterType: any = null;

    if (isAtlasConnected()) {
      letterType = await LetterTypeModel.findOne({ code: typeCode, isActive: true });
    } else {
      letterType = inMemoryDB.letterTypes.find(t => t.code === typeCode && t.isActive !== false);
    }

    if (!letterType) {
      // Fallback default configuration if type not registered
      letterType = {
        code: typeCode,
        name: typeCode,
        format: '{NO}/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
        scope: SequenceScope.TYPE_YEAR,
        resetSequence: SequenceReset.YEARLY,
        startingNumber: 1,
        padding: 3,
        requiresUnit: true,
        requiresTitle: true,
        requiresSubject: true
      };
    }

    const scope: SequenceScope = letterType.scope || SequenceScope.TYPE_YEAR;
    const reset: SequenceReset = letterType.resetSequence || SequenceReset.YEARLY;
    const counterKey = this.generateCounterKey(typeCode, unitCode, scope, reset, year, month);
    const startNum = letterType.startingNumber || 1;

    let sequenceNumber = startNum;

    if (isAtlasConnected()) {
      // Atomic MongoDB increment using findOneAndUpdate
      const counterDoc = await NumberCounterModel.findOneAndUpdate(
        { _id: counterKey },
        {
          $inc: { currentNumber: 1 },
          $setOnInsert: {
            typeCode,
            unitCode,
            year,
            month
          }
        },
        { upsert: true, new: true }
      );
      sequenceNumber = counterDoc ? (counterDoc as any).currentNumber : startNum;
    } else {
      // In-memory atomic increment
      const current = inMemoryDB.numberCounters.get(counterKey) || (startNum - 1);
      sequenceNumber = current + 1;
      inMemoryDB.numberCounters.set(counterKey, sequenceNumber);
    }

    return { sequenceNumber, counterKey, letterType };
  }

  /**
   * Reserve a letter number with Idempotency safeguard & Atomic Counter
   */
  public async reserveNumber(params: ReserveParams): Promise<any> {
    const {
      typeCode,
      unitCode = 'ADM',
      title = '',
      subject = '',
      userId,
      userName,
      channel = ChannelType.WEB,
      requestId,
      instansi = 'RSSBK'
    } = params;

    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month || (now.getMonth() + 1);

    // 1. Idempotency Check: if requestId supplied and already exists, return existing reservation
    if (requestId) {
      let existing = null;
      if (isAtlasConnected()) {
        existing = await NumberReservationModel.findOne({ requestId });
      } else {
        existing = inMemoryDB.numberReservations.find(r => r.requestId === requestId);
      }

      if (existing) {
        console.log(`⚡ Idempotency match for requestId: ${requestId}. Returning reserved number: ${existing.number}`);
        return existing;
      }
    }

    // 2. Atomic increment
    const { sequenceNumber, letterType } = await this.getNextNumber({
      typeCode,
      unitCode,
      year,
      month
    });

    // 3. Format complete letter number
    const formattedNumber = formatLetterNumber(letterType.format, {
      sequenceNumber,
      padding: letterType.padding || 3,
      typeCode,
      unitCode,
      instansi,
      year,
      month
    });

    // 4. Save Reservation
    const reservationData = {
      id: `RES-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      number: formattedNumber,
      typeCode,
      unitCode,
      instansi,
      title,
      subject,
      status: NumberStatus.RESERVED,
      channel,
      userId,
      userName,
      requestId,
      createdAt: now.toISOString(),
      year,
      month,
      sequenceNumber
    };

    let resultDoc = null;

    if (isAtlasConnected()) {
      const doc = new NumberReservationModel(reservationData);
      await doc.save();
      resultDoc = doc.toObject();
    } else {
      inMemoryDB.numberReservations.unshift(reservationData);
      resultDoc = reservationData;
    }

    // Auto-sync reservation into Management Modules (Surat Keluar, Dokumen Surat Umum, SPO, PERDIR, SK)
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      if (typeCode === 'UMUM') {
        const genData = {
          id: `GEN-SYNC-${Date.now()}`,
          number: formattedNumber,
          date: todayStr,
          unitCode: unitCode || 'ADM',
          subject: subject || title || 'Penomoran Surat Umum',
          summary: `Nomor diambil via ${channel} oleh ${userName}`,
          signer: userName || 'Admin RS Sebening Kasih',
          status: NumberStatus.RESERVED,
          channel: channel,
          createdAt: now.toISOString()
        };
        if (isAtlasConnected()) {
          await GeneralLetterModel.updateOne({ number: formattedNumber }, genData, { upsert: true });
        } else {
          const idx = inMemoryDB.generalLetters.findIndex(g => g.number === formattedNumber);
          if (idx >= 0) inMemoryDB.generalLetters[idx] = genData;
          else inMemoryDB.generalLetters.unshift(genData);
        }
      }

      // Always auto-sync into Outgoing Letters for general letter management tracking
      const outgoingData = {
        id: `OUT-SYNC-${Date.now()}`,
        typeCode: typeCode || 'UMUM',
        number: formattedNumber,
        letterNumber: formattedNumber,
        date: todayStr,
        unitCode: unitCode || 'ADM',
        title: title || subject || `Nomor Surat ${typeCode}`,
        subject: subject || title || `Penomoran otomatis via ${channel}`,
        recipient: 'Instansi / Internal RS',
        signer: userName || 'Direktur RS Sebening Kasih',
        signerTitle: 'Direktur / Penanggung Jawab',
        status: NumberStatus.RESERVED,
        channel: channel,
        createdAt: now.toISOString()
      };
      if (isAtlasConnected()) {
        await OutgoingLetterModel.updateOne({ number: formattedNumber }, outgoingData, { upsert: true });
      } else {
        const idx = inMemoryDB.outgoingLetters.findIndex(o => o.number === formattedNumber || o.letterNumber === formattedNumber);
        if (idx >= 0) inMemoryDB.outgoingLetters[idx] = outgoingData;
        else inMemoryDB.outgoingLetters.unshift(outgoingData);
      }

      if (typeCode === 'SPO') {
        const sopData = {
          id: `SPO-SYNC-${Date.now()}`,
          number: formattedNumber,
          unitCode: unitCode || 'KEP',
          title: title || subject || 'Standard Prosedur Operasional',
          purpose: 'Prosedur Operasional Standar',
          scope: 'Internal RS Sebening Kasih',
          policy: 'SK Direktur',
          procedure: 'Langkah-langkah terlampir',
          effectiveDate: todayStr,
          version: '1.0',
          pic: userName,
          status: 'RESERVED',
          channel: channel,
          createdAt: now.toISOString()
        };
        if (isAtlasConnected()) {
          await SopDocumentModel.updateOne({ number: formattedNumber }, sopData, { upsert: true });
        } else {
          const idx = inMemoryDB.sopDocuments.findIndex(s => s.number === formattedNumber);
          if (idx >= 0) inMemoryDB.sopDocuments[idx] = sopData;
          else inMemoryDB.sopDocuments.unshift(sopData);
        }
      }

      if (typeCode === 'PERDIR') {
        const perdirData = {
          id: `PERDIR-SYNC-${Date.now()}`,
          number: formattedNumber,
          title: title || subject || 'Peraturan Direksi',
          about: subject || title || 'Peraturan Direksi',
          legalBasis: 'UU Rumah Sakit',
          body: 'Mengingat dan Menimbang...',
          signer: userName || 'Direktur Utama',
          date: todayStr,
          status: 'RESERVED',
          channel: channel,
          createdAt: now.toISOString()
        };
        if (isAtlasConnected()) {
          await PerdirDocumentModel.updateOne({ number: formattedNumber }, perdirData, { upsert: true });
        } else {
          const idx = inMemoryDB.perdirDocuments.findIndex(p => p.number === formattedNumber);
          if (idx >= 0) inMemoryDB.perdirDocuments[idx] = perdirData;
          else inMemoryDB.perdirDocuments.unshift(perdirData);
        }
      }

      if (typeCode === 'SK') {
        const skData = {
          id: `SK-SYNC-${Date.now()}`,
          number: formattedNumber,
          title: title || subject || 'Surat Keputusan Direksi',
          about: subject || title || 'Surat Keputusan',
          basis: 'Kebijakan Direksi',
          considering: 'Menimbang kebutuhan operasional',
          inViewOf: 'Mengingat Peraturan RS',
          decides: 'MEMUTUSKAN',
          enactment: 'Ditetapkan di Pati',
          signer: userName || 'Direktur Utama',
          date: todayStr,
          status: 'RESERVED',
          channel: channel,
          createdAt: now.toISOString()
        };
        if (isAtlasConnected()) {
          await SkDocumentModel.updateOne({ number: formattedNumber }, skData, { upsert: true });
        } else {
          const idx = inMemoryDB.skDocuments.findIndex(sk => sk.number === formattedNumber);
          if (idx >= 0) inMemoryDB.skDocuments[idx] = skData;
          else inMemoryDB.skDocuments.unshift(skData);
        }
      }
    } catch (syncErr) {
      console.warn('⚠️ Auto-sync reservation warning:', syncErr);
    }

    // 5. Audit Log
    await auditService.log({
      userId,
      userName,
      action: 'RESERVE_NUMBER',
      entity: 'NumberReservation',
      entityId: formattedNumber,
      channel,
      after: resultDoc
    });

    return resultDoc;
  }

  /**
   * Resolve the active letter type and fallback configuration.
   */
  private async getLetterType(typeCode: string): Promise<any> {
    let letterType: any = null;

    if (isAtlasConnected()) {
      letterType = await LetterTypeModel.findOne({
        code: typeCode,
        isActive: true
      });
    } else {
      letterType = inMemoryDB.letterTypes.find(
        t => t.code === typeCode && t.isActive !== false
      );
    }

    if (!letterType) {
      letterType = {
        code: typeCode,
        name: typeCode,
        format: '{NO}/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
        scope: SequenceScope.TYPE_YEAR,
        resetSequence: SequenceReset.YEARLY,
        startingNumber: 1,
        padding: 3,
        requiresUnit: true,
        requiresTitle: true,
        requiresSubject: true
      };
    }

    return letterType;
  }

  /**
   * Reserve multiple letter numbers in one atomic batch.
   * MongoDB Atlas: counter allocation + reservations are committed together.
   * In-memory mode: allocation is synchronous and sequential.
   */
  public async reserveMultipleNumbers(params: ReserveMultipleParams): Promise<any> {
    const count = Number(params.count);

    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Jumlah nomor minimal 1.');
    }

    if (count > 100) {
      throw new Error('Maksimal 100 nomor dalam satu transaksi.');
    }

    const {
      typeCode,
      unitCode = 'ADM',
      userId,
      userName,
      channel = ChannelType.WEB,
      requestId,
      instansi = 'RSSBK'
    } = params;

    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month || (now.getMonth() + 1);

    const letterType = await this.getLetterType(typeCode);
    const scope: SequenceScope = letterType.scope || SequenceScope.TYPE_YEAR;
    const reset: SequenceReset = letterType.resetSequence || SequenceReset.YEARLY;
    const counterKey = this.generateCounterKey(
      typeCode,
      unitCode,
      scope,
      reset,
      year,
      month
    );
    const startNum = Number(letterType.startingNumber || 1);
    const padding = Number(letterType.padding || 3);

    // Idempotency for bulk requests: reuse the whole existing batch.
    if (requestId) {
      let existing: any[] = [];

      if (isAtlasConnected()) {
        const escaped = requestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        existing = await NumberReservationModel.find({
          requestId: { $regex: `^${escaped}-\\d+$` }
        }).sort({ sequenceNumber: 1 });
      } else {
        existing = inMemoryDB.numberReservations
          .filter(r => typeof r.requestId === 'string' && r.requestId.startsWith(`${requestId}-`))
          .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
      }

      if (existing.length > 0) {
        console.log(
          `⚡ Bulk idempotency match for requestId: ${requestId}. Returning ${existing.length} reserved numbers.`
        );
        return {
          batchId: requestId,
          count: existing.length,
          reservations: existing
        };
      }
    }

    const subjects = Array.isArray(params.subjects) ? params.subjects : [];
    const titles = Array.isArray(params.titles) ? params.titles : [];

    const buildSubject = (index: number) => {
      if (subjects.length > 0) return subjects[index] || params.subject || params.title || '';
      return params.subject || params.title || '';
    };

    const buildTitle = (index: number) => {
      if (titles.length > 0) return titles[index] || params.title || params.subject || '';
      return params.title || params.subject || '';
    };

    const reservations: any[] = [];

    if (isAtlasConnected()) {
      const session = await NumberCounterModel.db.startSession();

      try {
        session.startTransaction();

        // Ensure the counter exists with the configured starting point.
        await NumberCounterModel.findOneAndUpdate(
          { _id: counterKey },
          {
            $setOnInsert: {
              currentNumber: startNum - 1,
              typeCode,
              unitCode,
              year,
              month
            }
          },
          {
            upsert: true,
            new: false,
            session
          }
        );

        // One atomic increment for the whole batch.
        const counterDoc = await NumberCounterModel.findOneAndUpdate(
          { _id: counterKey },
          {
            $inc: { currentNumber: count }
          },
          {
            new: true,
            session
          }
        );

        if (!counterDoc) {
          throw new Error('Counter nomor surat tidak dapat dibuat.');
        }

        const lastSequence = Number((counterDoc as any).currentNumber);
        const firstSequence = lastSequence - count + 1;

        for (let i = 0; i < count; i++) {
          const sequenceNumber = firstSequence + i;
          const formattedNumber = formatLetterNumber(
            letterType.format,
            {
              sequenceNumber,
              padding,
              typeCode,
              unitCode,
              instansi,
              year,
              month
            }
          );

          const reservationData = {
            id: `RES-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
            number: formattedNumber,
            typeCode,
            unitCode,
            instansi,
            title: buildTitle(i),
            subject: buildSubject(i),
            status: NumberStatus.RESERVED,
            channel,
            userId,
            userName,
            requestId: requestId ? `${requestId}-${i + 1}` : undefined,
            createdAt: now.toISOString(),
            year,
            month,
            sequenceNumber
          };

          const doc = new NumberReservationModel(reservationData);
          await doc.save({ session });
          reservations.push(doc.toObject());
        }

        // Auto-sync each reserved number within the same transaction.
        for (const reservation of reservations) {
          await this.syncReservationDocuments(
            reservation,
            session
          );
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      // In-memory allocation: synchronous update of the batch counter.
      const current = inMemoryDB.numberCounters.get(counterKey) || (startNum - 1);
      const firstSequence = current + 1;
      const lastSequence = current + count;
      inMemoryDB.numberCounters.set(counterKey, lastSequence);

      for (let i = 0; i < count; i++) {
        const sequenceNumber = firstSequence + i;
        const formattedNumber = formatLetterNumber(
          letterType.format,
          {
            sequenceNumber,
            padding,
            typeCode,
            unitCode,
            instansi,
            year,
            month
          }
        );

        const reservationData = {
          id: `RES-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
          number: formattedNumber,
          typeCode,
          unitCode,
          instansi,
          title: buildTitle(i),
          subject: buildSubject(i),
          status: NumberStatus.RESERVED,
          channel,
          userId,
          userName,
          requestId: requestId ? `${requestId}-${i + 1}` : undefined,
          createdAt: now.toISOString(),
          year,
          month,
          sequenceNumber
        };

        inMemoryDB.numberReservations.unshift(reservationData);
        reservations.push(reservationData);
      }

      for (const reservation of reservations) {
        await this.syncReservationDocuments(reservation);
      }
    }

    for (const reservation of reservations) {
      await auditService.log({
        userId,
        userName,
        action: 'RESERVE_NUMBER_BULK',
        entity: 'NumberReservation',
        entityId: reservation.number,
        channel,
        after: reservation
      });
    }

    return {
      batchId: requestId || `BATCH-${Date.now()}`,
      count: reservations.length,
      reservations
    };
  }

  /**
   * Synchronize a reserved number with the management modules.
   * Optional MongoDB session allows it to participate in the bulk transaction.
   */
  private async syncReservationDocuments(reservation: any, session?: any): Promise<void> {
    const {
      number: formattedNumber,
      typeCode,
      unitCode,
      title,
      subject,
      channel,
      userName,
      createdAt,
    } = reservation;

    const todayStr = new Date().toISOString().split('T')[0];
    const options = session ? { session } : undefined;

    if (typeCode === 'UMUM') {
      const genData = {
        id: `GEN-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        number: formattedNumber,
        date: todayStr,
        unitCode: unitCode || 'ADM',
        subject: subject || title || 'Penomoran Surat Umum',
        summary: `Nomor diambil via ${channel} oleh ${userName}`,
        signer: userName || 'Admin RS Sebening Kasih',
        status: NumberStatus.RESERVED,
        channel,
        createdAt
      };

      if (isAtlasConnected()) {
        await GeneralLetterModel.updateOne(
          { number: formattedNumber },
          genData,
          { upsert: true, ...(options || {}) }
        );
      } else {
        const idx = inMemoryDB.generalLetters.findIndex(
          g => g.number === formattedNumber
        );
        if (idx >= 0) inMemoryDB.generalLetters[idx] = genData;
        else inMemoryDB.generalLetters.unshift(genData);
      }
    }

    const outgoingData = {
      id: `OUT-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      typeCode: typeCode || 'UMUM',
      number: formattedNumber,
      letterNumber: formattedNumber,
      date: todayStr,
      unitCode: unitCode || 'ADM',
      title: title || subject || `Nomor Surat ${typeCode}`,
      subject: subject || title || `Penomoran otomatis via ${channel}`,
      recipient: 'Instansi / Internal RS',
      signer: userName || 'Direktur RS Sebening Kasih',
      signerTitle: 'Direktur / Penanggung Jawab',
      status: NumberStatus.RESERVED,
      channel,
      createdAt
    };

    if (isAtlasConnected()) {
      await OutgoingLetterModel.updateOne(
        { number: formattedNumber },
        outgoingData,
        { upsert: true, ...(options || {}) }
      );
    } else {
      const idx = inMemoryDB.outgoingLetters.findIndex(
        o => o.number === formattedNumber || o.letterNumber === formattedNumber
      );
      if (idx >= 0) inMemoryDB.outgoingLetters[idx] = outgoingData;
      else inMemoryDB.outgoingLetters.unshift(outgoingData);
    }

    if (typeCode === 'SPO') {
      const sopData = {
        id: `SPO-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        number: formattedNumber,
        unitCode: unitCode || 'KEP',
        title: title || subject || 'Standard Prosedur Operasional',
        purpose: 'Prosedur Operasional Standar',
        scope: 'Internal RS Sebening Kasih',
        policy: 'SK Direktur',
        procedure: 'Langkah-langkah terlampir',
        effectiveDate: todayStr,
        version: '1.0',
        pic: userName,
        status: 'RESERVED',
        channel,
        createdAt
      };

      if (isAtlasConnected()) {
        await SopDocumentModel.updateOne(
          { number: formattedNumber },
          sopData,
          { upsert: true, ...(options || {}) }
        );
      } else {
        const idx = inMemoryDB.sopDocuments.findIndex(
          s => s.number === formattedNumber
        );
        if (idx >= 0) inMemoryDB.sopDocuments[idx] = sopData;
        else inMemoryDB.sopDocuments.unshift(sopData);
      }
    }

    if (typeCode === 'PERDIR') {
      const perdirData = {
        id: `PERDIR-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        number: formattedNumber,
        title: title || subject || 'Peraturan Direksi',
        about: subject || title || 'Peraturan Direksi',
        legalBasis: 'UU Rumah Sakit',
        body: 'Mengingat dan Menimbang...',
        signer: userName || 'Direktur Utama',
        date: todayStr,
        status: 'RESERVED',
        channel,
        createdAt
      };

      if (isAtlasConnected()) {
        await PerdirDocumentModel.updateOne(
          { number: formattedNumber },
          perdirData,
          { upsert: true, ...(options || {}) }
        );
      } else {
        const idx = inMemoryDB.perdirDocuments.findIndex(
          p => p.number === formattedNumber
        );
        if (idx >= 0) inMemoryDB.perdirDocuments[idx] = perdirData;
        else inMemoryDB.perdirDocuments.unshift(perdirData);
      }
    }

    if (typeCode === 'SK') {
      const skData = {
        id: `SK-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        number: formattedNumber,
        title: title || subject || 'Surat Keputusan Direksi',
        about: subject || title || 'Surat Keputusan',
        basis: 'Kebijakan Direksi',
        considering: 'Menimbang kebutuhan operasional',
        inViewOf: 'Mengingat Peraturan RS',
        decides: 'MEMUTUSKAN',
        enactment: 'Ditetapkan di Pati',
        signer: userName || 'Direktur Utama',
        date: todayStr,
        status: 'RESERVED',
        channel,
        createdAt
      };

      if (isAtlasConnected()) {
        await SkDocumentModel.updateOne(
          { number: formattedNumber },
          skData,
          { upsert: true, ...(options || {}) }
        );
      } else {
        const idx = inMemoryDB.skDocuments.findIndex(
          sk => sk.number === formattedNumber
        );
        if (idx >= 0) inMemoryDB.skDocuments[idx] = skData;
        else inMemoryDB.skDocuments.unshift(skData);
      }
    }
  }

  /**
   * Issue a reserved number (status becomes ISSUED)
   */
  public async issueNumber(numberOrId: string, userId: string, userName: string): Promise<any> {
    let reservation = null;

    if (isAtlasConnected()) {
      reservation = await NumberReservationModel.findOne({
        $or: [{ id: numberOrId }, { number: numberOrId }]
      });
      if (reservation) {
        reservation.status = NumberStatus.ISSUED;
        reservation.issuedAt = new Date();
        await reservation.save();
      }
    } else {
      reservation = inMemoryDB.numberReservations.find(
        r => r.id === numberOrId || r.number === numberOrId
      );
      if (reservation) {
        reservation.status = NumberStatus.ISSUED;
        reservation.issuedAt = new Date().toISOString();
      }
    }

    if (!reservation) {
      throw new Error(`Nomor ${numberOrId} tidak ditemukan.`);
    }

    await auditService.log({
      userId,
      userName,
      action: 'ISSUE_NUMBER',
      entity: 'NumberReservation',
      entityId: reservation.number,
      channel: ChannelType.WEB,
      after: reservation
    });

    return reservation;
  }

  /**
   * Cancel a reserved number with explicit reason (status becomes CANCELLED)
   */
  public async cancelNumber(numberOrId: string, reason: string, userId: string, userName: string): Promise<any> {
    let reservation = null;

    if (isAtlasConnected()) {
      reservation = await NumberReservationModel.findOne({
        $or: [{ id: numberOrId }, { number: numberOrId }]
      });
      if (reservation) {
        reservation.status = reservation.status === NumberStatus.ISSUED ? NumberStatus.VOID : NumberStatus.CANCELLED;
        reservation.cancelReason = reason;
        reservation.cancelledAt = new Date();
        await reservation.save();
      }
    } else {
      reservation = inMemoryDB.numberReservations.find(
        r => r.id === numberOrId || r.number === numberOrId
      );
      if (reservation) {
        reservation.status = reservation.status === NumberStatus.ISSUED ? NumberStatus.VOID : NumberStatus.CANCELLED;
        reservation.cancelReason = reason;
        reservation.cancelledAt = new Date().toISOString();
      }
    }

    if (!reservation) {
      throw new Error(`Nomor ${numberOrId} tidak ditemukan.`);
    }

    await auditService.log({
      userId,
      userName,
      action: 'CANCEL_NUMBER',
      entity: 'NumberReservation',
      entityId: reservation.number,
      channel: ChannelType.WEB,
      after: { reason, status: reservation.status }
    });

    return reservation;
  }

  /**
   * Get status & detail of a specific letter number
   */
  public async getNumberStatus(numberStr: string): Promise<any> {
    if (isAtlasConnected()) {
      return await NumberReservationModel.findOne({ number: numberStr });
    } else {
      return inMemoryDB.numberReservations.find(r => r.number === numberStr) || null;
    }
  }

  /**
   * List all reservations with optional filters & pagination
   */
  public async listReservations(filters: {
    status?: string;
    typeCode?: string;
    unitCode?: string;
    search?: string;
  } = {}): Promise<any[]> {
    if (isAtlasConnected()) {
      const query: any = {};
      if (filters.status) query.status = filters.status;
      if (filters.typeCode) query.typeCode = filters.typeCode;
      if (filters.unitCode) query.unitCode = filters.unitCode;
      if (filters.search) {
        query.$or = [
          { number: new RegExp(filters.search, 'i') },
          { subject: new RegExp(filters.search, 'i') },
          { title: new RegExp(filters.search, 'i') },
          { userName: new RegExp(filters.search, 'i') }
        ];
      }
      return await NumberReservationModel.find(query).sort({ createdAt: -1 });
    } else {
      let list = [...inMemoryDB.numberReservations];
      if (filters.status) list = list.filter(r => r.status === filters.status);
      if (filters.typeCode) list = list.filter(r => r.typeCode === filters.typeCode);
      if (filters.unitCode) list = list.filter(r => r.unitCode === filters.unitCode);
      if (filters.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(r =>
          (r.number && r.number.toLowerCase().includes(s)) ||
          (r.subject && r.subject.toLowerCase().includes(s)) ||
          (r.title && r.title.toLowerCase().includes(s)) ||
          (r.userName && r.userName.toLowerCase().includes(s))
        );
      }
      return list;
    }
  }

  /**
   * Set sequence counter value for a given typeCode
   */
  public async setCounter(typeCode: string, sequenceNumber: number, year?: number, unitCode?: string): Promise<any> {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let letterType: any = null;
    if (isAtlasConnected()) {
      letterType = await LetterTypeModel.findOne({ code: typeCode });
    } else {
      letterType = inMemoryDB.letterTypes.find(t => t.code === typeCode);
    }

    const scope = letterType?.scope || SequenceScope.TYPE_YEAR;
    const reset = letterType?.resetSequence || SequenceReset.YEARLY;
    const counterKey = this.generateCounterKey(typeCode, unitCode || 'ADM', scope, reset, currentYear, currentMonth);

    if (isAtlasConnected()) {
      await NumberCounterModel.findOneAndUpdate(
        { _id: counterKey },
        { currentNumber: sequenceNumber, typeCode, unitCode: unitCode || 'ADM', year: currentYear },
        { upsert: true, new: true }
      );
    }
    inMemoryDB.numberCounters.set(counterKey, sequenceNumber);

    if (letterType) {
      letterType.startingNumber = sequenceNumber + 1;
      if (isAtlasConnected()) {
        await LetterTypeModel.updateOne({ code: typeCode }, { startingNumber: sequenceNumber + 1 });
      }
    }

    return { counterKey, sequenceNumber };
  }

  /**
   * Reset all transaction data (reservations, outgoing, general, SPO, audit) for clean production launch
   */
  public async resetTransactions(): Promise<void> {
    if (isAtlasConnected()) {
      await NumberReservationModel.deleteMany({});
      await OutgoingLetterModel.deleteMany({});
      await GeneralLetterModel.deleteMany({});
      await SopDocumentModel.deleteMany({});
      await PerdirDocumentModel.deleteMany({});
      await SkDocumentModel.deleteMany({});
      await NumberCounterModel.deleteMany({});
    }
    inMemoryDB.numberReservations = [];
    inMemoryDB.outgoingLetters = [];
    inMemoryDB.generalLetters = [];
    inMemoryDB.sopDocuments = [];
    inMemoryDB.perdirDocuments = [];
    inMemoryDB.skDocuments = [];
    inMemoryDB.numberCounters.clear();
  }
}

export const numberingService = new NumberingService();

