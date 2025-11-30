from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import trimesh
import io
import shutil

app = FastAPI()

# Salli liikenne frontendistä (React pyörii oletuksena portissa 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_model(file: UploadFile = File(...)):
    # 1. Hyväksy laajemmat päätteet
    allowed_extensions = ('.stl', '.STL', '.obj', '.OBJ', '.3mf', '.3MF')
    
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail=f"Tuetut tiedostot: STL, OBJ, 3MF")

    try:
        content = await file.read()
        file_obj = io.BytesIO(content)
        
        # 2. Määritä tiedostotyyppi trimeshille
        file_ext = file.filename.split('.')[-1].lower()
        
        # Trimesh lataa objektin
        # Huom: 3MF/OBJ voi sisältää "Scenen" (useita kappaleita), ei vain yhtä "Meshiä".
        mesh = trimesh.load(file_obj, file_type=file_ext)
        
        # Jos tiedosto on Scene (useita objekteja), yhdistetään ne yhdeksi laskentaa varten
        if isinstance(mesh, trimesh.Scene):
            # Dumpataan kaikki geometria yhteen
            if len(mesh.geometry) == 0:
                 raise ValueError("Tiedosto on tyhjä")
            mesh = trimesh.util.concatenate(
                tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values())
            )

        # Laskenta (sama kuin ennen)
        volume_cm3 = mesh.volume / 1000 
        bbox = mesh.bounding_box.extents
        
        # HINNOTTELU
        material_cost = volume_cm3 * 0.10
        base_fee = 3.5
        total_price = material_cost + base_fee

        return {
            "filename": file.filename,
            "volume_cm3": round(volume_cm3, 2),
            "dimensions_mm": {
                "x": round(bbox[0], 1),
                "y": round(bbox[1], 1),
                "z": round(bbox[2], 1)
            },
            "estimated_price_eur": round(total_price, 2)
        }

    except Exception as e:
        print(f"Virhe: {e}") # Debuggausta varten konsoliin
        return {"error": "Tiedoston luku epäonnistui. Varmista että tiedosto on ehjä 3D-malli."}

@app.get("/")
def read_root():
    return {"status": "Backend is running"}