import csv
import io

from app.schemas import FeatureRow


def feature_row_to_csv(row: FeatureRow) -> str:
    data = row.model_dump()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(data.keys()))
    writer.writeheader()
    writer.writerow(data)
    return output.getvalue()
