# Dockerfile (apps/backend/Dockerfile)
FROM python:3.13

WORKDIR /app

COPY requirements.txt ./

RUN pip3 install -r requirements.txt

# Install build tools
RUN apt-get update && apt-get install -y gcc time

COPY . .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]