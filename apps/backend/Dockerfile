# 1. 기반 이미지를 slim에서 일반 버전으로 변경하여 빌드 도구를 설치하기 쉽게 합니다.
FROM python:3.13

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 2. apt 소스 리스트를 종합적인 버전으로 덮어쓰기
RUN echo "deb http://deb.debian.org/debian trixie main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian trixie-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security/ trixie-security main contrib non-free" >> /etc/apt/sources.list

# 3. 컴파일러, isolate 빌드 도구, sudo 등 필수 패키지 설치
RUN echo "deb http://deb.debian.org/debian trixie main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian trixie-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security/ trixie-security main contrib non-free" >> /etc/apt/sources.list

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
    && rm -rf /var/lib/apt/lists/*

# Add missing dependencies for isolate build
RUN apt-get update && apt-get install -y libcap-dev libseccomp-dev pkg-config

# Add missing systemd development headers for isolate build
RUN apt-get update && apt-get install -y libsystemd-dev

# 4. isolate 소스 코드를 클론하고 빌드
RUN git clone https://github.com/ioi/isolate.git /opt/isolate
WORKDIR /opt/isolate
RUN make install

# 5. isolate 샌드박스 초기화
RUN groupadd -g 1337 isolate_box && \
    useradd -u 1337 -g 1337 -d /var/local/lib/isolate -m -s /bin/bash isolate_box
RUN echo "ALL ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
RUN sudo /opt/isolate/isolate --init

# 6. 애플리케이션 코드를 복사하고 의존성 설치
WORKDIR /app
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 3001

# 7. 애플리케이션 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
