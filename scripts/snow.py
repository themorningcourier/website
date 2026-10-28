# Snow Desk data for The Morning Courier (season Nov. 1 – Apr. 1).
# Run by GitHub Actions each morning. Builds snow.json:
#   - official NWS Daily Climate Reports (CLI) for tracked cities: yesterday's snowfall,
#     month to date, season to date (since July 1) with normal and departure, snow depth;
#   - NOHRSC National Snow Analysis "Top Ten" station snowfall reports (biggest totals in the U.S.);
#   - NOHRSC station reports matching our home spots (Middlebury, Stowe/Mt. Mansfield, Snowshoe).
# Keeps a running daily log so the paper can draw season charts and leaders.
import json, re, urllib.request, datetime, html, os

UA = {"User-Agent": "(TheMorningCourier snow desk, jaybe2527@gmail.com)", "Accept": "application/ld+json"}
NOW = datetime.datetime.now(datetime.timezone.utc)
OUT = "snow.json"
DEBUG = []

# (id, name, CLI location code)
CITIES = [
    ("BTV", "Burlington, VT", "BTV"), ("BOS", "Boston, MA", "BOS"), ("PWM", "Portland, ME", "PWM"),
    ("CAR", "Caribou, ME", "CAR"), ("CON", "Concord, NH", "CON"), ("ALB", "Albany, NY", "ALB"),
    ("SYR", "Syracuse, NY", "SYR"), ("BUF", "Buffalo, NY", "BUF"), ("NYC", "New York (Central Park)", "NYC"),
    ("ERI", "Erie, PA", "ERI"), ("DTW", "Detroit, MI", "DTW"), ("ORD", "Chicago, IL", "ORD"),
    ("MSP", "Minneapolis, MN", "MSP"), ("DEN", "Denver, CO", "DEN"), ("SLC", "Salt Lake City, UT", "SLC"),
    ("ANC", "Anchorage, AK", "ANC"),
]
# home spots matched against NOHRSC station names (case-insensitive substrings)
HOME = [("middlebury", "Middlebury, VT", ["MIDDLEBURY"], "VT"),
        ("stowe", "Stowe / Mt. Mansfield", ["MOUNT MANSFIELD", "MT MANSFIELD", "MT. MANSFIELD", "STOWE"], "VT"),
        ("snowshoe", "Snowshoe, WV", ["SNOWSHOE"], "WV")]
# NWSLI (SHEF) station-ID state suffixes, e.g. ENEA2 = Alaska, SNOW2 = West Virginia
SHEF = dict(A1="AL", A2="AK", A3="AZ", A4="AR", C1="CA", C2="CO", C3="CT", D1="DE", D2="DC", F1="FL", G1="GA", H1="HI",
            I1="ID", I2="IL", I3="IN", I4="IA", K1="KS", K2="KY", L1="LA", M1="ME", M2="MD", M3="MA", M4="MI", M5="MN",
            M6="MS", M7="MO", M8="MT", N1="NE", N2="NV", N3="NH", N4="NJ", N5="NM", N6="NY", N7="NC", N8="ND", O1="OH",
            O2="OK", O3="OR", P1="PA", R1="RI", S1="SC", S2="SD", T1="TN", T2="TX", U1="UT", V1="VT", V2="VA", W1="WA",
            W2="WV", W3="WI", W4="WY")

def state_of(sid, name):
    sid = sid.upper()
    if sid.startswith("CAN"): return "CAN"
    m = re.match(r"^([A-Z]{2})-[A-Z]{2}-\d+$", sid)          # CoCoRaHS, e.g. WY-LN-2
    if m: return m.group(1)
    m = re.search(r",\s*([A-Z]{2})$", name.upper())
    if m and m.group(1) != "CA": return m.group(1)
    if len(sid) == 5 and sid[3:] in SHEF: return SHEF[sid[3:]]
    return ""

def get(url, accept=None):
    h = dict(UA)
    if accept: h["Accept"] = accept
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30).read().decode("utf-8", "replace")

def num(tok):
    tok = tok.strip()
    if tok == "T": return 0.0, True
    if tok in ("MM", "M", ""): return None, False
    try: return float(tok), False
    except ValueError: return None, False

def parse_cli(text):
    """Return dict for the snowfall block of a CLI product, or None."""
    t = text.upper()
    m = re.search(r"CLIMATE SUMMARY FOR\s+([A-Z]+\s+\d{1,2}\s+\d{4})", t)
    if not m: return None
    try: date = datetime.datetime.strptime(m.group(1).title(), "%B %d %Y").date()
    except ValueError: return None
    blk = re.search(r"SNOWFALL \(IN\)(.*?)(?:\n\s*\n|DEGREE DAYS)", t, re.S)
    if not blk: return None
    rec = {"date": date.isoformat(), "valid": "YESTERDAY" in blk.group(1) or "TODAY" in blk.group(1)}
    for key, pat in [("day", r"(?:YESTERDAY|TODAY)\s+([0-9.TM]+)"), ("month", r"MONTH TO DATE\s+([0-9.TM]+)\s+([0-9.TM]+)?"),
                     ("season", r"SINCE (?:JUL|JULY|JUN|JUNE|SEP|OCT)\s*1\s+([0-9.TM]+)\s+([0-9.TM]+)?\s+([-0-9.TM]+)?"),
                     ("depth", r"SNOW DEPTH\s+([0-9TM]+)")]:
        mm = re.search(pat, blk.group(1))
        if not mm: continue
        v, tr = num(mm.group(1))
        rec[key] = v
        if key == "day": rec["trace"] = tr
        if key == "season":
            rec["season_normal"] = num(mm.group(2) or "")[0]
            rec["season_dep"] = num(mm.group(3) or "")[0]
        if key == "month":
            rec["month_normal"] = num(mm.group(2) or "")[0]
    rec["final"] = "YESTERDAY" in blk.group(1)
    return rec

def cli_latest(loc):
    """Newest morning CLI (covering yesterday) for a location."""
    lst = json.loads(get("https://api.weather.gov/products/types/CLI/locations/%s" % loc))
    items = lst.get("@graph", [])[:6]
    best = None
    for it in items:
        p = json.loads(get("https://api.weather.gov/products/%s" % it["id"]))
        r = parse_cli(p.get("productText", ""))
        if not r: continue
        r["issued"] = it.get("issuanceTime")
        if r["final"]:
            return r
        best = best or r
    return best

def nohrsc_topten():
    page = get("https://www.nohrsc.noaa.gov/nsa/", accept="text/html")
    rows = []
    # rows look like: <a href="...station=XXX">XXX</a></td><td>Name</td>...<td>2.9</td><td>24</td>
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S | re.I):
        cells = [html.unescape(re.sub("<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S | re.I)]
        if len(cells) >= 6 and re.search(r"station=", tr):
            sid, name, elev, amt, dur, when = cells[:6]
            try: amt = float(amt); dur = float(dur)
            except ValueError: continue
            st = state_of(sid, name)
            if st == "CAN": continue
            rows.append({"id": sid, "name": name.title(), "state": st, "elev_ft": elev, "inches": amt, "hours": dur, "time": when})
    DEBUG.append({"nohrsc_top_rows": rows[:40]})
    return rows

def nohrsc_reports(date):
    url = ("https://www.nohrsc.noaa.gov/nsa/reports.html?region=National&var=snowfall&dy=%d&dm=%d&dd=%d&units=e&sort=value&filter=0"
           % (date.year, date.month, date.day))
    page = get(url, accept="text/html")
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S | re.I):
        cells = [html.unescape(re.sub("<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S | re.I)]
        if len(cells) >= 4: rows.append(cells)
    DEBUG.append({"nohrsc_reports_sample": rows[:15], "count": len(rows)})
    return rows

def main():
    old = {}
    if os.path.exists(OUT):
        try: old = json.load(open(OUT))
        except Exception: old = {}
    log = old.get("log", {})          # {date: {"cities": {...}, "top": [...], "home": {...}}}
    today = {"cities": {}, "top": [], "home": {}}
    for cid, name, loc in CITIES:
        try:
            r = cli_latest(loc)
            if r: today["cities"][cid] = dict(r, name=name)
        except Exception as e:
            DEBUG.append({"cli_error": loc, "err": str(e)})
    try: today["top"] = nohrsc_topten()
    except Exception as e: DEBUG.append({"nohrsc_top_error": str(e)})
    yday = (NOW - datetime.timedelta(hours=12)).date()
    try:
        rows = nohrsc_reports(yday)
        for hid, hname, keys, st in HOME:
            hits = []
            for r in rows:
                if len(r) < 6: continue
                sid, when, amt, dur, elev, name = r[:6]
                if not any(k in name.upper() for k in keys): continue
                if state_of(sid, name) != st: continue
                try: hits.append({"id": sid, "name": name.title(), "inches": float(amt), "hours": float(dur), "time": when, "elev_ft": elev})
                except ValueError: pass
            if hits: today["home"][hid] = {"name": hname, "reports": hits[:5]}
    except Exception as e:
        DEBUG.append({"nohrsc_reports_error": str(e)})
    key = NOW.date().isoformat()
    log[key] = today
    # keep the season only (Oct 1 onward)
    log = {k: v for k, v in sorted(log.items()) if k >= "2026-10-01"}
    json.dump({"updated": NOW.isoformat(), "season": "2026-27", "start": "2026-11-01", "end": "2027-04-01",
               "latest": today, "log": log}, open(OUT, "w"), indent=1)
    json.dump({"updated": NOW.isoformat(), "debug": DEBUG}, open("snow_debug.json", "w"), indent=1)
    print("cities", len(today["cities"]), "top", len(today["top"]), "home", list(today["home"]))

if __name__ == "__main__":
    main()
