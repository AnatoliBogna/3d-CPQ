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

    const sharedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#007bff",
        roughness: 0.5,
        metalness: 0.1,
    }), []);

    const scene = useMemo(() => {
        if (extension === 'stl') return loadedObject;
        return loadedObject.clone();
    }, [loadedObject, extension]);

    useEffect(() => {
        if (extension !== 'stl') {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.material = sharedMaterial;
                    if (child.geometry.attributes.color) {
                        child.geometry.deleteAttribute('color');
                    }
                    child.geometry.computeVertexNormals();
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } else {
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
        <div style={styles.container}>
            {/* 3D CANVAS */}
            <Canvas
                shadows
                camera={{ position: [0, 0, 150], fov: 50 }}
                style={{ cursor: 'grab' }}
            >
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                        <Model url={fileUrl} extension={extension} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={2.0} makeDefault />
            </Canvas>

            {/* MINIMALISTINEN VIHJE (OIKEA ALANURKKA) */}
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
        background: '#f0f0f0',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)'
    },
    interactionHint: {
        position: 'absolute',
        bottom: '10px',        // Alareuna
        right: '12px',         // Oikea reuna (keskityksen sijaan)
        fontSize: '0.7rem',    // Pienempi teksti
        color: '#a0aec0',      // Haalea harmaa
        fontWeight: '500',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        opacity: 0.8,          // Hieman läpinäkyvä
        userSelect: 'none'     // Estää tekstin maalauksen
    }
};

export default ModelViewer;