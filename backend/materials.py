# --- VALMISTUSTEKNIIKAT JA MATERIAALIT ---
# rate = €/cm3 (sis. materiaali + koneaika)
# startup = aloitusmaksu € (sis. asetukset, master-mallit, muotit)
# volume_factor = kerroin tilavuudelle (esim. 0.4 infillille, 3.0 CNC-lastuamiselle)

TECHNOLOGIES = {
    "3d_printing": {
        "label": "3D-Tulostustekniikat",
        "methods": {
            # --- FDM (VERTAILUN VUOKSI) ---
            "fdm_pro": {
                "name": "FDM (Lankatulostus)",
                "startup": 20.0,
                "volume_factor": 0.4,
                "materials": {
                    "pla":  {"name": "PLA (Standard)", "rate": 0.10, "description": "Edullisin. Vain mallikappaleisiin, ei kestä lämpöä."},
                    "asa":  {"name": "ASA (UV-kestävä)", "rate": 0.12, "description": "Kuin ABS, mutta kestää ulkoilmaa. Hyvä käyttöosiin."},
                    "tpu":  {"name": "TPU 95A (Joustava)", "rate": 0.15, "description": "Kumimainen, puolijoustava."}
                }
            },
            # --- PULVERIPETI ---
            "sls": {
                "name": "SLS (Selektiivinen lasersintraus)",
                "startup": 30.0,
                "volume_factor": 0.8,
                "materials": {
                    "pa12_white": {"name": "PA12 (Valkoinen)", "rate": 0.25, "description": "Standardi nailon. Kestävä, hieman karhea pinta. Yleisin protomateriaali."},
                    "pa12_gb":    {"name": "PA12 Glass Beads", "rate": 0.30, "description": "Lasikuulavahvistettu. Jäykkä, kova, kestää lämpöä paremmin."},
                    "pa11_black": {"name": "PA11 (Musta)", "rate": 0.25, "description": "Joustavampi ja iskunkestävämpi kuin PA12. Musta väritys."},
                    "tpu_88a":    {"name": "TPU 88A (Joustava)", "rate": 0.31, "description": "Kumimainen, joustava elastomeeri tiivisteisiin ja pehmusteisiin."}
                }
            },
            "mjf": {
                "name": "MJF (Multi Jet Fusion)",
                "startup": 30.0,
                "volume_factor": 1.0,
                "materials": {
                    "pa12_gray":  {"name": "PA12 (Harmaa/Musta)", "rate": 0.17, "description": "Tiiviimpi ja sileämpi pinta kuin SLS. Mekaanisesti erinomainen."},
                    "pa11":       {"name": "PA11", "rate": 0.16, "description": "Sitkeä, korkea murtovenymä. Saranat ja klipsit."},
                    "pa12_w":     {"name": "PA12 (Valkoinen)", "rate": 0.15, "description": "Värjättävissä oleva MJF-laatu."}
                }
            },
            # --- NESTEPOHJAISET ---
            "sla": {
                "name": "SLA (Stereolitografia)",
                "startup": 35.0,
                "volume_factor": 8.0,
                "materials": {
                    "accura_xtreme": {"name": "ABS-Like (Harmaa)", "rate": 0.38, "description": "Sitkeä, tarkka, muistuttaa ruiskuvalettua ABS-muovia."},
                    "accura_60":     {"name": "PC-Like (Kirkas)", "rate": 0.37, "description": "Läpinäkyvä, kova, muistuttaa polykarbonaattia. Vaatii lakkauksen kirkkaaksi."},
                    "accura_25":     {"name": "PP-Like (Valkoinen)", "rate": 0.39, "description": "Joustava, muistuttaa polypropeenia. Snap-fit liitoksiin."},
                    "ceramic_fill":  {"name": "Keraamivahvisteinen", "rate": 0.48, "description": "Erittäin jäykkä ja kova, kestää korkeita lämpötiloja."}
                }
            },
            "dlp": {
                "name": "DLP (Digital Light Processing)",
                "startup": 37.0,
                "volume_factor": 0.7,
                "materials": {
                    "figure_4_tough": {"name": "Figure 4 Tough", "rate": 0.43, "description": "Nopea tulostus, erinomainen pinnanlaatu ja mittatarkkuus."},
                    "elastomer_blk":  {"name": "Elastomer Black", "rate": 0.39, "description": "Musta kumi, palautuu muotoonsa puristuksen jälkeen."}
                }
            },
            # --- KOMPOSIITTI ---
            "cff": {
                "name": "CFF (Hiilikuituvahvistus)",
                "startup": 40,
                "volume_factor": 0.5, # Usein ei-täyttä, mutta vahvikkeet kalliita
                "materials": {
                    "onyx":        {"name": "Onyx (PA6+CF)", "rate": 0.45, "description": "Mikrohiilikuitutäytteinen nailon. Musta, erinomainen pinnanlaatu."},
                    "onyx_cont_cf":{"name": "Onyx + Continuous CF", "rate": 0.61, "description": "Jatkuva hiilikuituydin. Vastaa lujuudeltaan alumiinia."}
                }
            },
            # --- METALLIT ---
            "dmls": {
                "name": "DMLS (Metallitulostus)",
                "startup": 280.0, 
                "volume_factor": 0.8,
                "materials": {
                    "alsi10mg": {"name": "Alumiini (AlSi10Mg)", "rate": 2.1, "description": "Kevyt, hyvä lämmönjohtavuus. Yleisin metallituloste."},
                    "ss_316l":  {"name": "Ruostumaton (316L)", "rate": 3.2, "description": "Haponkestävä teräs. Elintarvike- ja lääketiedekelpoinen."},
                    "ti64":     {"name": "Titaani (Ti64)", "rate": 5.9, "description": "Ilmailu- ja implanttilaatu. Erinomainen lujuus-painosuhde."},
                    "inconel":  {"name": "Inconel 718", "rate": 5.3, "description": "Korkean lämpötilan superseos turbiineihin ja moottoreihin."}
                }
            }
        }
    },
    "rapid_casting": {
        "label": "Pikavalutekniikat",
        "methods": {
            "vacuum_casting": {
                "name": "Vakuumivalu (Silikonimuotti)",
                "startup": 320.0,
                "volume_factor": 1.0,
                "materials": {
                    "px_205":    {"name": "PX 205 (ABS-imitaatio)", "rate": 0.1, "description": "Yleisin valumateriaali. Hyvä iskunkestävyys."},
                    "px_5210":   {"name": "PX 5210 (PC-imitaatio)", "rate": 0.12, "description": "Kirkas materiaali, valaisimiin ja linsseihin."},
                    "up_x8400":  {"name": "UP X8400 (PP-imitaatio)", "rate": 0.1, "description": "Sitkeä ja joustava."},
                    "elastomer": {"name": "PU Kumi (40-90 Shore A)", "rate": 0.13, "description": "Säädettävä kovuus, tiivisteet ja pehmeät osat."}
                }
            },
            "rim": {
                "name": "RIM-valu (Reaction Injection)",
                "startup": 750.0,
                "volume_factor": 1.0,
                "materials": {
                    "rim_pu_rigid": {"name": "Jäykkä RIM-PU", "rate": 0.08, "description": "Suurille koteloille ja puskureille. Iskunkestävä."},
                    "rim_pu_foam":  {"name": "RIM Vaahto", "rate": 0.09, "description": "Integraalivaahto, kevyt ja jäykkä kuori."}
                }
            },
            "rtv": {
                "name": "RTV-silikonivalu",
                "startup": 180.0,
                "volume_factor": 1.0,
                "materials": {
                    "silicone_med": {"name": "Lääketieteellinen Silikoni", "rate": 0.33, "description": "Bioyhteensopiva, pehmeä."},
                    "silicone_ind": {"name": "Teollisuussilikoni", "rate": 0.18, "description": "Muotteihin ja tiivisteisiin."}
                }
            },
            "investment_casting": {
                "name": "Tarkkuusvalu (Investment Casting)",
                "startup": 550.0,
                "volume_factor": 1.0,
                "materials": {
                    "bronze": {"name": "Pronssi", "rate": 3, "description": "Taide-esineet, liukulaakerit."},
                    "steel":  {"name": "Teräs", "rate": 3.2, "description": "Koneenosat, joilla monimutkainen geometria."}
                }
            }
        }
    },
    "other": {
        "label": "Muut tekniikat",
        "methods": {
            "injection_molding": {
                "name": "Ruiskuvalu (Protomuotti)",
                "startup": 2500.0,
                "volume_factor": 1.0,
                "materials": {
                    "abs":  {"name": "ABS", "rate": 0.01, "description": "Perusmuovi, edullinen ja kestävä."},
                    "pc":   {"name": "Polykarbonaatti (PC)", "rate": 0.02, "description": "Iskunkestävä, läpinäkyvä."},
                    "pom":  {"name": "POM (Asetaali)", "rate": 0.023, "description": "Liukas, kova, hammaspyörät."},
                    "pa66": {"name": "PA66 (Nailon)", "rate": 0.02, "description": "Mekaanisesti luja, kestää lämpöä."}
                }
            },
            "lsr": {
                "name": "LSR (Nestesilikonivalu)",
                "startup": 3200.0,
                "volume_factor": 1.0,
                "materials": {
                    "lsr_50": {"name": "LSR 50 Shore A", "rate": 0.10, "description": "Elintarvikekelpoinen silikoni massatuotantoon."}
                }
            },
            "cnc": {
                "name": "CNC-koneistus",
                "startup": 60.0,
                "volume_factor": 2.0, 
                "materials": {
                    "alu_6061":  {"name": "Alumiini 6061-T6", "rate": 1.00, "description": "Yleisin alumiinilaatu. Hyvä korroosionkesto."},
                    "alu_7075":  {"name": "Alumiini 7075", "rate": 1.20, "description": "Lentokonealumiini, erittäin luja."},
                    "steel_304": {"name": "RST 304", "rate": 1.30, "description": "Ruostumaton teräs, vaikeampi koneistaa."},
                    "pom_c":     {"name": "POM-C (Muovi)", "rate": 0.3, "description": "Tekninen muovi, mittatarkka."}
                }
            }
        }
    }
}