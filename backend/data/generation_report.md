# Synthetic Sensor Data — Generation Report
Generated: 2026-05-17T05:30:06.533640

## Dataset summary
- Rows: 7993
- Columns: 19
- Plume events: 5
- Missing data rate: 5.9%

## Validation results
| Check | Result | PASS/FAIL |
|---|---|---|
| K-S test (lognormal fit) | p=0.5381 | PASS |
| Plume events ≥ 3 | 5 | PASS |
| Missing rate in [4%, 12%] | 5.9% | PASS |
| turbidity~wave_height r in [0.2, 0.6] | 0.549 | PASS |

## Pearson correlations (turbidity vs weather)
| Feature | r |
|---|---|
| wave_height_m | +0.549 |
| wind_speed_kmh | +0.174 |
| sea_surface_temperature_c | -0.214 |
| air_temperature_c | -0.162 |
| wave_period_s | +0.460 |
| humidity_pct | +0.012 |
| cloud_cover_pct | +0.117 |

## All constraints passed ✅

## Output columns
- `datetime`
- `longitude`
- `latitude`
- `depth_m`
- `wave_height_m`
- `wave_direction_deg`
- `wave_period_s`
- `wave_peak_period_s`
- `sea_surface_temperature_c`
- `air_temperature_c`
- `wind_speed_kmh`
- `wind_direction_deg`
- `cloud_cover_pct`
- `humidity_pct`
- `moon_phase`
- `turbidity_ntu`
- `salinity_psu`
- `sensor_temp_c`
- `sensor_status`
