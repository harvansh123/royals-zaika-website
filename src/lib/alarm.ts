/**
 * alarm.ts — Looping alarm manager using an actual audio file.
 * Uses /order_incoming_ringtone_loud_extended.mp3 from the public folder.
 * Loops continuously until explicitly stopped.
 */

let _audio: HTMLAudioElement | null = null;

/**
 * Starts a continuously looping alarm using the project's ringtone file.
 * Stops any previously running alarm automatically.
 * @returns a stop function — call it to silence the alarm.
 */
export function startLoopingAlarm(): () => void {
  if (typeof window === "undefined") return () => {};

  // Stop any existing alarm first
  stopCurrentAlarm();

  try {
    const audio = new Audio("/order_incoming_ringtone_loud_extended.mp3");
    audio.loop   = true;       // Loop continuously
    audio.volume = 1.0;        // Maximum volume

    // Play — handle autoplay restrictions gracefully
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked by browser — will play on next user interaction
        console.warn("[alarm] Autoplay blocked. Alarm will start after user interaction.");
      });
    }

    _audio = audio;
  } catch (err) {
    console.error("[alarm] Failed to start alarm:", err);
  }

  const stop = () => {
    if (_audio) {
      _audio.pause();
      _audio.currentTime = 0;
      _audio = null;
    }
  };

  return stop;
}

/** Silences the currently playing alarm (if any). */
export function stopCurrentAlarm() {
  if (_audio) {
    _audio.pause();
    _audio.currentTime = 0;
    _audio = null;
  }
}

/** Request browser Notification permission once. Safe to call repeatedly. */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission().catch(() => {});
  }
}

/**
 * Show a native browser notification.
 * No-op if permission not yet granted.
 */
export function showBrowserNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon:               "/icons/icon-192.png",
      requireInteraction: true, // stays until user interacts
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}
