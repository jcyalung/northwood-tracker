# Builds the `belts` collection: one document per belt, the app's single
# source of truth for belts (replacing belts.json). Combines:
#   - belt ids and names (rsrc/belts.json, checked below)
#   - colors (from the icons in public/icons)
#   - level counts (rsrc/curriculum.md)
#   - stars per level and running totals (rsrc/ninja_stars.csv)
#
# Usage: python3 scripts/migrate/belts.py <belts.json> <curriculum.md> <ninja_stars.csv> <out.json>
# Then load with scripts/migrate/load.mjs.
import csv
import json
import sys

from curriculum import parse as parse_curriculum

# Each belt's color, taken from its icon. Metal belts use the middle of their
# icon's gradient; Junior has no icon, so it gets the Junior cards' lavender.
COLORS = {
    0: "#c4b5fd", 1: "#ffffff", 2: "#eabb5c", 3: "#d96d32", 4: "#a7c839",
    5: "#4673b9", 6: "#893f98", 7: "#553426", 8: "#ef3e40", 9: "#424143",
    10: "#a97748", 11: "#a7b9c0", 12: "#8fc3e5", 13: "#e2a035",
}
EXPECTED = [
    "junior", "white", "yellow", "orange", "green", "blue", "purple", "brown",
    "red", "black", "bronze", "silver", "platinum", "gold",
]
# Bronze (10) and up have a belt type (Godot or Unity).
FIRST_TYPED_BELT = 10


def stars_table(path):
    """'White Belt' rows at the top of ninja_stars.csv -> {title: (running total, stars per level)}."""
    out = {}
    for row in csv.reader(open(path, newline="")):
        if row and row[0].endswith(" Belt") and row[2].strip().isdigit():
            out[row[0].removesuffix(" Belt").lower()] = (int(row[2]), int(row[3]))
    return out


def main(belts_json, curriculum_md, stars_csv, out):
    names = {int(k): v.lower() for k, v in json.load(open(belts_json)).items()}
    # belts.json is unreliable, so check it against the known belt order.
    if [names.get(i) for i in range(len(EXPECTED))] != EXPECTED or len(names) != len(EXPECTED):
        raise ValueError(f"{belts_json} doesn't match the expected belts: {names}")

    levels = {}
    for path in parse_curriculum(curriculum_md):
        levels[path["belt_id"]] = max(levels.get(path["belt_id"], 0), path["belt_level"])
    stars = stars_table(stars_csv)

    docs = []
    for belt_id, title in sorted(names.items()):
        running_total, per_level = stars.get(title, (None, None))
        docs.append({
            "belt_id": belt_id,
            "title": title,
            "color": COLORS[belt_id],
            # Junior has no levels.
            "levels": levels.get(belt_id) if belt_id > 0 else None,
            "stars_per_level": per_level,
            "running_total": running_total,
            "has_type": belt_id >= FIRST_TYPED_BELT,
        })

    json.dump({"belts": docs}, open(out, "w"), indent=2)
    print(f"{len(docs)} belts -> {out}")
    for d in docs:
        print(f"  {d['belt_id']:>2} {d['title']:<9} {d['color']}  levels={d['levels']}  "
              f"stars/level={d['stars_per_level']}  running={d['running_total']}  type={d['has_type']}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
