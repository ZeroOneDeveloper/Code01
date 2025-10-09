from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://code01.kr",
        "http://localhost:3000",
    ],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)


for extension in os.listdir("./extensions/"):
    if not os.path.isdir(os.path.join("./extensions/", extension)):
        continue

    if not os.path.exists(os.path.join("./extensions/", extension, "route.py")):
        continue

    module_name = f"extensions.{extension}.route"
    try:
        module = __import__(module_name, fromlist=["router"])
        app.include_router(module.router)
        print(f"Included router from {module_name}")
    except ImportError as e:
        print(f"Failed to import {module_name}: {e}")
    except AttributeError as e:
        print(f"Router not found in {module_name}: {e}")
    continue


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
    )
