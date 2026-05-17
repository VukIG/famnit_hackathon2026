from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.prediction import router as prediction_router
from app.routes.data import router as data_router

app = FastAPI(title="Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(prediction_router)
app.include_router(data_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
