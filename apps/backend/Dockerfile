FROM python:3.11-slim

# 필수 패키지 설치 (불필요한 패키지 제거)
RUN apt update && apt install -y \
    build-essential \
    git \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# requirements 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스코드 복사
COPY . .

# Piston API를 호출하는 백엔드 실행
CMD ["python", "main.py"]
