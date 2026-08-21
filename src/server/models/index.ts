import mongoose, { Schema } from 'mongoose';

// User Schema
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true, default: 'User' },
  unitId: { type: String },
  unitCode: { type: String },
  telegramAccountId: { type: String },
  whatsappJid: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Unit Schema
const UnitSchema = new Schema({
  id: { type: String },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'Administrasi' },
  isActive: { type: Boolean, default: true }
});

// LetterType Schema
const LetterTypeSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  format: { type: String, required: true },
  prefix: { type: String },
  scope: { type: String, default: 'TYPE_YEAR' },
  resetSequence: { type: String, default: 'YEARLY' },
  startingNumber: { type: Number, default: 1 },
  padding: { type: Number, default: 3 },
  requiresUnit: { type: Boolean, default: true },
  requiresTitle: { type: Boolean, default: true },
  requiresSubject: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false }
});

// NumberCounter Schema (Atomic Counter Key)
const NumberCounterSchema = new Schema({
  _id: { type: String, required: true },
  typeCode: { type: String, required: true },
  unitCode: { type: String },
  year: { type: Number },
  month: { type: Number },
  currentNumber: { type: Number, required: true, default: 0 }
});

// NumberReservation Schema
const NumberReservationSchema = new Schema({
  number: { type: String, required: true, unique: true },
  typeCode: { type: String, required: true },
  unitCode: { type: String },
  instansi: { type: String, default: 'RSSBK' },
  title: { type: String },
  subject: { type: String },
  status: { type: String, default: 'RESERVED' },
  channel: { type: String, default: 'WEB' },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  requestId: { type: String },
  previousCancelledNumber: { type: String },
  cancelReason: { type: String },
  issuedAt: { type: Date },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  sequenceNumber: { type: Number, required: true }
});
NumberReservationSchema.index({ requestId: 1 }, { sparse: true });

// IncomingLetter Schema
const IncomingLetterSchema = new Schema({
  agendaNumber: { type: String, required: true, unique: true },
  letterNumber: { type: String, required: true },
  letterDate: { type: String, required: true },
  receivedDate: { type: String, required: true },
  sender: { type: String, required: true },
  senderAddress: { type: String },
  subject: { type: String, required: true },
  recipient: { type: String, required: true },
  receiverUnitCode: { type: String, required: true },
  classification: { type: String, default: 'Biasa' },
  urgency: { type: String, default: 'Biasa' },
  attachments: [{ type: String }],
  fileName: { type: String },
  fileUrl: { type: String },
  fileSize: { type: String },
  mimeType: { type: String },
  uploadedBy: { type: String },
  uploadedAt: { type: String },
  channel: { type: String, default: 'WEB' },
  notes: { type: String },
  status: { type: String, default: 'PROCESSED' },
  dispositions: [{
    id: String,
    referenceNumber: String,
    incomingLetterId: String,
    fromUser: String,
    fromJid: String,
    toUserOrUnit: String,
    toJid: String,
    targetUnitCode: String,
    instruction: String,
    deadline: String,
    status: { type: String, default: 'PENDING_APPROVAL' },
    notes: String,
    rejectionReason: String,
    revisionNotes: String,
    approvedBy: String,
    approvedAt: String,
    processedBy: String,
    processedAt: String,
    completedAt: String,
    createdAt: { type: Date, default: Date.now }
  }],
  activityHistory: [{
    user: String,
    action: String,
    details: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// OutgoingLetter Schema
const OutgoingLetterSchema = new Schema({
  typeCode: {
    type: String,
    required: true
  },

  number: {
    type: String,
    required: true,
    unique: true
  },

  date: {
    type: String,
    required: true
  },

  unitCode: {
    type: String,
    required: true
  },

  title: {
    type: String
  },

  subject: {
    type: String
  },

  // Tujuan surat WAJIB
  destination: {
    type: String,
    required: true,
    trim: true
  },

  // Alamat tujuan OPSIONAL
  destinationAddress: {
    type: String,
    trim: true,
    default: undefined
  },

  signer: {
    type: String,
    required: true
  },

  signerTitle: {
    type: String,
    required: true
  },

  attachments: [{
    type: String
  }],

  content: {
    type: String
  },

  status: {
    type: String,
    default: 'DRAFT'
  },

  channel: {
    type: String,
    default: 'WEB'
  },

  notes: {
    type: String
  },

  previousCancelledNumber: {
    type: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// SopDocument Schema
const SopDocumentSchema = new Schema({
  number: { type: String, required: true, unique: true },
  unitCode: { type: String, required: true },
  title: { type: String, required: true },
  purpose: { type: String, required: true },
  scope: { type: String, required: true },
  policy: { type: String, required: true },
  procedure: { type: String, required: true },
  relatedDocs: { type: String },
  reference: { type: String },
  effectiveDate: { type: String, required: true },
  revisionDate: { type: String },
  version: { type: String, default: '1.0' },
  pic: { type: String, required: true },
  status: { type: String, default: 'ACTIVE' },
  previousCancelledNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// PerdirDocument Schema
const PerdirDocumentSchema = new Schema({
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  about: { type: String, required: true },
  legalBasis: { type: String, required: true },
  body: { type: String, required: true },
  signer: { type: String, required: true },
  date: { type: String, required: true },
  status: { type: String, default: 'ACTIVE' },
  previousCancelledNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// SkDocument Schema
const SkDocumentSchema = new Schema({
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  about: { type: String, required: true },
  basis: { type: String, required: true },
  considering: { type: String, required: true },
  inViewOf: { type: String, required: true },
  decides: { type: String, required: true },
  enactment: { type: String, required: true },
  signer: { type: String, required: true },
  date: { type: String, required: true },
  status: { type: String, default: 'ACTIVE' },
  previousCancelledNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// GeneralLetter Schema
const GeneralLetterSchema = new Schema({
  id: { type: String },
  number: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  unitCode: { type: String, required: true },
  destination: { type: String },
  subject: { type: String, required: true },
  summary: { type: String },
  content: { type: String },
  signer: { type: String },
  status: { type: String, default: 'ISSUED' },
  channel: { type: String, default: 'WEB' },
  fileName: { type: String },
  fileUrl: { type: String },
  fileSize: { type: String },
  uploadDate: { type: String },
  previousCancelledNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// LetterTemplate Schema
const LetterTemplateSchema = new Schema({
  id: { type: String },
  title: { type: String, required: true },
  category: { type: String, required: true },
  typeCode: { type: String },
  contentPattern: { type: String, required: true },
  variables: [{ type: String }]
});

// AuditLog Schema
const AuditLogSchema = new Schema({
  userId: { type: String },
  userName: { type: String },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String },
  channel: { type: String, default: 'WEB' },
  ip: { type: String },
  userAgent: { type: String },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

export const UserModel = (mongoose.models.User || mongoose.model('User', UserSchema)) as mongoose.Model<any>;
export const UnitModel = (mongoose.models.Unit || mongoose.model('Unit', UnitSchema)) as mongoose.Model<any>;
export const LetterTypeModel = (mongoose.models.LetterType || mongoose.model('LetterType', LetterTypeSchema)) as mongoose.Model<any>;
export const NumberCounterModel = (mongoose.models.NumberCounter || mongoose.model('NumberCounter', NumberCounterSchema)) as mongoose.Model<any>;
export const NumberReservationModel = (mongoose.models.NumberReservation || mongoose.model('NumberReservation', NumberReservationSchema)) as mongoose.Model<any>;
export const IncomingLetterModel = (mongoose.models.IncomingLetter || mongoose.model('IncomingLetter', IncomingLetterSchema)) as mongoose.Model<any>;
export const OutgoingLetterModel = (mongoose.models.OutgoingLetter || mongoose.model('OutgoingLetter', OutgoingLetterSchema)) as mongoose.Model<any>;
export const SopDocumentModel = (mongoose.models.SopDocument || mongoose.model('SopDocument', SopDocumentSchema)) as mongoose.Model<any>;
export const PerdirDocumentModel = (mongoose.models.PerdirDocument || mongoose.model('PerdirDocument', PerdirDocumentSchema)) as mongoose.Model<any>;
export const SkDocumentModel = (mongoose.models.SkDocument || mongoose.model('SkDocument', SkDocumentSchema)) as mongoose.Model<any>;
export const GeneralLetterModel = (mongoose.models.GeneralLetter || mongoose.model('GeneralLetter', GeneralLetterSchema)) as mongoose.Model<any>;
export const LetterTemplateModel = (mongoose.models.LetterTemplate || mongoose.model('LetterTemplate', LetterTemplateSchema)) as mongoose.Model<any>;
export const AuditLogModel = (mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)) as mongoose.Model<any>;