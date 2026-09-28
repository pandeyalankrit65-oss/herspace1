import { useEffect, useState } from "react";
import { hashCode, type DisguiseSettings } from "@/lib/disguise";
import { api } from "@/lib/api";

// A real, working calculator that hides HerSpace. PIN then "=" opens the app; the optional
// SOS code then "=" sends a silent alert and shows nothing unusual.

type Op = "+" | "−" | "×" | "÷";

const apply = (a: number, b: number, op: Op) =>
  op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;

const format = (n: number) => (Number.isFinite(n) ? String(Number(n.toPrecision(12))) : "Error");

function currentCoords(): Promise<{ lat: number; lng: number; accuracy: number } | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    )
  );
}

const Calculator = ({ settings, onUnlock }: { settings: DisguiseSettings; onUnlock: () => void }) => {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  // Digits typed since the last clear or operator: what's compared with the codes.
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const previous = document.title;
    document.title = "Calculator";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousIcon = icon?.href;
    if (icon) icon.href = "/calculator.svg";
    return () => {
      document.title = previous;
      if (icon && previousIcon) icon.href = previousIcon;
    };
  }, []);

  const digit = (d: string) => {
    setTyped((t) => (t + d).slice(-12));
    setDisplay((cur) => (fresh || cur === "0" ? (d === "." ? "0." : d) : cur.includes(".") && d === "." ? cur : (cur + d).slice(0, 14)));
    setFresh(false);
  };

  const operator = (next: Op) => {
    const value = Number(display);
    if (stored !== null && op && !fresh) {
      const result = apply(stored, value, op);
      setStored(result);
      setDisplay(format(result));
    } else {
      setStored(value);
    }
    setOp(next);
    setFresh(true);
    setTyped("");
  };

  const clear = () => {
    setDisplay("0");
    setStored(null);
    setOp(null);
    setFresh(true);
    setTyped("");
  };

  const equals = async () => {
    const code = typed;
    if (op === null && code) {
      const hash = await hashCode(code);
      if (hash === settings.pinHash) {
        clear();
        onUnlock();
        return;
      }
      if (settings.sosCodeHash && hash === settings.sosCodeHash) {
        // Silent SOS: no sound, no vibration, nothing on screen beyond a normal result.
        clear();
        currentCoords().then((coords) => api("/api/sos", { body: { coords, silent: true } }).catch(() => {}));
        return;
      }
    }
    if (stored !== null && op) {
      const result = apply(stored, Number(display), op);
      setDisplay(format(result));
      setStored(null);
      setOp(null);
    }
    setFresh(true);
    setTyped("");
  };

  const keys: Array<{ label: string; onPress: () => void; kind?: "op" | "fn" | "eq"; wide?: boolean }> = [
    { label: "C", onPress: clear, kind: "fn" },
    { label: "±", onPress: () => setDisplay((d) => (d.startsWith("-") ? d.slice(1) : d === "0" ? d : `-${d}`)), kind: "fn" },
    { label: "%", onPress: () => setDisplay((d) => format(Number(d) / 100)), kind: "fn" },
    { label: "÷", onPress: () => operator("÷"), kind: "op" },
    ...["7", "8", "9"].map((d) => ({ label: d, onPress: () => digit(d) })),
    { label: "×", onPress: () => operator("×"), kind: "op" },
    ...["4", "5", "6"].map((d) => ({ label: d, onPress: () => digit(d) })),
    { label: "−", onPress: () => operator("−"), kind: "op" },
    ...["1", "2", "3"].map((d) => ({ label: d, onPress: () => digit(d) })),
    { label: "+", onPress: () => operator("+"), kind: "op" },
    { label: "0", onPress: () => digit("0"), wide: true },
    { label: ".", onPress: () => digit(".") },
    { label: "=", onPress: equals, kind: "eq" },
  ];

  return (
    <main className="flex min-h-[100dvh] flex-col justify-end bg-neutral-950 p-4 text-white" aria-label="Calculator" lang="en">
      <div className="mx-auto w-full max-w-sm">
        <output className="mb-4 block truncate px-2 text-right text-6xl font-light tabular-nums" aria-live="polite">
          {display}
        </output>
        <div className="grid grid-cols-4 gap-3">
          {keys.map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={k.onPress}
              className={`h-16 rounded-full text-2xl font-medium transition-opacity active:opacity-70 sm:h-20 ${k.wide ? "col-span-2 pl-7 text-left" : ""} ${
                k.kind === "op" || k.kind === "eq" ? "bg-orange-500 text-white" : k.kind === "fn" ? "bg-neutral-300 text-black" : "bg-neutral-800 text-white"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};

export default Calculator;
