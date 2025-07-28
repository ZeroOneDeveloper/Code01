FROM gcc:latest

RUN apt-get update && \
    apt-get install -y time && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app