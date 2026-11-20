#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
command -v docker >/dev/null 2>&1 || { echo 'Instale o Docker com o plugin Compose.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Inicie o mecanismo Docker e tente novamente.' >&2; exit 1; }
if [ ! -f .env ]; then
  password="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  (umask 077; printf 'ARTEX_TAG=local\nPOSTGRES_USER=artex\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=artex\nANTHROPIC_API_KEY=\nOPENAI_API_KEY=\n' "$password" > .env)
  echo 'Configuração local criada com senha de banco aleatória.'
fi
docker compose up --build -d
echo 'Acesse http://localhost:8787 e siga os Primeiros passos.'
