FROM python:3.11-slim

WORKDIR /app

# Installe les dépendances système pour psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Installe les dépendances Python en premier (layer cacheable)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie le code (écrasé par le volume en dev)
COPY . .

# Lance les migrations puis démarre uvicorn avec --reload
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
