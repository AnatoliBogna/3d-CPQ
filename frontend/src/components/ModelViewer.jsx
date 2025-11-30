import React, { Suspense, useMemo, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Stage, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

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

    const loadedObject = useLoader(Loader, url);

    // Yhteinen sininen materiaali
    const sharedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#007bff",
        roughness: 0.5,
        metalness: 0.1,
    }), []);

    const scene = useMemo(() => {
        if (extension === 'stl') return loadedObject;
        return loadedObject.clone();
    }, [loadedObject, extension]);

    // --- KORJAUSLOGIIKKA ---
    useEffect(() => {
        if (extension !== 'stl') {
            scene.traverse((child) => {
                if (child.isMesh) {
                    // 1. Pakota materiaali
                    child.material = sharedMaterial;

                    // 2. KORJAUS: Poista 3MF/OBJ omat värit (Vertex Colors), jotta malli on sininen
                    if (child.geometry.attributes.color) {
                        child.geometry.deleteAttribute('color');
                    }

                    // 3. KORJAUS: Laske normaalit uudelleen, jos malli näyttää "litteältä" tai oudolta
                    child.geometry.computeVertexNormals();

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } else {
            // Myös STL:lle kannattaa varmistaa normaalit
            if (scene.attributes && scene.attributes.color) {
                scene.deleteAttribute('color');
            }
            scene.computeVertexNormals();
        }
    }, [scene, extension, sharedMaterial]);

    const correctionRotation = [-Math.PI / 2, 0, 0];

    if (extension === 'stl') {
        return (
            <mesh
                geometry={scene}
                material={sharedMaterial}
                rotation={correctionRotation}
                castShadow
                receiveShadow
            />
        );
    } else {
        return (
            <primitive
                object={scene}
                rotation={correctionRotation}
            />
        );
    }
};

const ModelViewer = ({ fileUrl, fileName }) => {
    if (!fileUrl) return null;

    const extension = fileName.split('.').pop().toLowerCase();

    return (
        <div style={{ width: '100%', height: '400px', background: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
            <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
                <Suspense fallback={null}>
                    {/* adjustCamera: false estää kameraa hyppimästä liikaa 3MF:n oudoilla koordinaateilla */}
                    <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                        <Model url={fileUrl} extension={extension} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={2.0} />
            </Canvas>
        </div>
    );
};

export default ModelViewer;