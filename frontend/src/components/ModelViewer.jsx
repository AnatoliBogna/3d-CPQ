import React, { Suspense, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Stage, OrbitControls } from '@react-three/drei';

// Tuodaan loaderit. Huom: nämä pitää löytyä node_modulesista.
// STLLoader on vakio, muut ovat 'three/examples/jsm/loaders/...'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';

const Model = ({ url, extension }) => {
    // Valitaan oikea loader tiedostopäätteen mukaan
    const Loader = useMemo(() => {
        if (extension === 'obj') return OBJLoader;
        if (extension === '3mf') return ThreeMFLoader;
        return STLLoader; // Oletus STL
    }, [extension]);

    const geometry = useLoader(Loader, url);

    // OBJ ja 3MF palauttavat usein kokonaisen "Group" tai "Scene" objektin, ei pelkkää geometriaa.
    // React-three-fiber osaa käsitellä 'primitive' objektin helposti.

    if (extension === 'stl') {
        return (
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial color="#007bff" roughness={0.5} />
            </mesh>
        );
    } else {
        // OBJ ja 3MF renderöidään primitiivinä
        return <primitive object={geometry} />;
    }
};

const ModelViewer = ({ fileUrl, fileName }) => {
    // Selvitetään tiedostopääte nimen perusteella
    const extension = fileName.split('.').pop().toLowerCase();

    return (
        <div style={{ width: '100%', height: '400px', background: '#eef', borderRadius: '8px', overflow: 'hidden' }}>
            <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.6}>
                        <Model url={fileUrl} extension={extension} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate />
            </Canvas>
        </div>
    );
};

export default ModelViewer;