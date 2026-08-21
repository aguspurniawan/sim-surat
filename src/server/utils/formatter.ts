/**
 * Token parser and Roman numerals formatter for Letter Numbering
 */

export function toRomanNumeral(monthNum: number): string {
  const romanMonths = [
    'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  ];
  if (monthNum >= 1 && monthNum <= 12) {
    return romanMonths[monthNum - 1];
  }
  return 'I';
}

export interface FormatOptions {
  sequenceNumber: number;
  padding: number; // e.g., 3 -> "001"
  typeCode: string; // e.g., SPO
  unitCode?: string; // e.g., KEP
  instansi?: string; // e.g., RSSBK
  year?: number; // e.g., 2026
  month?: number; // 1-12
}

export function formatLetterNumber(pattern: string, options: FormatOptions): string {
  const {
    sequenceNumber,
    padding = 3,
    typeCode = 'UMUM',
    unitCode = 'ADM',
    instansi = 'RSSBK',
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1
  } = options;

  const paddedNo = String(sequenceNumber).padStart(padding, '0');
  const monthTwoDigit = String(month).padStart(2, '0');
  const romanMonth = toRomanNumeral(month);
  const year4Digit = String(year);
  const year2Digit = String(year).slice(-2);

  let formatted = pattern;

  formatted = formatted.replace(/{NO}/g, paddedNo);
  formatted = formatted.replace(/{KODE}/g, typeCode);
  formatted = formatted.replace(/{UNIT}/g, unitCode || 'ADM');
  formatted = formatted.replace(/{UNIT_CODE}/g, unitCode || 'ADM');
  formatted = formatted.replace(/{INSTANSI}/g, instansi);
  formatted = formatted.replace(/{BULAN}/g, monthTwoDigit);
  formatted = formatted.replace(/{BULAN_ROMAWI}/g, romanMonth);
  formatted = formatted.replace(/{TAHUN}/g, year4Digit);
  formatted = formatted.replace(/{TAHUN_2}/g, year2Digit);

  // Clean double slashes or clean trailing slashes if unit was empty
  formatted = formatted.replace(/\/\//g, '/');

  return formatted;
}
