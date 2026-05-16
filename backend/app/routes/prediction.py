from datetime import datetime

from fastapi import APIRouter

from app.config import settings
from app.ml.visibility import predict_visibility, status_from_score
from app.schemas import PredictionRequest, PredictionResponse
from app.services.aggregator import build_feature_row
from app.utils.csv_export import feature_row_to_csv

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
async def predict(body: PredictionRequest) -> PredictionResponse:
    target = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M")

    row = await build_feature_row(target)
    csv_output = feature_row_to_csv(row)

    score = predict_visibility(
        target=target,
        lat=settings.site_lat,
        lng=settings.site_lng,
        depth_m=settings.site_depth_m,
        features=row.model_dump(),
    )
    status = status_from_score(score)

    return PredictionResponse(
        status="ok",
        features=row,
        csv=csv_output,
        visibility_score=score,
        status_label=status["label"],
        status_tone=status["tone"],
    )
