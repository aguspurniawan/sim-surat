/**
 * Helper utilities for WhatsApp numbers and Baileys JID formatting
 */

/**
 * Clean and normalize phone number into Indonesian E.164 without plus:
 * e.g., "0812-3456-7890", "+62 812 3456 7890", "81234567890" -> "6281234567890"
 */
export function normalizePhoneNumber(input?: string): string {
  if (!input) return '';
  // Remove non-digit characters
  let clean = input.replace(/\D/g, '');

  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1);
  } else if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }

  return clean;
}

/**
 * Format phone number into Baileys standard JID:
 * e.g. "081234567890" -> "6281234567890@s.whatsapp.net"
 */
export function formatPhoneToJid(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.includes('@s.whatsapp.net') || trimmed.includes('@g.us')) {
    return trimmed;
  }
  const cleanPhone = normalizePhoneNumber(trimmed);
  if (!cleanPhone || cleanPhone.length < 8) return '';
  return `${cleanPhone}@s.whatsapp.net`;
}

/**
 * Extract human readable phone number from JID or raw string:
 * e.g. "6281234567890@s.whatsapp.net" -> "0812-3456-7890" or "+62 812-3456-7890"
 */
export function formatJidToDisplayPhone(jid?: string): string {
  if (!jid) return '-';
  const cleanNumber = jid.split('@')[0].replace(/\D/g, '');
  if (!cleanNumber) return '-';

  if (cleanNumber.startsWith('62')) {
    const rest = cleanNumber.slice(2);
    // Format nicely e.g. +62 812-3456-7890
    if (rest.length >= 8) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    return `+62 ${rest}`;
  }

  return cleanNumber;
}

/**
 * Validate whether a string is a potentially valid WhatsApp number/JID
 */
export function isValidWhatsAppJid(input?: string): boolean {
  if (!input) return false;
  const clean = normalizePhoneNumber(input);
  return clean.length >= 9 && clean.length <= 16;
}
