# 🚀 Code01 - Online Judge Platform

Code01은 프로그래밍 문제를 만들고, 관리하며, 사용자들이 코드를 제출하여 채점받을 수 있는 온라인 저지(Online Judge) 플랫폼입니다.

## ✨ 주요 기능

- **사용자 인증**: 회원가입 및 로그인 기능을 통해 개인화된 경험을 제공합니다.
- **조직(Organization) 관리**: 조직을 생성하고, 조직별로 문제 및 퀴즈를 관리할 수 있습니다.
- **문제 및 퀴즈 출제**: 관리자는 새로운 프로그래밍 문제와 퀴즈를 생성할 수 있습니다.
- **코드 제출 및 채점**: 사용자는 문제에 대한 코드를 제출하고, 실행 엔진을 통해 실시간으로 채점 결과를 확인할 수 있습니다.
- **제출 내역 확인**: 문제별, 사용자별 제출 기록을 조회하고 관리할 수 있습니다.

## 🔧 기술 스택

이 프로젝트는 세 가지 주요 서비스로 구성된 마이크로서비스 아키텍처를 따릅니다.

- **Frontend**:
  - **Framework**: Next.js (React)
  - **Language**: TypeScript
  - **Styling**: Tailwind CSS

- **Backend**:
  - **Language**: Python
  - **Framework**: FastAPI

- **Code Execution Engine**:
  - **Engine**: Piston
  - **Environment**: Docker

- **Orchestration**:
  - **Tool**: Docker Compose

## 🚀 시작하기

Docker와 Docker Compose가 설치되어 있어야 합니다.

1.  **프로젝트 클론**
    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd Code01
    ```

2.  **애플리케이션 실행**
    아래 명령어는 `frontend`, `backend`, `piston` 서비스의 Docker 이미지를 빌드하고 컨테이너를 실행합니다.

    ```bash
    docker-compose up --build
    ```

    백그라운드에서 실행하려면 `-d` 플래그를 추가하세요.
    ```bash
    docker-compose up --build -d
    ```

3.  **서비스 접속**
    - **웹사이트**: [http://localhost:3000](http://localhost:3000)
    - **백엔드 API**: [http://localhost:3001](http://localhost:3001)

## 📂 프로젝트 구조

```
/
├── apps/
│   ├── frontend/       # Next.js 기반 프론트엔드 애플리케이션
│   ├── backend/        # Python 기반 백엔드 API 서버
│   └── piston/         # 코드 실행을 위한 Piston 엔진
├── docker-compose.yml  # 서비스 실행을 위한 Docker Compose 설정
└── README.md           # 프로젝트 안내 문서
```

## 🐞 이슈 제보

버그나 개선 사항을 발견하면 언제든지 이슈를 생성해주세요.

**중요: 하나의 이슈에는 하나의 문제만 다루어주세요.** 예를 들어, "A 버그가 발생했고, B 기능도 추가되었으면 좋겠습니다"와 같이 여러 문제를 한 이슈에 담지 말아주세요.

좋은 이슈는 아래 정보를 포함할 때 더 빠르게 해결될 수 있습니다.

- **문제 요약**: 어떤 문제가 발생했는지 명확하고 간결하게 설명해주세요.
- **재현 단계**:
  1. 이 페이지로 이동 '...'
  2. 이 버튼 클릭 '....'
  3. 스크롤 다운 '....'
  4. 에러 확인
- **기대했던 결과**: 어떤 결과가 나타나야 했는지 설명해주세요.
- **실제 결과**: 대신 어떤 결과가 나타났는지 설명해주세요.
- **스크린샷/동영상**: (가능하다면) 문제 상황을 보여주는 스크린샷이나 동영상을 첨부해주세요.
- **환경 정보 (선택 사항)**: 문제를 특정 환경에서만 재현할 수 있는 경우, 최대한 자세히 적어주시면 큰 도움이 됩니다.
    - **OS**: [e.g. iOS]
    - **브라우저**: [e.g. chrome, safari]
    - **버전**: [e.g. 22]