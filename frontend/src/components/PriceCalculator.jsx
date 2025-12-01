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

    // VALINNAT
    const [selectedTech, setSelectedTech] = useState(null);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [selectedFinish, setSelectedFinish] = useState('bulk');
    const [selectedDelivery, setSelectedDelivery] = useState('economy');

    // UI State
    const [openDropdown, setOpenDropdown] = useState(null); // 'tech', 'mat', 'finish', 'delivery'
    const [showDetails, setShowDetails] = useState(false);

    // TARJOUSPYYNTÖ STATE
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [quoteForm, setQuoteForm] = useState({
        name: '', company: '', phone: '', email: '',
        surface: '', color: '', application: '', notes: ''
    });
    const [formStatus, setFormStatus] = useState(null);

    // REFS (Kaikille neljälle valikolle)
    const techDropdownRef = useRef(null);
    const matDropdownRef = useRef(null);
    const finishDropdownRef = useRef(null);
    const deliveryDropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            // Suljetaan dropdown jos klikataan sen ulkopuolelle
            if (techDropdownRef.current && !techDropdownRef.current.contains(event.target) &&
                matDropdownRef.current && !matDropdownRef.current.contains(event.target) &&
                finishDropdownRef.current && !finishDropdownRef.current.contains(event.target) &&
                deliveryDropdownRef.current && !deliveryDropdownRef.current.contains(event.target)) {
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
        setSelectedTech(null);
        setSelectedMaterial(null);
        setQuantity(1);
        setShowDetails(false);
        setShowQuoteModal(false);
        setSelectedFinish('bulk');
        setSelectedDelivery('economy');
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
    };

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

    const finishOptions = [
        { key: 'bulk', label: 'Bulk', multiplier: 1.0, desc: 'Peruslaatu. Osat puhdistetaan jauheesta ja tukirakenteista.' },
        { key: 'cost_effective', label: 'Kustannustehokas', multiplier: 1.15, desc: 'Koneellinen viimeistely (esim. raepuhallus). Tasoittaa pinnan.' },
        { key: 'custom', label: 'Yksilöllinen', multiplier: 1.6, desc: 'Vaativa viimeistely: maalaus, lakkaus tai kiillotus.' }
    ];

    const deliveryOptions = [
        { key: 'economy', label: 'Economy (10-14 pv)', multiplier: 1.0, desc: 'Edullisin vaihtoehto.' },
        { key: 'standard', label: 'Standard (5-7 pv)', multiplier: 1.25, desc: 'Normaali toimitusnopeus.' },
        { key: 'express', label: 'Express (2-4 pv)', multiplier: 1.75, desc: 'Priorisoitu valmistus.' }
    ];

    const currentFinishObj = finishOptions.find(f => f.key === selectedFinish);
    const currentDeliveryObj = deliveryOptions.find(d => d.key === selectedDelivery);

    const currentEstimate = useMemo(() => {
        if (!result || !selectedTech || !selectedMaterial) return null;

        const techData = result.estimates[selectedTech];
        if (!techData) return null;

        const matData = techData[selectedMaterial];
        if (!matData) return null;

        const unitMaterialCost = matData.breakdown.material_cost;
        const unitStartupFee = matData.breakdown.startup_fee;

        const finishMult = currentFinishObj?.multiplier || 1.0;
        const deliveryMult = currentDeliveryObj?.multiplier || 1.0;

        const totalBaseMaterial = unitMaterialCost * quantity;
        const totalBaseStartup = unitStartupFee;

        const baseTotal = totalBaseMaterial + totalBaseStartup;
        const costAddedByFinish = (baseTotal * finishMult) - baseTotal;
        const subTotal = baseTotal + costAddedByFinish;
        const costAddedByDelivery = (subTotal * deliveryMult) - subTotal;
        const grandTotal = subTotal + costAddedByDelivery;

        const vatAmount = grandTotal * 0.255;
        const totalWithVat = grandTotal + vatAmount;
        const effectiveUnitPrice = grandTotal / quantity;

        return {
            ...matData,
            tech_real_name: matData.tech_name,
            calculated_total: grandTotal.toFixed(2),
            effective_unit_price: effectiveUnitPrice.toFixed(2),

            breakdown_detailed: {
                technology: matData.tech_name,
                material_name: matData.name,
                row_material: totalBaseMaterial.toFixed(2),
                row_startup: totalBaseStartup.toFixed(2),
                row_finish: costAddedByFinish.toFixed(2),
                row_delivery: costAddedByDelivery.toFixed(2),
                row_vat: vatAmount.toFixed(2),
                row_total_inc_vat: totalWithVat.toFixed(2),
                label_finish: currentFinishObj?.label,
                label_delivery: currentDeliveryObj?.label
            }
        };
    }, [result, selectedTech, selectedMaterial, quantity, selectedFinish, selectedDelivery, currentFinishObj, currentDeliveryObj]);

    const handleTechChange = (techKey) => {
        setSelectedTech(techKey);
        setOpenDropdown(null);
        if (result && result.estimates[techKey]) {
            const firstMat = Object.keys(result.estimates[techKey])[0];
            setSelectedMaterial(firstMat);
        }
    };

    const handleQuoteSubmit = async (e) => {
        e.preventDefault();
        setFormStatus('sending');
        setTimeout(() => {
            setShowQuoteModal(false);
            setFormStatus(null);
            setQuoteForm({ name: '', company: '', phone: '', email: '', surface: '', color: '', application: '', notes: '' });
        }, 2000);
    };

    return (
        <>
            <style>{`
                :root { color-scheme: light; }
                * { box-sizing: border-box; }
                .blur-content { filter: blur(8px); transition: filter 0.3s ease; pointer-events: none; }
            `}</style>

            <div style={styles.pageContainer}>

                <div style={{
                    ...styles.contentWrapper,
                    ...(showQuoteModal ? { filter: 'blur(8px)', pointerEvents: 'none', transform: 'scale(0.99)', opacity: 0.6, transition: 'all 0.4s ease' } : { transition: 'all 0.4s ease' })
                }}>
                    <header style={styles.header}>
                        <h1 style={styles.title}>3D-Valmistusportaali</h1>
                        <p style={styles.subtitle}>Lataa malli, valitse tekniikka ja materiaali.</p>
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

                                    <div style={styles.specsContainer}>
                                        <div style={styles.specCard}>
                                            <div style={styles.specIcon}>📏</div>
                                            <div style={styles.specContent}><div style={styles.specLabel}>Mitat (mm)</div><div style={styles.specValue}>{result.geometry.dimensions_mm.x} x {result.geometry.dimensions_mm.y} x {result.geometry.dimensions_mm.z}</div></div>
                                        </div>
                                        <div style={styles.specCard}>
                                            <div style={styles.specIcon}>💧</div>
                                            <div style={styles.specContent}><div style={styles.specLabel}>Tilavuus</div><div style={styles.specValue}>{result.geometry.volume_cm3} cm³</div></div>
                                        </div>
                                    </div>

                                    <div style={styles.formStack}>

                                        {/* 1. TEKNIIKKA */}
                                        <div style={styles.inputGroup} ref={techDropdownRef}>
                                            <label style={styles.label}>Valmistustekniikka</label>
                                            <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('tech')}>
                                                <span>{selectedTech && result.structure ? findTechName(selectedTech, result.structure) : "Valitse tekniikka..."}</span>
                                                <span style={{ fontSize: '0.8rem' }}>▼</span>
                                            </div>
                                            {openDropdown === 'tech' && (
                                                <div style={styles.customOptionsList}>
                                                    {techOptions.map((opt) => (
                                                        opt.type === 'header' ? <div key={opt.key} style={styles.optionHeader}>{opt.label}</div> :
                                                            <div key={opt.key} style={{ ...styles.customOption, paddingLeft: '24px', color: selectedTech === opt.key ? '#007bff' : '#333' }} onClick={() => handleTechChange(opt.key)}>{opt.label}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* 2. MATERIAALI + MÄÄRÄ */}
                                        <div style={styles.inputGroup} ref={matDropdownRef}>
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
                                                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{opt.unit_price} €/kpl</div>
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

                                        {/* 3. VIIMEISTELY + TOIMITUS */}
                                        <div style={styles.inputGroup}>
                                            <div style={styles.inputRow}>

                                                {/* VIIMEISTELY */}
                                                <div style={{ flex: 1 }} ref={finishDropdownRef}>
                                                    <label style={styles.label}>Viimeistelytaso</label>

                                                    {/* KÄÄRE: Position relative vain tähän, jotta lista aukeaa heti triggerin alle */}
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('finish')}>
                                                            <span>{finishOptions.find(o => o.key === selectedFinish)?.label}</span>
                                                            <span style={{ fontSize: '0.8rem' }}>▼</span>
                                                        </div>
                                                        {openDropdown === 'finish' && (
                                                            <div style={styles.customOptionsList}>
                                                                {finishOptions.map((opt) => (
                                                                    <div
                                                                        key={opt.key}
                                                                        style={{ ...styles.customOption, backgroundColor: selectedFinish === opt.key ? '#f0f9ff' : 'white', color: selectedFinish === opt.key ? '#007bff' : '#333' }}
                                                                        onClick={() => { setSelectedFinish(opt.key); setOpenDropdown(null); }}
                                                                    >
                                                                        <div>{opt.label}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p style={styles.materialDesc}>{currentFinishObj?.desc}</p>
                                                </div>

                                                {/* TOIMITUS */}
                                                <div style={{ flex: 1 }} ref={deliveryDropdownRef}>
                                                    <label style={styles.label}>Toimitusnopeus</label>

                                                    {/* KÄÄRE: Position relative vain tähän */}
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={styles.customSelectTrigger} onClick={() => toggleDropdown('delivery')}>
                                                            <span>{deliveryOptions.find(o => o.key === selectedDelivery)?.label}</span>
                                                            <span style={{ fontSize: '0.8rem' }}>▼</span>
                                                        </div>
                                                        {openDropdown === 'delivery' && (
                                                            <div style={styles.customOptionsList}>
                                                                {deliveryOptions.map((opt) => (
                                                                    <div
                                                                        key={opt.key}
                                                                        style={{ ...styles.customOption, backgroundColor: selectedDelivery === opt.key ? '#f0f9ff' : 'white', color: selectedDelivery === opt.key ? '#007bff' : '#333' }}
                                                                        onClick={() => { setSelectedDelivery(opt.key); setOpenDropdown(null); }}
                                                                    >
                                                                        <div>{opt.label}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p style={styles.materialDesc}>{currentDeliveryObj?.desc}</p>
                                                </div>

                                            </div>
                                        </div>
                                    </div>

                                    {/* HINTA */}
                                    <div style={styles.priceContainer}>
                                        <div style={styles.priceHeader}>Hinta-arvio (ALV 0%)</div>
                                        {currentEstimate ? (
                                            <>
                                                <div style={styles.priceMain}>
                                                    {currentEstimate.calculated_total} €
                                                </div>
                                                {quantity > 1 && (
                                                    <div style={styles.unitPriceHint}>
                                                        {currentEstimate.effective_unit_price} € / kpl
                                                    </div>
                                                )}
                                                <button style={styles.breakdownButton} onClick={() => setShowDetails(true)}>
                                                    <span style={styles.infoIcon}>i</span>
                                                    Katso hintaerittely
                                                </button>
                                            </>
                                        ) : <div style={styles.priceMain}>-</div>}
                                    </div>

                                    <div style={styles.actionRow}>
                                        <button style={styles.quoteButton} onClick={() => setShowQuoteModal(true)}>Pyydä tarjous</button>
                                        <button style={styles.cartButton} onClick={() => alert('Siirrytään kassalle...')}>Lisää ostoskoriin</button>
                                    </div>
                                </div>
                            )}

                            {!result && !loading && !error && (
                                <div style={styles.placeholderBox}><p>Lataa tiedosto aloittaaksesi.</p></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL BOM */}
                {showDetails && currentEstimate && currentEstimate.breakdown_detailed && (
                    <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
                        <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                            <div style={styles.modalHeader}>
                                <h3>Hintaerittely ({quantity} kpl)</h3>
                                <button style={styles.closeButton} onClick={() => setShowDetails(false)}>×</button>
                            </div>
                            <div style={styles.bomContainer}>
                                <div style={{ ...styles.bomRow, borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <strong style={{ color: '#2d3748', fontSize: '1rem' }}>Valmistustekniikka</strong>
                                    <strong style={{ color: '#2d3748', fontSize: '1rem' }}>{currentEstimate.breakdown_detailed.technology}</strong>
                                </div>
                                <div style={styles.bomRow}><span>Materiaali ({currentEstimate.breakdown_detailed.material_name})</span><span></span></div>
                                <div style={styles.bomRow}><span>Tuotanto ({quantity} kpl)</span><span>{currentEstimate.breakdown_detailed.row_material} €</span></div>
                                <div style={styles.bomRow}><span>Aloitusmaksu (Kiinteä)</span><span>{currentEstimate.breakdown_detailed.row_startup} €</span></div>
                                {parseFloat(currentEstimate.breakdown_detailed.row_finish) > 0 && <div style={{ ...styles.bomRow, color: '#2f855a' }}><span>+ Viimeistely ({currentEstimate.breakdown_detailed.label_finish})</span><span>{currentEstimate.breakdown_detailed.row_finish} €</span></div>}
                                {parseFloat(currentEstimate.breakdown_detailed.row_delivery) > 0 && <div style={{ ...styles.bomRow, color: '#2f855a' }}><span>+ Toimitus ({currentEstimate.breakdown_detailed.label_delivery})</span><span>{currentEstimate.breakdown_detailed.row_delivery} €</span></div>}
                                <hr style={styles.bomDivider} />
                                <div style={styles.bomRow}><strong>Välisumma (ALV 0%)</strong><strong>{currentEstimate.calculated_total} €</strong></div>
                                <div style={{ ...styles.bomRow, fontSize: '0.85rem', color: '#666' }}><span>ALV 25.5%</span><span>{currentEstimate.breakdown_detailed.row_vat} €</span></div>
                                <div style={styles.bomTotalRow}><span>Yhteensä</span><span>{currentEstimate.breakdown_detailed.row_total_inc_vat} €</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TARJOUS MODAL */}
                {showQuoteModal && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.quoteModalBox}>
                            <div style={styles.modalHeader}>
                                <h2>Pyydä sitova tarjous</h2>
                                <button style={styles.closeButton} onClick={() => setShowQuoteModal(false)}>×</button>
                            </div>
                            {formStatus === 'success' ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#2f855a' }}>
                                    <h3>Kiitos!</h3><p>Olemme yhteydessä pian.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleQuoteSubmit} style={styles.quoteForm}>
                                    <div style={styles.formSection}>
                                        <h4 style={styles.sectionTitle}>Yhteystiedot</h4>
                                        <div style={styles.formGrid}>
                                            <div style={styles.field}><label style={styles.label}>Nimi *</label><input required type="text" style={styles.modalInput} value={quoteForm.name} onChange={e => setQuoteForm({ ...quoteForm, name: e.target.value })} /></div>
                                            <div style={styles.field}><label style={styles.label}>Yritys</label><input type="text" style={styles.modalInput} value={quoteForm.company} onChange={e => setQuoteForm({ ...quoteForm, company: e.target.value })} /></div>
                                            <div style={styles.field}><label style={styles.label}>Puhelin *</label><input required type="tel" style={styles.modalInput} value={quoteForm.phone} onChange={e => setQuoteForm({ ...quoteForm, phone: e.target.value })} /></div>
                                            <div style={styles.field}><label style={styles.label}>Sähköposti *</label><input required type="email" style={styles.modalInput} value={quoteForm.email} onChange={e => setQuoteForm({ ...quoteForm, email: e.target.value })} /></div>
                                        </div>
                                    </div>
                                    <div style={styles.formSection}>
                                        <h4 style={styles.sectionTitle}>Tuotteen tarkennukset</h4>
                                        <div style={styles.formGrid}>
                                            <div style={styles.field}>
                                                <label style={styles.label}>Pintastruktuuri</label>
                                                <input type="text" placeholder="Esim. sileä, karhea..." style={styles.modalInput} value={quoteForm.surface} onChange={e => setQuoteForm({ ...quoteForm, surface: e.target.value })} />
                                                <span style={styles.helperText}>Määrittele pinnan laatu (esim. VDI 3400).</span>
                                            </div>
                                            <div style={styles.field}>
                                                <label style={styles.label}>Väri</label>
                                                <input type="text" placeholder="Esim. RAL 9005" style={styles.modalInput} value={quoteForm.color} onChange={e => setQuoteForm({ ...quoteForm, color: e.target.value })} />
                                                <span style={styles.helperText}>Jos ei väliä, jätä tyhjäksi.</span>
                                            </div>
                                            <div style={{ ...styles.field, gridColumn: '1 / -1' }}><label style={styles.label}>Käyttökohde</label><input type="text" style={styles.modalInput} value={quoteForm.application} onChange={e => setQuoteForm({ ...quoteForm, application: e.target.value })} /></div>
                                        </div>
                                    </div>
                                    <div style={styles.formSection}>
                                        <div style={styles.field}>
                                            <label style={styles.label}>Lisätietoja</label>
                                            <textarea rows="4" style={styles.modalTextArea} value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={styles.modalFooter}>
                                        <button type="button" style={styles.quoteButton} onClick={() => setShowQuoteModal(false)}>Peruuta</button>
                                        <button type="submit" style={styles.cartButton}>Lähetä</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

function findTechName(techKey, structure) {
    if (!structure) return techKey;
    for (const catKey in structure) {
        if (structure[catKey].methods[techKey]) {
            return structure[catKey].methods[techKey].name;
        }
    }
    return techKey;
}

const styles = {
    // --- LAYOUT ---
    pageContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#333', background: '#f5f7fa', isolation: 'isolate' },
    contentWrapper: { width: '70vw', maxWidth: '1600px', minWidth: '350px' },
    header: { textAlign: 'center', marginBottom: '40px' },
    title: { fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px', color: '#1a1a1a' },
    subtitle: { fontSize: '1.1rem', color: '#666' },
    mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px', alignItems: 'start', width: '100%' },

    // --- VASEN ---
    leftColumn: { display: 'flex', flexDirection: 'column' },
    dropzone: { border: '2px dashed #cbd5e0', borderRadius: '16px', padding: '60px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', minHeight: '450px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
    viewerContainer: { width: '100%', backgroundColor: 'white', borderRadius: '16px', padding: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    uploadIcon: { fontSize: '48px', marginBottom: '20px', opacity: 0.3 },
    uploadText: { fontSize: '1.2rem', fontWeight: '500', marginBottom: '8px' },
    uploadHint: { fontSize: '0.9rem', color: '#888' },
    reuploadBtn: { marginTop: '10px', width: '100%', padding: '12px', backgroundColor: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },

    // --- OIKEA ---
    rightColumn: { display: 'flex', flexDirection: 'column' },
    resultsCard: { background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #edf2f7', position: 'relative' },
    cardTitle: { marginTop: 0, marginBottom: '24px', fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' },

    // SPECS
    specsContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' },
    specCard: { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: '15px' },
    specIcon: { fontSize: '24px', opacity: 0.7 },
    specContent: { display: 'flex', flexDirection: 'column' },
    specLabel: { fontSize: '0.8rem', color: '#718096', fontWeight: '600', textTransform: 'uppercase' },
    specValue: { fontSize: '1rem', fontWeight: '700', color: '#2d3748' },

    // FORM
    formStack: { display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '20px' },
    inputGroup: { position: 'relative', width: '100%' },
    inputRow: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
    label: { display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' },

    customSelectTrigger: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', color: '#333' },
    customOptionsList: { position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100, maxHeight: '350px', overflowY: 'auto', boxSizing: 'border-box' },
    customOption: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' },
    optionHeader: { padding: '12px 16px', backgroundColor: '#f8fafc', color: '#718096', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #edf2f7' },
    quantityInput: { width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#333', outline: 'none' },
    materialDesc: { fontSize: '0.8rem', color: '#718096', marginTop: '8px', lineHeight: '1.4', paddingLeft: '4px' },

    // HINTA
    priceContainer: { marginTop: '10px', padding: '15px 25px', backgroundColor: '#f0fff4', borderRadius: '16px', border: '1px solid #c6f6d5', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    priceHeader: { color: '#2f855a', fontWeight: '600', fontSize: '0.8rem', marginBottom: '2px' },
    priceMain: { fontSize: '2.5rem', fontWeight: '800', color: '#22543d', lineHeight: '1', letterSpacing: '-1px' },
    unitPriceHint: { fontSize: '0.9rem', color: '#48bb78', marginTop: '2px' },

    breakdownButton: {
        marginTop: '10px',
        background: 'white',
        border: '1px solid #c6f6d5',
        color: '#2f855a',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s'
    },
    infoIcon: { width: '16px', height: '16px', borderRadius: '50%', background: '#2f855a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', fontStyle: 'normal' },

    actionRow: { display: 'flex', gap: '15px', width: '100%', marginTop: '20px' },
    cartButton: { flex: 1, padding: '18px', backgroundColor: '#1a202c', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.1s ease' },
    quoteButton: { flex: 1, padding: '18px', backgroundColor: 'transparent', color: '#1a202c', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s ease' },

    // MODAL
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
    closeButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' },
    bomContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
    bomRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#4a5568' },
    bomDivider: { margin: '5px 0', border: 0, borderTop: '1px dashed #cbd5e0' },
    bomTotalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: '700', color: '#2d3748', borderTop: '2px solid #e2e8f0', marginTop: '10px', paddingTop: '15px' },

    // TARJOUSMODAL (UUDET TYYLIT)
    quoteModalBox: { backgroundColor: 'white', padding: '40px', borderRadius: '20px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' },
    quoteForm: { display: 'flex', flexDirection: 'column', gap: '30px' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '15px' },
    sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#2d3748', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
    field: { display: 'flex', flexDirection: 'column', gap: '8px' },

    // YHTENÄISET INPUT TYYLIT
    modalInput: { padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' },
    modalTextArea: { padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#fff', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' },
    helperText: { fontSize: '0.8rem', color: '#718096', fontStyle: 'italic', marginTop: '4px' },

    modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' },

    loadingBox: { textAlign: 'center', padding: '40px' },
    spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3182ce', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' },
    errorBox: { backgroundColor: '#fff5f5', color: '#c53030', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #feb2b2' },
    placeholderBox: { padding: '60px', textAlign: 'center', color: '#a0aec0', border: '2px dashed #cbd5e0', borderRadius: '16px', backgroundColor: 'white' }
};

export default PriceCalculator;