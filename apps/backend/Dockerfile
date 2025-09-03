# Dockerfile (backend/Dockerfile)
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps + Docker CLI (client only) + build tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       apt-transport-https ca-certificates curl gnupg lsb-release \
       gcc time \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001
# Note: Access to Docker requires mounting /var/run/docker.sock at runtime.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]