"""
Serviço de transcrição do Flowalt (faster-whisper em CPU).

Recebe o endereço de um arquivo de áudio/vídeo (URL assinada do armazenamento), baixa, transcreve
e devolve o texto com os trechos. Só roda uma transcrição por vez para não disputar CPU com os
outros projetos da máquina. Não tem porta publicada: só é alcançável pela rede interna do Docker.
"""
import os
import tempfile
import threading
import time

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from faster_whisper import WhisperModel

MODELO = os.environ.get("WHISPER_MODEL", "small")
THREADS = int(os.environ.get("WHISPER_THREADS", "4"))
LIMITE_BYTES = int(os.environ.get("WHISPER_MAX_MB", "300")) * 1024 * 1024

app = FastAPI()
_trava = threading.Lock()
_modelo = None


def modelo():
    global _modelo
    if _modelo is None:
        _modelo = WhisperModel(MODELO, device="cpu", compute_type="int8", cpu_threads=THREADS, download_root="/models")
    return _modelo


class Pedido(BaseModel):
    url: str
    language: str | None = "pt"


@app.get("/health")
def health():
    return {"ok": True, "modelo": MODELO, "threads": THREADS}


@app.post("/transcribe")
def transcrever(p: Pedido):
    inicio = time.time()
    with tempfile.NamedTemporaryFile(suffix=".bin") as tmp:
        total = 0
        try:
            with httpx.stream("GET", p.url, timeout=60, follow_redirects=True) as r:
                if r.status_code != 200:
                    raise HTTPException(400, f"Não consegui baixar o arquivo (HTTP {r.status_code})")
                for pedaco in r.iter_bytes(1024 * 256):
                    total += len(pedaco)
                    if total > LIMITE_BYTES:
                        raise HTTPException(413, "Arquivo grande demais")
                    tmp.write(pedaco)
        except httpx.HTTPError as e:
            raise HTTPException(400, f"Falha ao baixar: {e}")
        tmp.flush()

        with _trava:
            trechos, info = modelo().transcribe(
                tmp.name, language=p.language, vad_filter=True, beam_size=1, condition_on_previous_text=False
            )
            lista = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in trechos]

    texto = " ".join(t["text"] for t in lista).strip()
    return {
        "text": texto,
        "language": info.language,
        "duration": round(info.duration, 2),
        "segments": lista,
        "seconds": round(time.time() - inicio, 2),
    }
