import { useCallback, useEffect, useState } from "react";

type WebkitDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

function fullscreenElement(): Element | null {
  const webkitDocument = document as WebkitDocument;
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

/** Fullscreen and orientation controls shared by every game phase. */
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

  const enterFullscreen = useCallback(async () => {
    const root = document.documentElement as WebkitElement;

    try {
      if (root.requestFullscreen !== undefined) {
        await root.requestFullscreen({ navigationUI: "hide" });
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch {
      // Some mobile browsers expose the API but reject it outside an installed
      // app. The landscape prompt remains useful in that case.
    }

    try {
      await (screen.orientation as LockableOrientation).lock?.("landscape");
    } catch {
      // Orientation locking is best-effort and requires fullscreen on Android.
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreenElement() === null) {
      await enterFullscreen();
      return;
    }

    const webkitDocument = document as WebkitDocument;
    try {
      if (document.exitFullscreen !== undefined) await document.exitFullscreen();
      else await webkitDocument.webkitExitFullscreen?.();
    } finally {
      (screen.orientation as LockableOrientation).unlock?.();
    }
  }, [enterFullscreen]);

  return (
    <>
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

      <dialog className="orientation-gate" aria-labelledby="rotate-title" open>
        <div className="rotate-device" aria-hidden="true">
          <span />
        </div>
        <p className="orientation-kicker">Hidden Front plays in landscape</p>
        <h1 id="rotate-title">Rotate your device</h1>
        <p>Turn your phone sideways for the full battlefield.</p>
        <button type="button" className="primary" onClick={enterFullscreen}>
          Enter fullscreen
        </button>
      </dialog>
    </>
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
