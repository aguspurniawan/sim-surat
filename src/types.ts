/**
 * Shared Type Definitions
 * Sistem Manajemen Surat Terintegrasi
 */

export enum RoleName {
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Admin',
  PIMPINAN = 'Pimpinan',
  DIREKSI = 'Direksi',
  SEKRETARIAT = 'Sekretariat',
  STAFF = 'Staff Admin',
  OPERATOR = 'Operator',
  USER = 'User',
  VIEWER = 'Viewer',
}

export enum NumberStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
}

export enum SequenceScope {
  GLOBAL = 'GLOBAL',
  TYPE = 'TYPE',
  UNIT = 'UNIT',
  TYPE_UNIT = 'TYPE_UNIT',
  TYPE_YEAR = 'TYPE_YEAR',
  TYPE_UNIT_YEAR = 'TYPE_UNIT_YEAR',
  TYPE_UNIT_MONTH = 'TYPE_UNIT_MONTH',
}

export enum SequenceReset {
  NEVER = 'NEVER',
  YEARLY = 'YEARLY',
  MONTHLY = 'MONTHLY',
}

export enum ChannelType {
  WEB = 'WEB',
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
}

export enum LetterClassification {
  SECRET = 'Rahasia',
  IMPORTANT = 'Penting',
  NORMAL = 'Biasa',
}

export enum LetterUrgency {
  VERY_URGENT = 'Sangat Segera',
  URGENT = 'Segera',
  NORMAL = 'Biasa',
}

export enum IncomingLetterStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PROCESSED = 'PROCESSED',
  DISPOSITIONED = 'DISPOSITIONED',
  ARCHIVED = 'ARCHIVED',
}

export enum DispositionStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  ARCHIVED = 'ARCHIVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum WhatsappSessionStatus {
  DISCONNECTED = 'DISCONNECTED',
  PAIRING = 'PAIRING',
  CONNECTED = 'CONNECTED',
}

export enum TelegramStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/* =========================
   USER & UNIT
========================= */

export interface IUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: RoleName;

  unitId?: string;
  unitCode?: string;
  unitName?: string;

  telegramAccountId?: string;
  whatsappJid?: string;

  isActive: boolean;
  createdAt: string;
}

export interface IUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
}

/* =========================
   LETTER CONFIGURATION
========================= */

export interface ILetterType {
  id: string;
  code: string;
  name: string;

  format: string;
  prefix?: string;

  scope: SequenceScope;
  resetSequence: SequenceReset;

  startingNumber: number;
  padding: number;

  requiresUnit: boolean;
  requiresTitle: boolean;
  requiresSubject: boolean;

  isActive: boolean;
  isLocked: boolean;
}

export interface ILetterTemplate {
  id: string;
  title: string;
  category: string;
  typeCode?: string;

  contentPattern: string;
  variables: string[];
}

/* =========================
   NUMBER RESERVATION
========================= */

export interface INumberReservation {
  id: string;

  number: string;
  typeCode: string;
  unitCode?: string;
  instansi: string;

  title?: string;
  subject?: string;

  status: NumberStatus;
  channel: ChannelType;

  userId: string;
  userName: string;

  requestId?: string;

  previousCancelledNumber?: string;
  cancelReason?: string;

  issuedAt?: string;
  cancelledAt?: string;

  createdAt: string;

  year: number;
  month: number;
  sequenceNumber: number;
}

/* =========================
   INCOMING LETTER
========================= */

export interface IIncomingLetter {
  id: string;

  agendaNumber: string;
  letterNumber: string;

  letterDate: string;
  receivedDate: string;

  sender: string;
  senderAddress?: string;

  subject: string;
  recipient: string;
  receiverUnitCode: string;

  classification: LetterClassification;
  urgency: LetterUrgency;

  attachments?: string[];

  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  mimeType?: string;

  uploadedBy?: string;
  uploadedAt?: string;

  channel?: ChannelType | string;
  notes?: string;

  status: IncomingLetterStatus;

  dispositions: IDisposition[];
  activityHistory: IActivity[];

  createdAt: string;
}

/* =========================
   DISPOSITION
========================= */

export interface IDisposition {
  id: string;

  referenceNumber?: string;
  incomingLetterId: string;

  fromUser: string;
  fromJid?: string;

  toUserOrUnit: string;
  toJid?: string;

  targetUnitCode?: string;

  instruction: string;
  deadline?: string;

  status: DispositionStatus;

  notes?: string;
  directorNotes?: string;

  rejectionReason?: string;
  revisionNotes?: string;

  approvedBy?: string;
  approvedAt?: string;

  processedBy?: string;
  processedAt?: string;

  completedAt?: string;

  createdAt: string;
}

/* =========================
   OUTGOING LETTER
========================= */

export interface IOutgoingLetter {
  id: string;

  number: string;
  letterNumber?: string;

  date: string;

  typeCode: string;
  unitCode: string;

  destination: string;
  destinationAddress?: string;

  subject: string;
  title?: string;

  content?: string;

  signer?: string;
  creatorName?: string;

  status: DocumentStatus;

  channel?: ChannelType | string;

  createdAt: string;
}

/* =========================
   DOCUMENT SOP
========================= */

export interface IDocumentSop {
  id: string;

  number: string;
  title: string;
  unitCode: string;

  purpose?: string;
  scope?: string;
  policy?: string;
  procedure?: string;

  pic?: string;
  version?: string;
  effectiveDate?: string;

  status: DocumentStatus;

  createdAt: string;
}

/* =========================
   DOCUMENT PERDIR
========================= */

export interface IDocumentPerdir {
  id: string;

  number: string;
  title: string;

  about?: string;
  considering?: string;
  inViewOf?: string;
  legalBasis?: string;

  decides?: string;
  body?: string;
  enactment?: string;

  signer?: string;
  date?: string;

  status: DocumentStatus;

  createdAt: string;
}

/* =========================
   DOCUMENT SK
========================= */

export interface IDocumentSk {
  id: string;

  number: string;
  title: string;

  about?: string;
  basis?: string;
  considering?: string;
  inViewOf?: string;

  decides?: string;
  enactment?: string;

  signer?: string;
  date?: string;

  status: DocumentStatus;

  createdAt: string;
}

/* =========================
   DOCUMENT UMUM
========================= */

export interface IDocumentUmum {
  id: string;

  number: string;
  date: string;

  unitCode: string;

  destination: string;
  subject: string;

  summary?: string;
  content?: string;

  signer?: string;

  status: DocumentStatus;

  channel?: ChannelType | string;

  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  mimeType?: string;

  uploadedBy?: string;
  uploadDate?: string;

  createdAt: string;
}

export type IDocumentGeneral = IDocumentUmum;

/* =========================
   ACTIVITY & AUDIT
========================= */

export interface IActivity {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface IAuditLog {
  id: string;

  userId: string;
  userName: string;

  action: string;
  entity: string;
  entityId?: string;

  channel: ChannelType;

  ip: string;
  userAgent: string;

  before?: Record<string, unknown>;
  after?: Record<string, unknown>;

  timestamp: string;
}

/* =========================
   WHATSAPP
========================= */

export interface IWhatsappSession {
  status: WhatsappSessionStatus;

  accountName?: string;
  jid?: string;
  qrCodeUrl?: string;

  lastConnected?: string;
}

/* =========================
   TELEGRAM
========================= */

export interface ITelegramConfig {
  botToken: string;
  botUsername: string;

  status: TelegramStatus;

  webhookUrl?: string;
}

/* =========================
   DASHBOARD
========================= */

export interface IDashboardStats {
  totalIncoming: number;
  totalOutgoing: number;

  totalDrafts: number;
  pendingApprovals: number;

  reservedNumbers: number;
  issuedNumbers: number;
  cancelledNumbers: number;

  lettersThisMonth: number;

  byType: Array<{
    name: string;
    count: number;
  }>;

  byUnit: Array<{
    name: string;
    count: number;
  }>;

  monthlyTrend: Array<{
    month: string;
    masuk: number;
    keluar: number;
  }>;
}