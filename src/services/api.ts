import {
  IDashboardStats, ILetterType, IUnit, ILetterTemplate,
  INumberReservation, IIncomingLetter, IOutgoingLetter,
  IDocumentSop, IDocumentPerdir, IDocumentSk, IDocumentGeneral,
  IAuditLog, IUser
} from '../types';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token') || 'mock-jwt-token';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Terjadi kesalahan pada server' }));
    throw new Error(errorData.message || `HTTP Error ${res.status}`);
  }
  return res.json();
}

export const apiService = {
  async disconnectWhatsapp() {
    const response = await fetch(
      '/api/integrations/whatsapp/disconnect',
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Gagal disconnect WhatsApp');
    }

    return response.json();
  },
  // Dashboard
  getDashboardStats: () => fetchJson<IDashboardStats>('/api/reports/dashboard'),

  // Letter Types & Units
  getLetterTypes: () => fetchJson<ILetterType[]>('/api/letters/types'),
  createLetterType: (data: Partial<ILetterType>) => fetchJson<ILetterType>('/api/letters/types', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateLetterType: (id: string, data: Partial<ILetterType>) => fetchJson<ILetterType>(`/api/letters/types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  setLetterTypeLock: (id: string, isLocked: boolean) =>
    fetchJson<ILetterType>(`/api/letters/types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ isLocked })
    }),

  getUnits: () => fetchJson<IUnit[]>('/api/units'),
  createUnit: (data: Partial<IUnit>) => fetchJson<IUnit>('/api/units', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUnit: (id: string, data: Partial<IUnit>) => fetchJson<IUnit>(`/api/units/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteUnit: (id: string) => fetchJson<{ message: string }>(`/api/units/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  }),

  // Templates
  getTemplates: () => fetchJson<ILetterTemplate[]>('/api/letters/templates'),
  createTemplate: (data: Partial<ILetterTemplate>) => fetchJson<ILetterTemplate>('/api/letters/templates', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTemplate: (id: string, data: Partial<ILetterTemplate>) => fetchJson<ILetterTemplate>(`/api/letters/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteTemplate: (id: string) => fetchJson<{ message: string }>(`/api/letters/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  }),

  // Numbering Engine
  previewNumber: (data: { format: string; typeCode: string; unitCode?: string; padding?: number }) =>
    fetchJson<{ preview: string }>('/api/numbering/preview', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  reserveNumber: (data: { typeCode: string; unitCode?: string; title?: string; subject?: string; requestId?: string }) =>
    fetchJson<INumberReservation>('/api/numbering/reserve', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    async reserveMultipleNumbers(data: {
      typeCode: string;
      unitCode?: string;
      count: number;
      subjects?: string[];
      titles?: string[];
      requestId?: string;
      instansi?: string;
    }) {
      const response = await fetch('/api/numbering/reserve-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || 'Gagal mengambil nomor surat secara massal.'
        );
      }

      return response.json();
    },

  setCounter: (data: { typeCode: string; sequenceNumber: number; year?: number; unitCode?: string }) =>
    fetchJson<{ message: string; result: any }>('/api/numbering/counters/set', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  resetProduction: () => fetchJson<{ message: string }>('/api/system/reset-production', { method: 'POST' }),


  issueNumber: (number: string) => fetchJson<INumberReservation>('/api/numbering/issue', {
    method: 'POST',
    body: JSON.stringify({ number })
  }),

  cancelNumber: (number: string, reason: string) => fetchJson<INumberReservation>('/api/numbering/cancel', {
    method: 'POST',
    body: JSON.stringify({ number, reason })
  }),

  getNumberHistory: (filters: { status?: string; typeCode?: string; unitCode?: string; search?: string } = {}) => {
    const params = new URLSearchParams(filters as any);
    return fetchJson<INumberReservation[]>(`/api/numbering/history?${params.toString()}`);
  },

  testConcurrency: (count: number, typeCode: string, unitCode: string) =>
    fetchJson<any>('/api/numbering/test-concurrency', {
      method: 'POST',
      body: JSON.stringify({ count, typeCode, unitCode })
    }),

  // Incoming Letters
  getIncomingLetters: () => fetchJson<IIncomingLetter[]>('/api/letters/incoming'),
  createIncomingLetter: (data: Partial<IIncomingLetter>) => fetchJson<IIncomingLetter>('/api/letters/incoming', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  createDisposition: (incomingId: string, data: { toUserOrUnit: string; instruction: string; deadline?: string; notes?: string; targetUnitCode?: string; toJid?: string }) =>
    fetchJson<any>(`/api/letters/incoming/${incomingId}/disposition`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  approveDisposition: (dispId: string, notes?: string) =>
    fetchJson<any>(`/api/letters/incoming/dispositions/${dispId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    }),
  rejectDisposition: (dispId: string, reason?: string) =>
    fetchJson<any>(`/api/letters/incoming/dispositions/${dispId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    }),
  requestRevisionDisposition: (dispId: string, notes?: string) =>
    fetchJson<any>(`/api/letters/incoming/dispositions/${dispId}/revision`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    }),
  processDisposition: (dispId: string) =>
    fetchJson<any>(`/api/letters/incoming/dispositions/${dispId}/process`, {
      method: 'PUT'
    }),
  completeDisposition: (dispId: string) =>
    fetchJson<any>(`/api/letters/incoming/dispositions/${dispId}/complete`, {
      method: 'PUT'
    }),

  // Outgoing Letters
  getOutgoingLetters: () =>
    fetchJson<IOutgoingLetter[]>('/api/letters/outgoing'),

  createOutgoingLetter: (data: {
    typeCode: string;
    unitCode: string;
    destination: string;
    destinationAddress?: string;
    subject: string;
    content?: string;
  }) =>
    fetchJson<IOutgoingLetter>('/api/letters/outgoing', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        destinationAddress: data.destinationAddress?.trim() || undefined
      })
    }),

  // Documents
  getSopDocuments: () => fetchJson<IDocumentSop[]>('/api/sop'),
  createSopDocument: (data: Partial<IDocumentSop>) => fetchJson<IDocumentSop>('/api/sop', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getPerdirDocuments: () => fetchJson<IDocumentPerdir[]>('/api/perdir'),
  createPerdirDocument: (data: Partial<IDocumentPerdir>) => fetchJson<IDocumentPerdir>('/api/perdir', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getSkDocuments: () => fetchJson<IDocumentSk[]>('/api/sk'),
  createSkDocument: (data: Partial<IDocumentSk>) => fetchJson<IDocumentSk>('/api/sk', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getUmumDocuments: () => fetchJson<any[]>('/api/general'),
  createUmumDocument: (data: any) => fetchJson<any>('/api/general', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUmumDocument: (id: string, data: any) => fetchJson<any>(`/api/general/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  uploadFile: (fileName: string, fileData: string) => fetchJson<{ fileUrl: string; fileName: string; fileSize: string; uploadDate: string }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileData })
  }),

  getGeneralLetters: () => fetchJson<IDocumentGeneral[]>('/api/general'),
  createGeneralLetter: (data: Partial<IDocumentGeneral>) => fetchJson<IDocumentGeneral>('/api/general', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Integrations
  getTelegramStatus: () => fetchJson<any>('/api/integrations/telegram/status'),
  restartTelegramBot: () => fetchJson<any>('/api/integrations/telegram/restart-bot', { method: 'POST' }),
  getTelegramNotifications: () => fetchJson<any[]>('/api/integrations/telegram/notifications'),
  simulateTelegramMsg: (text: string, telegramUserId = 'tg_sekretariat', senderName = 'Sekretariat RS (Telegram)') =>
    fetchJson<{ reply: string }>('/api/integrations/telegram/simulate', {
      method: 'POST',
      body: JSON.stringify({ telegramUserId, senderName, text })
    }),
  simulateTelegramMedia: (fileBase64: string, fileName: string, mimeType: string, telegramUserId = 'tg_sekretariat', senderName = 'Sekretariat RS (Telegram)') =>
    fetchJson<{ reply: string }>('/api/integrations/telegram/simulate-media', {
      method: 'POST',
      body: JSON.stringify({ fileBase64, fileName, mimeType, telegramUserId, senderName })
    }),

  getWhatsappSession: () => fetchJson<any>('/api/integrations/whatsapp/session'),
  refreshWhatsappQR: () => fetchJson<any>('/api/integrations/whatsapp/refresh-qr', { method: 'POST' }),
  simulateWhatsappMsg: (text: string, whatsappJid = '628122650582@s.whatsapp.net', senderName = 'Sekretariat RS') =>
    fetchJson<{ reply: string }>('/api/integrations/whatsapp/simulate', {
      method: 'POST',
      body: JSON.stringify({ whatsappJid, senderName, text })
    }),
  simulateWhatsappMedia: (fileBase64: string, fileName: string, mimeType: string, whatsappJid = '628122650582@s.whatsapp.net', senderName = 'Sekretariat RS') =>
    fetchJson<{ reply: string }>('/api/integrations/whatsapp/simulate-media', {
      method: 'POST',
      body: JSON.stringify({ fileBase64, fileName, mimeType, whatsappJid, senderName })
    }),

  // Users & Contacts
  getUsers: () => fetchJson<IUser[]>('/api/users'),
  createUser: (data: Partial<IUser>) => fetchJson<IUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUser: (id: string, data: Partial<IUser>) => fetchJson<IUser>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  updateUserWhatsapp: (id: string, data: { whatsappJid?: string; fullName?: string; unitCode?: string; role?: any; isActive?: boolean }) =>
    fetchJson<IUser>(`/api/users/${encodeURIComponent(id)}/whatsapp`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  testSendWhatsapp: (data: { userId?: string; whatsappJid?: string; text?: string }) =>
    fetchJson<{ success: boolean; sent: boolean; targetJid: string; message: string }>('/api/integrations/whatsapp/test-send', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Audit
  getAuditLogs: (search?: string) => fetchJson<IAuditLog[]>(`/api/audit${search ? '?search=' + encodeURIComponent(search) : ''}`)
};