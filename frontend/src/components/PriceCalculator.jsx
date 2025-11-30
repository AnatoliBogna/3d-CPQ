import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ModelViewer from './ModelViewer';

const PriceCalculator = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [error, setError] = useState(null);

    // UUSI: Talletetaan tiedostonimi heti, jotta Viewer tietää onko se obj, stl vai 3mf
    const [currentFileName, setCurrentFileName] = useState("");

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // 1. Asetetaan visuaaliset asiat heti kuntoon
        const objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
        setCurrentFileName(file.name); // <--- TÄMÄ LISÄTTY

        setLoading(true);
        setError(null);
        setResult(null);

        // 2. Valmistellaan lähetys
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://127.0.0.1:8000/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(response.data);
        } catch (err) {
            console.error(err);
            setError('Virhe: Backend ei vastaa tai tiedosto on viallinen.');
        } finally {
            setLoading(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        // Päivitetty hyväksymään myös OBJ ja 3MF
        accept: {
            'model/stl': ['.stl'],
            'model/obj': ['.obj'],
            'model/3mf': ['.3mf']
        },
        multiple: false
    });

    // Resetointi-funktio
    const handleReset = () => {
        setFileUrl(null);
        setResult(null);
        setCurrentFileName("");
        setError(null);
    };

    return (
        <div style={styles.pageContainer}>
            <div style={styles.contentWrapper}>

                <header style={styles.header}>
                    <h1 style={styles.title}>3D-Valmistusportaali</h1>
                    <p style={styles.subtitle}>Lataa malli (STL, OBJ, 3MF), valitse materiaali, tilaa.</p>
                </header>

                <div style={styles.mainGrid}>

                    {/* Vasen puoli: Lataus ja 3D-katselu */}
                    <div style={styles.leftColumn}>
                        {!fileUrl ? (
                            <div {...getRootProps()} style={{
                                ...styles.dropzone,
                                borderColor: isDragActive ? '#2196f3' : '#e0e0e0',
                                backgroundColor: isDragActive ? '#f0f8ff' : '#ffffff'
                            }}>
                                <input {...getInputProps()} />
                                <div style={styles.uploadIcon}>⬆️</div>
                                <p style={styles.uploadText}>
                                    {isDragActive ? "Pudota tiedosto tähän" : "Raahaa tiedosto tähän tai klikkaa"}
                                </p>
                                <p style={styles.uploadHint}>Tuetut: .STL, .OBJ, .3MF</p>
                            </div>
                        ) : (
                            <div style={styles.viewerContainer}>
                                {/* Välitetään tiedostonimi Viewerille */}
                                <ModelViewer fileUrl={fileUrl} fileName={currentFileName} />

                                <button onClick={handleReset} style={styles.reuploadBtn}>
                                    Lataa uusi malli
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Oikea puoli: Laskelmat ja Hinta */}
                    <div style={styles.rightColumn}>
                        {loading && (
                            <div style={styles.loadingBox}>
                                <div style={styles.spinner}></div>
                                <p>Analysoidaan geometriaa...</p>
                            </div>
                        )}

                        {error && <div style={styles.errorBox}>{error}</div>}

                        {result && !loading && (
                            <div style={styles.resultsCard}>
                                <h2 style={styles.cardTitle}>Analyysi valmistui</h2>

                                <div style={styles.dataRow}>
                                    <span>Tiedosto:</span>
                                    <strong>{result.filename}</strong>
                                </div>

                                <div style={styles.dataGrid}>
                                    <div style={styles.dataItem}>
                                        <span style={styles.label}>Tilavuus</span>
                                        <span style={styles.value}>{result.volume_cm3} cm³</span>
                                    </div>
                                    <div style={styles.dataItem}>
                                        <span style={styles.label}>Mitat (mm)</span>
                                        <span style={styles.value}>
                                            {result.dimensions_mm.x} x {result.dimensions_mm.y} x {result.dimensions_mm.z}
                                        </span>
                                    </div>
                                </div>

                                <div style={styles.priceBox}>
                                    <span>Hinta-arvio (ALV 0%)</span>
                                    <span style={styles.priceTag}>{result.estimated_price_eur} €</span>
                                </div>

                                <button style={styles.primaryButton} onClick={() => alert('Jatketaan kassalle...')}>
                                    Siirry tilaukseen →
                                </button>
                            </div>
                        )}

                        {!result && !loading && !error && (
                            <div style={styles.placeholderBox}>
                                <p>Lataa tiedosto nähdäksesi hinnan.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Tyylit
const styles = {
    pageContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#333',
    },
    contentWrapper: {
        width: '100%',
        maxWidth: '1200px',
    },
    header: {
        textAlign: 'center',
        marginBottom: '40px',
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '700',
        marginBottom: '10px',
        color: '#111',
    },
    subtitle: {
        fontSize: '1.1rem',
        color: '#666',
    },
    mainGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '40px',
        alignItems: 'start',
        width: '100%',
    },
    dropzone: {
        border: '2px dashed #e0e0e0',
        borderRadius: '16px',
        padding: '60px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    viewerContainer: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '10px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    },
    uploadIcon: { fontSize: '48px', marginBottom: '20px', opacity: 0.5 },
    uploadText: { fontSize: '1.2rem', fontWeight: '500', marginBottom: '8px' },
    uploadHint: { fontSize: '0.9rem', color: '#888' },
    reuploadBtn: { marginTop: '10px', background: 'transparent', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' },
    resultsCard: { background: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee' },
    cardTitle: { marginTop: 0, marginBottom: '20px', fontSize: '1.5rem' },
    dataRow: { marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' },
    dataGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' },
    dataItem: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' },
    value: { fontSize: '1.1rem', fontWeight: '600' },
    priceBox: { background: '#f8f9fa', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    priceTag: { fontSize: '1.8rem', fontWeight: '700', color: '#2e7d32' },
    primaryButton: { width: '100%', padding: '16px', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' },
    loadingBox: { textAlign: 'center', padding: '40px' },
    spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' },
    errorBox: { backgroundColor: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' },
    placeholderBox: { padding: '40px', textAlign: 'center', color: '#aaa', border: '2px dashed #eee', borderRadius: '16px', backgroundColor: 'white' }
};

export default PriceCalculator;