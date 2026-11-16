import { useEffect, useMemo, useRef, useState } from "react";
import { getSeasonDays, formatNumber } from "../services/api";
import { listEntries, updateEntry, deleteEntry, exportJson, importJson, exportCsv, download } from "../services/catchLog";
import { DISTRICTS, districtName, districtColor, mdyShort } from "../services/districts";

/**
 * "My log" section of the Catch Efficiency screen.
 * The entries stay in this browser. Only the ADF&G district numbers are loaded from the server.
 */
export default function CatchLog({ refreshKey }) {
  const [entries, setEntries] = useState(() => listEntries());
  const [season, setSeason] = useState(null);
  const [spdByDate, setSpdByDate] = useState({});
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => setEntries(listEntries()), [refreshKey]);

  const seasons = useMemo(() => [...new Set(entries.map((e) => +e.date.slice(6)))].sort((a, b) => b - a), [entries]);
  const activeSeason = season && seasons.includes(season) ? season : seasons[0];
  const shown = entries.filter((e) => +e.date.slice(6) === activeSeason);

  // District sockeye per delivery for each day of the season (one request)
  useEffect(() => {
    if (!activeSeason || spdByDate[activeSeason]) return;
    getSeasonDays(activeSeason)
      .then((days) => {
        const map = {};
        (days || []).forEach((d) => (map[d.runDate] = d.sockeyePerDelivery || {}));
        setSpdByDate((s) => ({ ...s, [activeSeason]: map }));
      })
      .catch(() => {});
  }, [activeSeason, spdByDate]);

  const totals = shown.reduce(
    (t, e) => ({
      pounds: t.pounds + (e.pounds || 0),
      fish: t.fish + (e.sockeye || 0),
      value: t.value + (e.pounds && e.pricePerLb ? e.pounds * e.pricePerLb : 0),
      priced: t.priced + (e.pricePerLb ? 1 : 0),
    }),
    { pounds: 0, fish: 0, value: 0, priced: 0 }
  );

  const reload = () => setEntries(listEntries());

  const remove = (e) => {
    if (!window.confirm(`Delete the delivery of ${mdyShort(e.date)} (${formatNumber(e.pounds)} lbs)? This cannot be undone.`)) return;
    deleteEntry(e.id);
    reload();
  };

  const saveEdit = () => {
    updateEntry(editing.id, editing);
    setEditing(null);
    reload();
  };

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const n = importJson(await file.text());
      setMessage(`Backup read: ${n} entries added or changed.`);
      reload();
    } catch (err) {
      setMessage(`Import failed: ${err.message}`);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="catch-log">
      <div className="catch-log-head">
        <h3>📒 My log</h3>
        {seasons.length > 1 && (
          <div className="catch-log-seasons">
            {seasons.map((y) => (
              <button key={y} className={`log-chip ${y === activeSeason ? "active" : ""}`} onClick={() => setSeason(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="section-description">No deliveries saved yet. Enter a delivery above and tap “Save to my log”.</p>
      ) : (
        <>
          <div className="catch-log-totals">
            <div><span>{formatNumber(Math.round(totals.pounds))}</span>lbs</div>
            <div><span>{formatNumber(totals.fish)}</span>sockeye</div>
            <div><span>{shown.length}</span>deliveries</div>
            <div>
              <span>{totals.priced ? `$${formatNumber(Math.round(totals.value))}` : "–"}</span>
              value{totals.priced && totals.priced < shown.length ? "*" : ""}
            </div>
          </div>
          {totals.priced > 0 && totals.priced < shown.length && (
            <p className="catch-log-note">*Value counts only the deliveries with a price.</p>
          )}

          <ul className="catch-log-list">
            {shown.map((e) => {
              const avg = spdByDate[activeSeason]?.[e.date]?.[e.district];
              const diff = avg && e.sockeye ? e.sockeye - avg : null;
              if (editing?.id === e.id) {
                return (
                  <li key={e.id} className="catch-log-item editing">
                    <div className="catch-log-edit">
                      <label>Pounds<input className="input-field" type="number" inputMode="decimal" value={editing.pounds ?? ""} onChange={(x) => setEditing({ ...editing, pounds: x.target.value })} /></label>
                      <label>Avg weight<input className="input-field" type="number" inputMode="decimal" step="0.1" value={editing.avgWeight ?? ""} onChange={(x) => setEditing({ ...editing, avgWeight: x.target.value })} /></label>
                      <label>District
                        <select className="input-field" value={editing.district} onChange={(x) => setEditing({ ...editing, district: x.target.value })}>
                          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </label>
                      <label>Price $/lb<input className="input-field" type="number" inputMode="decimal" step="0.01" value={editing.pricePerLb ?? ""} onChange={(x) => setEditing({ ...editing, pricePerLb: x.target.value })} /></label>
                      <label>Sets<input className="input-field" type="number" inputMode="numeric" value={editing.sets ?? ""} onChange={(x) => setEditing({ ...editing, sets: x.target.value })} /></label>
                      <label>Tide<input className="input-field" value={editing.tide ?? ""} onChange={(x) => setEditing({ ...editing, tide: x.target.value })} /></label>
                      <label className="wide">Notes<input className="input-field" value={editing.notes ?? ""} onChange={(x) => setEditing({ ...editing, notes: x.target.value })} /></label>
                    </div>
                    <div className="catch-log-actions">
                      <button className="log-btn primary" onClick={saveEdit}>Save</button>
                      <button className="log-btn" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={e.id} className="catch-log-item" style={{ borderLeftColor: districtColor(e.district) }}>
                  <div className="catch-log-main">
                    <div>
                      <strong>{mdyShort(e.date)}</strong> · {districtName(e.district)}
                      <div className="catch-log-sub">
                        {formatNumber(e.pounds)} lbs ÷ {e.avgWeight} = <strong>{formatNumber(e.sockeye)} fish</strong>
                        {e.pricePerLb ? ` · $${e.pricePerLb}/lb` : ""}
                        {e.sets ? ` · ${e.sets} sets` : ""}
                        {e.tide ? ` · ${e.tide}` : ""}
                      </div>
                      {e.notes && <div className="catch-log-sub">{e.notes}</div>}
                    </div>
                    <div className="catch-log-diff">
                      {diff == null ? (
                        <span className="muted">no district number</span>
                      ) : (
                        <span className={diff >= 0 ? "better" : "worse"}>
                          {diff >= 0 ? "+" : ""}{formatNumber(diff)} vs {formatNumber(avg)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="catch-log-actions">
                    <button className="log-btn" onClick={() => setEditing({ ...e })}>Edit</button>
                    <button className="log-btn danger" onClick={() => remove(e)}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="catch-log-note">“vs” = ADF&G sockeye per drift delivery for that district and day.</p>
        </>
      )}

      <div className="catch-log-backup">
        <button className="log-btn" onClick={() => download(exportJson(), `catch-log-${stamp}.json`, "application/json")} disabled={!entries.length}>
          Export backup
        </button>
        <button className="log-btn" onClick={() => fileRef.current?.click()}>Import backup</button>
        <button className="log-btn" onClick={() => download(exportCsv(), `catch-log-${stamp}.csv`, "text/csv")} disabled={!entries.length}>
          Export CSV
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </div>
      {message && <p className="catch-log-note">{message}</p>}
      <p className="catch-log-note">
        🔒 The log is saved only in this browser. Export a backup before you clear the browser data or change phones.
        On iPhone, the home-screen app and Safari keep separate logs: use the same one each time.
      </p>
    </div>
  );
}
