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

const RANGE = 0.2;
const BOX_W = RANGE; // X width
const BOX_D = RANGE; // Z depth
const BOX_H = 1.0;       // Y height to make it easy to click
const POP_Y = 0.25;      // lift for popup over floor
const LABEL_DF = 28;     // Html distanceFactor (bigger => smaller on screen)
// ---------------------------------------------------------------

const fmt = (n) => (Math.abs(n) < 1e-3 ? "0.000" : n.toFixed(3));

function ClickHotspot({ id, pos, color = STATUS_COLOR.DEFAULT, selectedId, setSelected }) {
    const [x, y, z] = pos;
    const isActive = selectedId === id;

    return (
        <group>
            {/* Invisible clickable volume around the coordinate */}
            <mesh
                position={[x, y + BOX_H / 2, z]}
                onClick={(e) => {
                    e.stopPropagation();
                    // toggle if clicking the same, otherwise select this room
                    setSelected((curr) => (curr === id ? null : id));
                }}
            >
                <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Popup only when selected by click */}
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

export default function FloorPlan() {
    const [label, setLabel] = useState("4th floor");
    const url = FLOORS[label];
    const rooms = ROOMS[label] ?? [];

    // which room's popup is currently selected (clicked)
    const [selectedId, setSelectedId] = useState(null);

    return (
        <div className="h-screen w-screen bg-[#030d30] relative">
            {/* Small floor buttons */}
            <div className="absolute top-3 right-3 z-10 flex gap-6">
                {Object.keys(FLOORS).map((name) => (
                    <button
                        key={name}
                        onClick={() => {
                            setLabel(name);
                            setSelectedId(null); // clear selection when changing floors
                        }}
                        style={{
                            padding: "12px 20px",
                            fontSize: 20,
                            lineHeight: 1.0,
                            color: "#fff",
                            background: name === label ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
                            border: "1px solid rgba(255,255,255,0.45)",
                            borderRadius: 10,
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            <Canvas
                camera={{ position: [0, 9, 12], near: 0.01, far: 500 }}
                // Click empty space to clear any active popup
                onPointerMissed={() => setSelectedId(null)}
            >
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 8, 5]} intensity={1.0} />

                <Suspense fallback={null}>
                    <Bounds fit clip observe margin={1}>
                        <FloorplanModel key={url} url={url} />
                    </Bounds>

                    {/* One clickable hotspot per room coordinate */}
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