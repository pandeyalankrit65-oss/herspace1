import { registerPlugin } from "@capacitor/core";
import { isNative } from "./native";

// Prints the current page; the print stylesheet shows only its .print-doc element. In the
// Android app window.print() does nothing, so Android's print service is used instead (its
// dialog has "Save as PDF" too).
const NativePrint = registerPlugin<{ print(options: { title: string }): Promise<void> }>("Print");

export async function printPage(title: string) {
  if (isNative) await NativePrint.print({ title });
  else window.print();
}
