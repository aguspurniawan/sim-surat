import { GoogleGenAI } from '@google/genai';

export interface ExtractedLetterData {
  letterNumber: string;
  letterDate: string;
  receivedDate: string;
  sender: string;
  senderAddress: string;
  subject: string;
  recipient: string;
  classification: string;
  urgency: string;
  rawText?: string;
  confidence: number;
}

export class DocumentExtractorService {
  private aiClient: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI | null {
    if (!this.aiClient && process.env.GEMINI_API_KEY) {
      try {
        this.aiClient = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
      } catch (error) {
        console.error(
          '❌ Gemini Client initialization error:',
          error
        );
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        '⚠️ GEMINI_API_KEY belum tersedia di environment.'
      );
    }

    return this.aiClient;
  }

  /**
   * ============================================================
   * MAIN EXTRACTION
   * ============================================================
   */
  public async extract(
    fileBuffer?: Buffer,
    fileName?: string,
    mimeType?: string,
    rawTextHint?: string
  ): Promise<ExtractedLetterData> {
    const todayStr = new Date().toISOString().split('T')[0];
    const client = this.getClient();
    const effectiveMime = this.resolveMimeType(
      fileName,
      mimeType
    );

    console.log('🔎 Document extraction started:', {
      fileName,
      mimeType: effectiveMime,
      size: fileBuffer?.length || 0,
      hasGeminiClient: !!client,
    });

    // ============================================================
    // 1. GEMINI MULTIMODAL
    // ============================================================
    if (
      client &&
      fileBuffer &&
      fileBuffer.length > 0 &&
      effectiveMime
    ) {
      try {
        const base64Data =
          fileBuffer.toString('base64');

        const prompt = `
Anda adalah sistem OCR dokumen surat masuk resmi
untuk rumah sakit di Indonesia.

BACA DOKUMEN TERLAMPIR SECARA LANGSUNG.

JANGAN menggunakan nama file sebagai sumber data.
JANGAN membuat data yang tidak terlihat pada dokumen.
JANGAN mengarang nomor surat.
JANGAN mengarang nama pengirim.
JANGAN menggunakan nama file sebagai perihal.

Ekstrak informasi berikut:

{
  "letterNumber": "",
  "letterDate": "",
  "sender": "",
  "senderAddress": "",
  "subject": "",
  "recipient": "",
  "classification": "",
  "urgency": "",
  "confidence": 0
}

ATURAN:

1. letterNumber
   Ambil nomor surat asli yang tertulis pada dokumen.
   Contoh:
   440/123/DINKES/VIII/2026

   Jika tidak terlihat atau tidak terbaca:
   ""

2. letterDate
   Ambil tanggal surat yang tertulis.
   Format:
   YYYY-MM-DD

   Jika tidak terbaca:
   ""

3. sender
   Ambil nama instansi/organisasi/pengirim.
   Contoh:
   Dinas Kesehatan Kabupaten Pati

   Jika tidak terbaca:
   ""

4. senderAddress
   Ambil alamat pengirim jika tertulis.
   Jika tidak ada:
   ""

5. subject
   Cari:
   Perihal
   Hal
   Tentang
   Subjek

   Jangan gunakan nama file.
   Jangan membuat perihal.
   Jika tidak terbaca:
   ""

6. recipient
   Ambil penerima surat dari dokumen.
   Contoh:
   Direktur RSU Sebening Kasih

   Jika tidak terbaca:
   ""

7. classification
   Hanya boleh:
   "Biasa"
   "Penting"
   "Rahasia"

8. urgency
   Hanya boleh:
   "Biasa"
   "Segera"
   "Sangat Segera"

9. confidence
   Angka 0 sampai 1.
   Nilai harus mencerminkan keyakinan terhadap hasil OCR.

ATURAN TAMBAHAN:
- Jika dokumen terlihat jelas tetapi sebuah field memang tidak ada,
  isi "".
- Jangan mengisi field dengan nama file.
- Jangan membuat nomor surat dari angka pada nama file.
- Jangan membuat sender default.
- Jangan mengarang subject.

HANYA KEMBALIKAN JSON VALID.
JANGAN gunakan markdown.
`;

        console.log('🤖 Mengirim dokumen ke Gemini...');

        const response = await client.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: prompt,
                },
                {
                  inlineData: {
                    mimeType: effectiveMime,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });
        const textOutput =
          response.text?.trim() || '';

        console.log(
          '🤖 Gemini response length:',
          textOutput.length
        );

        if (!textOutput) {
          throw new Error(
            'Gemini tidak mengembalikan teks hasil ekstraksi.'
          );
        }

        const cleanJson =
          this.extractJsonFromResponse(
            textOutput
          );

        const parsed =
          JSON.parse(cleanJson);

        const normalized =
          this.normalizeAIResult(
            parsed,
            todayStr
          );

        console.log(
          '✅ OCR Gemini berhasil:',
          {
            fileName,
            letterNumber:
              normalized.letterNumber || '-',
            letterDate:
              normalized.letterDate || '-',
            sender:
              normalized.sender || '-',
            subject:
              normalized.subject || '-',
            recipient:
              normalized.recipient || '-',
            confidence:
              normalized.confidence,
          }
        );

        return {
          ...normalized,
          rawText: textOutput,
        };
      } catch (error: any) {
        console.error(
          '❌ GEMINI EXTRACTION ERROR'
        );

        console.error(
          'Message:',
          error?.message || error
        );

        console.error(
          'Stack:',
          error?.stack || '-'
        );

        console.error(
          'File:',
          fileName || '-'
        );

        console.error(
          'Mime:',
          effectiveMime || '-'
        );

        console.warn(
          '⚠️ Gemini gagal. Menggunakan fallback heuristic.'
        );
      }
    } else {
      console.warn(
        '⚠️ Gemini extraction dilewati karena client/file tidak tersedia.'
      );

      if (!client) {
        console.warn(
          '   Penyebab: GEMINI_API_KEY tidak tersedia atau client gagal dibuat.'
        );
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        console.warn(
          '   Penyebab: fileBuffer kosong.'
        );
      }
    }

    // ============================================================
    // 2. FALLBACK HEURISTIC
    // ============================================================
    const fallback =
      this.heuristicExtract(
        fileName,
        rawTextHint
      );

    return {
      ...fallback,
      confidence: rawTextHint
        ? fallback.confidence
        : 0,
    };
  }

  /**
   * ============================================================
   * NORMALIZE GEMINI RESULT
   * ============================================================
   */
  private normalizeAIResult(
    parsed: any,
    todayStr: string
  ): ExtractedLetterData {
    const confidenceRaw =
      Number(parsed?.confidence);

    const confidence =
      Number.isFinite(confidenceRaw) &&
      confidenceRaw >= 0 &&
      confidenceRaw <= 1
        ? confidenceRaw
        : this.estimateConfidence(
            parsed
          );

    const classification =
      parsed?.classification === 'Rahasia'
        ? 'Rahasia'
        : parsed?.classification === 'Penting'
        ? 'Penting'
        : 'Biasa';

    const urgency =
      parsed?.urgency === 'Sangat Segera'
        ? 'Sangat Segera'
        : parsed?.urgency === 'Segera'
        ? 'Segera'
        : 'Biasa';

    return {
      letterNumber:
        this.cleanValue(
          parsed?.letterNumber
        ),

      letterDate:
        this.normalizeDate(
          parsed?.letterDate
        ) || todayStr,

      receivedDate:
        todayStr,

      sender:
        this.cleanValue(
          parsed?.sender
        ),

      senderAddress:
        this.cleanValue(
          parsed?.senderAddress
        ),

      subject:
        this.cleanValue(
          parsed?.subject
        ),

      recipient:
        this.cleanValue(
          parsed?.recipient
        ),

      classification,

      urgency,

      confidence,
    };
  }

  /**
   * ============================================================
   * FALLBACK HEURISTIC
   * ============================================================
   */
  public heuristicExtract(
    _fileName?: string,
    textHint?: string
  ): ExtractedLetterData {
    const todayStr =
      new Date()
        .toISOString()
        .split('T')[0];

    const text =
      String(textHint || '').trim();

    let letterNumber = '';
    let sender = '';
    let senderAddress = '';
    let subject = '';
    let recipient = '';

    let classification = 'Biasa';
    let urgency = 'Biasa';

    if (text) {
      // --------------------------------------------------------
      // Nomor Surat
      // --------------------------------------------------------
      const numMatch =
        text.match(
          /(?:no\.?|nomor|nomor surat|no surat)\s*[:=]?\s*([0-9]{1,6}\/[A-Za-z0-9._\-\/]+)/i
        );

      if (numMatch?.[1]) {
        letterNumber =
          numMatch[1].trim();
      }

      // --------------------------------------------------------
      // Sender
      // --------------------------------------------------------
      const senderMatch =
        text.match(
          /(?:dari|pengirim|instansi)\s*[:=]\s*([^\n\r]+)/i
        );

      if (senderMatch?.[1]) {
        sender =
          senderMatch[1].trim();
      }

      // --------------------------------------------------------
      // Address
      // --------------------------------------------------------
      const addressMatch =
        text.match(
          /(?:alamat|address)\s*[:=]\s*([^\n\r]+)/i
        );

      if (addressMatch?.[1]) {
        senderAddress =
          addressMatch[1].trim();
      }

      // --------------------------------------------------------
      // Subject
      // --------------------------------------------------------
      const subjectMatch =
        text.match(
          /(?:perihal|hal|subjek|tentang)\s*[:=]\s*([^\n\r]+)/i
        );

      if (subjectMatch?.[1]) {
        subject =
          subjectMatch[1].trim();
      }

      // --------------------------------------------------------
      // Recipient
      // --------------------------------------------------------
      const recipientMatch =
        text.match(
          /(?:kepada|ditujukan kepada|yth|yang terhormat)\s*[:=]?\s*([^\n\r]+)/i
        );

      if (recipientMatch?.[1]) {
        recipient =
          recipientMatch[1].trim();
      }

      // --------------------------------------------------------
      // Classification
      // --------------------------------------------------------
      const lowerText =
        text.toLowerCase();

      if (
        lowerText.includes(
          'rahasia'
        )
      ) {
        classification =
          'Rahasia';
      } else if (
        lowerText.includes(
          'penting'
        )
      ) {
        classification =
          'Penting';
      }

      // --------------------------------------------------------
      // Urgency
      // --------------------------------------------------------
      if (
        lowerText.includes(
          'sangat segera'
        ) ||
        lowerText.includes(
          'urgent'
        ) ||
        lowerText.includes(
          'cito'
        )
      ) {
        urgency =
          'Sangat Segera';
      } else if (
        lowerText.includes(
          'segera'
        )
      ) {
        urgency =
          'Segera';
      }
    }

    return {
      letterNumber,
      letterDate: todayStr,
      receivedDate: todayStr,
      sender,
      senderAddress,
      subject,
      recipient,
      classification,
      urgency,
      rawText: text,
      confidence: text
        ? 0.45
        : 0,
    };
  }

  /**
   * ============================================================
   * JSON PARSER
   * ============================================================
   */
  private extractJsonFromResponse(
    text: string
  ): string {
    let clean =
      text
        .replace(
          /```json/gi,
          ''
        )
        .replace(
          /```/g,
          ''
        )
        .trim();

    // Cari objek JSON pertama jika Gemini menambahkan teks
    const firstBrace =
      clean.indexOf('{');

    const lastBrace =
      clean.lastIndexOf('}');

    if (
      firstBrace >= 0 &&
      lastBrace > firstBrace
    ) {
      clean =
        clean.substring(
          firstBrace,
          lastBrace + 1
        );
    }

    if (!clean) {
      throw new Error(
        'Respons Gemini tidak mengandung JSON.'
      );
    }

    return clean;
  }

  /**
   * ============================================================
   * CLEAN VALUE
   * ============================================================
   */
  private cleanValue(
    value: any
  ): string {
    if (
      value === undefined ||
      value === null
    ) {
      return '';
    }

    const result =
      String(value).trim();

    if (
      !result ||
      result === '-' ||
      result.toLowerCase() === 'null' ||
      result.toLowerCase() ===
        'undefined'
    ) {
      return '';
    }

    return result;
  }

  /**
   * ============================================================
   * DATE NORMALIZATION
   * ============================================================
   */
  private normalizeDate(
    value: any
  ): string {
    const raw =
      this.cleanValue(value);

    if (!raw) {
      return '';
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        raw
      )
    ) {
      return raw;
    }

    // dd/mm/yyyy
    const indoMatch =
      raw.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
      );

    if (indoMatch) {
      const day =
        indoMatch[1].padStart(
          2,
          '0'
        );

      const month =
        indoMatch[2].padStart(
          2,
          '0'
        );

      const year =
        indoMatch[3];

      return `${year}-${month}-${day}`;
    }

    const date =
      new Date(raw);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date
        .toISOString()
        .split('T')[0];
    }

    return '';
  }

  /**
   * ============================================================
   * CONFIDENCE ESTIMATION
   * ============================================================
   */
  private estimateConfidence(
    parsed: any
  ): number {
    const fields = [
      parsed?.letterNumber,
      parsed?.letterDate,
      parsed?.sender,
      parsed?.subject,
      parsed?.recipient,
    ];

    const filled =
      fields.filter(
        value =>
          value !==
            undefined &&
          value !== null &&
          String(value).trim() !== ''
      ).length;

    if (filled >= 5) {
      return 0.95;
    }

    if (filled === 4) {
      return 0.85;
    }

    if (filled === 3) {
      return 0.70;
    }

    if (filled === 2) {
      return 0.50;
    }

    if (filled === 1) {
      return 0.30;
    }

    return 0;
  }

  /**
   * ============================================================
   * MIME TYPE
   * ============================================================
   */
  private resolveMimeType(
    fileName?: string,
    mimeType?: string
  ): string {
    if (mimeType) {
      return mimeType;
    }

    const lowerName =
      String(fileName || '')
        .toLowerCase();

    if (
      lowerName.endsWith(
        '.pdf'
      )
    ) {
      return 'application/pdf';
    }

    if (
      lowerName.endsWith(
        '.png'
      )
    ) {
      return 'image/png';
    }

    if (
      lowerName.endsWith(
        '.jpg'
      ) ||
      lowerName.endsWith(
        '.jpeg'
      )
    ) {
      return 'image/jpeg';
    }

    if (
      lowerName.endsWith(
        '.webp'
      )
    ) {
      return 'image/webp';
    }

    return 'image/jpeg';
  }
}

export const documentExtractorService =
  new DocumentExtractorService();