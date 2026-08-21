import mongoose from 'mongoose';

// In-memory fallback datastore if MongoDB Atlas is not yet configured or unreachable
export interface InMemStore {
  users: any[];
  roles: any[];
  units: any[];
  letterTypes: any[];
  numberingConfigs: any[];
  numberCounters: Map<string, number>;
  numberReservations: any[];
  incomingLetters: any[];
  outgoingLetters: any[];
  sopDocuments: any[];
  perdirDocuments: any[];
  skDocuments: any[];
  generalLetters: any[];
  letterTemplates: any[];
  letterApprovals: any[];
  letterDispositions: any[];
  telegramAccounts: any[];
  whatsappSessions: any[];
  auditLogs: any[];
  systemSettings: any[];
}

export const inMemoryDB: InMemStore = {
  users: [],
  roles: [],
  units: [],
  letterTypes: [],
  numberingConfigs: [],
  numberCounters: new Map<string, number>(),
  numberReservations: [],
  incomingLetters: [],
  outgoingLetters: [],
  sopDocuments: [],
  perdirDocuments: [],
  skDocuments: [],
  generalLetters: [],
  letterTemplates: [],
  letterApprovals: [],
  letterDispositions: [],
  telegramAccounts: [],
  whatsappSessions: [],
  auditLogs: [],
  systemSettings: []
};

let isConnectedToAtlas = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('username:password')) {
    console.log('ℹ️ MONGODB_URI not set or using placeholder. Running in-memory database mode for Atlas compatibility.');
    return false;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'surat_db',
      serverSelectionTimeoutMS: 5000,
    });
    isConnectedToAtlas = true;
    console.log('✅ Connected to MongoDB Atlas successfully!');
    return true;
  } catch (err) {
    console.warn('⚠️ Could not connect to MongoDB Atlas URI. Defaulting to high-performance in-memory datastore mode.', err);
    isConnectedToAtlas = false;
    return false;
  }
}

export function isAtlasConnected() {
  return isConnectedToAtlas && mongoose.connection.readyState === 1;
}
