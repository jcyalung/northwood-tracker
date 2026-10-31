import type { Activity, Belt } from "@/lib/students";

// Activities for each belt level, keyed by pathKey().
export type BeltPaths = Record<string, Activity[]>;

// A belt, from the `belts` collection (the source of truth for belts).
export type BeltInfo = {
  belt_id: number;
  title: string;
  color: string;
  // Number of levels; null for Junior.
  levels: number | null;
  stars_per_level: number | null;
  running_total: number | null;
  // Bronze and up have a belt type (Godot or Unity).
  has_type: boolean;
};

export const BELT_TYPES = ["godot", "unity"] as const;

// Whether the belt with this id has a type (Bronze and up).
export function beltHasType(belts: BeltInfo[], beltId: number): boolean {
  return belts.find((b) => b.belt_id === beltId)?.has_type ?? false;
}

// Junior has no levels, so its key is just the belt id.
export function pathKey(belt: { belt_id: number; belt_level?: number }) {
  return belt.belt_level === undefined
    ? `${belt.belt_id}`
    : `${belt.belt_id}:${belt.belt_level}`;
}

export function activityValue(activity: Activity) {
  return activity.activity_id ?? activity.title;
}

// Matches by id when both have one, otherwise by title (Junior activities
// may only have a title).
export function sameActivity(a: Activity, b: Activity) {
  return a.activity_id && b.activity_id
    ? a.activity_id === b.activity_id
    : a.title === b.title;
}

export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The belt after `belt`, starting at level 1, or null at the top belt.
export function nextBelt(
  belt: Belt,
  belts: BeltInfo[],
  beltType?: string,
): Belt | null {
  const next = belts.find((b) => b.belt_id === belt.belt_id + 1);
  if (!next) return null;

  return {
    belt_id: next.belt_id,
    belt_title: next.title,
    belt_level: 1,
    ...(next.has_type && { belt_type: beltType ?? belt.belt_type }),
  };
}

const ACTIVITY_TYPES: Record<string, string> = {
  build: "Build",
  quest: "Quest",
  adventure: "Adventure",
  prove: "Prove Yourself",
  mastery: "Mastery",
  solve: "Solve",
  activity: "Activity",
};

// "Build 2: Spooky Effects". Types that appear more than once on the level
// are numbered (Build 1, Build 2, …), like the curriculum's columns.
export function activityLabel(activity: Activity, levelActivities: Activity[]) {
  const type = activity.type
    ? (ACTIVITY_TYPES[activity.type] ?? capitalize(activity.type))
    : null;
  if (!type) return activity.title;
  const sameType = levelActivities.filter((a) => a.type === activity.type);
  const index = sameType.findIndex((a) => sameActivity(a, activity));
  const number = sameType.length > 1 && index >= 0 ? ` ${index + 1}` : "";
  return `${type}${number}: ${activity.title}`;
}

// What to show when a student has no current activity: "First session" only
// if they've never had one.
export function noActivityLabel(student: { last_session?: string | null }) {
  return student.last_session ? "Activity not set" : "First session";
}
