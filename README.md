# Anki Templates Engine (Tripla Blindagem)

Repositório oficial do motor visual e interativo para os cartões do modelo **`Disciplina | Assunto | Certo ou Errado`** (Anki Desktop & AnkiDroid).

## Arquitetura de Tripla Blindagem (Zero Conflito `Modelo+`)

O código interno do modelo no Anki permanece **100% congelado** (apenas a casca de dados brutos), impedindo que a importação de novos pacotes `.apkg` gere modelos duplicados com sinal de `+`.

1. **Camada 1 — Offline Nativo Imediato (`collection.media`):**
   - `_anki_estilo.css` e `_anki_scripts.js` viajam embutidos dentro do `.apkg`.
   - Permite uso 100% offline desde o primeiro segundo, mesmo sem nunca ter conectado à internet.
2. **Camada 2 — Cache Síncrono Instantâneo (`localStorage`):**
   - Armazena a versão mais recente baixada da nuvem no navegador interno do Anki (`anki_tpl_css_v1` e `anki_tpl_js_v1`), aplicando estilos e scripts em `0ms` sem *flash* de tela.
3. **Camada 3 — Auto-Update Silencioso via GitHub Pages (CDN):**
   - URLs oficiais:
     - `https://gilsonnogueira.github.io/anki-templates/estilo.css`
     - `https://gilsonnogueira.github.io/anki-templates/scripts.js`
   - Qualquer melhoria publicada neste repositório propaga-se automaticamente para o Anki Desktop e AnkiDroid dos alunos assim que estiverem online.

## Como Publicar Atualizações de Visual ou Scripts

1. Edite `estilo.css` ou `scripts.js` nesta pasta (`C:\Users\USER\Documents\anki-templates`).
2. Dê dois cliques em **`publicar_atualizacao.bat`** (ou execute `python publicar_atualizacao.py`).
   - O script atualiza automaticamente os arquivos `_anki_estilo.css` e `_anki_scripts.js` no seu Anki local e faz o `git commit` + `git push` para o GitHub Pages!
