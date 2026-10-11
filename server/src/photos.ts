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

// Stored files: report photos (.jpg), SOS audio recordings (.webm/.ogg/.m4a), audio and video
// attached to reports (.webm/.ogg/.mp4/.mp3) and the private record's encrypted files (.bin,
// which the server can't read).
const FILE_NAME = /^[a-f0-9]{32}\.(jpg|webm|ogg|m4a|mp4|mp3|bin)$/;
export type StoredExt = 'jpg' | 'webm' | 'ogg' | 'm4a' | 'mp4' | 'mp3' | 'bin';

export function saveFile(data: Buffer, ext: StoredExt): string {
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, file), data, { flag: 'wx' });
  return file;
}

export const savePhoto = (data: Buffer) => saveFile(data, 'jpg');

export function photoPath(file: string): string | null {
  return FILE_NAME.test(file) ? path.join(uploadDir(), file) : null;
}

export function deletePhotoFiles(files: string[]) {
  for (const file of files) {
    const p = photoPath(file);
    if (p) fs.rmSync(p, { force: true });
  }
}

// Audio and video attached to reports. Phone videos are large, so the limit is generous; the
// browser can't shrink a video the way it does photos.
export const MAX_MEDIA_PER_REPORT = 2;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

// The container a file really is, from its first bytes (the type the browser claims isn't trusted).
export type MediaFormat = 'mp4' | 'webm' | 'ogg' | 'mp3';
export function mediaFormat(data: Buffer): MediaFormat | null {
  if (data.length >= 12 && data.toString('latin1', 4, 8) === 'ftyp') return 'mp4'; // MP4, M4A, MOV, 3GP
  if (data.length >= 4 && data.readUInt32BE(0) === 0x1a45dfa3) return 'webm'; // Matroska / WebM
  if (data.length >= 4 && data.toString('latin1', 0, 4) === 'OggS') return 'ogg';
  if (data.length >= 3 && data.toString('latin1', 0, 3) === 'ID3') return 'mp3';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3'; // MPEG audio frame
  return null;
}

// Phone cameras write where a video was taken (and the phone's make and model) into the
// MP4/MOV 'udta' and 'meta' boxes. Each one is renamed to 'free', which players skip, so the
// file stays playable and the same size, with no location in it. Returns false if the file
// isn't a well-formed MP4. (WebM, Ogg and MP3 files from phones don't carry a location.)
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'edts', 'dinf', 'stbl', 'mvex', 'moof', 'traf']);
export function stripMp4Metadata(data: Buffer): boolean {
  const walk = (start: number, end: number, depth: number): boolean => {
    let i = start;
    while (i + 8 <= end) {
      let size = data.readUInt32BE(i);
      const type = data.toString('latin1', i + 4, i + 8);
      let header = 8;
      if (size === 1) {
        if (i + 16 > end) return false;
        const big = data.readBigUInt64BE(i + 8);
        if (big > BigInt(end - i)) return false;
        size = Number(big);
        header = 16;
      } else if (size === 0) {
        size = end - i; // to the end of the enclosing box
      }
      if (size < header || i + size > end) return false;
      if (type === 'udta' || type === 'meta') data.write('free', i + 4, 'latin1');
      else if (CONTAINERS.has(type) && depth < 8 && !walk(i + header, i + size, depth + 1)) return false;
      i += size;
    }
    return i === end || end - i < 8;
  };
  return walk(0, data.length, 0);
}
