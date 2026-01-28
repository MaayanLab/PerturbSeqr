FROM postgres:17.2

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    postgresql-plpython3-17 \
    python3 \
    python3-pip \
  && pip install --no-cache-dir --break-system-packages requests==2.32.3 \
  && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint-initdb.d /docker-entrypoint-initdb.d
