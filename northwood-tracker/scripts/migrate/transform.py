# Turns rsrc/student_progress_full_export.xlsx (+ star balances from
# rsrc/ninja_stars.csv and tags from rsrc/LABELS.MD) into MongoDB documents
# for `students` and `session_notes`, and prints a report of everything it
# had to guess.
#
# Usage: python3 scripts/migrate/transform.py <export.xlsx> <ninja_stars.csv> <out.json> [LABELS.MD]
# Then load with scripts/migrate/load.mjs.
import csv
import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from read_xlsx import read_sheets

PACIFIC = ZoneInfo("America/Los_Angeles")
BELTS = {
    "junior": 0, "white": 1, "yellow": 2, "orange": 3, "green": 4, "blue": 5,
    "purple": 6, "brown": 7, "red": 8, "black": 9, "bronze": 10, "silver": 11,
    "platinum": 12, "gold": 13,
}
# Export names spelled differently in ninja_stars.csv (confirmed same student).
STAR_NAME_ALIASES = {"teddykasperowicz": "teddykasperwicz"}
# Names spelled differently in LABELS.MD -> the export's spelling.
TAG_NAME_ALIASES = {"johnhauperthal": "johnhaupenthal"}
# LABELS.MD shorthand -> tag name.
TAG_NAMES = {
    "easily": "Easily Distracted",
    "easily distracted": "Easily Distracted",
    "needs": "Needs Attention",
    "needs attention": "Needs Attention",
    "break": "Coming From Break",
    "coming from break": "Coming From Break",
}
# Export belt prefixes that aren't belt names.
BELT_ALIASES = {"gb": "green"}
TYPES = {"godot", "unity"}
DEBRIEF_METHODS = {"email": "Email", "in_person": "In person"}
PROGRAMS = {"CREATE": "Create", "JUNIOR": "Junior", "ROBOTICS": "Robotics"}
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

notes = defaultdict(list)  # report: category -> messages


def note(category, message):
    notes[category].append(message)


def name_of(row, first="first_name", last="last_name"):
    return f"{(row[first] or '').strip()} {(row[last] or '').strip()}"


def parse_belt(raw, who):
    """'Blue_4' -> {belt_id: 5, belt_title: 'blue', belt_level: 4}.
    Also handles 'Unity_Gold', 'Gold', 'GB_1', and 'Green_1 --> 2'."""
    text = raw.strip()
    arrow = re.match(r"^(.*?)_(\d+)\s*-->\s*(\d+)$", text)
    if arrow:  # Mid belt-up: use the level they're moving to.
        note("belt", f"{who}: '{raw}' -> level {arrow.group(3)}")
        text = f"{arrow.group(1)}_{arrow.group(3)}"
    parts = text.split("_")
    belt_type = None
    if parts[0].lower() in TYPES:
        belt_type = parts.pop(0).lower()
    level = None
    if parts and parts[-1].isdigit():
        level = int(parts.pop())
    color = "_".join(parts).lower()
    if color in BELT_ALIASES:
        note("belt", f"{who}: '{raw}' -> {BELT_ALIASES[color]}")
        color = BELT_ALIASES[color]
    if color not in BELTS:
        raise ValueError(f"{who}: unknown belt '{raw}'")
    belt_id = BELTS[color]
    if level is None and belt_id > 0:
        note("belt", f"{who}: '{raw}' has no level -> level 1")
        level = 1
    if belt_type and belt_id < 10:
        note("belt", f"{who}: '{raw}' has a type below Bronze (kept)")
    belt = {"belt_id": belt_id, "belt_title": color}
    if belt_id > 0:
        belt["belt_level"] = level
    if belt_type:
        belt["belt_type"] = belt_type
    return belt


def clean_email(raw, who):
    if raw is None or not raw.strip():
        note("parent_email", f"{who}: blank -> null")
        return None
    emails = [e.strip().lower() for e in raw.split(",") if e.strip()]
    if len(emails) > 1:
        note("parent_email", f"{who}: '{raw}' -> kept the first")
    if emails[0] != raw:
        if len(emails) == 1:
            note("parent_email", f"{who}: '{raw}' -> '{emails[0]}'")
    if not EMAIL.match(emails[0]):
        raise ValueError(f"{who}: invalid email '{raw}'")
    return emails[0]


def pacific(ts):
    return datetime.fromisoformat(ts).astimezone(PACIFIC)


def session_hour(local, who):
    """Check-in time -> the hour slot it's recorded under. Early check-ins
    count toward the day's first hour (weekdays 2 PM, weekends 1 PM)."""
    first = 13 if local.weekday() >= 5 else 14
    last = first + 3
    hour = min(max(local.hour, first), last)
    if hour != local.hour:
        note(
            "session_hour",
            f"{who} {local:%a %m/%d %I:%M %p} -> {hour - 12} PM",
        )
    return f"{hour - 12} PM"


def name_key(name):
    """Name for matching across sheets: letters only, so 'Chen-Sandoval' and
    'Chen Sandoval' match."""
    return re.sub(r"[^a-z]", "", name.lower())


def stars_by_name(path):
    """ninja_stars.csv -> {name_key: [(belt color, stars)]}."""
    rows = list(csv.reader(open(path, newline="")))
    header_row = next(i for i, r in enumerate(rows) if r and r[0] == "Name")
    out = defaultdict(list)
    for r in rows[header_row + 1 :]:
        if not r[0].strip() or not r[1].strip() or not r[3].strip():
            continue
        color = r[1].replace("Belt", "").strip().lower()
        out[name_key(r[0])].append((color, int(r[3])))
    return out


def tags_by_name(path):
    """LABELS.MD lines like 'skyler hu: easily' -> {name_key: [tag names]}."""
    out = defaultdict(list)
    for line in open(path, encoding="utf-8"):
        if ":" not in line:
            continue
        name, _, tag = line.partition(":")
        tag_name = TAG_NAMES.get(tag.strip().lower())
        if not tag_name:
            raise ValueError(f"unknown tag '{tag.strip()}' for {name.strip()}")
        key = TAG_NAME_ALIASES.get(name_key(name), name_key(name))
        if tag_name not in out[key]:
            out[key].append(tag_name)
    return out


def main(xlsx, stars_csv, out_path, tags_path=None):
    sheets = read_sheets(xlsx)
    stars = stars_by_name(stars_csv)
    tags = tags_by_name(tags_path) if tags_path else {}
    tagged = set()

    students, by_legacy, unmatched_stars = [], {}, 0
    for row in sheets["Students"]:
        who = name_of(row)
        program = PROGRAMS.get((row["program"] or "").strip().upper())
        if not program:
            raise ValueError(f"{who}: unknown program '{row['program']}'")
        belt = parse_belt(row["belt"], who)

        key = STAR_NAME_ALIASES.get(name_key(who), name_key(who))
        matches = stars.get(key, [])
        if len(matches) > 1:  # Same name twice: pick by belt color.
            matches = [m for m in matches if m[0] == belt["belt_title"]]
        if len(matches) == 1:
            star_count = matches[0][1]
        else:
            star_count = 0
            unmatched_stars += 1
            reason = "not in ninja_stars.csv" if not stars.get(key) else "ambiguous"
            note("stars", f"{who}: {reason} -> 0")

        method = (row["debrief_method"] or "").strip().lower()
        student = {
            "id": str(uuid.uuid4()),
            "legacy_id": int(row["student_id"]),
            "first_name": row["first_name"].strip(),
            "last_name": row["last_name"].strip(),
            "parent_email": clean_email(row["email"], who),
            "birthday": None,  # Not in the export.
            "program": program,
            "belt": belt,
            "stars": star_count,
            "last_session": None,  # Filled from sessions below.
        }
        if method:
            if method not in DEBRIEF_METHODS:
                raise ValueError(f"{who}: unknown debrief method '{method}'")
            student["debrief_method"] = DEBRIEF_METHODS[method]
        if row["summary"] and row["summary"].strip():
            student["notes"] = row["summary"].strip()
        if name_key(who) in tags:
            student["tags"] = [
                {"name": t, "expires_at": None} for t in tags[name_key(who)]
            ]
            tagged.add(name_key(who))
        students.append(student)
        by_legacy[student["legacy_id"]] = student

    session_notes = []
    for row in sheets["Sessions"]:
        student = by_legacy[int(row["student_id"])]
        who = f"{student['first_name']} {student['last_name']}"
        local = pacific(row["session_date"])
        date = local.strftime("%m/%d/%Y")
        doc = {
            "session_id": str(uuid.uuid4()),
            "legacy_session_id": int(row["session_id"]),
            "session_date": date,
            "student_id": student["id"],
            "session_hour": session_hour(local, who),
            "debriefed": row["debrief_completed"] == "1",
            "finalized": row["finalized"] == "1",
            "last_edited": row["session_date"],
        }
        for src, dest in (
            ("notes", "working_on"),
            ("achievements", "accomplished"),
            ("next_session", "next_steps"),
        ):
            if row[src] and row[src].strip():
                doc[dest] = row[src].strip()
        session_notes.append(doc)

        # last_session = the latest session date, in Pacific time.
        if student["last_session"] is None or local > pacific_of(student):
            student["last_session"] = date
            student["_last_ts"] = row["session_date"]

    for key in tags:
        if key not in tagged:
            note("tags", f"'{key}' in tags file matches no student")
    for alias, real in TAG_NAME_ALIASES.items():
        if real in tagged:
            note("tags", f"'{alias}' in tags file -> {real}")

    for s in students:
        s.pop("_last_ts", None)
        if s["last_session"] is None:
            note("last_session", f"{s['first_name']} {s['last_name']}: no sessions -> null")

    json.dump({"students": students, "session_notes": session_notes},
              open(out_path, "w"), indent=2)

    print(f"{len(students)} students, {len(session_notes)} session notes -> {out_path}")
    print("programs:", dict(Counter(s["program"] for s in students)))
    print("belts:", dict(Counter(s["belt"]["belt_title"] for s in students)))
    print(f"tags: {sum(1 for s in students if s.get('tags'))} students tagged")
    print(f"stars: {len(students) - unmatched_stars} matched in ninja_stars.csv, "
          f"{unmatched_stars} not found (set to 0)")
    for category, messages in notes.items():
        print(f"\n[{category}] {len(messages)}")
        for m in messages:
            print("  -", m)


def pacific_of(student):
    return pacific(student["_last_ts"])


if __name__ == "__main__":
    main(*sys.argv[1:5])
