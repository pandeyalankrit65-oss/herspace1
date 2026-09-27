import { useEffect, useState } from "react";
import { apiUrl } from "./native";

export const MAX_PHOTOS = 3;
const MAX_SIDE = 1600;

// Redraws the photo on a canvas and saves it as a new JPEG. The copy has no EXIF data, so
// the GPS position, camera model and time in the original never leave the phone. It is also
// scaled down, which keeps uploads small on slow connections.
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.82)
  );
}

export async function uploadPhoto(reportId: number, uploadToken: string, photo: Blob) {
  const res = await fetch(apiUrl(`/api/reports/${reportId}/photos`), {
    method: "POST",
    headers: { "Content-Type": "image/jpeg", "X-Upload-Token": uploadToken, "X-Requested-With": "HerSpace" },
    credentials: "same-origin",
    body: photo,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

// Photos need the session cookie, so they are fetched and shown from a local object URL.
export function usePhotoUrl(reportId: number, photoId: number) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(apiUrl(`/api/reports/${reportId}/photos/${photoId}`), { credentials: "same-origin" })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId, photoId]);
  return { url, failed };
}
