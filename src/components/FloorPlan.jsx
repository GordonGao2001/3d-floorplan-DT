// src/components/FloorPlan.jsx
import React, { useState, useMemo, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Html } from "@react-three/drei";
import FloorplanModel from "../jsx_model/FloorplanModel";
import { ROOMS, STATUS_COLOR } from "../data/rooms";

/* ----------------------------- config ----------------------------- */
const FLOORS = {
    "4th floor": "/models/floorplan_4th.glb",
    "5th floor": "/models/floorplan_5th.glb",
    "6th floor": "/models/floorplan_6th.glb",
    "7th floor": "/models/floorplan_7th.glb",
};
const SENSORS = ["co2", "humidity", "light", "motion", "temperature"];

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

/* ------- clickable hotspots around coordinates (±RANGE on X/Z) ----- */
const RANGE = 0.35;
const BOX_W = RANGE * 2;
const BOX_D = RANGE * 2;
const BOX_H = 1.0;
const POP_Y = 0.25;
const LABEL_DF = 28;

function ClickHotspot({ id, pos, color, selectedId, setSelected }) {
    const [x, y, z] = pos;
    const isActive = selectedId === id;

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
                            padding: "4px 6px",
                            fontSize: 11,
                            color: "#fff",
                            background: color,
                            border: "1px solid rgba(255,255,255,0.5)",
                            borderRadius: 4,
                            boxShadow: "0 3px 10px rgba(0,0,0,0.30)",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                        }}
                        title={`x:${x.toFixed(3)} y:${y.toFixed(3)} z:${z.toFixed(3)}`}
                    >
                        Room {id} — x:{fmt(x)} y:{fmt(y)} z:{fmt(z)}
                    </div>
                </Html>
            )}
        </group>
    );
}

/* --------------------------- main component ------------------------ */
export default function FloorPlan() {
    const [label, setLabel] = useState("4th floor");
    const url = FLOORS[label];
    const rooms = ROOMS[label] ?? [];

    // top-left coordinate readout
    const [pick, setPick] = useState(null);
    const pickText = useMemo(() => {
        if (!pick) return "Click the model to read coordinates…";
        const { x, y, z, name } = pick;
        return `${name ?? "(unnamed)"}  |  x:${fmt(x)}  y:${fmt(y)}  z:${fmt(z)}`;
    }, [pick]);

    // selection + replay UI
    const [selectedId, setSelectedId] = useState(null);
    const [replayOn, setReplayOn] = useState(true); // keep ON if you want this always visible
    const floorCode = floorToCode(label);

    // floor ranges (used to request room series window)
    const [ranges, setRanges] = useState(null);

    // sensor choice + fetched series for that sensor
    const [selectedSensor, setSelectedSensor] = useState(null);     // 'co2' | 'humidity' | ...
    const [series, setSeries] = useState(null);                     // array of points for chosen sensor
    const [curIdx, setCurIdx] = useState(0);                        // slider index into series

    /* 1) Fetch floor ranges when Replay is ON or floor changes (drives window for room series) */
    useEffect(() => {
        if (!replayOn || !floorCode) return;
        setRanges(null);
        setSeries(null);
        setSelectedSensor(null);
        setCurIdx(0);

        fetch(`/twin/history/${floorCode}`)
            .then((r) => r.json())
            .then((data) => setRanges(data.range || {}))
            .catch((err) => {
                console.error("history fetch failed:", err);
                setRanges({});
            });
    }, [replayOn, floorCode]);

    /* 2) When a room is selected, reset sensor/series/slider */
    useEffect(() => {
        setSelectedSensor(null);
        setSeries(null);
        setCurIdx(0);
    }, [selectedId]);

    /* 3) After sensor chosen, fetch full series once (agg=1&sensor=...) */
    useEffect(() => {
        if (!replayOn || !ranges || !selectedId || !selectedSensor) return;
        const roomKey = `R_${selectedId}`;
        const span = roomOverallRange(ranges[roomKey]);
        if (!span) { setSeries([]); return; }

        const [minT, maxT] = span;
        const from = toSqlish(new Date(minT));
        const to   = toSqlish(new Date(maxT));
        const url  = `/twin/rooms/${floorCode}/${roomKey}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&agg=1&sensor=${encodeURIComponent(selectedSensor)}`;

        setSeries(null);
        setCurIdx(0);

        fetch(url)
            .then((r) => r.json())
            .then((j) => {
                const arr = j?.series || [];
                setSeries(arr);
                setCurIdx(arr.length ? 0 : 0);
            })
            .catch((e) => {
                console.error("room sensor history fetch failed:", e);
                setSeries([]);
            });
    }, [replayOn, ranges, selectedId, selectedSensor, floorCode]);

    const currentPoint = useMemo(() => {
        if (!series || !series.length) return null;
        const i = Math.min(Math.max(curIdx, 0), series.length - 1);
        return series[i];
    }, [series, curIdx]);

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

            {/* sensor picker (appears when a room is selected) */}
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
                                    background: selectedSensor === s ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.35)",
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

            {/* dynamic data box (appears after sensor is chosen) */}
            {replayOn && selectedId && selectedSensor && (
                <div
                    style={{
                        position: "absolute",
                        top: 116, // below the picker
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
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                {selectedSensor.toUpperCase()} @ {currentPoint.t} (R_{selectedId})
                            </div>
                            {"avg" in currentPoint && <div>avg: {currentPoint.avg}</div>}
                            {"min" in currentPoint && <div>min: {currentPoint.min}</div>}
                            {"max" in currentPoint && <div>max: {currentPoint.max}</div>}
                            {"last" in currentPoint && <div>last: {currentPoint.last}</div>}
                        </>
                    )}
                </div>
            )}

            {/* top-right: floor buttons */}
            <div className="absolute top-3 right-3 z-10 flex gap-6">
                {Object.keys(FLOORS).map((name) => (
                    <button
                        key={name}
                        onClick={() => {
                            setLabel(name);
                            setSelectedId(null);
                            setPick(null);
                            setRanges(null);
                            setSelectedSensor(null);
                            setSeries(null);
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

            {/* bottom-center: slider indexes the sensor series */}
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
                        />
                    ))}

                    <OrbitControls />
                </Suspense>
            </Canvas>
        </div>
    );
}
