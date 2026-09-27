import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Report photos live on disk, outside the database, and are only served to the report's owner
// or a moderator. The browser re-encodes photos before upload; the server strips metadata again
// in case a client doesn't.
export const MAX_PHOTOS_PER_REPORT = 3;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const uploadDir = () => process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'data', 'uploads');

// Removes EXIF (APP1, which holds GPS position and camera details), other APPn blocks and
// comments from a JPEG. Returns null if the data isn't a well-formed JPEG.
export function stripJpegMetadata(input: Buffer): Buffer | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const parts: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) return null;
    const marker = input[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd9) break; // end of image without scan data
    const length = input.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > input.length) return null;
    const segment = input.subarray(i, i + 2 + length);
    if (marker === 0xda) {
      // Start of scan: the compressed image follows to the end of the file.
      parts.push(input.subarray(i));
      return Buffer.concat(parts);
    }
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) parts.push(segment);
    i += 2 + length;
  }
  return null;
}

const FILE_NAME = /^[a-f0-9]{32}\.jpg$/;

export function savePhoto(data: Buffer): string {
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(dir, file), data, { flag: 'wx' });
  return file;
}

export function photoPath(file: string): string | null {
  return FILE_NAME.test(file) ? path.join(uploadDir(), file) : null;
}

export function deletePhotoFiles(files: string[]) {
  for (const file of files) {
    const p = photoPath(file);
    if (p) fs.rmSync(p, { force: true });
  }
}
