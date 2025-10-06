import { useGLTF, Center } from '@react-three/drei';

export default function FloorplanModel({ url, ...props }) {
    const { scene } = useGLTF(url);
    return (
        <Center {...props}>
            <primitive object={scene} />
        </Center>
    );
}

// (optional) warm the cache
useGLTF.preload('/models/floorplan_4th.glb');
useGLTF.preload('/models/floorplan_5th.glb');
useGLTF.preload('/models/floorplan_6th.glb');
useGLTF.preload('/models/floorplan_7th.glb');
