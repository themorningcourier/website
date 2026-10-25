/* The Morning Courier — live boxes. Each box hides itself if its data source fails. */
(function () {
  const FIXED = [
    ["Essex Jct., VT", 44.4936, -73.1110],
    ["Middlebury, VT", 44.0153, -73.1673],
    ["Charlotte, NC", 35.2271, -80.8431],
    ["Snowshoe, WV", 38.4020, -79.9940],
    ["Fulton, MO", 38.8467, -91.9479]
  ];
  // Two rotating spots that change every day
  const ROTATE = [
    ["Roseburg, OR", 43.2165, -123.3417], ["Cape Cod, MA", 41.7300, -70.1500], ["Wilmington, NC", 34.2257, -77.9447],
    ["Mt. Washington, NH", 44.2706, -71.3033], ["Saratoga Springs, NY", 43.0831, -73.7846], ["Lake Placid, NY", 44.2795, -73.9799],
    ["Portland, ME", 43.6591, -70.2568], ["Milwaukee, WI", 43.0389, -87.9065], ["Bar Harbor, ME", 44.3876, -68.2039],
    ["Cooperstown, NY", 42.7001, -74.9243], ["Crater Lake, OR", 42.9446, -122.1090], ["Cannon Beach, OR", 45.8918, -123.9615],
    ["Boston, MA", 42.3601, -71.0589], ["Stowe, VT", 44.4654, -72.6874], ["Tampa, FL", 27.9506, -82.4572], ["Nashville, TN", 36.1627, -86.7816]
  ];
  const _d = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const PLACES = FIXED.concat([ROTATE[_d % ROTATE.length], ROTATE[(_d * 7 + 3) % ROTATE.length]]);
  // Candidates for "hottest spot right now"
  const HOT = [["Phoenix, AZ",33.4484,-112.074],["Las Vegas, NV",36.1699,-115.1398],["Palm Springs, CA",33.8303,-116.5453],["Yuma, AZ",32.6927,-114.6277],
    ["Tucson, AZ",32.2226,-110.9747],["Death Valley, CA",36.4617,-116.8670],["El Paso, TX",31.7619,-106.485],["Laredo, TX",27.5306,-99.4803],
    ["Brownsville, TX",25.9017,-97.4975],["Houston, TX",29.7604,-95.3698],["San Antonio, TX",29.4241,-98.4936],["Miami, FL",25.7617,-80.1918],
    ["Key West, FL",24.5551,-81.78],["Orlando, FL",28.5383,-81.3792],["New Orleans, LA",29.9511,-90.0715],["Honolulu, HI",21.3069,-157.8583],
    ["Los Angeles, CA",34.0522,-118.2437],["Fresno, CA",36.7378,-119.7871],["Austin, TX",30.2672,-97.7431],["Tampa, FL",27.9506,-82.4572]];
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
      try {
        const hl = HOT.map(p => p[1]).join(","), hn = HOT.map(p => p[2]).join(",");
        let h = await getJSON("https://api.open-meteo.com/v1/forecast?latitude=" + hl + "&longitude=" + hn + "&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto");
        if (!Array.isArray(h)) h = [h];
        let bi = 0; h.forEach((x, i) => { if (x.current.temperature_2m > h[bi].current.temperature_2m) bi = i; });
        const w = WMO[h[bi].current.weather_code] || ["", ""];
        $("wx-list").insertAdjacentHTML("beforeend", '<div class="wx-row hot"><span class="wx-ico">🔥</span><span class="wx-name">Hottest right now<small>' +
          esc(HOT[bi][0]) + ' · ' + esc(w[0]) + '</small></span><span class="wx-now">' + Math.round(h[bi].current.temperature_2m) + '°</span><span class="wx-hl"><small>of 20 hot-weather cities</small></span></div>');
      } catch (e) {}
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

  async function national() {
    try {
      const d = await getJSON("national.json?t=" + Date.now());
      if (!d.items || !d.items.length) { hide("box-nat"); return; }
      $("nat-list").innerHTML = d.items.slice(0, 14).map(h =>
        '<a class="hl" href="' + esc(h.link) + '" target="_blank" rel="noopener">' + esc(h.title) + '<small>' + esc(h.source) + '</small></a>').join("");
      const u = $("nat-time"); if (u && d.updated) u.textContent = "Updated " + new Date(d.updated).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
    } catch (e) { hide("box-nat"); }
  }
  async function standings() {
    try {
      const d = await getJSON("standings.json?t=" + Date.now());
      if (!d.divisions || !d.divisions.length) { hide("box-st"); return; }
      const dvh = dv => '<div class="st-dv">' + esc(dv.name) + '</div><table class="st">' +
        dv.teams.map(t => '<tr' + (t.abbr === "NE" ? ' class="me"' : '') + '><td>' + esc(t.name) + '</td><td>' + esc(t.rec) + '</td></tr>').join("") + '</table>';
      $("st-list").innerHTML = dvh(d.divisions[0]) + '<details class="stw"><summary>All divisions</summary>' + d.divisions.slice(1).map(dvh).join("") + '</details>';
      const u = $("st-time"); if (u && d.updated) u.textContent = "Updated " + new Date(d.updated).toLocaleDateString([], {month:"short", day:"numeric"});
    } catch (e) { hide("box-st"); }
  }
  function run() { weather(); alerts(); scores(); headlines(); national(); standings(); }
  run();
  setInterval(run, 5 * 60 * 1000);
})();
