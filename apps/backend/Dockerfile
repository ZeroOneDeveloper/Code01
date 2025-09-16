FROM python:3.13

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN echo "deb http://deb.debian.org/debian trixie main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian trixie-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security trixie-security main contrib non-free" >> /etc/apt/sources.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    fakeroot \
    sudo \
    git \
    gcc \
    g++ \
    default-jdk-headless \
    nodejs \
    npm \
    golang \
    rustc \
    libcap-dev \
    libseccomp-dev \
    libsystemd-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/google/nsjail.git /opt/nsjail && \
    cd /opt/nsjail && \
    make

WORKDIR /app
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]