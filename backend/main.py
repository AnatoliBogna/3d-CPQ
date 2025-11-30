from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import trimesh
import io
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://caari.fi", "https://www.caari.fi"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MATERIAALIKIRJASTO ---
MATERIALS = {
    "pla": {
        "name": "PLA (Perusmuovi)", 
        "description": "Edullinen ja nopea, sopii prototyyppeihin.",
        "rate": 0.25, 
        "startup": 5.0
    },
    "petg": {
        "name": "PETG (Tekninen)", 
        "description": "Iskunkestävä ja vahva, hyvä yleismateriaali.",
        "rate": 0.35, 
        "startup": 8.0
    },
    "tpu95": {
        "name": "TPU 95A (Joustava)", 
        "description": "Kumimainen ja joustava, kestää kulutusta.",
        "rate": 0.50, 
        "startup": 12.0
    },
    "pa12": {
        "name": "Nylon PA12 (Kestävä kulutukseen)", 
        "description": "Teollinen laatu, tarkka ja kestävä. Ei tukirakenteita.",
        "rate": 0.80, 
        "startup": 15.0
    },
    "aluminum": {
        "name": "Alumiini (Metalli)", 
        "description": "Kevyt ja luja metalliosa, lopputuotteisiin.",
        "rate": 6.50, 
        "startup": 80.0
    },
    "titanium": {
        "name": "Titaani (Ti6Al4V)", 
        "description": "Äärimmäinen lujuus ja keveys, vaativaan käyttöön.",
        "rate": 14.00, 
        "startup": 120.0
    },
}

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
            if len(mesh.geometry) == 0:
                 raise ValueError("Tiedosto on tyhjä")
            mesh = trimesh.util.concatenate(
                tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values())
            )

        volume_cm3 = mesh.volume / 1000 
        bbox = mesh.bounding_box.extents
        
        # LASKENTA JA ERITTELY
        price_options = {}
        for key, mat in MATERIALS.items():
            material_cost = volume_cm3 * mat['rate']
            startup_fee = mat['startup']
            total_cost = material_cost + startup_fee
            
            price_options[key] = {
                "name": mat['name'],
                "description": mat['description'],
                "total_price": round(total_cost, 2),
                "breakdown": {
                    "startup_fee": round(startup_fee, 2),
                    "material_rate": mat['rate'],
                    "material_cost": round(material_cost, 2),
                    "volume": round(volume_cm3, 2)
                }
            }

        return {
            "filename": file.filename,
            "geometry": {
                "volume_cm3": round(volume_cm3, 2),
                "dimensions_mm": {
                    "x": round(bbox[0], 1),
                    "y": round(bbox[1], 1),
                    "z": round(bbox[2], 1)
                }
            },
            "estimates": price_options,
            "default_material": "pla"
        }

    except Exception as e:
        print(f"Virhe: {e}")
        return {"error": "Analyysi epäonnistui."}

@app.get("/")
def read_root():
    return {"status": "Backend is running"}