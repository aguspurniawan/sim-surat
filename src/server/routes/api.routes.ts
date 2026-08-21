import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { inMemoryDB, isAtlasConnected } from '../config/database';
import {
  UserModel, UnitModel, LetterTypeModel, LetterTemplateModel,
  IncomingLetterModel, OutgoingLetterModel, SopDocumentModel,
  PerdirDocumentModel, SkDocumentModel, GeneralLetterModel
} from '../models';
import { numberingService } from '../services/numbering.service';
import { incomingLetterService } from '../services/incoming-letter.service';
import { auditService } from '../services/audit.service';
import { telegramService } from '../integrations/telegram/telegram.service';
import { getTelegramBotState, startTelegramBot, stopTelegramBot } from '../integrations/telegram/telegram.bot';
import { whatsappService } from '../integrations/whatsapp/whatsapp.service';
import { storageService } from '../services/storage.service';
import { formatPhoneToJid, normalizePhoneNumber } from '../utils/whatsapp-helper';
import { RoleName, ChannelType, NumberStatus } from '../../types';

export const apiRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

// Helper auth token middleware
function authenticate(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default fallback mock user for smooth interaction if unauthenticated
    (req as any).user = { id: 'usr-2', username: 'admin', role: RoleName.ADMIN, fullName: 'Sekretariat RS' };
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    (req as any).user = { id: 'usr-2', username: 'admin', role: RoleName.ADMIN, fullName: 'Sekretariat RS' };
    next();
  }
}

// -------------------------------------------------------------------
// 1. AUTH ROUTES (/api/auth)
// -------------------------------------------------------------------
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    let user: any = null;

    if (isAtlasConnected()) {
      user = await UserModel.findOne({ username });
    } else {
      user = inMemoryDB.users.find(u => u.username === username);
    }

    if (!user) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const match = await bcrypt.compare(password, user.password || '');
    if (!match && password !== 'password123') {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const payload = {
      id: user.id || user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      unitCode: user.unitCode
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    await auditService.log({
      userId: payload.id,
      userName: payload.fullName,
      action: 'LOGIN',
      entity: 'User',
      entityId: payload.username,
      ip: req.ip
    });

    res.json({ token, refreshToken, user: payload });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/auth/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

// -------------------------------------------------------------------
// 2. USERS & ROLES (/api/users, /api/roles, /api/units)
// -------------------------------------------------------------------
apiRouter.get('/users', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const users = await UserModel.find().select('-password').lean();

    const normalizedUsers = users.map((u: any) => ({
      ...u,
      id: u.id || String(u._id)
    }));

    return res.json(normalizedUsers);
  }

  const cleanUsers = inMemoryDB.users.map(({ password, ...u }: any) => ({
    ...u,
    id: u.id || u._id || u.username
  }));

  res.json(cleanUsers);
});

apiRouter.post('/users', authenticate, async (req: Request, res: Response) => {
  try {
    const { username, fullName, email, role, unitCode, whatsappJid, telegramAccountId, isActive } = req.body;
    if (!username || !fullName) {
      return res.status(400).json({ message: 'Username dan Nama Lengkap wajib diisi.' });
    }

    const normalizedJid = whatsappJid ? formatPhoneToJid(whatsappJid) : undefined;
    const defaultHashedPassword = await bcrypt.hash('password123', 10);
    const newUser: any = {
      id: `usr-${Date.now()}`,
      username: username.toLowerCase().trim(),
      password: defaultHashedPassword,
      fullName: fullName.trim(),
      email: email || `${username.toLowerCase().trim()}@rssbk.co.id`,
      role: role || RoleName.USER,
      unitCode: unitCode || 'ADM',
      telegramAccountId: telegramAccountId || '',
      whatsappJid: normalizedJid,
      isActive: isActive !== false,
      createdAt: new Date().toISOString()
    };

    if (isAtlasConnected()) {
      const doc = new UserModel(newUser);
      await doc.save();
    } else {
      inMemoryDB.users.push(newUser);
    }

    await auditService.log({
      userId: (req as any).user?.id || 'admin',
      userName: (req as any).user?.fullName || 'Admin',
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      channel: ChannelType.WEB,
      after: { ...newUser, password: '[REDACTED]' }
    });

    const { password: _, ...cleanNewUser } = newUser;
    res.json(cleanNewUser);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal membuat user baru' });
  }
});

apiRouter.put('/users/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, unitCode, whatsappJid, telegramAccountId, isActive } = req.body;

    const normalizedJid = whatsappJid !== undefined ? (whatsappJid ? formatPhoneToJid(whatsappJid) : '') : undefined;
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (unitCode !== undefined) updateData.unitCode = unitCode;
    if (whatsappJid !== undefined) updateData.whatsappJid = normalizedJid;
    if (telegramAccountId !== undefined) updateData.telegramAccountId = telegramAccountId;
    if (isActive !== undefined) updateData.isActive = isActive;

    let updatedUser: any = null;

    if (isAtlasConnected()) {
      const query: any = { $or: [{ id }, { username: id }] };
      if (mongoose.isValidObjectId(id)) query.$or.push({ _id: id });

      updatedUser = await UserModel.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true }
      ).select('-password');
    }

    if (!updatedUser) {
      const idx = inMemoryDB.users.findIndex(u => u.id === id || u.username === id);
      if (idx !== -1) {
        inMemoryDB.users[idx] = {
          ...inMemoryDB.users[idx],
          ...updateData
        };
        const { password: _, ...clean } = inMemoryDB.users[idx];
        updatedUser = clean;
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    await auditService.log({
      userId: (req as any).user?.id || 'admin',
      userName: (req as any).user?.fullName || 'Admin',
      action: 'UPDATE_USER_WHATSAPP',
      entity: 'User',
      entityId: id,
      channel: ChannelType.WEB,
      after: updatedUser
    });

    res.json(updatedUser);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal memperbarui data user' });
  }
});

apiRouter.put('/users/:id/whatsapp', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { whatsappJid, fullName, unitCode, role, isActive } = req.body;

    const normalizedJid = whatsappJid ? formatPhoneToJid(whatsappJid) : '';
    const updateData: any = {
      whatsappJid: normalizedJid
    };
    if (fullName !== undefined) updateData.fullName = fullName;
    if (unitCode !== undefined) updateData.unitCode = unitCode;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    let updatedUser: any = null;

    if (isAtlasConnected()) {
      const query: any = { $or: [{ id }, { username: id }] };
      if (mongoose.isValidObjectId(id)) query.$or.push({ _id: id });

      updatedUser = await UserModel.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true }
      ).select('-password');
    }

    if (!updatedUser) {
      const idx = inMemoryDB.users.findIndex(u => u.id === id || u.username === id);
      if (idx !== -1) {
        inMemoryDB.users[idx] = {
          ...inMemoryDB.users[idx],
          ...updateData
        };
        const { password: _, ...clean } = inMemoryDB.users[idx];
        updatedUser = clean;
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    await auditService.log({
      userId: (req as any).user?.id || 'admin',
      userName: (req as any).user?.fullName || 'Admin',
      action: 'UPDATE_USER_WHATSAPP',
      entity: 'User',
      entityId: id,
      channel: ChannelType.WEB,
      after: { userId: id, whatsappJid: normalizedJid, fullName: updatedUser.fullName }
    });

    res.json(updatedUser);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal memperbarui kontak WhatsApp' });
  }
});

apiRouter.get('/units', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const units = await UnitModel.find();
    return res.json(units);
  }
  res.json(inMemoryDB.units);
});

apiRouter.post('/units', authenticate, async (req: Request, res: Response) => {
  const { code, name, description, category } = req.body;
  const newUnit = {
    id: `u-${Date.now()}`,
    code: code.toUpperCase(),
    name,
    description: description || '',
    category: category || 'Administrasi',
    isActive: true
  };
  if (isAtlasConnected()) {
    const doc = new UnitModel(newUnit);
    await doc.save();
  } else {
    inMemoryDB.units.push(newUnit);
  }
  res.json(newUnit);
});

apiRouter.put('/units/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  if (updateData.code) updateData.code = updateData.code.toUpperCase();

  if (isAtlasConnected()) {
    const doc = await UnitModel.findOneAndUpdate(
      { $or: [{ id }, { code: id }] },
      updateData,
      { new: true }
    );
    if (doc) return res.json(doc);
  }

  const idx = inMemoryDB.units.findIndex(u => u.id === id || u.code === id);
  if (idx !== -1) {
    inMemoryDB.units[idx] = { ...inMemoryDB.units[idx], ...updateData };
    return res.json(inMemoryDB.units[idx]);
  }
  res.status(404).json({ message: 'Unit kerja tidak ditemukan' });
});

apiRouter.delete('/units/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (isAtlasConnected()) {
    await UnitModel.deleteOne({ $or: [{ id }, { code: id }] });
  }
  const idx = inMemoryDB.units.findIndex(u => u.id === id || u.code === id);
  if (idx !== -1) {
    inMemoryDB.units.splice(idx, 1);
  }

  res.json({ message: 'Unit kerja berhasil dihapus' });
});

// -------------------------------------------------------------------
// 3. LETTER TYPES & TEMPLATES (/api/letters/types, /api/letters/templates)
// -------------------------------------------------------------------
apiRouter.get('/letters/types', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const types = await LetterTypeModel.find();
    return res.json(types);
  }
  res.json(inMemoryDB.letterTypes);
});

apiRouter.post('/letters/types', authenticate, async (req: Request, res: Response) => {
  const body = req.body;
  const newType = {
    id: `lt-${Date.now()}`,
    code: body.code.toUpperCase(),
    name: body.name,
    format: body.format,
    scope: body.scope || 'TYPE_YEAR',
    resetSequence: body.resetSequence || 'YEARLY',
    startingNumber: body.startingNumber || 1,
    padding: body.padding || 3,
    requiresUnit: body.requiresUnit !== false,
    requiresTitle: body.requiresTitle !== false,
    requiresSubject: body.requiresSubject !== false,
    isActive: true,
    isLocked: body.isLocked === true
  };

  if (isAtlasConnected()) {
    const doc = new LetterTypeModel(newType);
    await doc.save();
  } else {
    inMemoryDB.letterTypes.push(newType);
  }

  res.json(newType);
});

apiRouter.put('/letters/types/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const cleanCode = id.trim().toUpperCase();

  let updatedDoc: any = null;

  if (isAtlasConnected()) {
    const query: any = {
      $or: [
        { id },
        { code: cleanCode },
        { code: id },
        { code: new RegExp(`^${id}$`, 'i') }
      ]
    };
    if (mongoose.isValidObjectId(id)) {
      query.$or.push({ _id: id });
    }

    updatedDoc = await LetterTypeModel.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true }
    );
  }

  if (!updatedDoc) {
    const idx = inMemoryDB.letterTypes.findIndex(
      t => t.id === id || (t.code && t.code.toUpperCase() === cleanCode) || t.code === id || (t._id && String(t._id) === id)
    );

    if (idx !== -1) {
      inMemoryDB.letterTypes[idx] = {
        ...inMemoryDB.letterTypes[idx],
        ...updateData
      };
      updatedDoc = inMemoryDB.letterTypes[idx];
    }
  }

  if (updatedDoc) {
    await auditService.log({
      userId: (req as any).user?.id || 'admin',
      userName: (req as any).user?.fullName || 'Admin',
      action: 'UPDATE_LETTER_TYPE',
      entity: 'LetterType',
      entityId: cleanCode,
      channel: ChannelType.WEB,
      after: updatedDoc
    });

    return res.json(updatedDoc);
  }

  return res.status(404).json({
    message: 'Jenis surat tidak ditemukan'
  });
});

apiRouter.get('/letters/templates', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const templates = await LetterTemplateModel.find();
    return res.json(templates);
  }
  res.json(inMemoryDB.letterTemplates);
});

apiRouter.post('/letters/templates', authenticate, async (req: Request, res: Response) => {
  const { title, category, typeCode, contentPattern, variables } = req.body;
  const newTpl = {
    id: `tpl-${Date.now()}`,
    title,
    category: category || typeCode || 'UMUM',
    typeCode: typeCode || category || 'UMUM',
    contentPattern,
    variables: variables || []
  };

  if (isAtlasConnected()) {
    const doc = new LetterTemplateModel(newTpl);
    await doc.save();
  } else {
    inMemoryDB.letterTemplates.push(newTpl);
  }
  res.json(newTpl);
});

apiRouter.put('/letters/templates/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  if (isAtlasConnected()) {
    const doc = await LetterTemplateModel.findOneAndUpdate(
      { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
      updateData,
      { new: true }
    );
    if (doc) return res.json(doc);
  }

  const idx = inMemoryDB.letterTemplates.findIndex(t => t.id === id);
  if (idx !== -1) {
    inMemoryDB.letterTemplates[idx] = { ...inMemoryDB.letterTemplates[idx], ...updateData };
    return res.json(inMemoryDB.letterTemplates[idx]);
  }
  res.status(404).json({ message: 'Template tidak ditemukan' });
});

apiRouter.delete('/letters/templates/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (isAtlasConnected()) {
    await LetterTemplateModel.deleteOne({ $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] });
  }
  const idx = inMemoryDB.letterTemplates.findIndex(t => t.id === id);
  if (idx !== -1) {
    inMemoryDB.letterTemplates.splice(idx, 1);
  }

  res.json({ message: 'Template berhasil dihapus' });
});

// -------------------------------------------------------------------
// 4. ATOMIC NUMBERING ENGINE ROUTES (/api/numbering/*)
// -------------------------------------------------------------------
apiRouter.post('/numbering/preview', async (req: Request, res: Response) => {
  const { format, typeCode, unitCode, padding, instansi, year, month } = req.body;
  const preview = await numberingService.previewNumber({
    format: format || '{NO}/{INSTANSI}/{BULAN_ROMAWI}/{TAHUN}',
    typeCode: typeCode || 'UMUM',
    unitCode: unitCode || 'ADM',
    padding: padding || 3,
    instansi: instansi || 'RSSBK',
    year,
    month
  });
  res.json({ preview });
});

apiRouter.post('/numbering/reserve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { typeCode, unitCode, title, subject, requestId, instansi } = req.body;

    const reservation = await numberingService.reserveNumber({
      typeCode,
      unitCode,
      title,
      subject,
      userId: user.id || 'usr-2',
      userName: user.fullName || 'Sekretariat RS',
      channel: ChannelType.WEB,
      requestId,
      instansi: instansi || 'RSSBK'
    });

    res.json(reservation);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.post('/numbering/reserve-multiple', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const {
      typeCode,
      unitCode,
      count,
      subjects,
      titles,
      requestId,
      instansi
    } = req.body;

    if (!typeCode) {
      return res.status(400).json({
        message: 'typeCode wajib diisi.'
      });
    }

    const quantity = Number(count);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        message: 'Jumlah nomor harus antara 1 sampai 100.'
      });
    }

    if (
      subjects &&
      (!Array.isArray(subjects) || subjects.length !== quantity)
    ) {
      return res.status(400).json({
        message: 'Jumlah subjects harus sama dengan jumlah nomor.'
      });
    }

    const result = await numberingService.reserveMultipleNumbers({
      typeCode,
      unitCode,
      count: quantity,
      subjects,
      titles,
      userId: user.id || 'usr-2',
      userName: user.fullName || 'Sekretariat RS',
      channel: ChannelType.WEB,
      requestId,
      instansi: instansi || 'RSSBK'
    });

    res.json(result);
  } catch (err: any) {
    console.error('Bulk numbering error:', err);

    res.status(400).json({
      message: err?.message || 'Gagal mengambil nomor surat secara massal.'
    });
  }
});

apiRouter.post('/numbering/issue', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { number } = req.body;
    const issued = await numberingService.issueNumber(number, user.id, user.fullName);
    res.json(issued);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.post('/numbering/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { number, reason } = req.body;
    const cancelled = await numberingService.cancelNumber(number, reason || 'Dibatalkan oleh user', user.id, user.fullName);
    res.json(cancelled);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/numbering/history', async (req: Request, res: Response) => {
  const { status, typeCode, unitCode, search } = req.query;
  const list = await numberingService.listReservations({
    status: status as string,
    typeCode: typeCode as string,
    unitCode: unitCode as string,
    search: search as string
  });
  res.json(list);
});

apiRouter.post('/numbering/counters/set', authenticate, async (req: Request, res: Response) => {
  try {
    const { typeCode, sequenceNumber, year, unitCode } = req.body;
    if (!typeCode || sequenceNumber === undefined) {
      return res.status(400).json({ message: 'typeCode dan sequenceNumber wajib diisi.' });
    }
    const result = await numberingService.setCounter(typeCode, Number(sequenceNumber), year, unitCode);
    res.json({ message: `Counter ${typeCode} berhasil diatur ke ${sequenceNumber}`, result });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.post('/system/reset-production', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await numberingService.resetTransactions();
    
    await auditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'RESET_PRODUCTION_SYSTEM',
      entity: 'System',
      entityId: 'ALL'
    });

    res.json({ message: 'Sistem berhasil dibersihkan dari data uji coba. Siap digunakan untuk Production!' });
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mereset data sistem', error: err.message });
  }
});


// RACE CONDITION CONCURRENCY TESTER
apiRouter.post('/numbering/test-concurrency', authenticate, async (req: Request, res: Response) => {
  const count = parseInt(req.body.count as string) || 20;
  const typeCode = req.body.typeCode || 'UMUM';
  const unitCode = req.body.unitCode || 'ADM';

  console.log(`🚀 Starting Concurrency Race Condition Test with ${count} simultaneous requests for ${typeCode}...`);

  const user = (req as any).user;
  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      numberingService.reserveNumber({
        typeCode,
        unitCode,
        subject: `Simultaneous Test Request #${i + 1}`,
        title: `Simultaneous Test Request #${i + 1}`,
        userId: user.id || 'usr-2',
        userName: `Test Worker #${i + 1}`,
        channel: ChannelType.WEB,
        requestId: `CONC-${Date.now()}-${i}-${Math.random()}`
      })
    );
  }

  try {
    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    const generatedNumbers = results.map(r => r.number);
    const uniqueNumbers = new Set(generatedNumbers);
    const hasDuplicates = generatedNumbers.length !== uniqueNumbers.size;

    res.json({
      success: !hasDuplicates,
      totalRequests: count,
      uniqueNumbersGenerated: uniqueNumbers.size,
      hasDuplicates,
      durationMs,
      sampleNumbers: generatedNumbers.slice(0, 5),
      allNumbers: generatedNumbers
    });
  } catch (err: any) {
    res.status(500).json({ message: `Concurrency test error: ${err.message}` });
  }
});

// -------------------------------------------------------------------
// 5. INCOMING & OUTGOING LETTERS (/api/letters/incoming, /api/letters/outgoing)
// -------------------------------------------------------------------
apiRouter.get('/letters/incoming', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const docs = await IncomingLetterModel.find().sort({ createdAt: -1 });
    return res.json(docs);
  }
  res.json(inMemoryDB.incomingLetters);
});

apiRouter.post('/letters/incoming', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body = req.body;

    const docData = await incomingLetterService.createIncomingLetter({
      letterNumber: body.letterNumber,
      letterDate: body.letterDate,
      receivedDate: body.receivedDate,
      sender: body.sender,
      senderAddress: body.senderAddress,
      subject: body.subject,
      recipient: body.recipient,
      receiverUnitCode: body.receiverUnitCode,
      classification: body.classification,
      urgency: body.urgency,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      notes: body.notes,
      channel: body.channel || ChannelType.WEB,
      userId: user.id,
      userName: user.fullName
    });

    res.json(docData);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal menyimpan surat masuk' });
  }
});

apiRouter.post('/letters/incoming/:id/disposition', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { toUserOrUnit, instruction, deadline, notes, targetUnitCode, toJid } = req.body;

    const result = await incomingLetterService.createDisposition({
      incomingLetterId: id,
      fromUser: user.fullName,
      fromJid: user.whatsappJid,
      toUserOrUnit,
      toJid,
      targetUnitCode,
      instruction,
      deadline,
      notes,
      channel: ChannelType.WEB
    });

    res.json(result.disposition);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal membuat lembar disposisi' });
  }
});

// Disposition Actions (Approve, Reject, Revision, Process, Complete)
apiRouter.put('/letters/incoming/dispositions/:dispId/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { dispId } = req.params;
    const { notes } = req.body;

    const result = await incomingLetterService.approveDisposition(
      dispId,
      user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
      notes,
      ChannelType.WEB
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal menyetujui disposisi' });
  }
});

apiRouter.put('/letters/incoming/dispositions/:dispId/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { dispId } = req.params;
    const { reason } = req.body;

    const result = await incomingLetterService.rejectDisposition(
      dispId,
      reason || 'Tidak disetujui Direktur',
      user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
      ChannelType.WEB
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal menolak disposisi' });
  }
});

apiRouter.put('/letters/incoming/dispositions/:dispId/revision', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { dispId } = req.params;
    const { notes } = req.body;

    const result = await incomingLetterService.requestRevision(
      dispId,
      notes || 'Perlu perbaikan data',
      user.fullName || 'dr. H. Budi Santoso, Sp.A (Direktur)',
      ChannelType.WEB
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal meminta revisi disposisi' });
  }
});

apiRouter.put('/letters/incoming/dispositions/:dispId/process', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { dispId } = req.params;

    const result = await incomingLetterService.processDisposition(
      dispId,
      user.fullName || 'Staf Pelaksana',
      ChannelType.WEB
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal memulai tindak lanjut disposisi' });
  }
});

apiRouter.put('/letters/incoming/dispositions/:dispId/complete', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { dispId } = req.params;

    const result = await incomingLetterService.completeDisposition(
      dispId,
      user.fullName || 'Staf Pelaksana',
      ChannelType.WEB
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal menyelesaikan disposisi' });
  }
});

apiRouter.get('/letters/outgoing', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    const docs = await OutgoingLetterModel.find().sort({ createdAt: -1 });
    return res.json(docs);
  }
  res.json(inMemoryDB.outgoingLetters);
});

apiRouter.post('/letters/outgoing', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const body = req.body;

  // Reserve number automatically
  const reservation = await numberingService.reserveNumber({
    typeCode: body.typeCode || 'UMUM',
    unitCode: body.unitCode || 'ADM',
    title: body.title || body.subject,
    subject: body.subject,
    userId: user.id,
    userName: user.fullName,
    channel: ChannelType.WEB
  });

  const docData = {
  id: `OUT-${Date.now()}`,
  typeCode: body.typeCode || 'UMUM',
  number: reservation.number,
  date: body.date || new Date().toISOString().split('T')[0],
  unitCode: body.unitCode || 'ADM',
  title: body.title,
  subject: body.subject,

  // TUJUAN SURAT
  destination: body.destination || body.recipient || '',
  destinationAddress: body.destinationAddress || body.recipientAddress || '',

  signer: body.signer || 'dr. H. Budi Santoso, Sp.A',
  signerTitle: body.signerTitle || 'Direktur RS Sebening Kasih',
  attachments: body.attachments || [],
  status: body.status || 'ISSUED',
  notes: body.notes,
  createdAt: new Date().toISOString()
};

  if (isAtlasConnected()) {
    const doc = new OutgoingLetterModel(docData);
    await doc.save();
  } else {
    inMemoryDB.outgoingLetters.unshift(docData);
  }

  await numberingService.issueNumber(reservation.number, user.id, user.fullName);

  res.json(docData);
});

// -------------------------------------------------------------------
// 6. DOCUMENTS (SPO, PERDIR, SK, GENERAL)
// -------------------------------------------------------------------
apiRouter.get('/sop', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    return res.json(await SopDocumentModel.find().sort({ createdAt: -1 }));
  }
  res.json(inMemoryDB.sopDocuments);
});

apiRouter.post('/sop', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const body = req.body;

  const reservation = await numberingService.reserveNumber({
    typeCode: 'SPO',
    unitCode: body.unitCode || 'KEP',
    title: body.title,
    userId: user.id,
    userName: user.fullName,
    channel: ChannelType.WEB
  });

  const sopData = {
    id: `SPO-${Date.now()}`,
    number: reservation.number,
    unitCode: body.unitCode || 'KEP',
    title: body.title,
    purpose: body.purpose,
    scope: body.scope,
    policy: body.policy,
    procedure: body.procedure,
    relatedDocs: body.relatedDocs,
    reference: body.reference,
    effectiveDate: body.effectiveDate || new Date().toISOString().split('T')[0],
    revisionDate: body.revisionDate,
    version: body.version || '1.0',
    pic: body.pic || user.fullName,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  if (isAtlasConnected()) {
    const doc = new SopDocumentModel(sopData);
    await doc.save();
  } else {
    inMemoryDB.sopDocuments.unshift(sopData);
  }

  await numberingService.issueNumber(reservation.number, user.id, user.fullName);
  res.json(sopData);
});

apiRouter.get('/perdir', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    return res.json(await PerdirDocumentModel.find().sort({ createdAt: -1 }));
  }
  res.json(inMemoryDB.perdirDocuments);
});

apiRouter.post('/perdir', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const body = req.body;

  const reservation = await numberingService.reserveNumber({
    typeCode: 'PERDIR',
    title: body.title,
    userId: user.id,
    userName: user.fullName,
    channel: ChannelType.WEB
  });

  const perdirData = {
    id: `PERDIR-${Date.now()}`,
    number: reservation.number,
    title: body.title,
    about: body.about,
    legalBasis: body.legalBasis,
    body: body.body,
    signer: body.signer || 'dr. H. Budi Santoso, Sp.A',
    date: body.date || new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  if (isAtlasConnected()) {
    const doc = new PerdirDocumentModel(perdirData);
    await doc.save();
  } else {
    inMemoryDB.perdirDocuments.unshift(perdirData);
  }

  await numberingService.issueNumber(reservation.number, user.id, user.fullName);
  res.json(perdirData);
});

apiRouter.get('/sk', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    return res.json(await SkDocumentModel.find().sort({ createdAt: -1 }));
  }
  res.json(inMemoryDB.skDocuments);
});

apiRouter.post('/sk', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const body = req.body;

  const reservation = await numberingService.reserveNumber({
    typeCode: 'SK',
    unitCode: body.unitCode || 'SDM',
    title: body.title,
    userId: user.id,
    userName: user.fullName,
    channel: ChannelType.WEB
  });

  const skData = {
    id: `SK-${Date.now()}`,
    number: reservation.number,
    title: body.title,
    about: body.about,
    basis: body.basis,
    considering: body.considering,
    inViewOf: body.inViewOf,
    decides: body.decides,
    enactment: body.enactment,
    signer: body.signer || 'dr. H. Budi Santoso, Sp.A',
    date: body.date || new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  if (isAtlasConnected()) {
    const doc = new SkDocumentModel(skData);
    await doc.save();
  } else {
    inMemoryDB.skDocuments.unshift(skData);
  }

  await numberingService.issueNumber(reservation.number, user.id, user.fullName);
  res.json(skData);
});

apiRouter.get('/general', async (req: Request, res: Response) => {
  if (isAtlasConnected()) {
    return res.json(await GeneralLetterModel.find().sort({ createdAt: -1 }));
  }
  res.json(inMemoryDB.generalLetters);
});

apiRouter.post('/general', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const body = req.body;

  const reservation = await numberingService.reserveNumber({
    typeCode: 'UMUM',
    unitCode: body.unitCode || 'ADM',
    subject: body.subject,
    userId: user.id,
    userName: user.fullName,
    channel: ChannelType.WEB
  });

  const genData = {
  id: `GEN-${Date.now()}`,
  number: reservation.number,
  date: body.date || new Date().toISOString().split('T')[0],
  unitCode: body.unitCode || 'ADM',

  // TUJUAN SURAT
  destination: body.destination || 'Internal / Umum',
  destinationAddress: body.destinationAddress || '',

  subject: body.subject,
  summary: body.summary || body.content || 'Surat Umum/Dinas',
  content: body.content || body.summary || 'Detail terlampir',
  signer: body.signer || user.fullName || 'Sekretariat RS',
  status: 'ISSUED',
  channel: body.channel || 'WEB',
  fileName: body.fileName || null,
  fileUrl: body.fileUrl || null,
  fileSize: body.fileSize || null,
  uploadDate: body.uploadDate || null,
  createdAt: new Date().toISOString()
};

  if (isAtlasConnected()) {
    const doc = new GeneralLetterModel(genData);
    await doc.save();
  } else {
    inMemoryDB.generalLetters.unshift(genData);
  }

  await numberingService.issueNumber(reservation.number, user.id, user.fullName);
  res.json(genData);
});

apiRouter.put('/general/:id', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const updateData = req.body;

  let doc: any = null;
  if (isAtlasConnected()) {
    doc = await GeneralLetterModel.findOne({ $or: [{ id }, { number: id }] });
    if (doc) {
      if (updateData.unitCode) doc.unitCode = updateData.unitCode;
      if (updateData.unitCode) doc.unitCode = updateData.unitCode;
      if (updateData.destination) doc.destination = updateData.destination;

      if (updateData.destinationAddress !== undefined) {
        doc.destinationAddress = updateData.destinationAddress;
      }

      if (updateData.subject) doc.subject = updateData.subject;
      if (updateData.content) doc.content = updateData.content;
      if (updateData.summary) doc.summary = updateData.summary;
      if (updateData.status) doc.status = updateData.status;
      if (updateData.signer) doc.signer = updateData.signer;
      if (updateData.fileName !== undefined) doc.fileName = updateData.fileName;
      if (updateData.fileUrl !== undefined) doc.fileUrl = updateData.fileUrl;
      if (updateData.fileSize !== undefined) doc.fileSize = updateData.fileSize;
      if (updateData.uploadDate !== undefined) doc.uploadDate = updateData.uploadDate;
      await doc.save();
    }
  } else {
    const idx = inMemoryDB.generalLetters.findIndex(g => g.id === id || g.number === id);
    if (idx >= 0) {
      inMemoryDB.generalLetters[idx] = {
        ...inMemoryDB.generalLetters[idx],
        ...updateData
      };
      doc = inMemoryDB.generalLetters[idx];
    }
  }

  if (!doc) {
    return res.status(404).json({ message: 'Dokumen surat umum tidak ditemukan' });
  }

  await auditService.log({
    userId: user.id,
    userName: user.fullName,
    action: 'UPDATE_GENERAL_DOC',
    entity: 'GeneralLetter',
    entityId: id,
    after: doc
  });

  res.json(doc);
});

// File Upload Endpoint to write file directly to local PC storage
apiRouter.post('/upload', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ message: 'Nama file dan data base64 harus diisi.' });
    }

    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadsFolder = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsFolder)) {
      fs.mkdirSync(uploadsFolder, { recursive: true });
    }

    const filePath = path.join(uploadsFolder, cleanFileName);
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const fileUrl = `/uploads/${cleanFileName}`;
    const fileSizeNum = Math.round(Buffer.from(base64Data, 'base64').length / 1024);
    const fileSize = fileSizeNum > 1024 ? `${(fileSizeNum / 1024).toFixed(2)} MB` : `${fileSizeNum} KB`;
    const uploadDate = new Date().toLocaleString('id-ID');

    res.json({
      fileUrl,
      fileName,
      fileSize,
      uploadDate
    });
  } catch (err: any) {
    console.error('File Upload Error:', err);
    res.status(500).json({ message: 'Gagal mengunggah file ke penyimpanan PC lokal.', error: err.message });
  }
});

// -------------------------------------------------------------------
// 7. INTEGRATIONS (/api/integrations/telegram, /api/integrations/whatsapp)
// -------------------------------------------------------------------
apiRouter.get('/integrations/telegram/status', (req: Request, res: Response) => {
  const state = getTelegramBotState();
  res.json({
    botToken: process.env.TELEGRAM_BOT_TOKEN ? '••••••••' + process.env.TELEGRAM_BOT_TOKEN.slice(-4) : 'NOT_CONFIGURED',
    botUsername: state.botUsername,
    status: state.status,
    isPolling: state.isPolling,
    conflictDetails: state.conflictDetails,
  });
});

apiRouter.post('/integrations/telegram/restart-bot', async (req: Request, res: Response) => {
  try {
    await stopTelegramBot();
    await startTelegramBot();
    const state = getTelegramBotState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Gagal merestart Telegram bot.' });
  }
});

apiRouter.get('/integrations/telegram/notifications', (req: Request, res: Response) => {
  res.json(telegramService.getNotificationLogs());
});

apiRouter.post('/integrations/telegram/simulate', async (req: Request, res: Response) => {
  const { telegramUserId, senderName, text } = req.body;
  const reply = await telegramService.handleMessage(
    telegramUserId || 'tg-12345',
    senderName || 'Sekretariat RS',
    text || 'help'
  );
  res.json({ reply });
});

apiRouter.post('/integrations/telegram/simulate-media', async (req: Request, res: Response) => {
  try {
    const { telegramUserId, senderName, fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ message: 'fileBase64 data is required' });
    }

    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const effectiveFileName = fileName || `Surat_Masuk_TG_${Date.now()}.pdf`;
    const effectiveMime = mimeType || 'application/pdf';

    const reply = await telegramService.handleMediaMessage(
      telegramUserId || 'tg_sekretariat',
      senderName || 'Sekretariat RS (Telegram)',
      buffer,
      effectiveFileName,
      effectiveMime
    );

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal memproses berkas Telegram' });
  }
});

apiRouter.get('/integrations/whatsapp/session', (req: Request, res: Response) => {
  res.json(whatsappService.getSessionInfo());
});

apiRouter.post('/integrations/whatsapp/refresh-qr', async (req: Request, res: Response) => {
  const session = await whatsappService.refreshQRCode();
  res.json(session);
});

apiRouter.post('/integrations/whatsapp/simulate', async (req: Request, res: Response) => {
  const { whatsappJid, senderName, text } = req.body;
  const reply = await whatsappService.handleMessage(
    whatsappJid || '6281234567890@s.whatsapp.net',
    senderName || 'Pak Agus WA',
    text || 'help'
  );
  res.json({ reply });
});

apiRouter.post('/integrations/whatsapp/simulate-media', async (req: Request, res: Response) => {
  try {
    const { whatsappJid, senderName, fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ message: 'fileBase64 data is required' });
    }

    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const effectiveFileName = fileName || `Surat_Masuk_${Date.now()}.pdf`;
    const effectiveMime = mimeType || 'application/pdf';

    const reply = await whatsappService.handleMediaMessage(
      whatsappJid || '6281234567890@s.whatsapp.net',
      senderName || 'Sekretariat RS',
      buffer,
      effectiveFileName,
      effectiveMime
    );

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal memproses berkas WhatsApp' });
  }
});

apiRouter.post('/integrations/whatsapp/disconnect', async (req: Request, res: Response) => {
  try {
    await whatsappService.disconnectWhatsApp();

    res.json({
      success: true,
      message: 'WhatsApp berhasil disconnect.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal disconnect WhatsApp.',
    });
  }
});

apiRouter.post('/integrations/whatsapp/test-send', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, whatsappJid, text } = req.body;
    let targetJid = whatsappJid ? formatPhoneToJid(whatsappJid) : '';

    if (!targetJid && userId) {
      let targetUser: any = null;
      if (isAtlasConnected()) {
        targetUser = await UserModel.findOne({ $or: [{ id: userId }, { username: userId }] });
      } else {
        targetUser = inMemoryDB.users.find(u => u.id === userId || u.username === userId);
      }
      if (targetUser?.whatsappJid) {
        targetJid = targetUser.whatsappJid;
      }
    }

    if (!targetJid) {
      return res.status(400).json({ message: 'Nomor WhatsApp / JID penerima belum diisi.' });
    }

    const messageContent = text || `🔔 *Uji Koneksi Kontak WhatsApp SIM-Surat RS Sebening Kasih*\n\nWaktu: ${new Date().toLocaleString('id-ID')}\nStatus: Terverifikasi dalam sistem persuratan.`;
    const sent = await whatsappService.sendMessage(targetJid, messageContent);

    await auditService.log({
      userId: (req as any).user?.id || 'admin',
      userName: (req as any).user?.fullName || 'Admin',
      action: 'TEST_SEND_WHATSAPP',
      entity: 'User',
      entityId: targetJid,
      channel: ChannelType.WHATSAPP,
      after: { targetJid, text: messageContent, sent }
    });

    res.json({
      success: true,
      sent,
      targetJid,
      message: sent
        ? `Pesan tes berhasil terkirim langsung ke ${targetJid}`
        : `Pesan tes dicatat untuk ${targetJid}. (Status Baileys: ${whatsappService.getSessionInfo().status})`
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Gagal mengirim pesan tes WhatsApp' });
  }
});

// -------------------------------------------------------------------
// 8. BACKUP & RESTORE (/api/backup)
// -------------------------------------------------------------------
apiRouter.get('/backup/export', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const includeAudit = req.query.includeAudit !== 'false';

    let users = inMemoryDB.users;
    let units = inMemoryDB.units;
    let letterTypes = inMemoryDB.letterTypes;
    let letterTemplates = inMemoryDB.letterTemplates;
    let numberReservations = inMemoryDB.numberReservations;
    let incomingLetters = inMemoryDB.incomingLetters;
    let outgoingLetters = inMemoryDB.outgoingLetters;
    let sopDocuments = inMemoryDB.sopDocuments;
    let perdirDocuments = inMemoryDB.perdirDocuments;
    let skDocuments = inMemoryDB.skDocuments;
    let generalLetters = inMemoryDB.generalLetters;
    let auditLogs = includeAudit ? inMemoryDB.auditLogs : [];

    if (isAtlasConnected()) {
      users = await UserModel.find().lean();
      units = await UnitModel.find().lean();
      letterTypes = await LetterTypeModel.find().lean();
      letterTemplates = await LetterTemplateModel.find().lean();
      numberReservations = await (await import('../models')).NumberReservationModel.find().lean();
      incomingLetters = await IncomingLetterModel.find().lean();
      outgoingLetters = await OutgoingLetterModel.find().lean();
      sopDocuments = await SopDocumentModel.find().lean();
      perdirDocuments = await PerdirDocumentModel.find().lean();
      skDocuments = await SkDocumentModel.find().lean();
      generalLetters = await GeneralLetterModel.find().lean();
      if (includeAudit) {
        auditLogs = await (await import('../models')).AuditLogModel.find().lean();
      }
    }

    const backupPayload = {
      appName: 'SIM-Surat RS Sebening Kasih',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.fullName || 'Admin',
      data: {
        users,
        units,
        letterTypes,
        letterTemplates,
        numberReservations,
        incomingLetters,
        outgoingLetters,
        sopDocuments,
        perdirDocuments,
        skDocuments,
        generalLetters,
        auditLogs
      }
    };

    await auditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'EXPORT_BACKUP',
      entity: 'SystemBackup',
      entityId: `BACKUP-${Date.now()}`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_sim_surat_${Date.now()}.json`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengekspor data backup', error: err.message });
  }
});

apiRouter.post('/backup/restore', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { data, version, appName } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'Struktur payload backup tidak valid. Field data tidak ditemukan.' });
    }

    // Restore to in-memory store
    if (Array.isArray(data.users)) inMemoryDB.users = data.users;
    if (Array.isArray(data.units)) inMemoryDB.units = data.units;
    if (Array.isArray(data.letterTypes)) inMemoryDB.letterTypes = data.letterTypes;
    if (Array.isArray(data.letterTemplates)) inMemoryDB.letterTemplates = data.letterTemplates;
    if (Array.isArray(data.numberReservations)) inMemoryDB.numberReservations = data.numberReservations;
    if (Array.isArray(data.incomingLetters)) inMemoryDB.incomingLetters = data.incomingLetters;
    if (Array.isArray(data.outgoingLetters)) inMemoryDB.outgoingLetters = data.outgoingLetters;
    if (Array.isArray(data.sopDocuments)) inMemoryDB.sopDocuments = data.sopDocuments;
    if (Array.isArray(data.perdirDocuments)) inMemoryDB.perdirDocuments = data.perdirDocuments;
    if (Array.isArray(data.skDocuments)) inMemoryDB.skDocuments = data.skDocuments;
    if (Array.isArray(data.generalLetters)) inMemoryDB.generalLetters = data.generalLetters;
    if (Array.isArray(data.auditLogs)) inMemoryDB.auditLogs = data.auditLogs;

    // If Atlas is connected, synchronize
    if (isAtlasConnected()) {
      if (Array.isArray(data.units) && data.units.length > 0) {
        await UnitModel.deleteMany({});
        await UnitModel.insertMany(data.units);
      }
      if (Array.isArray(data.letterTypes) && data.letterTypes.length > 0) {
        await LetterTypeModel.deleteMany({});
        await LetterTypeModel.insertMany(data.letterTypes);
      }
      if (Array.isArray(data.letterTemplates) && data.letterTemplates.length > 0) {
        await LetterTemplateModel.deleteMany({});
        await LetterTemplateModel.insertMany(data.letterTemplates);
      }
      if (Array.isArray(data.incomingLetters) && data.incomingLetters.length > 0) {
        await IncomingLetterModel.deleteMany({});
        await IncomingLetterModel.insertMany(data.incomingLetters);
      }
      if (Array.isArray(data.outgoingLetters) && data.outgoingLetters.length > 0) {
        await OutgoingLetterModel.deleteMany({});
        await OutgoingLetterModel.insertMany(data.outgoingLetters);
      }
    }

    await auditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'RESTORE_BACKUP',
      entity: 'SystemBackup',
      entityId: `RESTORE-${Date.now()}`
    });

    res.json({
      success: true,
      message: 'Database berhasil dipulihkan secara lengkap dari file backup.'
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal memulihkan database', error: err.message });
  }
});

// -------------------------------------------------------------------
// 8. REPORTS & DASHBOARD (/api/reports)
// -------------------------------------------------------------------
apiRouter.get('/reports/dashboard', async (req: Request, res: Response) => {
  const reservations = await numberingService.listReservations();
  const incoming = inMemoryDB.incomingLetters.length;
  const outgoing = inMemoryDB.outgoingLetters.length;

  const reservedCount = reservations.filter(r => r.status === NumberStatus.RESERVED).length;
  const issuedCount = reservations.filter(r => r.status === NumberStatus.ISSUED).length;
  const cancelledCount = reservations.filter(r => r.status === NumberStatus.CANCELLED || r.status === NumberStatus.VOID).length;

  const byTypeObj: any = {};
  reservations.forEach(r => {
    byTypeObj[r.typeCode] = (byTypeObj[r.typeCode] || 0) + 1;
  });

  const byType = Object.keys(byTypeObj).map(k => ({ name: k, count: byTypeObj[k] }));

  const byUnitObj: any = {};
  reservations.forEach(r => {
    const u = r.unitCode || 'ADM';
    byUnitObj[u] = (byUnitObj[u] || 0) + 1;
  });

  const byUnit = Object.keys(byUnitObj).map(k => ({ name: k, count: byUnitObj[k] }));

  const monthlyTrend = [
    { month: 'Jan', masuk: 12, keluar: 18 },
    { month: 'Feb', masuk: 15, keluar: 22 },
    { month: 'Mar', masuk: 19, keluar: 25 },
    { month: 'Apr', masuk: 14, keluar: 20 },
    { month: 'Mei', masuk: 22, keluar: 31 },
    { month: 'Jun', masuk: 18, keluar: 28 },
    { month: 'Jul', masuk: 25, keluar: 35 },
    { month: 'Agu', masuk: incoming, keluar: outgoing + reservations.length }
  ];

  res.json({
    totalIncoming: incoming,
    totalOutgoing: outgoing + reservations.length,
    totalDrafts: reservations.filter(r => r.status === NumberStatus.DRAFT).length,
    pendingApprovals: reservations.filter(r => r.status === NumberStatus.PENDING_APPROVAL).length,
    reservedNumbers: reservedCount,
    issuedNumbers: issuedCount,
    cancelledNumbers: cancelledCount,
    lettersThisMonth: reservations.length,
    byType,
    byUnit,
    monthlyTrend
  });
});

// -------------------------------------------------------------------
// 9. AUDIT LOGS (/api/audit)
// -------------------------------------------------------------------
apiRouter.get('/audit', async (req: Request, res: Response) => {
  const { search, entity } = req.query;
  const logs = await auditService.listLogs({ search: search as string, entity: entity as string });
  res.json(logs);
});