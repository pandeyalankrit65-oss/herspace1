// The phone's battery, sent with live location so contacts know if updates might stop because
// the phone is about to die. Not every browser has the Battery API (Chrome and Android do);
// without it we simply send nothing.

export type Battery = { level: number; charging: boolean };

type BatteryManager = { level: number; charging: boolean };

export async function readBattery(): Promise<Battery | undefined> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
  if (!nav.getBattery) return undefined;
  try {
    const b = await nav.getBattery();
    return { level: Math.round(b.level * 100) / 100, charging: b.charging };
  } catch {
    return undefined;
  }
}
