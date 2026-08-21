import { isAtlasConnected, inMemoryDB } from '../config/database';
import { IncomingLetterModel, UserModel, UnitModel } from '../models';
import { IIncomingLetter, IDisposition, ChannelType } from '../../types';
import { auditService } from './audit.service';

export class IncomingLetterService {
  /**
   * Generate next sequential Agenda Number: SM-YYYY-00001
   */
  public async getNextAgendaNumber(year: number = new Date().getFullYear()): Promise<string> {
    let count = 0;
    if (isAtlasConnected()) {
      count = await IncomingLetterModel.countDocuments({
        createdAt: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`)
        }
      });
    } else {
      count = inMemoryDB.incomingLetters.length;
    }
    const seq = (count + 1).toString().padStart(5, '0');
    return `SM-${year}-${seq}`;
  }

  /**
   * Generate next sequential Disposition Reference ID: DISP-YYYY-00001
   */
  public async getNextDispositionId(year: number = new Date().getFullYear()): Promise<string> {
    let count = 0;
    if (isAtlasConnected()) {
      const letters = await IncomingLetterModel.find({
        'dispositions.0': { $exists: true }
      });
      letters.forEach(l => {
        count += (l.dispositions?.length || 0);
      });
    } else {
      inMemoryDB.incomingLetters.forEach(l => {
        count += (l.dispositions?.length || 0);
      });
    }
    const seq = (count + 1).toString().padStart(5, '0');
    return `DISP-${year}-${seq}`;
  }

  /**
   * Create a new Incoming Letter entry
   */
  public async createIncomingLetter(params: {
    letterNumber: string;
    letterDate: string;
    receivedDate?: string;
    sender: string;
    senderAddress?: string;
    subject: string;
    recipient?: string;
    receiverUnitCode?: string;
    classification?: string;
    urgency?: string;
    fileName?: string;
    fileUrl?: string;
    fileSize?: string;
    mimeType?: string;
    channel?: ChannelType | string;
    uploadedBy?: string;
    notes?: string;
    userId?: string;
    userName?: string;
  }): Promise<IIncomingLetter> {
    const now = new Date();
    const year = now.getFullYear();
    const agendaNumber = await this.getNextAgendaNumber(year);

    const docData: IIncomingLetter = {
      id: `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agendaNumber,
      letterNumber: params.letterNumber,
      letterDate: params.letterDate || now.toISOString().split('T')[0],
      receivedDate: params.receivedDate || now.toISOString().split('T')[0],
      sender: params.sender,
      senderAddress: params.senderAddress || '-',
      subject: params.subject,
      recipient: params.recipient || 'Direktur RS Sebening Kasih',
      receiverUnitCode: params.receiverUnitCode || 'ADM',
      classification: params.classification || 'Biasa',
      urgency: params.urgency || 'Biasa',
      attachments: params.fileName ? [params.fileName] : [],
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      uploadedBy: params.uploadedBy || params.userName || 'Sekretariat RS',
      uploadedAt: now.toISOString(),
      channel: params.channel || ChannelType.WEB,
      notes: params.notes || '',
      status: 'PROCESSED',
      dispositions: [],
      activityHistory: [
        {
          id: `ACT-${Date.now()}`,
          user: params.userName || 'Sekretariat RS',
          action: 'UPLOAD_INCOMING_LETTER',
          details: `Surat masuk dicatat dari ${params.sender} dengan nomor ${params.letterNumber}`,
          timestamp: now.toISOString()
        }
      ],
      createdAt: now.toISOString()
    };

    if (isAtlasConnected()) {
      const doc = new IncomingLetterModel(docData);
      await doc.save();
    } else {
      inMemoryDB.incomingLetters.unshift(docData);
    }

    await auditService.log({
      userId: params.userId || 'system',
      userName: params.userName || 'Sekretariat',
      action: 'UPLOAD_INCOMING_LETTER',
      entity: 'IncomingLetter',
      entityId: agendaNumber,
      channel: (params.channel as ChannelType) || ChannelType.WEB,
      after: docData
    });

    return docData;
  }

  /**
   * Create Disposition for an incoming letter (default status: PENDING_APPROVAL)
   */
  public async createDisposition(params: {
    incomingLetterId: string;
    fromUser: string;
    fromJid?: string;
    toUserOrUnit: string;
    toJid?: string;
    targetUnitCode?: string;
    instruction: string;
    deadline?: string;
    notes?: string;
    channel?: ChannelType;
  }): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    const year = new Date().getFullYear();
    const dispRef = await this.getNextDispositionId(year);

    // Resolve target JID if not explicitly provided
    let resolvedToJid = params.toJid;
    let resolvedUnitCode = params.targetUnitCode;

    if (!resolvedToJid && params.toUserOrUnit) {
      if (isAtlasConnected()) {
        const user = await UserModel.findOne({
          $or: [
            { fullName: new RegExp(params.toUserOrUnit, 'i') },
            { username: params.toUserOrUnit },
            { unitCode: params.targetUnitCode || params.toUserOrUnit }
          ],
          isActive: true
        });
        if (user?.whatsappJid) {
          resolvedToJid = user.whatsappJid;
          if (!resolvedUnitCode) resolvedUnitCode = user.unitCode;
        }
      } else {
        const inMemUser = inMemoryDB.users.find(
          u => u.isActive !== false && (
            (u.fullName && u.fullName.toLowerCase().includes(params.toUserOrUnit.toLowerCase())) ||
            u.username === params.toUserOrUnit ||
            u.id === params.toUserOrUnit ||
            (params.targetUnitCode && u.unitCode === params.targetUnitCode)
          )
        );
        if (inMemUser?.whatsappJid) {
          resolvedToJid = inMemUser.whatsappJid;
          if (!resolvedUnitCode) resolvedUnitCode = inMemUser.unitCode;
        }
      }
    }

    const newDisposition: IDisposition = {
      id: dispRef,
      referenceNumber: dispRef,
      incomingLetterId: params.incomingLetterId,
      fromUser: params.fromUser,
      fromJid: params.fromJid,
      toUserOrUnit: params.toUserOrUnit,
      toJid: resolvedToJid,
      targetUnitCode: resolvedUnitCode || 'ADM',
      instruction: params.instruction,
      deadline: params.deadline || '-',
      status: 'PENDING_APPROVAL',
      notes: params.notes || '',
      createdAt: new Date().toISOString()
    };

    let targetLetter: any = null;
    if (isAtlasConnected()) {
      targetLetter = await IncomingLetterModel.findOne({
        $or: [{ id: params.incomingLetterId }, { agendaNumber: params.incomingLetterId }, { letterNumber: params.incomingLetterId }]
      });
      if (targetLetter) {
        targetLetter.dispositions = targetLetter.dispositions || [];
        targetLetter.dispositions.push(newDisposition);
        targetLetter.status = 'DISPOSITIONED';
        targetLetter.activityHistory.push({
          user: params.fromUser,
          action: 'CREATE_DISPOSITION',
          details: `Disposisi ${dispRef} dibuat untuk ${params.toUserOrUnit} (Menunggu Persetujuan Direktur)`,
          timestamp: new Date().toISOString()
        });
        await targetLetter.save();
      }
    } else {
      targetLetter = inMemoryDB.incomingLetters.find(
        l => l.id === params.incomingLetterId || l.agendaNumber === params.incomingLetterId || l.letterNumber === params.incomingLetterId
      );
      if (targetLetter) {
        targetLetter.dispositions = targetLetter.dispositions || [];
        targetLetter.dispositions.push(newDisposition);
        targetLetter.status = 'DISPOSITIONED';
        targetLetter.activityHistory = targetLetter.activityHistory || [];
        targetLetter.activityHistory.push({
          id: `ACT-${Date.now()}`,
          user: params.fromUser,
          action: 'CREATE_DISPOSITION',
          details: `Disposisi ${dispRef} dibuat untuk ${params.toUserOrUnit} (Menunggu Persetujuan Direktur)`,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (!targetLetter) {
      throw new Error(`Surat masuk dengan id/agenda ${params.incomingLetterId} tidak ditemukan.`);
    }

    await auditService.log({
      userId: params.fromJid || params.fromUser,
      userName: params.fromUser,
      action: 'CREATE_DISPOSITION',
      entity: 'IncomingLetter',
      entityId: dispRef,
      channel: params.channel || ChannelType.WEB,
      after: newDisposition
    });

    return { letter: targetLetter, disposition: newDisposition };
  }

  /**
   * Direktur approves disposition: status -> APPROVED
   */
  public async approveDisposition(
    dispIdOrRef: string,
    approvedBy: string = 'dr. H. Budi Santoso, Sp.A (Direktur)',
    approvedNotes?: string,
    channel: ChannelType = ChannelType.WHATSAPP
  ): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    let letter: any = null;
    let disposition: any = null;

    if (isAtlasConnected()) {
      letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          disposition.status = 'APPROVED';
          disposition.approvedBy = approvedBy;
          disposition.approvedAt = new Date().toISOString();
          if (approvedNotes) disposition.notes = (disposition.notes ? disposition.notes + ' | ' : '') + approvedNotes;
          letter.activityHistory.push({
            user: approvedBy,
            action: 'APPROVE_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} disetujui Direktur.`,
            timestamp: new Date().toISOString()
          });
          await letter.save();
        }
      }
    } else {
      for (const l of inMemoryDB.incomingLetters) {
        const found = (l.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (found) {
          letter = l;
          disposition = found;
          disposition.status = 'APPROVED';
          disposition.approvedBy = approvedBy;
          disposition.approvedAt = new Date().toISOString();
          if (approvedNotes) disposition.notes = (disposition.notes ? disposition.notes + ' | ' : '') + approvedNotes;
          letter.activityHistory = letter.activityHistory || [];
          letter.activityHistory.push({
            id: `ACT-${Date.now()}`,
            user: approvedBy,
            action: 'APPROVE_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} disetujui Direktur.`,
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    if (!letter || !disposition) {
      throw new Error(`Disposisi ${dispIdOrRef} tidak ditemukan.`);
    }

    await auditService.log({
      userId: approvedBy,
      userName: approvedBy,
      action: 'APPROVE_DISPOSITION',
      entity: 'IncomingLetter',
      entityId: dispIdOrRef,
      channel,
      after: disposition
    });

    return { letter, disposition };
  }

  /**
   * Direktur rejects disposition: status -> REJECTED
   */
  public async rejectDisposition(
    dispIdOrRef: string,
    rejectionReason: string,
    rejectedBy: string = 'dr. H. Budi Santoso, Sp.A (Direktur)',
    channel: ChannelType = ChannelType.WHATSAPP
  ): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    let letter: any = null;
    let disposition: any = null;

    if (isAtlasConnected()) {
      letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          disposition.status = 'REJECTED';
          disposition.rejectionReason = rejectionReason;
          disposition.approvedBy = rejectedBy;
          disposition.approvedAt = new Date().toISOString();
          letter.activityHistory.push({
            user: rejectedBy,
            action: 'REJECT_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} DITOLAK. Alasan: ${rejectionReason}`,
            timestamp: new Date().toISOString()
          });
          await letter.save();
        }
      }
    } else {
      for (const l of inMemoryDB.incomingLetters) {
        const found = (l.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (found) {
          letter = l;
          disposition = found;
          disposition.status = 'REJECTED';
          disposition.rejectionReason = rejectionReason;
          disposition.approvedBy = rejectedBy;
          disposition.approvedAt = new Date().toISOString();
          letter.activityHistory = letter.activityHistory || [];
          letter.activityHistory.push({
            id: `ACT-${Date.now()}`,
            user: rejectedBy,
            action: 'REJECT_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} DITOLAK. Alasan: ${rejectionReason}`,
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    if (!letter || !disposition) {
      throw new Error(`Disposisi ${dispIdOrRef} tidak ditemukan.`);
    }

    await auditService.log({
      userId: rejectedBy,
      userName: rejectedBy,
      action: 'REJECT_DISPOSITION',
      entity: 'IncomingLetter',
      entityId: dispIdOrRef,
      channel,
      after: disposition
    });

    return { letter, disposition };
  }

  /**
   * Direktur requests revision: status -> REVISION_REQUIRED
   */
  public async requestRevision(
    dispIdOrRef: string,
    revisionNotes: string,
    requestedBy: string = 'dr. H. Budi Santoso, Sp.A (Direktur)',
    channel: ChannelType = ChannelType.WHATSAPP
  ): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    let letter: any = null;
    let disposition: any = null;

    if (isAtlasConnected()) {
      letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          disposition.status = 'REVISION_REQUIRED';
          disposition.revisionNotes = revisionNotes;
          letter.activityHistory.push({
            user: requestedBy,
            action: 'REQUEST_DISPOSITION_REVISION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} membutuhkan REVISI. Catatan: ${revisionNotes}`,
            timestamp: new Date().toISOString()
          });
          await letter.save();
        }
      }
    } else {
      for (const l of inMemoryDB.incomingLetters) {
        const found = (l.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (found) {
          letter = l;
          disposition = found;
          disposition.status = 'REVISION_REQUIRED';
          disposition.revisionNotes = revisionNotes;
          letter.activityHistory = letter.activityHistory || [];
          letter.activityHistory.push({
            id: `ACT-${Date.now()}`,
            user: requestedBy,
            action: 'REQUEST_DISPOSITION_REVISION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} membutuhkan REVISI. Catatan: ${revisionNotes}`,
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    if (!letter || !disposition) {
      throw new Error(`Disposisi ${dispIdOrRef} tidak ditemukan.`);
    }

    await auditService.log({
      userId: requestedBy,
      userName: requestedBy,
      action: 'REQUEST_DISPOSITION_REVISION',
      entity: 'IncomingLetter',
      entityId: dispIdOrRef,
      channel,
      after: disposition
    });

    return { letter, disposition };
  }

  /**
   * Recipient starts processing: status -> IN_PROGRESS
   */
  public async processDisposition(
    dispIdOrRef: string,
    processedBy: string,
    channel: ChannelType = ChannelType.WHATSAPP
  ): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    let letter: any = null;
    let disposition: any = null;

    if (isAtlasConnected()) {
      letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          disposition.status = 'IN_PROGRESS';
          disposition.processedBy = processedBy;
          disposition.processedAt = new Date().toISOString();
          letter.activityHistory.push({
            user: processedBy,
            action: 'START_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} diterima & mulai diproses oleh ${processedBy}`,
            timestamp: new Date().toISOString()
          });
          await letter.save();
        }
      }
    } else {
      for (const l of inMemoryDB.incomingLetters) {
        const found = (l.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (found) {
          letter = l;
          disposition = found;
          disposition.status = 'IN_PROGRESS';
          disposition.processedBy = processedBy;
          disposition.processedAt = new Date().toISOString();
          letter.activityHistory = letter.activityHistory || [];
          letter.activityHistory.push({
            id: `ACT-${Date.now()}`,
            user: processedBy,
            action: 'START_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} diterima & mulai diproses oleh ${processedBy}`,
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    if (!letter || !disposition) {
      throw new Error(`Disposisi ${dispIdOrRef} tidak ditemukan.`);
    }

    await auditService.log({
      userId: processedBy,
      userName: processedBy,
      action: 'START_DISPOSITION',
      entity: 'IncomingLetter',
      entityId: dispIdOrRef,
      channel,
      after: disposition
    });

    return { letter, disposition };
  }

  /**
   * Recipient completes disposition: status -> COMPLETED
   */
  public async completeDisposition(
    dispIdOrRef: string,
    completedBy: string,
    channel: ChannelType = ChannelType.WHATSAPP
  ): Promise<{ letter: IIncomingLetter; disposition: IDisposition }> {
    let letter: any = null;
    let disposition: any = null;

    if (isAtlasConnected()) {
      letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          disposition.status = 'COMPLETED';
          disposition.completedAt = new Date().toISOString();
          letter.activityHistory.push({
            user: completedBy,
            action: 'COMPLETE_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} dinyatakan SELESAI oleh ${completedBy}`,
            timestamp: new Date().toISOString()
          });
          await letter.save();
        }
      }
    } else {
      for (const l of inMemoryDB.incomingLetters) {
        const found = (l.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (found) {
          letter = l;
          disposition = found;
          disposition.status = 'COMPLETED';
          disposition.completedAt = new Date().toISOString();
          letter.activityHistory = letter.activityHistory || [];
          letter.activityHistory.push({
            id: `ACT-${Date.now()}`,
            user: completedBy,
            action: 'COMPLETE_DISPOSITION',
            details: `Disposisi ${disposition.referenceNumber || disposition.id} dinyatakan SELESAI oleh ${completedBy}`,
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }

    if (!letter || !disposition) {
      throw new Error(`Disposisi ${dispIdOrRef} tidak ditemukan.`);
    }

    await auditService.log({
      userId: completedBy,
      userName: completedBy,
      action: 'COMPLETE_DISPOSITION',
      entity: 'IncomingLetter',
      entityId: dispIdOrRef,
      channel,
      after: disposition
    });

    return { letter, disposition };
  }

  /**
   * Find a disposition by ID or reference number
   */
  public async findDisposition(dispIdOrRef: string): Promise<{ letter: IIncomingLetter; disposition: IDisposition } | null> {
    if (isAtlasConnected()) {
      const letter = await IncomingLetterModel.findOne({
        $or: [{ 'dispositions.id': dispIdOrRef }, { 'dispositions.referenceNumber': dispIdOrRef }]
      });
      if (letter) {
        const disposition = letter.dispositions.find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        return disposition ? { letter, disposition } : null;
      }
    } else {
      for (const letter of inMemoryDB.incomingLetters) {
        const disposition = (letter.dispositions || []).find((d: any) => d.id === dispIdOrRef || d.referenceNumber === dispIdOrRef);
        if (disposition) {
          return { letter, disposition };
        }
      }
    }
    return null;
  }

  /**
   * Find incoming letter by ID, agenda number, or letter number
   */
  public async findLetter(idOrAgenda: string): Promise<IIncomingLetter | null> {
    if (isAtlasConnected()) {
      return await IncomingLetterModel.findOne({
        $or: [{ id: idOrAgenda }, { agendaNumber: idOrAgenda }, { letterNumber: idOrAgenda }]
      });
    } else {
      return inMemoryDB.incomingLetters.find(
        l => l.id === idOrAgenda || l.agendaNumber === idOrAgenda || l.letterNumber === idOrAgenda
      ) || null;
    }
  }
}

export const incomingLetterService = new IncomingLetterService();
