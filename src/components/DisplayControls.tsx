import { useCallback, useEffect, useState } from "react";

type WebkitDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait") => Promise<void>;
  unlock?: () => void;
};

function fullscreenElement(): Element | null {
  const webkitDocument = document as WebkitDocument;
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

/**
 * Fullscreen control, shared by every game phase.
 *
 * There is deliberately no "rotate your device" gate any more. There used to be
 * one, from when the board was 12 wide by 9 tall and genuinely needed landscape.
 * The board is now 8 by 11 — portrait — so a gate demanding landscape would be
 * asking players to turn away from the orientation the game is designed for,
 * and phones are already held that way.
 *
 * Orientation lock is best-effort and only meaningful in fullscreen; it now
 * asks for portrait, matching the board.
 */
export function DisplayControls() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(fullscreenElement() !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreenElement() === null) {
      const root = document.documentElement as WebkitElement;
      try {
        if (root.requestFullscreen !== undefined) {
          await root.requestFullscreen({ navigationUI: "hide" });
        } else {
          await root.webkitRequestFullscreen?.();
        }
      } catch {
        // Some mobile browsers expose the API but reject it outside an
        // installed app. Fullscreen is a convenience, not a requirement.
      }

      try {
        await (screen.orientation as LockableOrientation).lock?.("portrait");
      } catch {
        // Locking requires fullscreen on Android and is unavailable on iOS.
      }
      return;
    }

    const webkitDocument = document as WebkitDocument;
    try {
      if (document.exitFullscreen !== undefined) await document.exitFullscreen();
      else await webkitDocument.webkitExitFullscreen?.();
    } finally {
      (screen.orientation as LockableOrientation).unlock?.();
    }
  }, []);

  return (
    <button
      type="button"
      className={`fullscreen-toggle ${isFullscreen ? "active" : ""}`}
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      <FullscreenIcon active={isFullscreen} />
      <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
    </button>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <title>{active ? "Exit fullscreen" : "Enter fullscreen"}</title>
      {active ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
      )}
    </svg>
  );
}
