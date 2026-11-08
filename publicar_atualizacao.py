import os
import json
import base64
import datetime
import subprocess
import urllib.request

REPO_DIR = os.path.dirname(os.path.abspath(__file__))

def update_version():
    v_path = os.path.join(REPO_DIR, "version.json")
    now_str = datetime.datetime.now().isoformat()
    data = {
        "version": "1.0." + datetime.datetime.now().strftime("%Y%m%d%H%M%S"),
        "updated_at": now_str,
        "description": "Motor Unificado de Templates Anki (Tripla Blindagem)"
    }
    with open(v_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[1/3] version.json atualizado ({data['version']})")

def sync_to_anki_media():
    try:
        for src_name, dst_name in [("estilo.css", "_anki_estilo.css"), ("scripts.js", "_anki_scripts.js")]:
            src_path = os.path.join(REPO_DIR, src_name)
            with open(src_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            req = urllib.request.Request(
                "http://127.0.0.1:8765",
                json.dumps({
                    "action": "storeMediaFile",
                    "version": 6,
                    "params": {"filename": dst_name, "data": b64}
                }).encode("utf-8")
            )
            urllib.request.urlopen(req, timeout=3).read()
        print("[2/3] Arquivos _anki_estilo.css e _anki_scripts.js sincronizados na pasta de mídia do Anki!")
    except Exception as e:
        print(f"[2/3] Aviso: Anki Desktop fechado ou AnkiConnect indisponível ({e}). Pulando cópia local.")

def push_to_github():
    print("[3/3] Enviando atualização para o GitHub Pages...")
    subprocess.run(["git", "add", "estilo.css", "scripts.js", "version.json", "README.md"], cwd=REPO_DIR, check=False)
    msg = f"Atualizacao de template ({datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')})"
    subprocess.run(["git", "commit", "-m", msg], cwd=REPO_DIR, check=False)
    res = subprocess.run(["git", "push", "origin", "main"], cwd=REPO_DIR, check=False)
    if res.returncode == 0:
        print("\n✅ SUCESSO! Atualização publicada no GitHub Pages!")
    else:
        print("\n⚠️ Verifique a conexão ou autenticação do Git.")

if __name__ == "__main__":
    update_version()
    sync_to_anki_media()
    push_to_github()
