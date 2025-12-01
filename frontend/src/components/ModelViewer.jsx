import React, { Suspense, useMemo, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Stage, OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

// Loaderit
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';

const Model = ({ url, extension }) => {
    // TUMMAN TEEMAN MATERIAALI: Kirkkaampi sininen, joka erottuu tummasta taustasta
    const sharedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#4fc3f7",   // Vaaleansininen (neon/tech)
        roughness: 0.4,
        metalness: 0.3,
        flatShading: false,
    }), []);

    const correctionRotation = [-Math.PI / 2, 0, 0];

    // Apufunktio
    const fixGeometry = (node) => {
        node.material = sharedMaterial;
        if (node.geometry) {
            if (node.geometry.attributes.color) node.geometry.deleteAttribute('color');
            node.geometry.computeVertexNormals();
        }
        node.castShadow = true;
        node.receiveShadow = true;
    };

    if (extension === 'glb') {
        const { scene } = useGLTF(url);
        useEffect(() => {
            scene.traverse((child) => {
                if (child.isMesh) fixGeometry(child);
            });
        }, [scene, sharedMaterial]);
        return <primitive object={scene} />;
    }

    const Loader = useMemo(() => {
        if (extension === 'obj') return OBJLoader;
        if (extension === '3mf') return ThreeMFLoader;
        return STLLoader;
    }, [extension]);

    const loadedObject = useLoader(Loader, url);

    const scene = useMemo(() => {
        if (extension === 'stl') return loadedObject;
        return loadedObject.clone();
    }, [loadedObject, extension]);

    useEffect(() => {
        if (extension === 'stl') {
            if (scene.attributes?.color) scene.deleteAttribute('color');
            scene.computeVertexNormals();
        } else {
            scene.traverse((child) => {
                if (child.isMesh) fixGeometry(child);
            });
        }
    }, [scene, extension, sharedMaterial]);

    if (extension === 'stl') {
        return <mesh geometry={scene} material={sharedMaterial} rotation={correctionRotation} castShadow receiveShadow />;
    }
    return <primitive object={scene} rotation={correctionRotation} />;
};

const ModelViewer = ({ fileUrl, fileName, visualizationUrl }) => {
    const finalUrl = visualizationUrl || fileUrl;
    if (!finalUrl) return null;

    let extension = visualizationUrl ? 'glb' : fileName.split('.').pop().toLowerCase();
    const isRawStep = !visualizationUrl && (extension === 'step' || extension === 'stp');

    if (isRawStep) {
        return (
            <div style={styles.container}>
                <div style={styles.stepPlaceholder}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚙️</div>
                    <p style={{ color: '#888', fontWeight: '600', margin: 0 }}>Prosessoidaan CAD-mallia...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <Canvas
                shadows
                dpr={[1, 2]}
                camera={{ position: [0, 0, 150], fov: 50 }}
                style={{ cursor: 'grab' }}
            >
                <Suspense fallback={
                    <Html center>
                        <div style={styles.loader}>Ladataan...</div>
                    </Html>
                }>
                    <Stage environment="city" intensity={0.8} adjustCamera={1.2}>
                        <Model url={finalUrl} extension={extension} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={1.5} makeDefault />
            </Canvas>

            <div style={styles.interactionHint}>
                <span style={{ fontSize: '14px', marginRight: '4px' }}>↺</span>
                Pyöritä & Zoomaa
            </div>
        </div>
    );
};

const styles = {
    container: {
        width: '100%',
        height: '400px',
        background: '#252525', // Tumma tausta
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' // Syvä sisävarjo
    },
    interactionHint: {
        position: 'absolute',
        bottom: '10px',
        right: '12px',
        fontSize: '0.7rem',
        color: '#666',
        fontWeight: '500',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        opacity: 0.8,
        userSelect: 'none'
    },
    stepPlaceholder: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px',
        background: '#252525'
    },
    loader: {
        color: '#ccc',
        fontWeight: 'bold',
        background: 'rgba(0,0,0,0.5)',
        padding: '5px 10px',
        borderRadius: '4px'
    }
};

export default ModelViewer;