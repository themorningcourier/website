# Collects the latest headlines from RSS feeds into headlines.json (run by GitHub Actions).
import json, urllib.request, xml.etree.ElementTree as ET, datetime, email.utils, html, re
FEEDS = [
    ("WCAX", "https://www.wcax.com/arc/outboundfeeds/rss/?outputType=xml"),
    ("WPTZ", "https://www.mynbc5.com/topstories-rss"),
    ("VTDigger", "https://vtdigger.org/feed/"),
    ("NPR", "https://feeds.npr.org/1001/rss.xml"),
    ("NPR Business", "https://feeds.npr.org/1006/rss.xml"),
]
items = []
for src, url in FEEDS:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (TheMorningCourier headline bot)"})
        root = ET.fromstring(urllib.request.urlopen(req, timeout=20).read())
        for it in root.iter('item'):
            t = (it.findtext('title') or '').strip(); l = (it.findtext('link') or '').strip()
            if not t or not l.startswith('http'): continue
            d = it.findtext('pubDate')
            try: ts = email.utils.parsedate_to_datetime(d).timestamp()
            except Exception: ts = 0
            items.append({"title": html.unescape(re.sub('<[^>]+>', '', t)), "link": l, "source": src, "ts": ts})
    except Exception as e:
        print("feed failed", src, e)
items.sort(key=lambda x: -x["ts"])
seen, out, per = set(), [], {}
for x in items:
    k = x["title"].lower()[:60]
    if k in seen or per.get(x["source"], 0) >= 3: continue
    seen.add(k); per[x["source"]] = per.get(x["source"], 0) + 1; out.append(x)
if out:
    json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "items": out[:12]}, open("headlines.json", "w"), indent=1)
print(len(out), "headlines")
