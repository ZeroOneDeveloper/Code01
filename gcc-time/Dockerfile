# gcc-time/Dockerfile
FROM debian:bookworm-slim

# build-essential: gcc, g++, make, libc6-dev 포함
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    bash \
    time \
    coreutils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
CMD ["bash"]
