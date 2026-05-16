from datetime import datetime

from fastapi import APIRouter

from app.schemas import PredictionRequest, PredictionResponse
from app.services.aggregator import build_feature_row
from app.utils.csv_export import feature_row_to_csv

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
async def predict(body: PredictionRequest) -> PredictionResponse:
    # Combines the validated date and time into a single datetime for downstream use.
    target = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M")

    row = await build_feature_row(target)
    csv_output = feature_row_to_csv(row)

    return PredictionResponse(status="ok", features=row, csv=csv_output)
