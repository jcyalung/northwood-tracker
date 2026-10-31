import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";

export default function Menu() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-neutral px-4">
      <p className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
        Code Ninjas Northwood
      </p>
      <h1 className="mt-2 font-display text-[3.125rem] leading-tight text-primary">
        Menu
      </h1>

      <nav className="mt-8 flex justify-center gap-4">
        <MenuButton href="/students/today" label="Students Today" primary>
          <MenuIcon src="/icons/StudentsToday.svg" />
        </MenuButton>
        <MenuButton
          href="/students/today/schedule"
          label="Schedule Students Today"
        >
          <CalendarIcon />
        </MenuButton>
        <MenuButton href="/students" label="All Students">
          <MenuIcon src="/icons/AllStudents.svg" />
        </MenuButton>
        <MenuButton href="/store" label="Star Store">
          <StarIcon />
        </MenuButton>
        <MenuButton href="/dashboard" label="Dashboard">
          <DashboardIcon />
        </MenuButton>
        <MenuButton href="/debrief" label="Debrief Helper">
          <QuestionBoxIcon />
        </MenuButton>
        <MenuButton
          href="https://outlook.office.com/mail/"
          label="Outlook"
          external
        >
          <MailIcon />
        </MenuButton>
      </nav>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="mt-12"
      >
        <button
          type="submit"
          className="rounded-md border border-secondary/40 px-5 py-2 text-sm text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

// Square tile. `primary` marks the screen's single Tertiary action (DESIGN.md).
// `external` links open in a new tab.
function MenuButton({
  href,
  label,
  primary = false,
  external = false,
  children,
}: {
  href: string;
  label: string;
  primary?: boolean;
  external?: boolean;
  children: ReactNode;
}) {
  const className = `flex aspect-square w-40 flex-col items-center justify-center gap-2 rounded-lg bg-surface p-4 text-center text-primary transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    primary ? "border-2 border-tertiary" : "border border-secondary/40"
  }`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
      {label}
    </Link>
  );
}

// brightness-0 renders the colored source SVGs in solid black.
function MenuIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={126}
      height={70}
      className="h-[4.375rem] w-[7.875rem] brightness-0"
    />
  );
}

// Placeholder until a Star Store SVG is added to public/.
function StarIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-11"
    >
      <path
        fill="#000"
        d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z"
      />
    </svg>
  );
}

// Placeholder until a Dashboard SVG is added to public/.
function DashboardIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-11"
    >
      <path
        fill="#000"
        d="M3 3h8v10H3V3zm10 0h8v6h-8V3zM3 15h8v6H3v-6zm10-4h8v10h-8V11z"
      />
    </svg>
  );
}

// Placeholder until an Outlook SVG is added to public/.
function MailIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-11"
    >
      <path
        fill="#000"
        d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.24V17h16V7.24l-8 5.6-8-5.6zM5.4 7 12 11.62 18.6 7H5.4z"
      />
    </svg>
  );
}

// Placeholder until a Schedule SVG is added to public/.
function CalendarIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-11"
    >
      <path
        fill="#000"
        d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm12 8H5v9h14v-9zM5 8h14V6H5v2zm2 4h4v4H7v-4z"
      />
    </svg>
  );
}

// Placeholder until a Debrief Helper SVG is added to public/.
function QuestionBoxIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-11"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill="none"
        stroke="#000"
        strokeWidth="2"
      />
      <path
        d="M9.25 9.5a2.75 2.75 0 1 1 3.9 2.5c-.7.33-1.15.9-1.15 1.65v.6"
        fill="none"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.25" fill="#000" />
    </svg>
  );
}
