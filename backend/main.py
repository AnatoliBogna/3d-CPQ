from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import trimesh
import numpy as np
import os
import uuid
import shutil

# TUODAAN MATERIAALIKIRJASTO
from materials import TECHNOLOGIES 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://caari.fi", "https://www.caari.fi"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- KONFIGURAATIO ---
UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- APUFUNKTIOT ---
def remove_file(path: str):
    """Tuhoaa tiedoston levyltä analyysin jälkeen"""
    try:
        if os.path.exists(path):
            os.remove(path)
            print(f"Siivous: Poistettu {path}")
    except Exception as e:
        print(f"Virhe tiedoston poistossa: {e}")

# --- TIETOMALLIT ---
class QuoteRequest(BaseModel):
    filename: str
    technology: str
    material: str
    finish: str
    delivery: str
    quantity: int
    estimated_price: float
    name: str
    company: Optional[str] = None
    email: str
    phone: str
    surface_structure: Optional[str] = None
    color_request: Optional[str] = None
    application_use: Optional[str] = None
    additional_notes: Optional[str] = None

# --- ENDPOINTIT ---

@app.post("/analyze")
async def analyze_model(
    background_tasks: BackgroundTasks, # FastAPI:n taustaprosessi
    file: UploadFile = File(...)
):
    allowed_extensions = ('.stl', '.STL', '.obj', '.OBJ', '.3mf', '.3MF')
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Tuetut tiedostot: STL, OBJ, 3MF")

    # 1. Luodaan uniikki tiedostonimi ja polku
    file_ext = file.filename.split('.')[-1].lower()
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        # 2. Tallennetaan tiedosto levylle (säästää RAM-muistia)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 3. Määritetään automaattinen poisto heti vastauksen jälkeen
        background_tasks.add_task(remove_file, file_path)

        # 4. Ladataan Trimesh suoraan levyltä
        mesh = trimesh.load(file_path, file_type=file_ext)
        
        if isinstance(mesh, trimesh.Scene):
            if len(mesh.geometry) == 0: raise ValueError("Tyhjä tiedosto")
            mesh = trimesh.util.concatenate(tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values()))

        volume_cm3 = mesh.volume / 1000 
        bbox = mesh.bounding_box.extents
        
        # --- LASKENTA ---
        estimates = {}
        for category_key, category in TECHNOLOGIES.items():
            for tech_key, tech in category['methods'].items():
                tech_estimates = {}
                
                startup_fee = tech['startup']
                
                # Haetaan tekniikkakohtainen tilavuuskerroin
                vol_factor = tech.get('volume_factor', 1.0)
                
                for mat_key, mat in tech['materials'].items():
                    
                    # Lasketaan "todellinen" materiaalin kulutus
                    # FDM: 100cm3 kappale -> maksetaan vain 40cm3 edestä materiaalia
                    # CNC: 100cm3 kappale -> maksetaan 250cm3 edestä materiaalia (aihio)
                    effective_volume = volume_cm3 * vol_factor
                    
                    material_cost = effective_volume * mat['rate']
                    total_cost = material_cost + startup_fee
                    
                    tech_estimates[mat_key] = {
                        "name": mat['name'],
                        "tech_name": tech['name'],
                        "unit_price": round(total_cost, 2),
                        "description": mat['description'],
                        "breakdown": {
                            "startup_fee": round(startup_fee, 2),
                            "material_rate": mat['rate'],
                            "material_cost": round(material_cost, 2),
                            "volume": round(volume_cm3, 2),
                            "charged_volume": round(effective_volume, 2), # Debuggausta varten hyödyllinen
                            "technology": tech['name']
                        }
                    }
                estimates[tech_key] = tech_estimates

        return {
            "filename": file.filename,
            "geometry": {
                "volume_cm3": round(volume_cm3, 2),
                "dimensions_mm": {
                    "x": round(bbox[0], 1), "y": round(bbox[1], 1), "z": round(bbox[2], 1)
                }
            },
            "estimates": estimates,
            "structure": TECHNOLOGIES,
            "defaults": {"tech": "sls", "mat": "pa12_white"}
        }

    except Exception as e:
        # Jos jotain menee pieleen, yritetään poistaa tiedosto heti
        remove_file(file_path)
        print(f"Virhe: {e}")
        return {"error": "Analyysi epäonnistui."}

@app.post("/send-quote")
async def send_quote(request: QuoteRequest):
    print("--- UUSI TARJOUSPYYNTÖ ---")
    print(f"Asiakas: {request.name} ({request.company})")
    print(f"Email: {request.email}, Puh: {request.phone}")
    print(f"Kappale: {request.filename}, Määrä: {request.quantity}")
    print(f"Tekniikka: {request.technology}, Materiaali: {request.material}")
    print(f"Lisätiedot: Pinta: {request.surface_structure}, Väri: {request.color_request}")
    print(f"Viesti: {request.additional_notes}")
    print("--------------------------")
    return {"message": "Tarjouspyyntö vastaanotettu onnistuneesti."}

@app.get("/")
def read_root():
    return {"status": "Backend is running"}