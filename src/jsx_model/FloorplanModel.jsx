import { useGLTF, Center } from '@react-three/drei';

export default function FloorplanModel(props) {
    // absolute path (served from /public)
    const { scene } = useGLTF('/models/floorplan_4th.glb');

    return (
        <Center {...props}>
            <primitive object={scene} />
        </Center>
    );
}

useGLTF.preload('/models/floorplan_4th.glb');