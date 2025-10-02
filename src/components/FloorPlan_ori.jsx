// FloorPlan.jsx
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { roomTitle } from "../constants";
import FloorplanModel from "../jsx_model/FloorplanModel";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Loader, OrbitControls } from "@react-three/drei";

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const FloorPlan = () => {
    const controlsRef = useRef();
    const [camPos, setCamPos] = useState(v3(0, 9, 0));
    const [target, setTarget] = useState(v3(0, 0, 0));
    const [lerping, setLerping] = useState(false);

    const goTo = (room) => {
        setCamPos(v3(room.camPos.x, room.camPos.y, room.camPos.z));
        setTarget(v3(room.target.x, room.target.y, room.target.z));
        setLerping(true);
    };

    const goHome = () => {
        setCamPos(v3(0, 9, 0));
        setTarget(v3(0, 0, 0));
        setLerping(true);
    };

    return (
        <div className="h-screen w-screen bg-[#030d30] relative">
            <div className="h-full">
                <Canvas
                    shadows
                    camera={{ position: [0, 9, 0] }}
                    onPointerDown={() => setLerping(false)}
                    onWheel={() => setLerping(false)}
                >
                    {/* IMPORTANT: fallback must be a 3D element (or null), not a DOM Loader */}
                    <Suspense fallback={null}>
                        <ambientLight intensity={2} />
                        <Environment preset="city" />
                        <FloorplanModel />

                        <Annotations onClick={goTo} />
                        <Animate controls={controlsRef} lerping={lerping} to={camPos} target={target} />

                        <OrbitControls
                            ref={controlsRef}
                            target={[target.x, target.y, target.z]}
                            minPolarAngle={0}
                            maxPolarAngle={1.4}
                            minDistance={0}
                            maxDistance={10}
                        />
                    </Suspense>
                    {/* <axesHelper args={[50]} /> */}
                    {/* <gridHelper /> */}
                </Canvas>
            </div>

            {/* UI lives OUTSIDE Canvas */}
            <div className="absolute top-0 right-0 m-3">
                <div className="flex flex-col gap-1">
                    {roomTitle.map((room) => (
                        <div
                            key={room.title}
                            className="p-1 bg-black bg-opacity-25 cursor-pointer text-white capitalize text-xs select-none"
                            onClick={() => goTo(room)}
                        >
                            {room.title}
                        </div>
                    ))}
                    <div
                        className="p-1 bg-black bg-opacity-25 cursor-pointer text-white capitalize text-xs select-none"
                        onClick={goHome}
                    >
                        floor plan
                    </div>
                </div>
            </div>

            {/* drei Loader is a DOM overlay: keep it OUTSIDE the Canvas */}
            <Loader />
        </div>
    );
};

export default FloorPlan;

const Annotations = ({ onClick }) => (
    <>
        {roomTitle.map((room, i) => (
            <Html key={`room-${i}`} position={[room.target.x, 3, room.target.z]}>
                <div
                    id={"desc_" + i}
                    className="annotationDescription p-1 text-xs border-2 border-white text-center rounded-md text-white font-semibold capitalize bg-black bg-opacity-50 cursor-pointer"
                    onClick={() => onClick(room)}
                    dangerouslySetInnerHTML={{ __html: room.title }}
                />
            </Html>
        ))}
    </>
);

function Animate({ controls, lerping, to, target }) {
    useFrame(({ camera }, delta) => {
        if (lerping && controls.current) {
            camera.position.lerp(to, delta * 2);
            controls.current.target.lerp(target, delta * 2);
            // stop lerping when close enough (prevents tiny jitter)
            if (camera.position.distanceTo(to) < 0.01 && controls.current.target.distanceTo(target) < 0.01) {
                camera.position.copy(to);
                controls.current.target.copy(target);
            }
        }
    });
}
