import { Suspense } from "react";
import FloorplanModel from "../jsx_model/FloorplanModel";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export default function FloorPlan() {
    return (
        <div className="h-screen w-screen bg-[#030d30]">
            <Canvas camera={{ position: [0, 9, 12], near: 0.01, far: 200 }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 8, 5]} intensity={1.0} />
                <Suspense fallback={null}>
                    <FloorplanModel />
                    <OrbitControls />
                </Suspense>
            </Canvas>
        </div>
    );
}
