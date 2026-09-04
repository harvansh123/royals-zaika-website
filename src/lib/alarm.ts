/**
 * alarm.ts — Looping alarm manager using an actual audio file.
 * Uses /order_incoming_ringtone_loud_extended.mp3 from the public folder.
 *
 * Mobile Safari/Chrome blocks autoplay without user interaction.
 * We globally initialize and "unlock" a single Audio instance on the
 * first touch/click anywhere on the screen so it can be played
 * programmatically later when an order arrives.
 *
 * FIX: If an order arrives BEFORE the user has touched the screen,
 * we set _pendingAlarm = true. The next touch/click will both unlock
 * the audio AND immediately start playing the alarm.
 */

let _audio: HTMLAudioElement | null = null;
let _isUnlocked = false;
let _pendingAlarm = false; // alarm was requested but blocked — play on next interaction

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
 * If an alarm was pending (order arrived before unlock), plays it immediately.
 */
function unlockAudio() {
  const audio = getAudio();
  if (!audio) return;

  audio.play()
    .then(() => {
      if (!_pendingAlarm) {
        // Normal unlock — just pause and reset
        audio.pause();
        audio.currentTime = 0;
      }
      // If _pendingAlarm is true, keep playing — alarm starts now!
      _pendingAlarm = false;
      _isUnlocked = true;
    })
    .catch(() => {
      // Unlock failed (should not happen on trusted event)
    });

  // Clean up listeners — they're one-shot
  if (typeof document !== "undefined") {
    document.removeEventListener("touchstart", unlockAudio);
    document.removeEventListener("click",      unlockAudio);
  }
}

// Bind the unlock listeners globally (passive for touchstart = better scroll perf)
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", unlockAudio, { passive: true });
  document.addEventListener("click",      unlockAudio);
}

/** Returns true if audio has been unlocked by a user interaction. */
export function isAudioUnlocked(): boolean {
  return _isUnlocked;
}

/**
 * Starts a continuously looping alarm using the project's ringtone file.
 * Stops any previously running alarm automatically.
 *
 * If the browser blocks autoplay (audio not yet unlocked by user interaction),
 * the alarm is queued and will play on the very next touch/click.
 *
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
    playPromise
      .then(() => {
        _isUnlocked = true;
        _pendingAlarm = false;
      })
      .catch(() => {
        // Autoplay blocked — queue alarm for next user interaction
        _pendingAlarm = true;

        // Re-register interaction listeners so the alarm fires on next touch/click
        if (typeof document !== "undefined") {
          document.removeEventListener("touchstart", unlockAudio);
          document.removeEventListener("click",      unlockAudio);
          document.addEventListener("touchstart", unlockAudio, { passive: true });
          document.addEventListener("click",      unlockAudio);
        }
      });
  }

  const stop = () => {
    _pendingAlarm = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  return stop;
}

/** Silences the currently playing alarm (if any). Also clears any pending alarm. */
export function stopCurrentAlarm() {
  _pendingAlarm = false;
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
