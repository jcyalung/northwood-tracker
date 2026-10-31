import Image from "next/image";
import type { Belt } from "@/lib/students";

// Belt icon from public/icons, with the belt type logo on the "forehead"
// and the level underneath.
export function BeltBadge({
  belt,
  showLevel,
  birthday = false,
}: {
  belt: Belt;
  showLevel: boolean;
  // Adds a party hat.
  birthday?: boolean;
}) {
  // There's no icon for Junior (belt 0), so it gets a plain marker.
  const hasIcon = belt.belt_id > 0;

  return (
    <span className="flex w-24 shrink-0 flex-col items-center gap-1">
      <span className="relative h-24 w-24">
        {hasIcon ? (
          <Image
            src={`/icons/${belt.belt_title}.svg`}
            alt={`${belt.belt_title} belt`}
            width={96}
            height={96}
            className="h-24 w-24"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full border border-secondary/40 font-label text-xs uppercase tracking-[0.08em] text-secondary">
            JR
          </span>
        )}
        {birthday && <PartyHat />}
        {belt.belt_type && (
          <Image
            src={`/icons/${belt.belt_type}.png`}
            alt={belt.belt_type}
            width={70}
            height={24}
            className="absolute left-1/2 top-[14%] h-auto w-[72%] -translate-x-1/2"
          />
        )}
      </span>
      {showLevel && belt.belt_level !== undefined && (
        <span className="bg-(--card-bg) font-label text-xs uppercase tracking-[0.08em] text-secondary">
          Lvl {belt.belt_level}
        </span>
      )}
    </span>
  );
}

function PartyHat() {
  return (
    <svg
      viewBox="0 0 40 48"
      aria-hidden="true"
      className="absolute left-[64%] top-[-38%] w-[46%] -translate-x-1/2 rotate-[22deg] overflow-visible"
    >
      <path d="M20 4 L5 42 Q20 47 35 42 Z" fill="#4673B9" />
      <path d="M14.2 19 L25.8 19 L28.6 26 L11.4 26 Z" fill="#F2C14E" />
      <path d="M9.2 32.5 L30.8 32.5 L33 38 L7 38 Z" fill="#B8422E" />
      <path
        d="M5 42 Q20 47 35 42"
        fill="none"
        stroke="#1A1C1E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="4" r="4" fill="#F2C14E" stroke="#1A1C1E" />
    </svg>
  );
}
