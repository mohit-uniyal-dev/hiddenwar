import type { UnitTypeId } from "../game/types.ts";

interface Props {
  type: UnitTypeId;
  className?: string;
}

/**
 * A deliberately chunky, single-colour SVG set for the game pieces.
 *
 * The silhouettes stay readable at board-token size and use `currentColor`, so
 * the same artwork works for both forces, disabled roster cards and reports.
 */
export function UnitIcon({ type, className = "" }: Props) {
  return (
    <svg
      className={`unit-icon unit-icon-${type} ${className}`.trim()}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {iconFor(type)}
    </svg>
  );
}

function iconFor(type: UnitTypeId) {
  switch (type) {
    case "soldier":
      return (
        <>
          <path d="M19 25c0-8 5.7-14 13-14s13 6 13 14H19Z" fill="currentColor" />
          <path d="M16 25h32v4H16z" fill="currentColor" />
          <circle cx="32" cy="32" r="7" fill="currentColor" />
          <path d="M16 55c1.2-11 7.3-17 16-17s14.8 6 16 17H16Z" fill="currentColor" />
          <path
            d="m42 37 12-13M46 23l10 9"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M27 42h10l-2 13h-6l-2-13Z" className="icon-detail" />
        </>
      );
    case "mg":
      return (
        <>
          <path d="M9 21h34v7H9z" fill="currentColor" />
          <path d="m42 19 15 3v5l-15-1v-7Z" fill="currentColor" />
          <rect x="22" y="27" width="20" height="11" rx="2" fill="currentColor" />
          <path
            d="M35 36 19 55M35 36l15 19M35 37v18"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="M18 16h9v5h-9zM18 28h8v14h-8z" fill="currentColor" />
          <path d="M27 30h11v5H27z" className="icon-detail" />
        </>
      );
    case "tank":
      return (
        <>
          <rect x="7" y="32" width="50" height="20" rx="7" fill="currentColor" />
          <path d="M15 28h33l6 9H10l5-9Z" fill="currentColor" />
          <path d="M25 18h19v12H25z" fill="currentColor" />
          <path d="M41 20h18v5H41z" fill="currentColor" />
          <circle cx="18" cy="42" r="5" className="icon-detail" />
          <circle cx="32" cy="42" r="5" className="icon-detail" />
          <circle cx="46" cy="42" r="5" className="icon-detail" />
          <path d="M17 56h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "mortar":
      return (
        <>
          <path d="m20 14 8-4 14 27-10 5-12-28Z" fill="currentColor" />
          <path
            d="m34 37-16 18M37 38l13 17"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="M14 54h41v5H14z" fill="currentColor" />
          <path d="m38 13 4-7 4 7-4 7-4-7Z" fill="currentColor" />
          <path d="m27 16 8 17-4 2-8-17 4-2Z" className="icon-detail" />
        </>
      );
    case "sandbag":
      return (
        <>
          <path
            d="M10 20c0-4 3-7 7-7h11c4 0 7 3 7 7s-3 7-7 7H17c-4 0-7-3-7-7Z"
            fill="currentColor"
          />
          <path
            d="M30 20c0-4 3-7 7-7h10c4 0 7 3 7 7s-3 7-7 7H37c-4 0-7-3-7-7Z"
            fill="currentColor"
          />
          <path
            d="M5 34c0-4 3-7 7-7h17c4 0 7 3 7 7s-3 7-7 7H12c-4 0-7-3-7-7Z"
            fill="currentColor"
          />
          <path
            d="M31 34c0-4 3-7 7-7h14c4 0 7 3 7 7s-3 7-7 7H38c-4 0-7-3-7-7Z"
            fill="currentColor"
          />
          <path
            d="M11 48c0-4 3-7 7-7h28c4 0 7 3 7 7s-3 7-7 7H18c-4 0-7-3-7-7Z"
            fill="currentColor"
          />
          <path
            d="M21 15v10M43 15v10M20 29v10M47 29v10M32 43v10"
            stroke="currentColor"
            strokeWidth="2"
            className="icon-seam"
          />
        </>
      );
    case "hq":
      return (
        <>
          <path d="M11 28 32 11l21 17v27H11V28Z" fill="currentColor" />
          <path d="M7 26 32 6l25 20-4 5-21-17-21 17-4-5Z" fill="currentColor" />
          <path d="M25 38h14v17H25z" className="icon-detail" />
          <path
            d="m32 20 2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7L32 20Z"
            className="icon-detail"
          />
          <path d="M16 32h7v7h-7zM41 32h7v7h-7z" className="icon-detail" />
        </>
      );
  }
}
