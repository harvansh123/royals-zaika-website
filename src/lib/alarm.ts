/**
 * alarm.ts — Looping alarm manager using an actual audio file.
 * Uses /order_incoming_ringtone_loud_extended.mp3 from the public folder.
 * 
 * Mobile Safari/Chrome blocks autoplay without user interaction.
 * We globally initialize and "unlock" a single Audio instance on the 
 * first touch/click anywhere on the screen so it can be played 
 * programmatically later when an order arrives.
 */

let _audio: HTMLAudioElement | null = null;
let _isUnlocked = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!_audio) {
    _audio = new Audio("/order_incoming_ringtone_loud_extended.mp3");
    _audio.loop = true;
    _audio.volume = 1.0;
  }
  return _audio;
}

/** 
 * Unlocks the audio object by playing and pausing it immediately 
 * in response to a direct user interaction. 
 */
function unlockAudio() {
  if (_isUnlocked) return;
  const audio = getAudio();
  if (audio) {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      _isUnlocked = true;
    }).catch(() => {
      // Ignored: unlocking failed (maybe not a trusted event)
    });
  }
  
  // Clean up listeners once unlocked
  if (typeof document !== "undefined") {
    document.removeEventListener("touchstart", unlockAudio);
    document.removeEventListener("click", unlockAudio);
  }
}

// Bind the unlock listeners globally
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
  document.addEventListener("click", unlockAudio, { once: true, passive: true });
}

/**
 * Starts a continuously looping alarm using the project's ringtone file.
 * Stops any previously running alarm automatically.
 * @returns a stop function — call it to silence the alarm.
 */
export function startLoopingAlarm(): () => void {
  if (typeof window === "undefined") return () => {};

  const audio = getAudio();
  if (!audio) return () => {};

  // Ensure it plays from the beginning
  audio.currentTime = 0;
  audio.volume = 1.0;
  
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      // Autoplay blocked by browser. This usually happens if an order comes in
      // before the user has tapped/touched the screen at all.
      console.warn("[alarm] Autoplay blocked. Alarm will start after user interaction.", err);
    });
  }

  const stop = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  return stop;
}

/** Silences the currently playing alarm (if any). */
export function stopCurrentAlarm() {
  const audio = getAudio();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
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
