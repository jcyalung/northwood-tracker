# Turns rsrc/curriculum.md into Belt Paths documents (rsrc/SCHEMA.md): one per
# belt level, with its activities in order.
#
# Usage: python3 scripts/migrate/curriculum.py <curriculum.md> <out.json>
# Then load with scripts/migrate/load.mjs.
import json
import re
import sys
from collections import defaultdict

BELTS = {
    "white": 1, "yellow": 2, "orange": 3, "green": 4, "blue": 5, "purple": 6,
    "brown": 7, "red": 8, "black": 9, "bronze": 10, "silver": 11,
    "platinum": 12, "gold": 13,
}

notes = defaultdict(list)


def column_type(header):
    """'Build 2' -> build, 'Quest' -> quest, 'Prove Yourself' -> prove."""
    h = header.lower()
    for prefix, kind in (("build", "build"), ("quest", "quest"),
                         ("adventure", "adventure"), ("project", "build"),
                         ("prove", "prove")):
        if h.startswith(prefix):
            return kind
    raise ValueError(f"unknown column '{header}'")


def parse(path):
    sections, current = {}, None
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        m = re.match(r"^## (\w+) Belt\s*$", line)
        if m:
            current = m.group(1).lower()
            sections[current] = []
        elif current:
            sections[current].append(line)

    paths = []
    for belt, lines in sections.items():
        belt_id = BELTS[belt]
        table = [l for l in lines if l.startswith("|")]
        if table:
            header = [c.strip() for c in table[0].strip("|").split("|")]
            rows = [[c.strip() for c in r.strip("|").split("|")] for r in table[2:]]
            for row in rows:
                level = int(row[0])
                activities = []
                for col, title in zip(header[1:], row[1:]):
                    if not title:
                        continue
                    kind = column_type(col)
                    # A mastery mission listed as both Quest and Adventure is
                    # one activity.
                    if "mastery mission" in title.lower():
                        if any(a["title"] == title for a in activities):
                            notes["mastery"].append(f"{belt} {level}: '{title}' listed twice -> kept once")
                            continue
                        kind = "mastery"
                    activities.append({"type": kind, "title": title})
                if header[0] == "#":
                    notes["project levels"].append(f"{belt}: project #{level} -> level {level}")
                paths.append((belt_id, belt, level, activities))
        else:
            # Bullet or numbered list: each item is its own level.
            items = [re.sub(r"^(\d+\.|-)\s*", "", l).strip()
                     for l in lines if re.match(r"^(\d+\.|-)\s", l)]
            for level, item in enumerate(items, start=1):
                kind, _, title = item.partition(" — Adventure: ")
                if title:  # "Capstone — Adventure: Capstone Project"
                    activities = [{"type": "adventure", "title": title}]
                else:
                    activities = [{"type": "build", "title": item}]
                notes["list levels"].append(f"{belt}: '{item}' -> level {level}")
                paths.append((belt_id, belt, level, activities))

    docs = []
    for belt_id, belt, level, activities in paths:
        for i, a in enumerate(activities, start=1):
            a["activity_id"] = str(i)
        docs.append({
            "belt_id": belt_id,
            "belt_title": belt,
            "belt_level": level,
            "activities": [{"activity_id": a["activity_id"], "type": a["type"],
                            "title": a["title"]} for a in activities],
        })
    return docs


def main(md, out):
    docs = parse(md)
    json.dump({"belt_paths": docs}, open(out, "w"), indent=2, ensure_ascii=False)
    levels = defaultdict(int)
    for d in docs:
        levels[d["belt_title"]] = max(levels[d["belt_title"]], d["belt_level"])
    print(f"{len(docs)} belt levels, {sum(len(d['activities']) for d in docs)} activities -> {out}")
    print("levels per belt:", dict(levels))
    print("activity types:", dict(sorted(
        {t: sum(1 for d in docs for a in d["activities"] if a["type"] == t)
         for t in {a["type"] for d in docs for a in d["activities"]}}.items())))
    for category, messages in notes.items():
        print(f"\n[{category}] {len(messages)}")
        for m in messages:
            print("  -", m)


if __name__ == "__main__":
    main(*sys.argv[1:3])
