import React, { Suspense, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Stage, OrbitControls } from '@react-three/drei';
import * as THREE from 'three'; // Tarvitaan Euler-kulmia varten

// Loaderit
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';

const Model = ({ url, extension }) => {
    const Loader = useMemo(() => {
        if (extension === 'obj') return OBJLoader;
        if (extension === '3mf') return ThreeMFLoader;
        return STLLoader;
    }, [extension]);

    const geometry = useLoader(Loader, url);

    // KORJAUS: Käännetään malli pystyyn (Z-up -> Y-up)
    // X-akselin kääntö -90 astetta (-PI/2) nostaa STL-mallin pystyyn.
    const correctionRotation = [-Math.PI / 2, 0, 0];

    if (extension === 'stl') {
        return (
            <mesh
                geometry={geometry}
                rotation={correctionRotation} // <--- TÄMÄ KORJAA ASENNON
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color="#007bff" roughness={0.5} />
            </mesh>
        );
    } else {
        // OBJ ja 3MF käsitellään primitiivinä, käännetään samalla tavalla
        return (
            <primitive
                object={geometry}
                rotation={correctionRotation} // <--- TÄMÄ KORJAA ASENNON
            />
        );
    }
};

const ModelViewer = ({ fileUrl, fileName }) => {
    // Jos tiedostoa ei ole, näytetään tyhjää tai latauskuvaketta
    if (!fileUrl) return null;

    const extension = fileName.split('.').pop().toLowerCase();

    return (
        <div style={{ width: '100%', height: '400px', background: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
            <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
                <Suspense fallback={null}>
                    {/* Stage keskittää mallin ja luo valaistuksen automaattisesti */}
                    <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                        <Model url={fileUrl} extension={extension} />
                    </Stage>
                </Suspense>
                {/* OrbitControls pyörittää kameraa oletuksena maailman Y-akselin ympäri.
            Koska käänsimme mallin pystyyn, tämä näyttää nyt oikealta (pyörii "sivusuunnassa"). */}
                <OrbitControls autoRotate autoRotateSpeed={2.0} />
            </Canvas>
        </div>
    );
};

export default ModelViewer;