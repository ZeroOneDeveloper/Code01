#!/bin/bash

# Start Piston API in background (note new path)
node /app/packages/api/index.js &

# Wait for API to be ready
echo "⏳ Waiting for Piston API to be available..."
until curl -s http://localhost:2000/api/v2/runtimes | grep -q '\['; do
  sleep 1
done
echo "✅ Piston API is up. Installing languages..."

# Install required languages using curl
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language": "gcc", "version": "10.2.0"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language": "java", "version": "15.0.2"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language": "python", "version": "3.12.0"}'

echo "✅ Language installation commands sent."

# Keep process alive
wait