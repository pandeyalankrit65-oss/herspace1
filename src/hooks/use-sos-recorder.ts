import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, asUpload } from "@/lib/native";

const SETTING_KEY = "herspace_record_sos";
const PIECE_MS = 10_000;
const MAX_MS = 15 * 60_000;

export function readRecordSetting() {
  try {
    return localStorage.getItem(SETTING_KEY) === "1";
  } catch {
    return false;
  }
}
export function saveRecordSetting(on: boolean) {
  try {
    localStorage.setItem(SETTING_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

const pickType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
};

export type RecorderStatus = "idle" | "recording" | "denied" | "unsupported" | "done";

/**
 * Records audio after an SOS and uploads it in 10-second pieces, so what was captured is kept
 * even if the phone is taken or broken. Each piece is a complete, playable file.
 */
export function useSosRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [saved, setSaved] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(false);
  const timers = useRef<number[]>([]);

  const stop = useCallback(() => {
    active.current = false;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStatus((s) => (s === "recording" ? "done" : s));
  }, []);

  const start = useCallback(
    async (sosId: number) => {
      const type = pickType();
      if (!type || !navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return setStatus("denied");
      }
      active.current = true;
      setStatus("recording");
      setSaved(0);
      const mime = type.split(";")[0];

      const upload = (blob: Blob) =>
        fetch(apiUrl(`/api/sos/${sosId}/recordings`), {
          method: "POST",
          headers: { "Content-Type": mime, "X-Requested-With": "HerSpace" },
          credentials: "same-origin",
          body: asUpload(blob, `piece.${mime.split("/")[1]}`, mime),
        })
          .then((r) => r.ok && setSaved((n) => n + 1))
          .catch(() => {});

      const piece = () => {
        if (!active.current || !stream.current) return;
        const rec = new MediaRecorder(stream.current, { mimeType: type });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          if (chunks.length) upload(new Blob(chunks, { type: mime }));
          piece();
        };
        rec.start();
        timers.current.push(window.setTimeout(() => rec.state !== "inactive" && rec.stop(), PIECE_MS));
      };
      piece();
      timers.current.push(window.setTimeout(stop, MAX_MS));
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { status, saved, start, stop };
}
