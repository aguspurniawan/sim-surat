import fs from 'fs';
import path from 'path';

export interface FileMetadata {
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  driver: 'local' | 'minio' | 'r2';
  url: string;
  createdAt: string;
}

export class StorageService {
  private driver: 'local' | 'minio' | 'r2';
  private storageDir: string;

  constructor() {
    this.driver = (process.env.STORAGE_DRIVER as any) || 'local';
    this.storageDir = path.resolve(process.env.STORAGE_PATH || './storage/uploads');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public async saveFile(fileBuffer: Buffer, originalName: string, mimeType: string): Promise<FileMetadata> {
    const ext = path.extname(originalName) || '.bin';
    const timestamp = Date.now();
    const safeRandom = Math.floor(Math.random() * 100000);
    const fileKey = `doc_${timestamp}_${safeRandom}${ext}`;

    const filePath = path.join(this.storageDir, fileKey);
    fs.writeFileSync(filePath, fileBuffer);

    const fileMeta: FileMetadata = {
      fileKey,
      originalName,
      mimeType,
      size: fileBuffer.length,
      driver: this.driver,
      url: `/api/storage/files/${fileKey}`,
      createdAt: new Date().toISOString()
    };

    return fileMeta;
  }

  public getFilePath(fileKey: string): string {
    return path.join(this.storageDir, fileKey);
  }

  public fileExists(fileKey: string): boolean {
    return fs.existsSync(this.getFilePath(fileKey));
  }
}

export const storageService = new StorageService();
