// Browsers keep audio paused until the person interacts with the page (autoplay rules), and a
// paused context hands an analyser nothing but silence. After a reload, listening would look
// on while hearing nothing; so we resume on the first tap or key press and report whether it's
// really running, letting the page say "tap to start listening" instead.
export function keepAudioRunning(ctx: AudioContext, onRunning: (running: boolean) => void): () => void {
  const resume = () => void ctx.resume().catch(() => {});
  const update = () => onRunning(ctx.state === "running");
  const events = ["pointerdown", "keydown", "touchend"] as const;
  ctx.addEventListener("statechange", update);
  events.forEach((e) => window.addEventListener(e, resume));
  resume();
  update();
  return () => {
    ctx.removeEventListener("statechange", update);
    events.forEach((e) => window.removeEventListener(e, resume));
  };
}
