import { useEffect, useState } from "react";

/**
 * Hand a match to someone else.
 *
 * A link rather than a bare code, because the whole point is that a teammate
 * can tap it on a phone and be in the match — asking someone to copy a string,
 * open a site, find a field and paste it loses most people. The raw code is
 * still shown and still accepted, for anywhere a link gets mangled.
 *
 * Everything travels in the URL fragment. A fragment is never sent to the
 * server, so a match works on static hosting with no backend at all, and the
 * deployment stays between the two players.
 */

export function matchUrl(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#c=${code}`;
}

interface Props {
  readonly code: string;
  readonly title: string;
  readonly blurb: string;
  /** What the sender should expect back, if anything. */
  readonly footnote?: string;
}

type Copied = "idle" | "link" | "code" | "failed";

export function SharePanel({ code, title, blurb, footnote }: Props) {
  const [copied, setCopied] = useState<Copied>("idle");
  const url = matchUrl(code);

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string, kind: Copied): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an
      // insecure origin, a locked-down browser. The code is on screen and
      // selectable, so say what happened instead of failing silently.
      setCopied("failed");
    }
  };

  const share = async (): Promise<void> => {
    if (typeof navigator.share !== "function") {
      await copy(url, "link");
      return;
    }
    try {
      await navigator.share({ title: "Hidden Front", text: "Your move.", url });
    } catch {
      // A cancelled share sheet lands here too, which is not an error.
    }
  };

  return (
    <div className="panel share-panel">
      <h2>{title}</h2>
      <p className="menu-note">{blurb}</p>

      <div className="row-actions">
        <button type="button" className="primary" onClick={share}>
          Send link
        </button>
        <button type="button" onClick={() => copy(url, "link")}>
          Copy link
        </button>
      </div>

      <label className="share-code" htmlFor="share-code-field">
        <span>or send the code</span>
        <input
          id="share-code-field"
          readOnly
          value={code}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <div className="row-actions">
        <button type="button" onClick={() => copy(code, "code")}>
          Copy code
        </button>
      </div>

      <p className="hint" aria-live="polite">
        {copied === "link"
          ? "Link copied."
          : copied === "code"
            ? "Code copied."
            : copied === "failed"
              ? "Couldn't reach the clipboard — select the code above and copy it."
              : (footnote ?? "")}
      </p>
    </div>
  );
}
