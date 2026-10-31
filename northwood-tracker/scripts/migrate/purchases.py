# Reads each student's prize counts from rsrc/ninja_stars.csv (Candy,
# Bracelet, ...), priced from the sheet's own price lists, keyed by student
# name. Load with scripts/migrate/purchases.mjs, which matches names to
# students and stores the purchases with date_purchased = null (they were
# made before this app, so there's no date).
#
# Usage: python3 scripts/migrate/purchases.py <ninja_stars.csv> <out.json>
import csv
import json
import sys

from transform import STAR_NAME_ALIASES, name_key


def main(stars_csv, out):
    rows = list(csv.reader(open(stars_csv, newline="")))

    # Price lists at the top: (Snack, Value), (Wearables, Value),
    # (Knick-knacks, Value) column pairs, one item per row.
    header = rows[0]
    price_columns = [i for i, h in enumerate(header) if h in ("Snack", "Wearables", "Knick-knacks")]
    prices = {}
    for row in rows[1:]:
        if row and row[0] == "Name":
            break
        for i in price_columns:
            if i + 1 < len(row) and row[i].strip() and row[i + 1].strip().isdigit():
                prices[row[i].strip()] = int(row[i + 1])

    name_row = next(i for i, r in enumerate(rows) if r and r[0] == "Name")
    columns = rows[name_row]
    item_columns = [(i, c) for i, c in enumerate(columns) if c in prices]
    missing = sorted(set(prices) - {c for _, c in item_columns})
    if missing:
        raise ValueError(f"items with prices but no count column: {missing}")

    by_name = {}
    for row in rows[name_row + 1 :]:
        if not row or not row[0].strip() or not row[1].strip():
            continue
        items = []
        for i, item in item_columns:
            count = row[i].strip() if i < len(row) else ""
            if count.isdigit() and int(count) > 0:
                items.append({
                    "item_purchased": item,
                    "quantity": int(count),
                    "stars_used": int(count) * prices[item],
                })
        if not items:
            continue
        key = name_key(row[0])
        by_name.setdefault(key, []).append({
            "belt": row[1].replace("Belt", "").strip().lower(),
            "items": items,
        })

    # Export spelling -> sheet spelling, so the loader can find both.
    aliases = {k: v for k, v in STAR_NAME_ALIASES.items()}
    json.dump({"prices": prices, "aliases": aliases, "by_name": by_name}, open(out, "w"), indent=2)
    print(f"{len(prices)} priced items; {len(by_name)} names with purchases "
          f"({sum(len(v) > 1 for v in by_name.values())} names appear more than once) -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
