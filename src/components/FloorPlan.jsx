// src/components/FloorPlan.jsx
import React, { useState, useMemo, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Html } from "@react-three/drei";
import FloorplanModel from "../jsx_model/FloorplanModel";
import PredictionPanel from "../components/PredictionPanel.jsx";
import { ROOMS, STATUS_COLOR } from "../data/rooms";

/* ========================= Config ========================= */
const FLOORS = {
    "4th floor": "/models/floorplan_4th.glb",
    "5th floor": "/models/floorplan_5th.glb",
    "6th floor": "/models/floorplan_6th.glb",
    "7th floor": "/models/floorplan_7th.glb",
};
const SENSORS = ["co2", "humidity", "light", "motion", "temperature"];
const SENSOR_COLORS = {
    co2: "#60a5fa",
    humidity: "#34d399",
    light: "#fbbf24",
    motion: "#f97316",
    temperature: "#ef4444",
};

const fmt = (n) => (Math.abs(n) < 1e-3 ? "0.000" : n.toFixed(3));
const fmtTime = (t) => new Date(t).toLocaleString();

function floorToCode(label) {
    switch (label) {
        case "4th floor": return "F_4";
        case "5th floor": return "F_5";
        case "6th floor": return "F_6";
        case "7th floor": return "F_7";
        default: return null;
    }
}

function roomOverallRange(roomObj) {
    if (!roomObj) return null;
    let minStart = Infinity, maxEnd = -Infinity;
    for (const sensor of Object.values(roomObj)) {
        const s = Date.parse(sensor.start);
        const e = Date.parse(sensor.end);
        if (!Number.isNaN(s) && s < minStart) minStart = s;
        if (!Number.isNaN(e) && e > maxEnd)  maxEnd = e;
    }
    if (!isFinite(minStart) || !isFinite(maxEnd)) return null;
    return [minStart, maxEnd];
}

// Date -> "YYYY-MM-DD HH:mm:ss"
function toSqlish(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ============ Clickable room hotspots (small floating label) ============ */
const RANGE = 0.35;
const BOX_W = RANGE * 2;
const BOX_D = RANGE * 2;
const BOX_H = 1.0;
const POP_Y = 0.22;
const LABEL_DF = 40;

function ClickHotspot({
                          id, pos, color, selectedId, setSelected,
                          selectedSensor, currentPoint,
                      }) {
    const [x, y, z] = pos;
    const isActive = selectedId === id;
    const labelColor = selectedSensor ? (SENSOR_COLORS[selectedSensor] || color) : color;

    let brief = `Room ${id}`;
    if (selectedSensor && currentPoint) {
        const sName = selectedSensor.toUpperCase();
        const last  = currentPoint.last ?? currentPoint.avg ?? currentPoint.max ?? currentPoint.min ?? "—";
        brief = `Room ${id} — ${sName}: ${last}`;
    } else if (selectedSensor && !currentPoint) {
        brief = `Room ${id} — ${selectedSensor.toUpperCase()}: (no data)`;
    }

    return (
        <group>
            <mesh
                position={[x, y + BOX_H / 2, z]}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelected((curr) => (curr === id ? null : id));
                }}
            >
                <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {isActive && (
                <Html position={[x, y + POP_Y, z]} center distanceFactor={LABEL_DF} zIndexRange={[15, 25]}>
                    <div
                        style={{
                            padding: "3px 6px",
                            fontSize: 10,
                            color: "#fff",
                            background: labelColor,
                            border: "1px solid rgba(255,255,255,0.5)",
                            borderRadius: 4,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            fontWeight: 700,
                        }}
                    >
                        {brief}
                    </div>
                </Html>
            )}
        </group>
    );
}

/* =========================== Main component =========================== */
export default function FloorPlan() {
    const [label, setLabel] = useState("4th floor");
    const url = FLOORS[label];
    const rooms = ROOMS[label] ?? [];

    // top-left coordinates readout
    const [pick, setPick] = useState(null);
    const pickText = useMemo(() => {
        if (!pick) return "Click the model to read coordinates…";
        const { x, y, z, name } = pick;
        return `${name ?? "(unnamed)"}  |  x:${fmt(x)}  y:${fmt(y)}  z:${fmt(z)}`;
    }, [pick]);

    // mode toggle
    const [mode, setMode] = useState("replay"); // 'replay' | 'prediction'

    // selection (room)
    const [selectedId, setSelectedId] = useState(null);

    /* ---------------------------- REPLAY STATE ---------------------------- */
    const replayOn = mode === "replay";
    const floorCode = floorToCode(label);

    const [ranges, setRanges] = useState(null);        // /twin/history/F_X
    const [selectedSensor, setSelectedSensor] = useState(null);
    const [series, setSeries] = useState(null);        // array of points for chosen sensor
    const [curIdx, setCurIdx] = useState(0);
    const currentPoint = useMemo(() => {
        if (!series || !series.length) return null;
        const i = Math.min(Math.max(curIdx, 0), series.length - 1);
        return series[i];
    }, [series, curIdx]);

    // fetch floor ranges for slider window (only when in replay)
    useEffect(() => {
        if (!replayOn || !floorCode) return;
        setRanges(null);
        setSeries(null);
        setSelectedSensor(null);
        setCurIdx(0);

        fetch(`/twin/history/${floorCode}`)
            .then((r) => r.json())
            .then((data) => setRanges(data.range || {}))
            .catch((err) => { console.error("ranges error", err); setRanges({}); });
    }, [replayOn, floorCode]);

    // reset sensor/series when room changes (replay)
    useEffect(() => {
        if (!replayOn) return;
        setSelectedSensor(null);
        setSeries(null);
        setCurIdx(0);
    }, [selectedId, replayOn]);

    // resolve API room key leniently
    function resolveRoomKey(rangesObj, id) {
        if (!rangesObj || !id) return null;
        const wantA = `R_${id}`.toLowerCase();
        const wantB = `${id}`.toLowerCase();
        return Object.keys(rangesObj).find(
            (k) => k.toLowerCase() === wantA || k.toLowerCase() === wantB
        ) || null;
    }

    // fetch full sensor series once after sensor chosen (replay)
    useEffect(() => {
        if (!replayOn || !ranges || !selectedId || !selectedSensor) return;

        const rk = resolveRoomKey(ranges, selectedId);
        const span = roomOverallRange(ranges[rk]);
        if (!rk || !span) { setSeries([]); return; }

        const [minT, maxT] = span;
        const from = toSqlish(new Date(minT));
        const to   = toSqlish(new Date(maxT));
        const url  = `/twin/rooms/${floorCode}/${rk}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&agg=1&sensor=${encodeURIComponent(selectedSensor)}`;

        setSeries(null);
        setCurIdx(0);

        fetch(url)
            .then((r) => r.json())
            .then((j) => { setSeries(Array.isArray(j?.series) ? j.series : []); })
            .catch((e) => { console.error("series error", e); setSeries([]); });
    }, [replayOn, ranges, selectedId, selectedSensor, floorCode]);

    /* -------------------------- UI LAYOUT -------------------------- */
    return (
        <div className="h-screen w-screen bg-[#030d30] relative">
            {/* top-left coordinate readout */}
            <div
                style={{
                    position: "absolute", top: 12, left: 12, zIndex: 20,
                    padding: "10px 12px", color: "#fff",
                    background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: 8, fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    fontSize: 13, whiteSpace: "pre", userSelect: "text",
                }}
            >
                {pickText}
            </div>

            {/* top-center: MODE TOGGLER */}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    display: "flex",
                    gap: 0,
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.45)",
                    borderRadius: 999,
                    overflow: "hidden",
                }}
            >
                <button
                    onClick={() => setMode("replay")}
                    style={{
                        padding: "8px 16px",
                        color: "#fff",
                        background: mode === "replay" ? "rgba(255,255,255,0.18)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                    }}
                >
                    Replay
                </button>
                <button
                    onClick={() => setMode("prediction")}
                    style={{
                        padding: "8px 16px",
                        color: "#fff",
                        background: mode === "prediction" ? "rgba(255,255,255,0.18)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                    }}
                >
                    Prediction
                </button>
            </div>

            {/* top-right: floor buttons */}
            <div className="absolute top-3 right-3 z-10 flex gap-6">
                {Object.keys(FLOORS).map((name) => (
                    <button
                        key={name}
                        onClick={() => {
                            setLabel(name);
                            setSelectedId(null);
                            setPick(null);
                            // replay state will refetch if in replay mode
                            setSeries(null);
                            setSelectedSensor(null);
                            setRanges(null);
                            setCurIdx(0);
                        }}
                        style={{
                            padding: "12px 20px", fontSize: 14, lineHeight: 1.0, color: "#fff",
                            background: name === label ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
                            border: "1px solid rgba(255,255,255,0.45)", borderRadius: 10,
                            cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {/* REPLAY: sensor picker */}
            {replayOn && selectedId && (
                <div
                    style={{
                        position: "absolute",
                        top: 52,
                        left: 12,
                        zIndex: 20,
                        background: "rgba(0,0,0,0.55)",
                        border: "1px solid rgba(255,255,255,0.4)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: "#fff",
                        fontSize: 12,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        Select sensor for R_{selectedId}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {SENSORS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setSelectedSensor(s)}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.5)",
                                    background: selectedSensor === s ? SENSOR_COLORS[s] : "rgba(0,0,0,0.35)",
                                    color: "#fff",
                                    cursor: "pointer",
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* REPLAY: dynamic data box */}
            {replayOn && selectedId && selectedSensor && (
                <div
                    style={{
                        position: "absolute",
                        top: 116,
                        left: 12,
                        zIndex: 20,
                        maxHeight: 260,
                        width: 360,
                        overflow: "auto",
                        background: "rgba(0,0,0,0.55)",
                        border: "1px solid rgba(255,255,255,0.4)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: "#fff",
                        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                        fontSize: 12,
                    }}
                >
                    {!ranges || series === null ? (
                        <div>loading…</div>
                    ) : !series.length ? (
                        <div>no {selectedSensor} data for room {selectedId}</div>
                    ) : (
                        <>
                            <div
                                style={{
                                    fontWeight: 700,
                                    marginBottom: 6,
                                    background: SENSOR_COLORS[selectedSensor],
                                    padding: "4px 6px",
                                    borderRadius: 6,
                                }}
                            >
                                {selectedSensor.toUpperCase()} @ {series[curIdx]?.t} (R_{selectedId})
                            </div>
                            {"avg" in (series[curIdx] || {}) && <div>avg: {series[curIdx].avg}</div>}
                            {"min" in (series[curIdx] || {}) && <div>min: {series[curIdx].min}</div>}
                            {"max" in (series[curIdx] || {}) && <div>max: {series[curIdx].max}</div>}
                            {"last" in (series[curIdx] || {}) && <div>last: {series[curIdx].last}</div>}
                        </>
                    )}
                </div>
            )}

            {/* REPLAY: bottom slider */}
            {replayOn && selectedId && selectedSensor && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 20,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.4)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        backdropFilter: "blur(4px)",
                        minWidth: 560,
                        justifyContent: "center",
                    }}
                >
                    {series === null ? (
                        <div style={{ color: "#fff", fontSize: 12 }}>loading…</div>
                    ) : !series.length ? (
                        <div style={{ color: "#fff", fontSize: 12 }}>
                            no {selectedSensor} data for room {selectedId}
                        </div>
                    ) : (
                        <>
                            <div style={{ color: "#fff", fontSize: 12, fontFamily: "monospace" }}>
                                {series[0].t}
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={series.length - 1}
                                step={1}
                                value={curIdx}
                                onChange={(e) => setCurIdx(parseInt(e.target.value, 10))}
                                style={{ width: 360 }}
                            />
                            <div style={{ color: "#fff", fontSize: 12, fontFamily: "monospace" }}>
                                {series[series.length - 1].t}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* PREDICTION mode UI */}
            {mode === "prediction" && selectedId ? (
                <PredictionPanel floorCode={floorCode} roomKey={`R_${selectedId}`} />
            ) : mode === "prediction" ? (
                <div style={{
                    position: "absolute", top: 52, left: 12, zIndex: 20,
                    padding: "10px 12px", background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8,
                    color: "#fff", fontSize: 12
                }}>
                    Pick a room to run predictions.
                </div>
            ) : null}

            {/* 3D scene */}
            <Canvas camera={{ position: [0, 9, 12], near: 0.01, far: 500 }} onPointerMissed={() => setSelectedId(null)}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 8, 5]} intensity={1.0} />

                <Suspense fallback={null}>
                    <Bounds fit clip observe margin={1}>
                        <group
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                const p = e.point;
                                setPick({ x: p.x, y: p.y, z: p.z, name: e.object?.name });
                            }}
                        >
                            <FloorplanModel key={url} url={url} />
                        </group>
                    </Bounds>

                    {rooms.map((r) => (
                        <ClickHotspot
                            key={r.id}
                            id={r.id}
                            pos={r.pos}
                            color={STATUS_COLOR?.DEFAULT ?? "rgba(0,0,0,0.75)"}
                            selectedId={selectedId}
                            setSelected={setSelectedId}
                            selectedSensor={replayOn ? selectedSensor : null}
                            currentPoint={replayOn ? currentPoint : null}
                        />
                    ))}

                    <OrbitControls />
                </Suspense>
            </Canvas>
        </div>
    );
}
