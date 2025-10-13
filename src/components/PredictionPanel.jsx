import React, { useMemo, useState } from "react";

function postJSON(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).then(r => r.json());
}

const TABS = [
    { key: "t",   label: "Predict Temperature",        path: "/predict/temperature" },
    { key: "tf",  label: "Predict Temperature Future", path: "/predict/temperature/ahead" },
    { key: "o",   label: "Predict Occupancy",          path: "/predict/occupancy" },
    { key: "of",  label: "Predict Occupancy Future",   path: "/predict/occupancy/ahead" },
];

export default function PredictionPanel({ floorCode, roomKey }) {
    const [tab, setTab] = useState("t");
    const [loading, setLoading] = useState(false);
    const [resp, setResp] = useState(null);
    const [err, setErr] = useState(null);

    // minimal params with your defaults
    const [hoursHistory, setHoursHistory] = useState(24);
    const [hoursAhead, setHoursAhead] = useState(6);
    const [freq, setFreq] = useState("1min");
    const [retProb, setRetProb] = useState(false);

    const endpoint = useMemo(() => TABS.find(t => t.key === tab).path, [tab]);

    const onSend = async () => {
        setLoading(true); setErr(null); setResp(null);
        try {
            let body = { floor: floorCode, room: roomKey };
            if (tab === "t") {
                body.hours_history = hoursHistory;                       // temp
            } else if (tab === "tf") {
                body.hours_ahead = hoursAhead;                           // temp future
                body.hours_history = hoursHistory;
                body.resample_freq = freq;
            } else if (tab === "o") {
                body.hours_history = hoursHistory;                       // occupancy
                body.return_probability = retProb;
            } else if (tab === "of") {
                body.hours_ahead = hoursAhead;                           // occupancy future
                body.hours_history = hoursHistory;
                body.return_probability = retProb;
                body.resample_freq = freq;
            }
            const json = await postJSON(endpoint, body);
            setResp(json);
        } catch (e) {
            setErr(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: "absolute", top: 52, left: 12, zIndex: 20,
            padding: 12, width: 420,
            background: "rgba(0,0,0,0.55)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8,
            fontSize: 12, fontFamily: "ui-monospace, Menlo, Consolas, monospace"
        }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
                Prediction — {floorCode}/{roomKey}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.45)",
                            background: tab === t.key ? "rgba(255,255,255,0.18)" : "transparent",
                            color: "#fff", cursor: "pointer"
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Minimal controls per your spec */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 6, columnGap: 8 }}>
                {(tab === "t" || tab === "tf" || tab === "o" || tab === "of") && (
                    <>
                        <label>hours_history</label>
                        <input type="number" min={1} value={hoursHistory}
                               onChange={e => setHoursHistory(+e.target.value)} />
                    </>
                )}

                {(tab === "tf" || tab === "of") && (
                    <>
                        <label>hours_ahead</label>
                        <input type="number" min={1} max={168} value={hoursAhead}
                               onChange={e => setHoursAhead(+e.target.value)} />
                    </>
                )}

                {(tab === "tf" || tab === "of") && (
                    <>
                        <label>resample_freq</label>
                        <select value={freq} onChange={e => setFreq(e.target.value)}>
                            <option value="1min">1min</option>
                            <option value="5min">5min</option>
                            <option value="10min">10min</option>
                            <option value="1h">1h</option>
                        </select>
                    </>
                )}

                {(tab === "o" || tab === "of") && (
                    <>
                        <label>return_probability</label>
                        <input type="checkbox" checked={retProb}
                               onChange={e => setRetProb(e.target.checked)} />
                    </>
                )}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button
                    onClick={onSend}
                    disabled={loading}
                    style={{
                        padding: "8px 12px", borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.45)",
                        background: "rgba(0,0,0,0.35)", color: "#fff", cursor: "pointer"
                    }}
                >
                    {loading ? "Sending…" : "POST"}
                </button>
                <div style={{ opacity: 0.8 }}>
                    POST {endpoint}
                </div>
            </div>

            {/* Response */}
            <div style={{
                marginTop: 10, maxHeight: 260, overflow: "auto",
                background: "rgba(0,0,0,0.35)", padding: 8, borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.25)"
            }}>
                {err && <div style={{ color: "#ffb4b4" }}>Error: {err}</div>}
                {!err && resp && (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(resp, null, 2)}
          </pre>
                )}
                {!err && !resp && <div style={{ opacity: 0.8 }}>No response yet.</div>}
            </div>
        </div>
    );
}
