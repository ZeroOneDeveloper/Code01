FROM node:22-bullseye

# Install required system packages
RUN apt update && apt install -y \
    curl \
    git \
    python3 \
    python3-pip \
    build-essential \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone piston repository
RUN git clone https://github.com/engineer-man/piston.git .

# Install dependencies for API and CLI
WORKDIR /app/cli
RUN npm install

WORKDIR /app/packages/api
RUN npm install

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose API port
EXPOSE 2000

# Start with custom entrypoint
CMD ["/entrypoint.sh"]
