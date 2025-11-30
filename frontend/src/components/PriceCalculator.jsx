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

    // --- VALINNAT ---
    const [selectedTech, setSelectedTech] = useState(null);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [quantity, setQuantity] = useState(1);

    // UUDET VALINNAT
    const [selectedFinish, setSelectedFinish] = useState('standard'); // bulk, standard, custom
    const [selectedDelivery, setSelectedDelivery] = useState('standard'); // economy, standard, express

    // --- UI STATE (Dropdownien auki/kiinni tilat) ---
    const [openDropdown, setOpenDropdown] = useState(null); // 'tech', 'mat', 'finish', 'delivery' tai null
    const [showDetails, setShowDetails] = useState(false);

    // Refit klikkausten tunnistamiseen
    const containerRef = useRef(null);

    // Sulje kaikki dropdownit jos klikataan ohi
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleDropdown = (name) => {
        setOpenDropdown(openDropdown === name ? null : name);
    };

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
        setCurrentFileName(file.name);

        setLoading(true);
        setError(null);
        setResult(null);

        // Resetoidaan
        setSelectedTech(null);
        setSelectedMaterial(null);
        setQuantity(1);
        setSelectedFinish('standard');
        setSelectedDelivery('standard');
        setShowDetails(false);
        setOpenDropdown(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://127.0.0.1:8000/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const data = response.data;
            setResult(data);

            if (data.defaults) {
                setSelectedTech(data.defaults.tech);
                setSelectedMaterial(data.defaults.mat);
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
        setSelectedTech(null);
        setSelectedMaterial(null);
        setQuantity(1);
        setSelectedFinish('standard');
        setSelectedDelivery('standard');
    };

    // --- DATA & OPTIONS ---

    const techOptions = useMemo(() => {
        if (!result || !result.structure) return [];
        let options = [];
        Object.entries(result.structure).forEach(([catKey, category]) => {
            options.push({ type: 'header', label: category.label, key: catKey });
            Object.entries(category.methods).forEach(([methodKey, method]) => {
                options.push({ type: 'option', label: method.name, key: methodKey });
            });
        });
        return options;
    }, [result]);

    const materialOptions = useMemo(() => {
        if (!result || !selectedTech || !result.estimates[selectedTech]) return [];
        return Object.entries(result.estimates[selectedTech]).map(([key, data]) => ({
            key,
            ...data
        }));
    }, [result, selectedTech]);

    // UUDET LISTAT
    const finishOptions = [
        { key: 'bulk', label: 'Bulk (Raaka)', multiplier: 1.0, desc: 'Ei jälkikäsittelyä, suoraan koneesta.' },
        { key: 'standard', label: 'Kustannustehokas', multiplier: 1.2, desc: 'Peruspuhdistus ja raepuhallus.' },
        { key: 'custom', label: 'Yksilöllinen', multiplier: 1.5, desc: 'Käsinviimeistely, maalaus tai kiillotus.' }
    ];

    const deliveryOptions = [
        { key: 'economy', label: 'Economy (14 pv)', multiplier: 0.9, desc: 'Edullisin, jos ei ole kiire.' },
        { key: 'standard', label: 'Standard (7 pv)', multiplier: 1.0, desc: 'Normaali toimitusaika.' },
        { key: 'express', label: 'Express (3 pv)', multiplier: 1.5, desc: 'Priorisoitu tuotanto ja toimitus.' }
    ];

    // --- HINNAN LASKENTA (SISÄLTÄÄ NYT UUDET MUUTTUJAT) ---
    const currentEstimate = useMemo(() => {
        if (!result || !selectedTech || !selectedMaterial) return null;

        const techData = result.estimates[selectedTech];
        const matData = techData?.[selectedMaterial];
        if (!matData) return null;

        // 1. Haetaan perushinnat
        const baseMaterialCost = matData.breakdown.material_cost;
        const baseStartupFee = matData.breakdown.startup_fee;

        // 2. Haetaan kertoimet valinnoista
        const finishMult = finishOptions.find(f => f.key === selectedFinish)?.multiplier || 1.0;
        const deliveryMult = deliveryOptions.find(d => d.key === selectedDelivery)?.multiplier || 1.0;

        // 3. Lasketaan muokattu kappalehinta (Viimeistely vaikuttaa materiaalikuluun/työhön)
        // Huom: Toimitusnopeus vaikuttaa koko hintaan tai vain työhön, tässä yksinkertaistettuna koko pottiin.

        const modifiedUnitCost = baseMaterialCost * finishMult;

        // 4. Kokonaishinta: (Kappalehinta * Määrä) + Aloitus
        // Kerrotaan lopuksi toimituskertoimella (Express maksaa enemmän kaikesta)
        const subTotal = (modifiedUnitCost * quantity) + baseStartupFee;
        const finalTotal = subTotal * deliveryMult;

        const effectiveUnitPrice = finalTotal / quantity;

        return {
            ...matData,
            calculated_total: finalTotal.toFixed(2),
            effective_unit_price: effectiveUnitPrice.toFixed(2),

            // Päivitetty erittely modaalia varten
            breakdown: {
                ...matData.breakdown,
                tech_name: techData.name, // Varmistetaan että tämä löytyy
                total_material: (modifiedUnitCost * quantity * deliveryMult).toFixed(2),
                total_startup: (baseStartupFee * deliveryMult).toFixed(2),
                finish_label: finishOptions.find(f => f.key === selectedFinish)?.label,
                delivery_label: deliveryOptions.find(d => d.key === selectedDelivery)?.label
            }
        };
    }, [result, selectedTech, selectedMaterial, quantity, selectedFinish, selectedDelivery]);

    const handleTechChange = (techKey) => {
        setSelectedTech(techKey);
        setOpenDropdown(null);
        if (result && result.estimates[techKey]) {
            const firstMat = Object.keys(result.estimates[techKey])[0];
            setSelectedMaterial(firstMat);
        }
    };

    // Yleinen handler napeille
    const handleAction = (action) => {
        alert(`${action}!\nTuote: ${currentEstimate?.name}\nMäärä: ${quantity} kpl\nViimeistely: ${selectedFinish}\nToimitus: ${selectedDelivery}\nHinta: ${currentEstimate?.calculated_total} €`);
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
                        <p style={styles.subtitle}>Lataa malli, valitse tekniikka ja materiaali.</p>
                    </header>

                    <div style={styles.mainGrid}>
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

                        <div style={styles.rightColumn}>
                            {loading && <div style={styles.loadingBox}><div style={styles.spinner}></div><p>Analysoidaan...</p></div>}
                            {error && <div style={styles.errorBox}>{error}</div>}

                            {result && !loading && (
                                <div style={styles.resultsCard} ref={containerRef}>
                                    <h2 style={styles.cardTitle}>Tilaustiedot</h2>

                                    <div style={styles.specsBox}>
                                        <div style={styles.specRow}>
                                            <span style={styles.specLabel}>Mitat:</span>
                                            <span style={styles.specValue}>{result.geometry.dimensions_mm.x} x {result.geometry.dimensions_mm.y} x {result.geometry.dimensions_mm.z} mm</span>
                                        </div>
                                        <div style={styles.specRow}>
                                            <span style={styles.specLabel}>Tilavuus:</span>
                                            <span style={styles.specValue}>{result.geometry.volume_cm3} cm³</span>
                                        </div>
                                    </div>

                                    {/* 1. RIVI: TEKNIIKKA (Koko leveys) */}
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Valmistustekniikka</label>
                                        <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('tech')}>
                                            <span>
                                                {selectedTech && result.structure
                                                    ? findTechName(selectedTech, result.structure)
                                                    : "Valitse tekniikka..."}
                                            </span>
                                            <span style={{ fontSize: '0.8rem' }}>▼</span>
                                        </div>
                                        {openDropdown === 'tech' && (
                                            <div style={styles.customOptionsList}>
                                                {techOptions.map((opt) => (
                                                    opt.type === 'header' ? (
                                                        <div key={opt.key} style={styles.optionHeader}>{opt.label}</div>
                                                    ) : (
                                                        <div key={opt.key} style={{ ...styles.customOption, paddingLeft: '24px', color: selectedTech === opt.key ? '#007bff' : '#333' }} onClick={() => handleTechChange(opt.key)}>
                                                            {opt.label}
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. RIVI: MATERIAALI (75%) + MÄÄRÄ (25%) */}
                                    <div style={styles.inputGroup}>
                                        <div style={styles.inputRow}>
                                            <div style={{ flex: 3, position: 'relative' }}>
                                                <label style={styles.label}>Materiaali</label>
                                                <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('mat')}>
                                                    <span>{currentEstimate ? currentEstimate.name : "Valitse..."}</span>
                                                    <span style={{ fontSize: '0.8rem' }}>▼</span>
                                                </div>
                                                {openDropdown === 'mat' && (
                                                    <div style={styles.customOptionsList}>
                                                        {materialOptions.map((opt) => (
                                                            <div key={opt.key} style={{ ...styles.customOption, backgroundColor: selectedMaterial === opt.key ? '#f0f9ff' : 'white' }} onClick={() => { setSelectedMaterial(opt.key); setOpenDropdown(null); }}>
                                                                <div style={{ fontWeight: '600' }}>{opt.name}</div>
                                                                <div style={{ fontSize: '0.9rem', color: '#555' }}>{opt.unit_price} €/kpl</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={styles.label}>Määrä</label>
                                                <input type="number" min="1" value={quantity} onChange={(e) => { const val = parseInt(e.target.value); if (val > 0) setQuantity(val); else if (e.target.value === "") setQuantity(""); }} onBlur={() => { if (quantity === "") setQuantity(1); }} style={styles.quantityInput} />
                                            </div>
                                        </div>
                                        {currentEstimate?.description && <p style={styles.materialDesc}>{currentEstimate.description}</p>}
                                    </div>

                                    {/* 3. RIVI: VIIMEISTELY (50%) + TOIMITUS (50%) */}
                                    <div style={styles.inputGroup}>
                                        <div style={styles.inputRow}>

                                            {/* VIIMEISTELYTASO */}
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <label style={styles.label}>Viimeistelytaso</label>
                                                <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('finish')}>
                                                    <span>{finishOptions.find(o => o.key === selectedFinish)?.label}</span>
                                                    <span style={{ fontSize: '0.8rem' }}>▼</span>
                                                </div>
                                                {openDropdown === 'finish' && (
                                                    <div style={styles.customOptionsList}>
                                                        {finishOptions.map((opt) => (
                                                            <div key={opt.key} style={{ ...styles.customOption, backgroundColor: selectedFinish === opt.key ? '#f0f9ff' : 'white' }} onClick={() => { setSelectedFinish(opt.key); setOpenDropdown(null); }}>
                                                                <div>{opt.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* TOIMITUSNOPEUS */}
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <label style={styles.label}>Toimitusnopeus</label>
                                                <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('delivery')}>
                                                    <span>{deliveryOptions.find(o => o.key === selectedDelivery)?.label}</span>
                                                    <span style={{ fontSize: '0.8rem' }}>▼</span>
                                                </div>
                                                {openDropdown === 'delivery' && (
                                                    <div style={styles.customOptionsList}>
                                                        {deliveryOptions.map((opt) => (
                                                            <div key={opt.key} style={{ ...styles.customOption, backgroundColor: selectedDelivery === opt.key ? '#f0f9ff' : 'white' }} onClick={() => { setSelectedDelivery(opt.key); setOpenDropdown(null); }}>
                                                                <div>{opt.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    {/* HINTA */}
                                    <div style={styles.priceBox}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={styles.priceLabel}>Hinta-arvio (ALV 0%)</span>
                                            <button style={styles.infoButton} onClick={() => setShowDetails(true)} title="Avaa hintaerittely">?</button>
                                        </div>
                                        {currentEstimate ? (
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={styles.priceTag}>{currentEstimate.calculated_total} €</span>
                                                {quantity > 1 && (
                                                    <div style={{ fontSize: '0.85rem', color: '#2f855a', marginTop: '4px' }}>
                                                        ({currentEstimate.effective_unit_price} € / kpl)
                                                    </div>
                                                )}
                                            </div>
                                        ) : <span>-</span>}
                                    </div>

                                    {/* TOIMINNOT */}
                                    <div style={styles.actionRow}>
                                        <button style={styles.quoteButton} onClick={() => handleAction('Tarjouspyyntö')}>Pyydä tarjous</button>
                                        <button style={styles.cartButton} onClick={() => handleAction('Ostoskori')}>Lisää ostoskoriin</button>
                                    </div>
                                </div>
                            )}

                            {!result && !loading && !error && (
                                <div style={styles.placeholderBox}><p>Lataa tiedosto aloittaaksesi.</p></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL (BOM) */}
                {showDetails && currentEstimate && currentEstimate.breakdown && (
                    <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
                        <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                            <div style={styles.modalHeader}>
                                <h3>Hintaerittely ({quantity} kpl)</h3>
                                <button style={styles.closeButton} onClick={() => setShowDetails(false)}>×</button>
                            </div>
                            <div style={styles.bomContainer}>
                                <div style={styles.bomRow}><strong>Tekniikka</strong><span>{findTechName(selectedTech, result.structure)}</span></div>
                                <div style={styles.bomRow}><span>Materiaali</span><span>{currentEstimate.name}</span></div>
                                <div style={styles.bomRow}><span>Viimeistely</span><span>{currentEstimate.breakdown.finish_label}</span></div>
                                <div style={styles.bomRow}><span>Toimitus</span><span>{currentEstimate.breakdown.delivery_label}</span></div>
                                <hr style={{ margin: '5px 0', border: 0, borderTop: '1px dashed #eee' }} />
                                <div style={styles.bomRow}><span>Aloituskustannus</span><span>{currentEstimate.breakdown.total_startup} €</span></div>
                                <div style={styles.bomRow}><span>Tuotantokustannus</span><span>{currentEstimate.breakdown.total_material} €</span></div>
                                <div style={{ ...styles.bomRow, borderTop: '1px solid #ddd', marginTop: '10px', paddingTop: '10px', fontWeight: 'bold' }}>
                                    <span>Yhteensä (ALV 0%)</span>
                                    <span>{currentEstimate.calculated_total} €</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// Apufunktiot
function findTechName(techKey, structure) {
    if (!structure) return techKey;
    for (const catKey in structure) {
        if (structure[catKey].methods[techKey]) {
            return structure[catKey].methods[techKey].name;
        }
    }
    return techKey;
}

// --- TYYLIT ---
const styles = {
    pageContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#333', background: '#f5f7fa', isolation: 'isolate' },
    contentWrapper: { width: '70vw', maxWidth: '1600px', minWidth: '350px' },
    header: { textAlign: 'center', marginBottom: '40px' },
    title: { fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px', color: '#1a1a1a' },
    subtitle: { fontSize: '1.1rem', color: '#666' },
    mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px', alignItems: 'start', width: '100%' },

    leftColumn: { display: 'flex', flexDirection: 'column' },
    dropzone: { border: '2px dashed #cbd5e0', borderRadius: '16px', padding: '60px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', minHeight: '450px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
    viewerContainer: { width: '100%', backgroundColor: 'white', borderRadius: '16px', padding: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    uploadIcon: { fontSize: '48px', marginBottom: '20px', opacity: 0.3 },
    uploadText: { fontSize: '1.2rem', fontWeight: '500', marginBottom: '8px' },
    uploadHint: { fontSize: '0.9rem', color: '#888' },
    reuploadBtn: { marginTop: '10px', width: '100%', padding: '12px', backgroundColor: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },

    rightColumn: { display: 'flex', flexDirection: 'column' },
    resultsCard: { background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #edf2f7', position: 'relative' },
    cardTitle: { marginTop: 0, marginBottom: '24px', fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' },

    specsBox: { marginBottom: '24px', padding: '24px', backgroundColor: '#f7fafc', borderRadius: '12px', border: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' },
    specRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' },
    specLabel: { fontSize: '0.9rem', color: '#718096' },
    specValue: { fontSize: '0.95rem', fontWeight: '600', color: '#2d3748' },

    inputGroup: { marginBottom: '24px', position: 'relative', width: '100%' },
    inputRow: { display: 'flex', gap: '16px', alignItems: 'flex-end' },
    label: { display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' },

    customSelectTrigger: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', color: '#333' },
    customOptionsList: { position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100, maxHeight: '350px', overflowY: 'auto', boxSizing: 'border-box' },
    customOption: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' },
    optionHeader: { padding: '12px 16px', backgroundColor: '#f8fafc', color: '#718096', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #edf2f7' },

    quantityInput: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#333', outline: 'none' },
    materialDesc: { fontSize: '0.85rem', color: '#718096', marginTop: '12px', lineHeight: '1.4', paddingLeft: '4px' },

    priceBox: { background: '#f0fff4', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', border: '1px solid #c6f6d5' },
    priceLabel: { color: '#2f855a', fontWeight: '600', fontSize: '0.9rem' },
    priceTag: { fontSize: '2rem', fontWeight: '700', color: '#22543d' },
    infoButton: { width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #cbd5e0', backgroundColor: 'transparent', color: '#a0aec0', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginLeft: '6px' },

    actionRow: { display: 'flex', gap: '15px', width: '100%', marginTop: '10px' },
    cartButton: { flex: 1, padding: '18px', backgroundColor: '#1a202c', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.1s ease' },
    quoteButton: { flex: 1, padding: '18px', backgroundColor: 'transparent', color: '#1a202c', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s ease' },

    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' },
    modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
    closeButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' },
    bomContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
    bomRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#4a5568' },

    loadingBox: { textAlign: 'center', padding: '40px' },
    spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182ce', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' },
    errorBox: { backgroundColor: '#fff5f5', color: '#c53030', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #feb2b2' },
    placeholderBox: { padding: '60px', textAlign: 'center', color: '#a0aec0', border: '2px dashed #cbd5e0', borderRadius: '16px', backgroundColor: 'white' }
};

export default PriceCalculator;