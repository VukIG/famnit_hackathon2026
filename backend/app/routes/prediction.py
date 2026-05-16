from datetime import datetime

from fastapi import APIRouter

from app.schemas import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
def predict(body: PredictionRequest) -> PredictionResponse:
    # Combines the validated date and time into a single datetime for downstream use.
    combined = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M")

    return PredictionResponse(status="ok")
