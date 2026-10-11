import { apiUrl, asUpload } from "./native";

// Audio and video attached to a report: a recording of what was said, a clip of what happened.
// Sent as they are (a browser can't shrink a video the way it does photos); the server removes
// the location a phone camera writes into a video. Never on the map.
export const MAX_MEDIA = 2;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export type MediaKind = "audio" | "video";
export type ReportMedia = { id: number; kind: MediaKind; size: number };

export const mediaKind = (file: Blob): MediaKind | null =>
  file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : null;

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export async function uploadMedia(reportId: number, uploadToken: string, file: Blob) {
  const type = file.type || "application/octet-stream";
  const res = await fetch(apiUrl(`/api/reports/${reportId}/media`), {
    method: "POST",
    headers: { "Content-Type": type, "X-Upload-Token": uploadToken, "X-Requested-With": "HerSpace" },
    credentials: "same-origin",
    body: asUpload(file, "recording", type),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

// Recordings need the session cookie, so one is fetched when she asks to play it and shown
// from a local object URL.
export async function fetchMedia(reportId: number, mediaId: number): Promise<string> {
  const res = await fetch(apiUrl(`/api/reports/${reportId}/media/${mediaId}`), { credentials: "same-origin" });
  if (!res.ok) throw new Error(String(res.status));
  return URL.createObjectURL(await res.blob());
}
