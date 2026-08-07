from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DrogueriAPP - Sistema de Pendientes")

# Configuración de Supabase
url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(url, key) if url and key else None

# Modelos de Datos (Pydantic)
class PendienteCreate(BaseModel):
    codigo_articulo: str
    nombre_articulo: str
    centro_nombre: str
    stock: int
    consumo: int
    pedido: int
    entrega: int

@app.get("/")
def health():
    return {"status": "online", "app": "DrogueriAPP Backend"}

# --- RUTAS DE GESTIÓN DE CENTROS ---

@app.get("/centros")
def listar_centros():
    res = supabase.table("centros").select("*").order("nombre").execute()
    return res.data

@app.post("/centros")
def crear_centro(nombre: str):
    res = supabase.table("centros").insert({"nombre": nombre.upper()}).execute()
    return res.data

@app.put("/centros/{centro_id}")
def editar_centro(centro_id: int, nuevo_nombre: str):
    res = supabase.table("centros").update({"nombre": nuevo_nombre.upper()}).eq("id", centro_id).execute()
    return res.data

@app.delete("/centros/{centro_id}")
def eliminar_centro(centro_id: int):
    res = supabase.table("centros").delete().eq("id", centro_id).execute()
    return {"status": "deleted", "id": centro_id}

# --- RUTAS DE NEGOCIO ---

@app.get("/articulos/buscar/{codigo}")
def buscar_articulo(codigo: str):
    """Busca un artículo por su código para autocompletar el formulario"""
    res = supabase.table("farmacos y DM").select("*").eq("codigo", codigo).limit(1).execute()
    return res.data

@app.post("/pendientes/registrar")
def registrar_pendiente(data: PendienteCreate):
    """Registra un nuevo pendiente, creando el centro si no existe"""
    try:
        # 1. Asegurar que el centro existe
        centro_res = supabase.table("centros").select("id").eq("nombre", data.centro_nombre).execute()
        if not centro_res.data:
            centro_res = supabase.table("centros").insert({"nombre": data.centro_nombre}).execute()
        centro_id = centro_res.data[0]['id']

        # 2. Asegurar que el artículo existe en la tabla de farmacos y DM (si no, lo registramos con cantidad 0)
        art_res = supabase.table("farmacos y DM").select("codigo").eq("codigo", data.codigo_articulo).limit(1).execute()
        if not art_res.data:
            supabase.table("farmacos y DM").insert({
                "codigo": data.codigo_articulo,
                "descripcion": data.nombre_articulo,
                "cantidad": 0,
                "lote": "S/L",
                "estado": "VIGENTE"
            }).execute()

        # 3. Registrar el pendiente (usando codigo_articulo directamente)
        pendiente_data = {
            "codigo_articulo": data.codigo_articulo,
            "centro_id": centro_id,
            "stock": data.stock,
            "consumo": data.consumo,
            "pedido": data.pedido,
            "entrega": data.entrega
        }
        res = supabase.table("pendientes").insert(pendiente_data).execute()
        return {"status": "success", "data": res.data[0]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reportes/jefatura")
def obtener_reporte_pendientes():
    """Reporte detallado de pendientes por artículo y centro"""
    # Consulta con JOIN a centros, utilizando codigo_articulo de pendientes
    res = supabase.table("pendientes") \
        .select("id, stock, consumo, pedido, entrega, pendiente, fecha, codigo_articulo, centros(nombre)") \
        .order("fecha", desc=True) \
        .execute()
    return res.data
