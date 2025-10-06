// src/sections/FloorPlan.jsx
import { useState, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Html } from "@react-three/drei";
import FloorplanModel from "../jsx_model/FloorplanModel";
import { ROOMS, STATUS_COLOR } from "../data/rooms";

const FLOORS = {
    "4th floor": "/models/floorplan_4th.glb",
    "5th floor": "/models/floorplan_5th.glb",
    "6th floor": "/models/floorplan_6th.glb",
    "7th floor": "/models/floorplan_7th.glb",
};

const fmt = (n) => (Math.abs(n) < 1e-3 ? "0.000" : n.toFixed(3));

export default function FloorPlan() {
    const [label, setLabel] = useState("4th floor");
    const url = FLOORS[label];
    const rooms = ROOMS[label] ?? [];

    const [pick, setPick] = useState(null);
    const pickText = useMemo(() => {
        if (!pick) return "Click the model to read coordinates…";
        const { x, y, z, name } = pick;
        return `${name ?? "(unnamed)"}  |  x:${fmt(x)}  y:${fmt(y)}  z:${fmt(z)}`;
    }, [pick]);

    function handlePick(e) {
        e.stopPropagation();
        const p = e.point;
        const name = e.object?.name;
        setPick({ x: p.x, y: p.y, z: p.z, name });
        console.log("Pick:", {
            name,
            pos: [Number(p.x.toFixed(6)), Number(p.y.toFixed(6)), Number(p.z.toFixed(6))]
        });
    }

    return (
        <div className="h-screen w-screen bg-[#030d30] relative">
            {/* Top-left readout */}
            <div
                style={{
                    position: "absolute", top: 12, left: 12, zIndex: 20,
                    padding: "10px 12px", color: "#fff",
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: 8, fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    fontSize: 13, whiteSpace: "pre", userSelect: "text",
                }}
            >
                {pickText}
            </div>

            {/* Top-right floor buttons */}
            <div className="absolute top-3 right-3 z-10 flex gap-6">
                {Object.keys(FLOORS).map((name) => (
                    <button
                        key={name}
                        onClick={() => setLabel(name)}
                        style={{
                            padding: "12px 2px",
                            fontSize: 12,
                            lineHeight: 1.0,
                            color: "#fff",
                            background: name === label ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
                            border: "3px solid rgba(255,255,255,0.5)",
                            borderRadius: 24,
                            cursor: "pointer",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            <Canvas camera={{ position: [0, 9, 12], near: 0.01, far: 500 }} onPointerMissed={() => setPick(null)}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 8, 5]} intensity={1.0} />

                <Suspense fallback={null}>
                    {/* Fit & recenter on floor change */}
                    <Bounds fit clip observe margin={1}>
                        <group onPointerDown={handlePick}>
                            <FloorplanModel key={url} url={url} />
                        </group>
                    </Bounds>

                    {/* Predefined room boxes */}
                    {rooms.map((r) => (
                        <Html key={r.id} position={r.pos} center distanceFactor={10} zIndexRange={[15, 25]}>
                            <div
                                style={{
                                    padding: "10px 14px", minWidth: 120, fontSize: 8, color: "#fff",
                                    background: STATUS_COLOR.DEFAULT,
                                    border: "2px solid rgba(255,255,255,0.6)", borderRadius: 10,
                                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)", textAlign: "center",
                                    whiteSpace: "nowrap", userSelect: "text",
                                }}
                                title={`x:${r.pos[0].toFixed(3)} y:${r.pos[1].toFixed(3)} z:${r.pos[2].toFixed(3)}`}
                            >
                                <div style={{ fontWeight: 700 }}>Room {r.id}</div>
                                <div style={{ opacity: 0.9 }}>
                                    x:{r.pos[0].toFixed(3)} y:{r.pos[1].toFixed(3)} z:{r.pos[2].toFixed(3)}
                                </div>
                            </div>
                        </Html>
                    ))}

                    {/* Floating tag at last clicked point */}
                    {/*pick && (
                        <Html position={[pick.x, pick.y, pick.z]} center distanceFactor={10} zIndexRange={[15, 25]}>
                            <div
                                style={{
                                    padding: "6px 10px", fontSize: 12, color: "#fff",
                                    background: "rgba(0,0,0,0.75)",
                                    border: "1px solid rgba(255,255,255,0.6)", borderRadius: 6,
                                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)", pointerEvents: "none", whiteSpace: "nowrap",
                                }}
                            >
                                {pick.name ?? "(unnamed)"} — x:{fmt(pick.x)} y:{fmt(pick.y)} z:{fmt(pick.z)}
                            </div>
                        </Html>
                    )*/}

                    <OrbitControls />
                </Suspense>
            </Canvas>
        </div>
    );
}
