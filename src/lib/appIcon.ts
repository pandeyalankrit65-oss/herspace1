import { registerPlugin } from "@capacitor/core";
import { isNative } from "./native";

// Disguised mode in the Android app can also make the home-screen icon and name a calculator
// (android/.../AppIconPlugin.java). Not possible on the web.
const AppIcon = registerPlugin<{
  get(): Promise<{ calculator: boolean }>;
  set(options: { calculator: boolean }): Promise<{ calculator: boolean }>;
}>("AppIcon");

export const appIconSupported = isNative;

export async function isCalculatorIcon(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await AppIcon.get()).calculator;
  } catch {
    return false;
  }
}

export async function setCalculatorIcon(calculator: boolean): Promise<boolean> {
  if (!isNative) return false;
  return (await AppIcon.set({ calculator })).calculator;
}
