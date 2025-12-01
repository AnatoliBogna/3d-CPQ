from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import trimesh
import io
import numpy as np

# TUODAAN MATERIAALIKIRJASTO
from materials import TECHNOLOGIES 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- TIETOMALLIT ---
class QuoteRequest(BaseModel):
    # Tilaustiedot
    filename: str
    technology: str
    material: str
    finish: str
    delivery: str
    quantity: int
    estimated_price: float
    # Asiakastiedot
    name: str
    company: Optional[str] = None
    email: str
    phone: str
    # Lisätiedot
    surface_structure: Optional[str] = None
    color_request: Optional[str] = None
    application_use: Optional[str] = None
    additional_notes: Optional[str] = None

# --- ENDPOINTIT ---

@app.post("/analyze")
async def analyze_model(file: UploadFile = File(...)):
    allowed_extensions = ('.stl', '.STL', '.obj', '.OBJ', '.3mf', '.3MF')
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Tuetut tiedostot: STL, OBJ, 3MF")

    try:
        content = await file.read()
        file_obj = io.BytesIO(content)
        file_ext = file.filename.split('.')[-1].lower()
        
        mesh = trimesh.load(file_obj, file_type=file_ext)
        if isinstance(mesh, trimesh.Scene):
            if len(mesh.geometry) == 0: raise ValueError("Tyhjä tiedosto")
            mesh = trimesh.util.concatenate(tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values()))

        volume_cm3 = mesh.volume / 1000 
        bbox = mesh.bounding_box.extents
        
        # --- LASKENTA (Käyttää importattua TECHNOLOGIES-kirjastoa) ---
        estimates = {}
        for category_key, category in TECHNOLOGIES.items():
            for tech_key, tech in category['methods'].items():
                tech_estimates = {}
                startup_fee = tech['startup']
                for mat_key, mat in tech['materials'].items():
                    waste_factor = 2.5 if tech_key == 'cnc' else 1.0
                    material_cost = volume_cm3 * mat['rate'] * waste_factor
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