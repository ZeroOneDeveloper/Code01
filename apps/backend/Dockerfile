FROM python:3.11-slim

# 필수 패키지 설치
RUN apt update && apt install -y \
    build-essential \
    git \
    python3 \
    python3-pip \
    python3-venv \
    flex \
    bison \
    libprotobuf-dev \
    protobuf-compiler \
    libnl-3-dev \
    libnl-route-3-dev \
    pkg-config

# nsjail 다운로드 및 빌드 (이제 Piston을 사용하므로 이 부분은 제거해도 괜찮습니다)
RUN git clone https://github.com/google/nsjail.git /opt/nsjail && \
    cd /opt/nsjail && \
    make && \
    cp nsjail /usr/local/bin/nsjail

# 작업 디렉토리 설정
WORKDIR /app

# 캐시 효율을 위해 requirements.txt를 먼저 복사하고 패키지를 설치합니다.
COPY requirements.txt .
RUN pip install -r requirements.txt

# 나머지 소스 코드를 복사합니다.
COPY . .

CMD ["python", "main.py"]