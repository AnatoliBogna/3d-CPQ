import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Stage, OrbitControls, useGLTF, Html, Center } from '@react-three/drei';
import * as THREE from 'three';

// Loaderit
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';

// --- KOMPONENTTI JOKA KÄÄNTÄÄ KAMERAN/KONTROLLIT OIKEIN ---
const SetupScene = () => {
    const { camera } = useThree();
    useEffect(() => {
        // Asetetaan kamera niin, että Z-akseli on ylöspäin (CAD-tyyli)
        camera.up.set(0, 0, 1);
        camera.position.set(100, -100, 100); // Katsotaan viistosti
        camera.lookAt(0, 0, 0);
    }, [camera]);
    return null;
};

const Model = ({ url, extension }) => {
    // MATERIAALI: Erittäin korkea laatu
    const material = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#007bff',
        roughness: 0.3,
        metalness: 0.15,
        flatShading: false, // Pakotetaan sileä varjostus
        side: THREE.DoubleSide // Renderöidään molemmat puolet
    }), []);

    // Apufunktio geometrian korjaukseen
    const fixGeometry = (node) => {
        node.material = material;
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.geometry) {
            // Poistetaan huonot värit
            if (node.geometry.attributes.color) {
                node.geometry.deleteAttribute('color');
            }
            // LASKETAAN NORMAALIT UUDELLEEN (Tärkeä resoluutiolle)
            // Jos normaaleja ei ole, pinta näyttää kulmikkaalta vaikka resoluutio olisi korkea
            node.geometry.computeVertexNormals();

            // Tärkeä: Keskittyy geometrian bounding boxin keskelle
            node.geometry.center();
        }
    };

    // 1. GLB (STEP)
    if (extension === 'glb') {
        const { scene } = useGLTF(url);
        useEffect(() => {
            scene.traverse((child) => {
                if (child.isMesh) fixGeometry(child);
            });
        }, [scene, material]);
        // Ei kääntöä täällä, hoidamme sen kameralla
        return <primitive object={scene} />;
    }

    // 2. MESH (STL/OBJ)
    const Loader = useMemo(() => {
        if (extension === 'obj') return OBJLoader;
        if (extension === '3mf') return ThreeMFLoader;
        return STLLoader;
    }, [extension]);

    const geom = useLoader(Loader, url);

    const objectToRender = useMemo(() => {
        if (extension === 'stl') return geom;
        return geom.clone();
    }, [geom, extension]);

    useEffect(() => {
        if (extension === 'stl') {
            if (objectToRender.attributes.color) objectToRender.deleteAttribute('color');
            objectToRender.computeVertexNormals();
            objectToRender.center();
        } else {
            objectToRender.traverse((child) => {
                if (child.isMesh) fixGeometry(child);
            });
        }
    }, [objectToRender, extension, material]);

    if (extension === 'stl') {
        return <mesh geometry={objectToRender} material={material} castShadow receiveShadow />;
    }
    return <primitive object={objectToRender} />;
};

const ModelViewer = ({ fileUrl, fileName, visualizationUrl }) => {
    const finalUrl = visualizationUrl || fileUrl;
    if (!finalUrl) return null;

    let extension = visualizationUrl ? 'glb' : fileName.split('.').pop().toLowerCase();
    const isProcessingStep = !visualizationUrl && (extension === 'step' || extension === 'stp');

    if (isProcessingStep) {
        return (
            <div style={styles.container}>
                <div style={styles.placeholder}>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚙️</div>
                    <div style={{ fontWeight: '600', color: '#555' }}>Prosessoidaan geometriaa...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <Canvas
                shadows
                // RESOLUUTIO: Pakotetaan korkea DPI (tärkeä!)
                dpr={[1, 2]}
                // Renderöintiasetukset (Antialias päälle)
                gl={{ antialias: true, preserveDrawingBuffer: true }}
                camera={{ fov: 45 }} // Kapeampi FOV näyttää ammattimaisemmalta
                style={{ cursor: 'grab' }}
            >
                {/* Asetetaan kamera Z-up maailmaan */}
                <SetupScene />

                <Suspense fallback={<Html center><div style={styles.hint}>Ladataan...</div></Html>}>
                    {/* Center varmistaa että malli on aina keskellä ruutua */}
                    <Center>
                        <Stage
                            environment="city"
                            intensity={0.6}
                            adjustCamera={false} // Hoidamme kameran itse SetupScenellä
                            shadows="contact"
                        >
                            <Model url={finalUrl} extension={extension} />
                        </Stage>
                    </Center>
                </Suspense>

                {/* OrbitControls ilman automaattista kääntöä aluksi, jotta näemme asennon */}
                <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} />
            </Canvas>

            <div style={styles.hint}>Pyöritä & Zoomaa</div>
        </div>
    );
};

const styles = {
    container: { width: '100%', height: '400px', backgroundColor: '#f0f0f0', borderRadius: '16px', overflow: 'hidden', position: 'relative' },
    placeholder: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    hint: { position: 'absolute', bottom: '10px', right: '15px', fontSize: '0.75rem', color: '#888', pointerEvents: 'none', userSelect: 'none' }
};

export default ModelViewer;