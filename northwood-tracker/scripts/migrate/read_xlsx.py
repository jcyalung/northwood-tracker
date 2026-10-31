# Minimal .xlsx reader (inline strings, shared strings, numbers, booleans) so
# the migration needs no third-party packages.
import re
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _column(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_sheets(path):
    """Returns {sheet name: [ {header: value}, ... ]}. Values are strings or None."""
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{NS}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))

        rels = {
            r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        }
        sheets = {}
        for s in ET.fromstring(z.read("xl/workbook.xml")).iter(f"{NS}sheet"):
            target = rels[s.get(f"{REL_NS}id")].lstrip("/")
            target = target if target.startswith("xl/") else f"xl/{target}"
            rows = []
            for r in ET.fromstring(z.read(target)).iter(f"{NS}row"):
                row = {}
                for c in r.iter(f"{NS}c"):
                    kind, v, inline = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
                    if kind == "inlineStr" and inline is not None:
                        value = "".join(t.text or "" for t in inline.iter(f"{NS}t"))
                    elif kind == "s" and v is not None:
                        value = shared[int(v.text)]
                    else:
                        value = v.text if v is not None else None
                    row[_column(c.get("r"))] = value
                rows.append(row)
            if not rows:
                sheets[s.get("name")] = []
                continue
            width = max(max(r) + 1 for r in rows if r)
            header = [rows[0].get(i) for i in range(width)]
            sheets[s.get("name")] = [
                {h: r.get(i) for i, h in enumerate(header)} for r in rows[1:]
            ]
        return sheets
