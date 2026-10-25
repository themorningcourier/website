/* The Morning Courier — live boxes. Each box hides itself if its data source fails. */
(function () {
  const PLACES = [
    ["Essex Jct., VT", 44.4936, -73.1110],
    ["Snowshoe, WV", 38.4020, -79.9940],
    ["Roseburg, OR", 43.2165, -123.3417],
    ["St. Petersburg, FL", 27.7676, -82.6403],
    ["Cape Cod, MA", 41.7300, -70.1500],
    ["Wilmington, NC", 34.2257, -77.9447],
    ["Fulton, MO", 38.8467, -91.9479],
    ["Mt. Washington, NH", 44.2706, -71.3033]
  ];
  const WMO = {0:["Clear","☀️"],1:["Mostly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Cloudy","☁️"],45:["Fog","🌫️"],48:["Fog","🌫️"],
    51:["Drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Drizzle","🌦️"],56:["Freezing drizzle","🌧️"],57:["Freezing drizzle","🌧️"],
    61:["Light rain","🌧️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],66:["Freezing rain","🧊"],67:["Freezing rain","🧊"],
    71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],77:["Snow grains","🌨️"],80:["Showers","🌦️"],81:["Showers","🌦️"],
    82:["Heavy showers","⛈️"],85:["Snow showers","🌨️"],86:["Snow showers","❄️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm","⛈️"],99:["Thunderstorm","⛈️"]};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const hide = (id) => { const e = $(id); if (e) e.style.display = "none"; };
  const stamp = (id) => { const e = $(id); if (e) e.textContent = "Updated " + new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); };
  async function getJSON(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error(r.status); return r.json(); }

  async function weather() {
    try {
      const lat = PLACES.map(p => p[1]).join(","), lon = PLACES.map(p => p[2]).join(",");
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
        "&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1";
      let d = await getJSON(url); if (!Array.isArray(d)) d = [d];
      $("wx-list").innerHTML = d.map((x, i) => {
        const w = WMO[x.current.weather_code] || ["", "🌡️"];
        return '<div class="wx-row"><span class="wx-ico">' + w[1] + '</span><span class="wx-name">' + esc(PLACES[i][0]) +
          '<small>' + esc(w[0]) + ' · wind ' + Math.round(x.current.wind_speed_10m) + ' mph</small></span>' +
          '<span class="wx-now">' + Math.round(x.current.temperature_2m) + '°</span>' +
          '<span class="wx-hl">' + Math.round(x.daily.temperature_2m_max[0]) + '° / ' + Math.round(x.daily.temperature_2m_min[0]) + '°' +
          '<small>' + (x.daily.precipitation_probability_max[0] ?? 0) + '% precip.</small></span></div>';
      }).join("");
      stamp("wx-time");
    } catch (e) { hide("box-wx"); }
  }

  async function alerts() {
    try {
      const d = await getJSON("https://api.weather.gov/alerts/active?point=44.4936,-73.1110", {headers: {"Accept": "application/geo+json"}});
      const f = (d.features || []).map(x => x.properties);
      if (!f.length) { hide("box-alert"); return; }
      $("alert-list").innerHTML = f.slice(0, 3).map(a =>
        '<div class="al"><b>' + esc(a.event) + '</b> — ' + esc(a.headline || "") + '</div>').join("");
      $("box-alert").style.display = "block";
    } catch (e) { hide("box-alert"); }
  }

  const LEAGUES = [
    ["baseball/mlb", "MLB", null],
    ["hockey/nhl", "NHL", "BOS"],
    ["football/nfl", "NFL", null]
  ];
  async function scores() {
    try {
      let html = "", any = false;
      for (const [path, lab, only] of LEAGUES) {
        let d; try { d = await getJSON("https://site.api.espn.com/apis/site/v2/sports/" + path + "/scoreboard"); } catch (e) { continue; }
        let ev = d.events || [];
        if (only) ev = ev.filter(e => e.competitions[0].competitors.some(c => c.team.abbreviation === only));
        if (!ev.length) continue;
        any = true;
        html += '<div class="sc-lg">' + lab + '</div>';
        html += ev.slice(0, 16).map(e => {
          const c = e.competitions[0], st = c.status.type;
          const t = c.competitors.slice().sort((a, b) => (a.homeAway === "away" ? -1 : 1));
          const line = t.map(x => '<span class="' + (x.winner ? "w" : "") + '">' + esc(x.team.abbreviation) +
            (st.state === "pre" ? "" : " " + esc(x.score)) + '</span>').join(" @ ");
          const live = st.state === "in";
          return '<div class="sc' + (live ? " live" : "") + '">' + line + '<small>' + (live ? "● " : "") + esc(st.shortDetail) + '</small></div>';
        }).join("");
      }
      if (!any) { hide("box-sc"); return; }
      $("sc-list").innerHTML = html; stamp("sc-time");
    } catch (e) { hide("box-sc"); }
  }

  async function headlines() {
    try {
      const d = await getJSON("headlines.json?t=" + Date.now());
      if (!d.items || !d.items.length) { hide("box-news"); return; }
      $("news-list").innerHTML = d.items.slice(0, 10).map(h =>
        '<a class="hl" href="' + esc(h.link) + '" target="_blank" rel="noopener">' + esc(h.title) + '<small>' + esc(h.source) + '</small></a>').join("");
      const u = $("news-time"); if (u && d.updated) u.textContent = "Updated " + new Date(d.updated).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
    } catch (e) { hide("box-news"); }
  }

  function run() { weather(); alerts(); scores(); headlines(); }
  run();
  setInterval(run, 5 * 60 * 1000);
})();
