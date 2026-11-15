import { useEffect, useState } from "react";
import { getBriefing, formatAkTime, durationBetween, formatNumber } from "../services/api";
import { DISTRICTS, districtName, districtColor, isoShort, mdyShort, ago } from "../services/districts";
import "../styles/ToolsHub.css";
import "../styles/V4Tools.css";

const HOME_KEY = "bp.homeDistrict";
const START_KEY = "bp.startView";

function readSetting(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function writeSetting(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode: setting is not saved */
  }
}

function short(n) {
  if (n == null) return "–";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)} K`;
  return formatNumber(n);
}

/** Days between two dates given as "YYYY-MM-DD". */
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);
const mdyToIso = (d) => (d ? `${d.slice(6)}-${d.slice(0, 2)}-${d.slice(3, 5)}` : null);

function StatusRow({ id, s, asOf, onOpen }) {
  let pill = { cls: "v4-pill-none", text: "No notice" };
  let detail = "No recent announcement";
  if (s.state === "open") {
    pill = { cls: "v4-pill-open", text: "OPEN" };
    detail = s.untilFurtherNotice ? "until further notice" : s.until ? `until ${formatAkTime(s.until)} · ${durationBetween(asOf, s.until)} left` : "";
  } else if (s.state === "closed") {
    pill = { cls: "v4-pill-closed", text: "CLOSED" };
    detail = s.next ? `opens ${formatAkTime(s.next.start)} · in ${durationBetween(asOf, s.next.start)}` : "no opening announced";
  }
  const unsure = (s.current && s.current.confident === false) || (s.next && s.next.confident === false);
  return (
    <button className="v4-brief-status" style={{ borderLeftColor: districtColor(id) }} onClick={onOpen}>
      <span className="v4-brief-status-name">{districtName(id)}</span>
      <span className={`v4-pill ${pill.cls}`}>{pill.text}</span>
      <span className="v4-brief-status-detail">
        {detail}
        {unsure && <span className="v4-pill v4-pill-check"> Check source</span>}
      </span>
    </button>
  );
}

export default function DailyBriefing({ onBack, onOpenOpenings, onOpenPortMoller, onOpenWeather, onOpenEscapement }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [home, setHome] = useState(() => readSetting(HOME_KEY, "nushagak"));
  const [startHere, setStartHere] = useState(() => readSetting(START_KEY, "") === "briefing");
  const asOfParam = new URLSearchParams(window.location.search).get("asOf");

  useEffect(() => {
    getBriefing(asOfParam)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Could not load the briefing. If you are offline, the last saved briefing shows when there is one."));
  }, [asOfParam]);

  const changeHome = (id) => {
    setHome(id);
    writeSetting(HOME_KEY, id);
  };
  const toggleStart = () => {
    writeSetting(START_KEY, startHere ? "" : "briefing");
    setStartHere(!startHere);
  };

  if (!data) {
    return (
      <div className="tools-hub-container">
        <div className="tools-hub-background"></div>
        <div className="tools-hub-content v4-content">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          {error ? <div className="v4-notice v4-notice-error">{error}</div> : <p className="v4-dim">Loading the briefing…</p>}
        </div>
      </div>
    );
  }

  const asOf = data.asOf;
  const run = data.latestRun;
  const runIso = run ? mdyToIso(run.runDate) : null;
  const runLate = data.inSeason && runIso && daysBetween(runIso, asOf.slice(0, 10)) > 1;
  const annAgeMin = data.freshness.announcements ? (Date.now() - new Date(data.freshness.announcements)) / 60000 : Infinity;
  const annLate = data.inSeason && !asOfParam && annAgeMin > 120;

  // Yesterday by district, sorted by sockeye per delivery; home district first.
  const rows = run
    ? DISTRICTS.map((d) => {
        const x = run.districts.find((r) => r.id === d.id) || {};
        const boats = data.fleet[d.id]?.vessels ?? null;
        return {
          ...d,
          catchDaily: x.catchDaily ?? null,
          spd: run.sockeyePerDelivery[d.id] ?? null,
          prevSpd: run.previous?.sockeyePerDelivery?.[d.id] ?? null,
          boats,
          perBoat: boats && x.catchDaily ? Math.round(x.catchDaily / boats) : null,
          totalRun: x.totalRun ?? null,
        };
      }).sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : (b.spd || 0) - (a.spd || 0)))
    : [];

  const fc = data.forecast;
  const bayActual = run?.totalRun?.totalRun || 0;
  const bayForecast = fc ? fc.baywide.inshoreRun * 1e6 : null;
  const pm = data.portMoller;
  const flagged = data.escapement.filter((e) => e.state !== "within");

  return (
    <div className="tools-hub-container">
      <div className="tools-hub-background"></div>
      <div className="tools-hub-content v4-content">
        <div className="tools-hub-header v4-header">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          <div className="header-text-section">
            <h1 className="tools-hub-title">Daily Briefing</h1>
            <p className="tools-hub-subtitle">{formatAkTime(asOf)} Alaska time{asOfParam ? " (replay)" : ""}</p>
          </div>
        </div>

        {/* 1. Freshness */}
        <div className="v4-brief-fresh">
          <span className={runLate ? "v4-warn" : ""}>
            Run summary: {run ? mdyShort(run.runDate) : "none"}
          </span>
          <span className={annLate ? "v4-warn" : ""}>Announcements read {ago(data.freshness.announcements)}</span>
          {data.freshness.portMoller && <span>Port Moller read {ago(data.freshness.portMoller)}</span>}
        </div>
        {!data.inSeason && (
          <div className="v4-notice">
            Off season. The numbers below are from the last day of {data.season}.
          </div>
        )}
        {error && <div className="v4-notice v4-notice-error">{error}</div>}

        {/* 2. Status strip */}
        <h2 className="v4-section-title">Drift openings</h2>
        <div className="v4-brief-statuslist">
          {DISTRICTS.map((d) => (
            <StatusRow key={d.id} id={d.id} s={data.status[d.id] || { state: "none" }} asOf={asOf} onOpen={onOpenOpenings} />
          ))}
        </div>

        {/* 3. Yesterday by district */}
        {run && (
          <>
            <h2 className="v4-section-title">{mdyShort(run.runDate)} by district</h2>
            <div className="v4-card v4-table-wrap">
              <table className="v4-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Catch</th>
                    <th>Per delivery</th>
                    <th>Boats</th>
                    <th>Per boat*</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.id === home ? "v4-home" : ""}>
                      <td style={{ borderLeft: `4px solid ${r.color}` }}>
                        <strong>{r.name}</strong>
                        {r.id === home && <div className="v4-dim v4-small">home</div>}
                      </td>
                      <td>{short(r.catchDaily)}</td>
                      <td>
                        {r.spd ? formatNumber(r.spd) : "–"}
                        {r.spd && r.prevSpd ? (
                          <div className={`v4-small ${r.spd >= r.prevSpd ? "v4-up" : "v4-down"}`}>
                            {r.spd >= r.prevSpd ? "▲" : "▼"} {formatNumber(Math.abs(r.spd - r.prevSpd))}
                          </div>
                        ) : null}
                      </td>
                      <td>{r.boats ?? "–"}</td>
                      <td>{r.perBoat ? formatNumber(r.perBoat) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="v4-footnote">
                Per delivery = ADF&G sockeye per drift delivery. Boats = newest count in the announcements (dates
                differ). *Per boat = district catch (all gear) / boats: an estimate.
              </p>
            </div>
          </>
        )}

        {/* 4. Run against forecast */}
        {fc && run && (
          <>
            <h2 className="v4-section-title">Run against forecast</h2>
            <div className="v4-card" onClick={onOpenEscapement} role="button">
              <div className="v4-fc-head">
                <strong>Bristol Bay</strong>
                <span>
                  {short(bayActual)} of {short(bayForecast)} · <strong>{Math.round((bayActual / bayForecast) * 100)}%</strong>
                </span>
              </div>
              <div className="v4-goalbar">
                <div className="v4-goalbar-fill" style={{ width: `${Math.min(100, (bayActual / bayForecast) * 100)}%`, background: "linear-gradient(90deg, #3b9ff3, #f4a460)" }} />
              </div>
              <div className="v4-brief-mini">
                {DISTRICTS.map((d) => {
                  const actual = rows.find((r) => r.id === d.id)?.totalRun || 0;
                  const f = fc.districts[d.id].inshoreRun * 1e6;
                  const pct = f ? (actual / f) * 100 : 0;
                  return (
                    <div key={d.id}>
                      <div className="v4-small">
                        {d.name} <strong>{Math.round(pct)}%</strong>
                      </div>
                      <div className="v4-goalbar v4-goalbar-thin">
                        <div className="v4-goalbar-fill" style={{ width: `${Math.min(100, pct)}%`, background: d.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {flagged.length > 0 && (
                <p className="v4-small v4-brief-esc">
                  Escapement:{" "}
                  {flagged.map((e, i) => (
                    <span key={e.river}>
                      {i > 0 && " · "}
                      {e.river.replace(" River", "")} <strong className={e.state === "below" ? "v4-warn" : ""}>{e.state} goal</strong>
                    </span>
                  ))}
                </p>
              )}
              <p className="v4-footnote">Inshore run to {mdyShort(run.runDate)} against the ADF&G preseason forecast.</p>
            </div>
          </>
        )}

        {/* 5. Port Moller */}
        {(pm.date || pm.stock) && (
          <>
            <h2 className="v4-section-title">Port Moller</h2>
            <div className="v4-card" onClick={onOpenPortMoller} role="button">
              {pm.date && (
                <p>
                  Daily index <strong className="v4-big-sm">{pm.dailyIndex ?? "–"}</strong> on {isoShort(pm.date)} · season
                  total {pm.cumulativeIndex != null ? Math.round(pm.cumulativeIndex) : "–"}
                </p>
              )}
              {pm.stock?.arrival && (
                <p>
                  Fish sampled {isoShort(pm.stock.period[0])}–{isoShort(pm.stock.period[1])} arrive about{" "}
                  <strong>
                    {isoShort(pm.stock.arrival.from)}–{isoShort(pm.stock.arrival.to)}
                  </strong>
                  . {districtName(home)} share: <strong>{(pm.stock.byDistrict[home] ?? 0).toFixed(1)}%</strong>
                  {!pm.stock.complete && <span className="v4-pill v4-pill-check"> Check source</span>}
                </p>
              )}
              <p className="v4-footnote">Preliminary BBSRI and ADF&G data. Tap for the charts.</p>
            </div>
          </>
        )}

        {/* 6. Weather */}
        <h2 className="v4-section-title">Weather and tide</h2>
        <button className="v4-chip v4-wide" onClick={onOpenWeather}>Open the weather dashboard →</button>

        {/* Settings */}
        <h2 className="v4-section-title">Settings</h2>
        <div className="v4-card v4-settings">
          <label>
            Home district
            <select className="v4-input" value={home} onChange={(e) => changeHome(e.target.value)}>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="v4-check">
            <input type="checkbox" checked={startHere} onChange={toggleStart} /> Open the app on this briefing
          </label>
          <p className="v4-footnote">
            Settings are saved in this browser only. For a home-screen icon, open{" "}
            <code>/?view=briefing</code> in Safari and use Share → Add to Home Screen.
          </p>
        </div>
      </div>
    </div>
  );
}
