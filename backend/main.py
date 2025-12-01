from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import Optional
import trimesh
import numpy as np
import os
import uuid
import shutil
import time
import threading
import glob

# Tuodaan materiaalikirjasto
from materials import TECHNOLOGIES 

# --- KONFIGURAATIO ---
UPLOAD_DIR = "temp_uploads"

# --- ELINKAARIHALLINTA (LIFESPAN) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Käynnistys: Siivotaan vanhat roskat
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
    else:
        files = glob.glob(os.path.join(UPLOAD_DIR, "*"))
        for f in files:
            try:
                os.remove(f)
            except Exception:
                pass
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://caari.fi", "https://www.caari.fi"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tarjoillaan temp-kansio julkisesti (GLB-tiedostoja varten)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

# --- APUFUNKTIOT ---
def delayed_remove_file(path: str, delay: int = 60):
    """Poistaa tiedoston viiveellä (jotta frontend ehtii ladata sen)."""
    def _remove():
        time.sleep(delay)
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print(f"Virhe poistossa: {e}")
    
    thread = threading.Thread(target=_remove)
    thread.daemon = True
    thread.start()

def get_smart_volume(mesh):
    """Laskee tilavuuden ja korjaa yleisimmät geometriavirheet."""
    # Skaalaus jos yksiköt pielessä (oletetaan metrit -> millimetrit)
    if np.max(mesh.extents) < 2.0: 
        mesh.apply_scale(1000)
    
    try:
        mesh.merge_vertices()
    except:
        pass
    
    if mesh.is_watertight:
        return mesh.volume / 1000.0
    else:
        try:
            return mesh.convex_hull.volume / 1000.0
        except:
            return (mesh.bounding_box.volume * 0.5) / 1000.0

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
async def analyze_model(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # 1. Validointi
    allowed_extensions = ('.stl', '.STL', '.obj', '.OBJ', '.3mf', '.3MF', '.step', '.STEP', '.stp', '.STP')
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Tuetut tiedostot: STL, OBJ, 3MF, STEP")

    file_ext = file.filename.split('.')[-1].lower()
    unique_id = uuid.uuid4()
    unique_filename = f"{unique_id}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        # 2. Tallennus levylle
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 3. Lataus (Trimesh / Meshio fallback)
        mesh = None
        try:
            mesh = trimesh.load(file_path, file_type=file_ext)
        except Exception:
            pass # Yritetään plan B

        if mesh is None or (isinstance(mesh, trimesh.Scene) and len(mesh.geometry) == 0):
            try:
                import meshio
                mesh_data = meshio.read(file_path)
                mesh = trimesh.Trimesh(vertices=mesh_data.points, faces=mesh_data.cells[0].data)
            except Exception as e:
                raise ValueError(f"Tiedoston luku epäonnistui: {str(e)}")

        if isinstance(mesh, trimesh.Scene):
            if len(mesh.geometry) == 0: raise ValueError("Tiedosto on tyhjä.")
            mesh = trimesh.util.concatenate(tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values()))

        # 4. Visualisointi (STEP -> GLB muunnos)
        visualization_url = None
        try:
            glb_filename = f"{unique_id}.glb"
            glb_path = os.path.join(UPLOAD_DIR, glb_filename)
            mesh.export(glb_path)
            # TUOTANNOSSA: Vaihda domain oikeaksi!
            visualization_url = f"http://127.0.0.1:8000/files/{glb_filename}"
            delayed_remove_file(glb_path, delay=60)
        except Exception as e:
            print(f"GLB-vienti epäonnistui: {e}")

        # 5. Laskenta
        volume_cm3 = get_smart_volume(mesh)
        bbox = mesh.bounding_box.extents
        
        estimates = {}
        for category_key, category in TECHNOLOGIES.items():
            for tech_key, tech in category['methods'].items():
                tech_estimates = {}
                startup_fee = tech['startup']
                vol_factor = tech.get('volume_factor', 1.0)

                for mat_key, mat in tech['materials'].items():
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
                            "technology": tech['name']
                        }
                    }
                estimates[tech_key] = tech_estimates

        return {
            "filename": file.filename,
            "visualization_url": visualization_url,
            "geometry": {
                "volume_cm3": round(volume_cm3, 2),
                "dimensions_mm": {"x": round(bbox[0], 1), "y": round(bbox[1], 1), "z": round(bbox[2], 1)}
            },
            "estimates": estimates,
            "structure": TECHNOLOGIES,
            "defaults": {"tech": "sls", "mat": "pa12_white"}
        }

    except Exception as e:
        print(f"Virhe: {e}")
        return {"error": f"Analyysi epäonnistui: {str(e)}"}
    
    finally:
        # 6. Siivous: Alkuperäinen tiedosto poistetaan AINA heti
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass

@app.post("/send-quote")
async def send_quote(request: QuoteRequest):
    # TODO: Kytke sähköpostipalvelu tähän
    print(f"TARJOUS: {request.name} - {request.filename} ({request.estimated_price}€)")
    return {"message": "OK"}

@app.get("/")
def read_root():
    return {"status": "Backend is running"}