# Builds headlines.json (Vermont/regional), national.json (national outlets) and standings.json (NFL) for the live boxes.
# Run by GitHub Actions every 30 minutes.
import json, urllib.request, xml.etree.ElementTree as ET, datetime, email.utils, html, re
UA = {"User-Agent": "Mozilla/5.0 (TheMorningCourier headline bot)"}
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25).read()

def feed(src, url):
    out = []
    try:
        root = ET.fromstring(get(url))
        for it in root.iter('item'):
            t = (it.findtext('title') or '').strip(); l = (it.findtext('link') or '').strip()
            if not t or not l.startswith('http'): continue
            d = it.findtext('pubDate')
            try: ts = email.utils.parsedate_to_datetime(d).timestamp()
            except Exception: ts = 0
            out.append({"title": html.unescape(re.sub('<[^>]+>', '', t)), "link": l, "source": src, "ts": ts})
    except Exception as e:
        print("feed failed", src, e)
    return out

def pick(items, per_source, total):
    items.sort(key=lambda x: -x["ts"])
    seen, out, per = set(), [], {}
    for x in items:
        k = re.sub(r'\W+', '', x["title"].lower())[:50]
        if k in seen or per.get(x["source"], 0) >= per_source: continue
        seen.add(k); per[x["source"]] = per.get(x["source"], 0) + 1; out.append(x)
    return out[:total]

def save(name, items):
    if items:
        json.dump({"updated": NOW, "items": items}, open(name, "w"), indent=1)
    print(name, len(items))

LOCAL = [("WCAX", "https://www.wcax.com/arc/outboundfeeds/rss/?outputType=xml"),
         ("WPTZ", "https://www.mynbc5.com/topstories-rss"),
         ("VTDigger", "https://vtdigger.org/feed/"),
         ("NPR", "https://feeds.npr.org/1001/rss.xml")]
NATIONAL = [("Fox News", "https://moxie.foxnews.com/google-publisher/latest.xml"),
            ("New York Post", "https://nypost.com/feed/"),
            ("USA Today", "https://rssfeeds.usatoday.com/UsatodaycomNation-TopStories"),
            ("CBS News", "https://www.cbsnews.com/latest/rss/main"),
            ("ABC News", "https://abcnews.go.com/abcnews/topstories")]
loc = [];  [loc.extend(feed(s, u)) for s, u in LOCAL]
save("headlines.json", pick(loc, 3, 12))
nat = [];  [nat.extend(feed(s, u)) for s, u in NATIONAL]
save("national.json", pick(nat, 3, 15))

# NFL standings (ESPN public JSON)
try:
    d = json.loads(get("https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3"))
    divs = []
    for conf in d.get("children", []):
        for dv in conf.get("children", []):
            teams = []
            for e in dv.get("standings", {}).get("entries", []):
                st = {s.get("name"): s for s in e.get("stats", [])}
                w = int(st.get("wins", {}).get("value", 0)); l = int(st.get("losses", {}).get("value", 0)); t = int(st.get("ties", {}).get("value", 0))
                pct = st.get("winPercent", {}).get("value", 0)
                teams.append({"name": e["team"].get("shortDisplayName") or e["team"]["displayName"], "abbr": e["team"].get("abbreviation", ""),
                              "rec": "%d-%d%s" % (w, l, "-%d" % t if t else ""), "pct": pct})
            teams.sort(key=lambda x: -x["pct"])
            divs.append({"name": dv.get("name", ""), "teams": teams})
    # AFC East first (the Patriots' division), then the rest
    divs.sort(key=lambda x: (x["name"] != "AFC East", x["name"]))
    if divs:
        json.dump({"updated": NOW, "divisions": divs}, open("standings.json", "w"), indent=1)
    print("standings", len(divs))
except Exception as e:
    print("standings failed", e)
