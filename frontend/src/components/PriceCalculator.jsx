import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ModelViewer from './ModelViewer';

const PriceCalculator = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [error, setError] = useState(null);
    const [currentFileName, setCurrentFileName] = useState("");
    const [selectedMaterial, setSelectedMaterial] = useState(null);

    // UUSI: Kappalemäärä
    const [quantity, setQuantity] = useState(1);

    // UI State
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
        setCurrentFileName(file.name);

        setLoading(true);
        setError(null);
        setResult(null);
        setSelectedMaterial(null);
        setIsDropdownOpen(false);
        setShowDetails(false);
        setQuantity(1); // Nollataan määrä uudelle tiedostolle

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://127.0.0.1:8000/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setResult(response.data);

            const estimates = response.data.estimates || response.data.prices;
            if (estimates) {
                const defaultMat = response.data.default_material;
                if (defaultMat && estimates[defaultMat]) {
                    setSelectedMaterial(defaultMat);
                } else {
                    setSelectedMaterial(Object.keys(estimates)[0]);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Virhe: Backend ei vastaa tai tiedosto on viallinen.');
        } finally {
            setLoading(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'model/stl': ['.stl'], 'model/obj': ['.obj'], 'model/3mf': ['.3mf'] },
        multiple: false
    });

    const handleReset = () => {
        setFileUrl(null);
        setResult(null);
        setCurrentFileName("");
        setError(null);
        setSelectedMaterial(null);
        setShowDetails(false);
        setQuantity(1);
    };

    // Lasketaan hinta dynaamisesti (Määrä * Yksikköhinta)
    const currentEstimate = useMemo(() => {
        const data = result?.estimates || result?.prices;
        if (!data || !selectedMaterial) return null;

        const baseData = data[selectedMaterial];
        // Lasketaan kokonaishinta määrän perusteella
        // Huom: Oikeassa tuotannossa aloitusmaksua ei kerrota, mutta tässä MVP:ssä kerrotaan kaikki
        // Jos haluat muuttaa logiikkaa: total = (baseData.breakdown.material_cost * quantity) + baseData.breakdown.startup_fee

        const totalPrice = (baseData.total_price * quantity).toFixed(2);

        return {
            ...baseData,
            total_price: totalPrice,
            // Päivitetään myös erittely näyttämään kokonaissummat
            breakdown: {
                ...baseData.breakdown,
                material_cost_total: (baseData.breakdown.material_cost * quantity).toFixed(2),
                startup_fee_total: (baseData.breakdown.startup_fee * quantity).toFixed(2)
            }
        };
    }, [result, selectedMaterial, quantity]);

    const materialOptions = useMemo(() => {
        if (!result || (!result.estimates && !result.prices)) return [];
        return Object.entries(result.estimates || result.prices).map(([key, data]) => ({
            key,
            ...data
        }));
    }, [result]);

    // Käsittelijä määrän muutokselle (estää negatiiviset luvut)
    const handleQuantityChange = (e) => {
        const val = parseInt(e.target.value);
        if (val > 0) setQuantity(val);
        else if (e.target.value === "") setQuantity(""); // Salli tyhjä hetkellisesti
    };

    return (
        <>
            <style>{`
                :root { color-scheme: light; }
                * { box-sizing: border-box; }
            `}</style>

            <div style={styles.pageContainer}>
                <div style={styles.contentWrapper}>
                    <header style={styles.header}>
                        <h1 style={styles.title}>3D-Valmistusportaali</h1>
                        <p style={styles.subtitle}>Lataa malli (STL, OBJ, 3MF), valitse materiaali, tilaa.</p>
                    </header>

                    <div style={styles.mainGrid}>
                        {/* VASEN: Viewer */}
                        <div style={styles.leftColumn}>
                            {!fileUrl ? (
                                <div {...getRootProps()} style={styles.dropzone}>
                                    <input {...getInputProps()} />
                                    <div style={styles.uploadIcon}>⬆️</div>
                                    <p style={styles.uploadText}>{isDragActive ? "Pudota tähän" : "Raahaa tiedosto tähän"}</p>
                                    <p style={styles.uploadHint}>Tuetut: .STL, .OBJ, .3MF</p>
                                </div>
                            ) : (
                                <div style={styles.viewerContainer}>
                                    <ModelViewer fileUrl={fileUrl} fileName={currentFileName} />
                                    <button onClick={handleReset} style={styles.reuploadBtn}>
                                        ↻ Lataa uusi malli
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* OIKEA: Tiedot */}
                        <div style={styles.rightColumn}>
                            {loading && <div style={styles.loadingBox}><div style={styles.spinner}></div><p>Analysoidaan...</p></div>}
                            {error && <div style={styles.errorBox}>{error}</div>}

                            {result && !loading && (
                                <div style={styles.resultsCard}>
                                    <h2 style={styles.cardTitle}>Tilaustiedot</h2>

                                    <div style={styles.specsBox}>
                                        {result.geometry ? (
                                            <>
                                                <div style={styles.specRow}>
                                                    <span style={styles.specLabel}>Mitat:</span>
                                                    <span style={styles.specValue}>{result.geometry.dimensions_mm.x} x {result.geometry.dimensions_mm.y} x {result.geometry.dimensions_mm.z} mm</span>
                                                </div>
                                                <div style={styles.specRow}>
                                                    <span style={styles.specLabel}>Tilavuus:</span>
                                                    <span style={styles.specValue}>{result.geometry.volume_cm3} cm³</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span>Tilavuus: {result.volume_cm3} cm³</span>
                                        )}
                                    </div>

                                    {(result.estimates || result.prices) && (
                                        <div style={styles.inputGroup} ref={dropdownRef}>
                                            {/* Yhteinen rivi Materiaalille (3/4) ja Määrälle (1/4) */}
                                            <div style={styles.inputRow}>

                                                {/* MATERIAALIVALIKKO (Flex 3) */}
                                                <div style={{ flex: 3, position: 'relative' }}>
                                                    <label style={styles.label}>Materiaali</label>
                                                    <div
                                                        style={styles.customSelectTrigger}
                                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                    >
                                                        <span>{currentEstimate ? currentEstimate.name : "Valitse..."}</span>
                                                        <span style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: '0.8rem' }}>▼</span>
                                                    </div>

                                                    {isDropdownOpen && (
                                                        <div style={styles.customOptionsList}>
                                                            {materialOptions.map((opt) => (
                                                                <div
                                                                    key={opt.key}
                                                                    style={{
                                                                        ...styles.customOption,
                                                                        backgroundColor: selectedMaterial === opt.key ? '#f0f9ff' : 'white',
                                                                        color: selectedMaterial === opt.key ? '#007bff' : '#333'
                                                                    }}
                                                                    onClick={() => {
                                                                        setSelectedMaterial(opt.key);
                                                                        setIsDropdownOpen(false);
                                                                    }}
                                                                >
                                                                    <div style={{ fontWeight: '600' }}>{opt.name}</div>
                                                                    {/* Näytetään tässä yksikköhinta */}
                                                                    <div style={{ fontSize: '0.9rem', color: '#555' }}>{opt.total_price} €/kpl</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* MÄÄRÄKENTTÄ (Flex 1) */}
                                                <div style={{ flex: 1 }}>
                                                    <label style={styles.label}>Määrä</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={quantity}
                                                        onChange={handleQuantityChange}
                                                        onBlur={() => { if (quantity === "") setQuantity(1); }}
                                                        style={styles.quantityInput}
                                                    />
                                                </div>
                                            </div>

                                            {currentEstimate?.description && (
                                                <p style={styles.materialDesc}>{currentEstimate.description}</p>
                                            )}
                                        </div>
                                    )}

                                    <div style={styles.priceBox}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={styles.priceLabel}>Hinta-arvio (ALV 0%)</span>
                                            <button
                                                style={styles.infoButton}
                                                onClick={() => setShowDetails(true)}
                                                title="Avaa hintaerittely"
                                            >
                                                ?
                                            </button>
                                        </div>

                                        {currentEstimate ? (
                                            <span style={styles.priceTag}>{currentEstimate.total_price} €</span>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </div>

                                    <div style={styles.buttonStack}>
                                        <button style={styles.primaryButton} onClick={() => alert(`Lisätty koriin: ${quantity} kpl ${currentEstimate?.name}`)}>
                                            Lisää ostoskoriin →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!result && !loading && !error && (
                                <div style={styles.placeholderBox}><p>Lataa tiedosto nähdäksesi hinnan.</p></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL */}
                {showDetails && currentEstimate && currentEstimate.breakdown && (
                    <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
                        <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                            <div style={styles.modalHeader}>
                                <h3>Hintaerittely ({quantity} kpl)</h3>
                                <button style={styles.closeButton} onClick={() => setShowDetails(false)}>×</button>
                            </div>

                            <div style={styles.bomContainer}>
                                <div style={styles.bomRow}>
                                    <span>Materiaali ({currentEstimate.name})</span>
                                    <span>{currentEstimate.breakdown.material_rate} €/cm³</span>
                                </div>
                                <div style={styles.bomRow}>
                                    <span>Materiaalikulu (Yht.)</span>
                                    <span>{currentEstimate.breakdown.material_cost_total} €</span>
                                </div>
                                <div style={styles.bomRow}>
                                    <span>Aloitusmaksu & Käsittely (Yht.)</span>
                                    <span>{currentEstimate.breakdown.startup_fee_total} €</span>
                                </div>
                                <div style={{ ...styles.bomRow, borderTop: '1px solid #ddd', marginTop: '10px', paddingTop: '10px', fontWeight: 'bold' }}>
                                    <span>Yhteensä (ALV 0%)</span>
                                    <span>{currentEstimate.total_price} €</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

// --- TYYLIT ---
const styles = {
    // --- LAYOUT & SIVUN RAKENNE ---
    pageContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: "'Inter', sans-serif",
        color: '#333',
        background: '#f5f7fa',
        isolation: 'isolate'
    },
    contentWrapper: { width: '70vw', maxWidth: '1600px', minWidth: '350px' },
    header: { textAlign: 'center', marginBottom: '40px' },
    title: { fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px', color: '#1a1a1a' },
    subtitle: { fontSize: '1.1rem', color: '#666' },
    mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px', alignItems: 'start', width: '100%' },

    // --- VASEN PALSTA (Viewer) ---
    leftColumn: { display: 'flex', flexDirection: 'column' },
    dropzone: { border: '2px dashed #cbd5e0', borderRadius: '16px', padding: '60px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', minHeight: '450px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
    viewerContainer: { width: '100%', backgroundColor: 'white', borderRadius: '16px', padding: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    uploadIcon: { fontSize: '48px', marginBottom: '20px', opacity: 0.3 },
    uploadText: { fontSize: '1.2rem', fontWeight: '500', marginBottom: '8px' },
    uploadHint: { fontSize: '0.9rem', color: '#888' },
    reuploadBtn: { marginTop: '10px', width: '100%', padding: '12px', backgroundColor: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },

    // --- OIKEA PALSTA (Tiedot) ---
    rightColumn: { display: 'flex', flexDirection: 'column' },
    resultsCard: { background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #edf2f7', position: 'relative' },
    cardTitle: { marginTop: 0, marginBottom: '24px', fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' },
    loadingBox: { textAlign: 'center', padding: '40px' },
    spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182ce', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' },
    errorBox: { backgroundColor: '#fff5f5', color: '#c53030', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #feb2b2' },
    placeholderBox: { padding: '60px', textAlign: 'center', color: '#a0aec0', border: '2px dashed #cbd5e0', borderRadius: '16px', backgroundColor: 'white' },

    // --- TEKNISET TIEDOT ---
    specsBox: { marginBottom: '24px', padding: '24px', backgroundColor: '#f7fafc', borderRadius: '12px', border: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' },
    specRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' },
    specLabel: { fontSize: '0.9rem', color: '#718096' },
    specValue: { fontSize: '0.95rem', fontWeight: '600', color: '#2d3748' },

    // --- INPUTIT (Materiaali + Määrä) ---
    inputGroup: { marginBottom: '24px', position: 'relative', width: '100%' },
    inputRow: { display: 'flex', gap: '16px', alignItems: 'flex-end' }, // UUSI: Rivi kahdelle kentälle
    label: { display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px', color: '#333' },

    // Custom Dropdown
    customSelectTrigger: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', color: '#333' },
    customOptionsList: { position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100, maxHeight: '300px', overflowY: 'auto', boxSizing: 'border-box' },
    customOption: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' },

    // Määräkenttä (Input Number)
    quantityInput: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#333', outline: 'none' },

    materialDesc: { fontSize: '0.85rem', color: '#718096', marginTop: '12px', lineHeight: '1.4', paddingLeft: '4px' },

    // --- HINTA OSIO ---
    priceBox: { background: '#f0fff4', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', border: '1px solid #c6f6d5' },
    priceLabel: { color: '#2f855a', fontWeight: '600', fontSize: '0.9rem' },
    priceTag: { fontSize: '2rem', fontWeight: '700', color: '#22543d' },

    // --- NAPIT ---
    buttonStack: { display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' },
    primaryButton: { width: '100%', padding: '18px', backgroundColor: '#1a202c', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },

    // --- INFO NAPPI & MODAL ---
    infoButton: { width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #cbd5e0', backgroundColor: 'transparent', color: '#a0aec0', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginLeft: '6px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' },
    modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
    closeButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' },
    bomContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
    bomRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#4a5568' },
};

export default PriceCalculator;