import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import Papa from 'papaparse'
import SectionHeader from './components/SectionHeader/SectionHeader'
import ClearanceCard from './components/ClearanceCard/ClearanceCard'
import DataTile from './components/DataTile/DataTile'
import SafetyBar from './components/SafetyBar/SafetyBar'
import './Dashboard.css'

/* ── Sensor data utilities (unchanged) ──────────────────────── */
const sample = (data, max = 500) => {
  const step = Math.max(1, Math.floor(data.length / max))
  return data.filter((_, i) => i % step === 0)
}

const withNoCache = (url) => {
  const u = new URL(url, window.location.origin)
  u.searchParams.set('_ts', Date.now().toString())
  return u.toString()
}

const parseRows = (rows) => {
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined) return obj[k]
    }
    return undefined
  }

  return rows
    .map((r) => {
      const dtStr = pick(r, ['datetime', 'date', 'time'])
      return {
        dt: new Date(dtStr),
        turbidity_ntu: parseFloat(pick(r, ['turbidity_ntu', 'turbidity'])) || 0,
        wave_height_m: parseFloat(pick(r, ['wave_height_m', 'wave_height', 'waveHeight'])) || 0,
        wind_speed_kmh: parseFloat(pick(r, ['wind_speed_kmh', 'wind_speed', 'windSpeed'])) || 0,
        sea_surface_temperature_c: parseFloat(pick(r, ['sea_surface_temperature_c', 'sst', 'sea_surface_temperature'])) || 0,
        sensor_status: parseInt(pick(r, ['sensor_status', 'status']), 10) || 0,
      }
    })
    .filter((d) => d.dt instanceof Date && !Number.isNaN(d.dt.getTime()) && !Number.isNaN(d.turbidity_ntu))
    .sort((a, b) => a.dt - b.dt)
}

const clarityScore = (d) => {
  let s = 100
  if (d.turbidity_ntu > 10) s -= 40
  else if (d.turbidity_ntu > 5) s -= 25
  else if (d.turbidity_ntu > 3) s -= 12
  else if (d.turbidity_ntu > 1.5) s -= 4

  if (d.wave_height_m > 2) s -= 30
  else if (d.wave_height_m > 1.5) s -= 20
  else if (d.wave_height_m > 1) s -= 10
  else if (d.wave_height_m > 0.6) s -= 4

  if (d.wind_speed_kmh > 35) s -= 20
  else if (d.wind_speed_kmh > 25) s -= 12
  else if (d.wind_speed_kmh > 18) s -= 6

  if (d.sea_surface_temperature_c > 30 || d.sea_surface_temperature_c < 10) s -= 10
  else if (d.sea_surface_temperature_c > 28 || d.sea_surface_temperature_c < 12) s -= 5

  return Math.max(0, Math.round(s))
}

const verdict = (score, faults) => {
  if (faults > 0) {
    return { status: 'SENSOR FAULT', desc: 'Active sensor malfunction - readings unreliable.' }
  }
  if (score >= 75) {
    return { status: 'GO', desc: 'Water clarity is good. Conditions are suitable for diving.' }
  }
  if (score >= 50) {
    return { status: 'CAUTION', desc: 'Marginal clarity. Exercise caution and monitor conditions.' }
  }
  return { status: 'NO-GO', desc: 'Poor clarity or hazardous wave conditions. Do not dive.' }
}

const tStatus = (v, lo, hi) => {
  if (v <= lo) return { c: '#00e5a0', t: 'GOOD' }
  if (v <= hi) return { c: '#ffb300', t: 'CAUTION' }
  return { c: '#ff4d6a', t: 'HIGH' }
}

/* Updated chart options — teal design system colors */
const baseOpts = (yLabel, minY = null) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(19, 51, 65, 0.97)',
      borderColor: 'rgba(127, 245, 220, 0.2)',
      borderWidth: 1,
      titleColor: 'rgba(244, 248, 248, 0.4)',
      bodyColor: 'rgba(244, 248, 248, 0.9)',
      titleFont: { family: 'IBM Plex Mono', size: 9 },
      bodyFont: { family: 'IBM Plex Mono', size: 10 },
      callbacks: {
        label: (c) => `  ${c.dataset.label}: ${Number(c.parsed.y).toFixed(2)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.07)', lineWidth: 0.5 },
      ticks: { color: 'rgba(244,248,248,0.4)', font: { family: 'IBM Plex Mono', size: 8 }, maxTicksLimit: 6, maxRotation: 0 },
      border: { display: false },
    },
    y: {
      min: minY,
      grid: { color: 'rgba(255,255,255,0.07)', lineWidth: 0.5 },
      ticks: { color: 'rgba(244,248,248,0.4)', font: { family: 'IBM Plex Mono', size: 8 }, maxTicksLimit: 5 },
      border: { display: false },
      title: yLabel
        ? { display: true, text: yLabel, color: 'rgba(244,248,248,0.4)', font: { family: 'IBM Plex Mono', size: 8 } }
        : { display: false },
    },
  },
})

const ds = (vals, color, label, dashed = false, fill = false) => ({
  label,
  data: vals,
  borderColor: color,
  borderWidth: dashed ? 1 : 1.4,
  borderDash: dashed ? [5, 3] : [],
  pointRadius: 0,
  pointHoverRadius: 3,
  fill: fill ? { target: 'origin', above: `${color}18` } : false,
  tension: 0.35,
})

/* ── Satellite helpers ───────────────────────────────────────── */
const satClarityScore = (d) => {
  let s = 100
  if (d.TUR > 10) s -= 40; else if (d.TUR > 5) s -= 25; else if (d.TUR > 3) s -= 12; else if (d.TUR > 1.5) s -= 4
  if (d.VHM0 > 2) s -= 30; else if (d.VHM0 > 1.5) s -= 20; else if (d.VHM0 > 1) s -= 10; else if (d.VHM0 > 0.6) s -= 4
  if (d.CHL > 5) s -= 15; else if (d.CHL > 2) s -= 6
  if (d.SPM > 5) s -= 15; else if (d.SPM > 3) s -= 6
  return Math.max(0, Math.round(s))
}

const toStateClass = (ts) => {
  if (ts.c === '#00e5a0') return 'good'
  if (ts.c === '#ffb300') return 'wait'
  return 'poor'
}

/* ── Dashboard component ─────────────────────────────────────── */
export function Dashboard() {
  /* ── Sensor state (unchanged) ────────────────────────────── */
  const [all, setAll] = useState([])
  const [source, setSource] = useState('local')
  const [apiUrl, setApiUrl] = useState('/api/sensor-data')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetch, setLastFetch] = useState('-')
  const [autoOn, setAutoOn] = useState(false)
  const [refreshMin, setRefreshMin] = useState(1)

  const cTRef = useRef(null)
  const cWRef = useRef(null)
  const cWindRef = useRef(null)
  const cSSTRef = useRef(null)
  const chartsRef = useRef({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let rows
      if (source === 'local') {
        const resp = await fetch(withNoCache('/data/sensor.csv'))
        const text = await resp.text()
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data
      } else {
        const resp = await fetch(withNoCache(apiUrl || '/api/sensor-data'))
        const contentType = (resp.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
          rows = await resp.json()
        } else {
          const text = await resp.text()
          rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data
        }
      }

      const parsed = parseRows(rows)
      if (!parsed.length) throw new Error('No valid rows')
      setAll(parsed)
      setLastFetch(new Date().toLocaleTimeString('en-GB'))
    } catch (e) {
      setError('Could not load sensor data - check source and endpoint.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, source])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!autoOn) return undefined
    const id = setInterval(loadData, refreshMin * 60000)
    return () => clearInterval(id)
  }, [autoOn, refreshMin, loadData])

  const win = useMemo(() => all, [all])
  const sampled = useMemo(() => sample(win), [win])
  const labels = useMemo(
    () => sampled.map((d) => d.dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })),
    [sampled],
  )

  const latest = win.length ? win[win.length - 1] : null
  const faults = useMemo(() => win.filter((d) => d.sensor_status === 1).length, [win])
  const score = latest ? clarityScore(latest) : 0
  const v = verdict(score, latest?.sensor_status || 0)

  useEffect(() => {
    if (!sampled.length) return

    const mkChart = (key, canvasRef, datasets, options) => {
      if (!canvasRef.current) return
      if (chartsRef.current[key]) chartsRef.current[key].destroy()
      chartsRef.current[key] = new Chart(canvasRef.current, {
        type: 'line',
        data: { labels, datasets },
        options,
      })
    }

    mkChart(
      't',
      cTRef,
      [
        ds(sampled.map((d) => d.turbidity_ntu), 'rgba(127,245,220,0.7)', 'Raw NTU'),
        ds(sampled.map(() => 5), 'rgba(230,180,84,0.8)', 'Safe limit', true),
      ],
      baseOpts('NTU', 0),
    )

    mkChart(
      'w',
      cWRef,
      [
        ds(sampled.map((d) => d.wave_height_m), 'rgba(127,245,220,0.6)', 'Wave h m'),
        ds(sampled.map(() => 1.0), 'rgba(230,180,84,0.8)', 'Caution', true),
      ],
      baseOpts('m', 0),
    )

    mkChart(
      'wind',
      cWindRef,
      [
        ds(sampled.map((d) => d.wind_speed_kmh), 'rgba(127,245,220,0.6)', 'Wind km/h'),
        ds(sampled.map(() => 25), 'rgba(230,180,84,0.8)', 'Caution', true),
      ],
      baseOpts('km/h', 0),
    )

    mkChart('sst', cSSTRef, [ds(sampled.map((d) => d.sea_surface_temperature_c), 'rgba(127,245,220,0.6)', 'SST °C', false, true)], baseOpts('°C'))

    return () => {
      Object.values(chartsRef.current).forEach((c) => c?.destroy())
      chartsRef.current = {}
    }
  }, [labels, sampled])

  const kpis = latest
    ? [
        {
          lbl: 'Datetime (latest)',
          val: latest.dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          unit: 'UTC/local browser',
          ...(faults === 0 ? { c: '#00e5a0', t: 'SYNCED' } : { c: '#ffb300', t: 'CHECK' }),
        },
        { lbl: 'Turbidity (latest)', val: latest.turbidity_ntu.toFixed(2), unit: 'NTU', ...tStatus(latest.turbidity_ntu, 3, 5) },
        { lbl: 'Wave height', val: latest.wave_height_m.toFixed(2), unit: 'm', ...tStatus(latest.wave_height_m, 0.6, 1.2) },
        { lbl: 'Wind speed', val: latest.wind_speed_kmh.toFixed(1), unit: 'km/h', ...tStatus(latest.wind_speed_kmh, 12, 25) },
        { lbl: 'Sea surface temp', val: latest.sea_surface_temperature_c.toFixed(1), unit: '°C', ...tStatus(Math.abs(latest.sea_surface_temperature_c - 22), 0, 6) },
        { lbl: 'Sensor faults', val: String(faults), unit: 'readings', ...(faults === 0 ? { c: '#00e5a0', t: 'OK' } : { c: '#ff4d6a', t: 'ALERT' }) },
      ]
    : []

  const meters = latest
    ? [
        { lbl: 'Turbidity clarity', val: Math.max(0, 100 - Math.min(100, (latest.turbidity_ntu / 10) * 100)), unit: `NTU: ${latest.turbidity_ntu.toFixed(2)}` },
        { lbl: 'Wave safety', val: Math.max(0, 100 - Math.min(100, (latest.wave_height_m / 2) * 100)), unit: `Height: ${latest.wave_height_m.toFixed(2)} m` },
        { lbl: 'Wind safety', val: Math.max(0, 100 - Math.min(100, (latest.wind_speed_kmh / 35) * 100)), unit: `Wind: ${latest.wind_speed_kmh.toFixed(1)} km/h` },
        { lbl: 'Overall clarity', val: score, unit: `Score: ${score} / 100` },
      ]
    : []

  const rangeLabel = useMemo(() => {
    if (!win.length) return 'No data loaded'
    const first = win[0].dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const last = win[win.length - 1].dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${win.length.toLocaleString()} readings · ${first} – ${last}`
  }, [win])

  /* ── Satellite state (new) ───────────────────────────────── */
  const [satData, setSatData] = useState(null)
  const [satLoading, setSatLoading] = useState(false)
  const [satError, setSatError] = useState('')

  useEffect(() => {
    setSatLoading(true)
    setSatError('')
    fetch(withNoCache('/data/latest'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setSatData(d)
        setSatLoading(false)
      })
      .catch(() => {
        setSatError('Satellite data unavailable — no Copernicus records fetched yet')
        setSatLoading(false)
      })
  }, [])

  /* ── Satellite derived values ─────────────────────────────── */
  const satScore = satData ? satClarityScore(satData) : null
  const satVerdict =
    satScore == null ? null : satScore >= 75 ? 'GO' : satScore >= 50 ? 'WAIT' : 'NO-GO'
  const satVerdictDesc =
    satScore == null
      ? ''
      : satScore >= 75
      ? 'Water clarity is good. Satellite confirms safe conditions for diving.'
      : satScore >= 50
      ? 'Marginal clarity. Satellite data shows moderate particle load — exercise caution.'
      : 'Poor clarity detected. High turbidity or wave energy — do not dive.'

  /* ── Sensor verdict normalised to GO / WAIT / NO-GO ─────── */
  const sensorVerdict =
    latest == null
      ? null
      : v.status === 'GO'
      ? 'GO'
      : v.status === 'CAUTION'
      ? 'WAIT'
      : 'NO-GO'

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="dashboard">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — SENSOR · IN-SITU READINGS
      ══════════════════════════════════════════════════════════ */}
      <SectionHeader
        kicker="SENSOR · IN-SITU READINGS"
        title='NIB MBP "Vida" Buoy + ARSO Feeds'
        meta={win.length ? `41.18°N 1.75°E · Depth 20 m · ${rangeLabel}` : '—'}
        feedStatus={{
          state: loading ? 'wait' : error ? 'poor' : win.length ? 'good' : 'wait',
          label: loading ? 'Loading…' : error ? 'Error' : win.length ? `${win.length.toLocaleString()} readings` : 'No data',
        }}
      />

      <ClearanceCard
        verdict={sensorVerdict}
        score={latest ? score : null}
        scoreMax={100}
        headline="DIVE CLEARANCE · SENSOR DATA"
        description={latest ? v.desc : 'Loading sensor data…'}
      />

      {/* Controls */}
      <div className="dashboard__controls">
        <span className="dashboard__ctl">Data source</span>
        <select className="dashboard__select" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="local">Local CSV</option>
          <option value="api">API</option>
        </select>
        {source === 'api' && (
          <input
            className="dashboard__input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="/api/sensor-data"
          />
        )}
        <button className="dashboard__btn" onClick={loadData} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <span className="dashboard__ctl" style={{ marginLeft: 8 }}>Auto-refresh</span>
        <button
          className={`dashboard__btn${autoOn ? ' dashboard__btn--active' : ''}`}
          onClick={() => setAutoOn((s) => !s)}
        >
          {autoOn ? 'On' : 'Off'}
        </button>
        <select className="dashboard__select" value={refreshMin} onChange={(e) => setRefreshMin(Number(e.target.value))}>
          <option value={1}>1 min</option>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
        <span className="dashboard__ctl" style={{ marginLeft: 8 }}>
          Last fetch: {lastFetch}
        </span>
      </div>

      {error && <div className="dashboard__fault-banner">{error}</div>}
      {!!faults && (
        <div className="dashboard__fault-banner">
          {faults} sensor fault reading{faults !== 1 ? 's' : ''} in window — affected data points excluded from clarity score.
        </div>
      )}

      {/* Live sensor snapshot tiles */}
      {latest && (
        <>
          <div className="dashboard__tile-grid">
            <DataTile
              label="Turbidity"
              value={latest.turbidity_ntu.toFixed(2)}
              unit="NTU"
              sub="Latest reading"
              source="live"
              status={{ state: toStateClass(tStatus(latest.turbidity_ntu, 3, 5)), label: tStatus(latest.turbidity_ntu, 3, 5).t }}
            />
            <DataTile
              label="Wave Height"
              value={latest.wave_height_m.toFixed(2)}
              unit="m"
              sub="Significant height"
              source="live"
              status={{ state: toStateClass(tStatus(latest.wave_height_m, 0.6, 1.2)), label: tStatus(latest.wave_height_m, 0.6, 1.2).t }}
            />
            <DataTile
              label="Wind Speed"
              value={latest.wind_speed_kmh.toFixed(1)}
              unit="km/h"
              source="live"
              status={{ state: toStateClass(tStatus(latest.wind_speed_kmh, 12, 25)), label: tStatus(latest.wind_speed_kmh, 12, 25).t }}
            />
            <DataTile
              label="Sea Surface Temp"
              value={latest.sea_surface_temperature_c.toFixed(1)}
              unit="°C"
              source="live"
              status={{ state: toStateClass(tStatus(Math.abs(latest.sea_surface_temperature_c - 22), 0, 6)), label: tStatus(Math.abs(latest.sea_surface_temperature_c - 22), 0, 6).t }}
            />
            <DataTile
              label="Sensor Faults"
              value={String(faults)}
              unit="readings"
              source="sensor"
              status={{ state: faults === 0 ? 'good' : 'poor', label: faults === 0 ? 'OK' : 'ALERT' }}
            />
          </div>

          {/* Safety bars */}
          <div className="dashboard__bars">
            {meters.map((m) => (
              <SafetyBar key={m.lbl} label={m.lbl} percent={Math.round(m.val)} sub={m.unit} />
            ))}
          </div>
        </>
      )}

      {/* Turbidity time-series */}
      <div className="sensor-chart">
        <div className="sensor-chart__head">
          <div>
            <div className="micro">TURBIDITY · WATER CLARITY OVER TIME</div>
            <div className="sensor-chart__sub">turbidity_ntu (NTU) — raw, with safe-dive threshold</div>
          </div>
          <div className="sensor-chart__badges">
            <span className="source-tag source-tag--live">PRIMARY</span>
            <span className="source-tag source-tag--sensor">sensor</span>
          </div>
        </div>
        <div className="sensor-chart__canvas sensor-chart__canvas--lg">
          <canvas ref={cTRef} />
        </div>
        <div className="sensor-chart__legend">
          <span className="sensor-chart__leg-item">
            <span className="sensor-chart__leg-line" style={{ background: 'rgba(127,245,220,0.7)' }} />
            <span className="micro">Raw NTU</span>
          </span>
          <span className="sensor-chart__leg-item">
            <span className="sensor-chart__leg-dashed" style={{ borderColor: 'rgba(230,180,84,0.8)' }} />
            <span className="micro">Safe limit (5 NTU)</span>
          </span>
        </div>
      </div>

      {/* Wave + wind charts */}
      <div className="dashboard__chart-row">
        <div className="sensor-chart">
          <div className="sensor-chart__head">
            <div>
              <div className="micro">SEA CONDITIONS · WAVE HEIGHT</div>
              <div className="sensor-chart__sub">wave_height_m (m)</div>
            </div>
            <div className="sensor-chart__badges">
              <span className="source-tag">SAFETY</span>
              <span className="source-tag source-tag--sensor">sensor</span>
            </div>
          </div>
          <div className="sensor-chart__canvas">
            <canvas ref={cWRef} />
          </div>
        </div>
        <div className="sensor-chart">
          <div className="sensor-chart__head">
            <div>
              <div className="micro">SEA CONDITIONS · WIND SPEED</div>
              <div className="sensor-chart__sub">wind_speed_kmh (km/h)</div>
            </div>
            <div className="sensor-chart__badges">
              <span className="source-tag">SAFETY</span>
              <span className="source-tag source-tag--sensor">sensor</span>
            </div>
          </div>
          <div className="sensor-chart__canvas">
            <canvas ref={cWindRef} />
          </div>
        </div>
      </div>

      {/* SST chart */}
      <div className="sensor-chart">
        <div className="sensor-chart__head">
          <div>
            <div className="micro">TEMPERATURE CONTEXT</div>
            <div className="sensor-chart__sub">sea_surface_temperature_c (°C)</div>
          </div>
          <div className="sensor-chart__badges">
            <span className="source-tag">ENV</span>
            <span className="source-tag source-tag--sensor">sensor</span>
          </div>
        </div>
        <div className="sensor-chart__canvas">
          <canvas ref={cSSTRef} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — SATELLITE · OCEAN DATA
      ══════════════════════════════════════════════════════════ */}
      <SectionHeader
        kicker="SATELLITE · OCEAN DATA"
        title="Copernicus Marine Service"
        meta={
          satData
            ? `${satData.latitude}°N ${satData.longitude}°E · ${satData.depth_min_m}–${satData.depth_max_m} m · ${satData.date} ${satData.time}`
            : '—'
        }
        feedStatus={{
          state: satLoading ? 'wait' : satError ? 'poor' : satData ? 'good' : 'wait',
          label: satLoading ? 'Loading…' : satError ? 'Unavailable' : satData ? '1 acquisition' : '—',
        }}
      />

      {satLoading && <div className="sat-nodata micro">Loading satellite data…</div>}

      {satError && !satLoading && (
        <div className="dashboard__fault-banner">{satError}</div>
      )}

      {satData && !satLoading && (
        <>
          <ClearanceCard
            verdict={satVerdict}
            score={satScore}
            scoreMax={100}
            headline="DIVE CLEARANCE · SATELLITE DATA"
            description={satVerdictDesc}
            warning={
              satData.depth_max_m != null && satData.mlotst != null && satData.depth_max_m > satData.mlotst
                ? `Mixed layer ends at ${satData.mlotst.toFixed(1)} m — dives below this depth enter different water conditions`
                : null
            }
          />

          {/* Water clarity */}
          <div className="dashboard__subgrid">
            <span className="micro dashboard__subgrid-label">WATER CLARITY</span>
            <div className="dashboard__tile-grid">
              <DataTile
                label="Turbidity"
                value={satData.TUR != null ? satData.TUR.toFixed(2) : null}
                unit="NTU"
                sub="Direct clarity indicator"
                source="satellite"
                status={satData.TUR != null ? { state: satData.TUR <= 3 ? 'good' : satData.TUR <= 5 ? 'wait' : 'poor', label: satData.TUR <= 3 ? 'CLEAR' : satData.TUR <= 5 ? 'MODERATE' : 'HIGH' } : null}
              />
              <DataTile
                label="Chlorophyll"
                value={satData.CHL != null ? satData.CHL.toFixed(2) : null}
                unit="mg/m³"
                sub="Algal bloom indicator"
                source="satellite"
                status={satData.CHL != null ? { state: satData.CHL <= 2 ? 'good' : satData.CHL <= 5 ? 'wait' : 'poor', label: satData.CHL <= 2 ? 'NORMAL' : 'ELEVATED' } : null}
              />
              <DataTile
                label="Suspended Particles"
                value={satData.SPM != null ? satData.SPM.toFixed(2) : null}
                unit="mg/L"
                sub="Sediment load"
                source="satellite"
                status={satData.SPM != null ? { state: satData.SPM <= 3 ? 'good' : satData.SPM <= 5 ? 'wait' : 'poor', label: satData.SPM <= 3 ? 'LOW' : satData.SPM <= 5 ? 'MODERATE' : 'HIGH' } : null}
              />
            </div>
          </div>

          {/* Wave conditions */}
          <div className="dashboard__subgrid">
            <span className="micro dashboard__subgrid-label">WAVE CONDITIONS</span>
            <div className="dashboard__tile-grid">
              <DataTile
                label="Wave Height"
                value={satData.VHM0 != null ? satData.VHM0.toFixed(2) : null}
                unit="m"
                sub="Significant wave height"
                source="satellite"
                status={satData.VHM0 != null ? { state: satData.VHM0 <= 0.6 ? 'good' : satData.VHM0 <= 1.2 ? 'wait' : 'poor', label: satData.VHM0 <= 0.6 ? 'CALM' : satData.VHM0 <= 1.2 ? 'MODERATE' : 'HIGH' } : null}
              />
              <DataTile
                label="Swell Height"
                value={satData.VHM0_SW1 != null ? satData.VHM0_SW1.toFixed(2) : null}
                unit="m"
                sub="Long-period swell"
                source="satellite"
                status={satData.VHM0_SW1 != null ? { state: satData.VHM0_SW1 <= 0.5 ? 'good' : 'wait', label: satData.VHM0_SW1 <= 0.5 ? 'LOW' : 'PRESENT' } : null}
              />
              <DataTile
                label="Wind Waves"
                value={satData.VHM0_WW != null ? satData.VHM0_WW.toFixed(2) : null}
                unit="m"
                sub="Short-period chop"
                source="satellite"
                status={satData.VHM0_WW != null ? { state: satData.VHM0_WW <= 0.4 ? 'good' : 'wait', label: satData.VHM0_WW <= 0.4 ? 'LOW' : 'PRESENT' } : null}
              />
              <DataTile
                label="Wave Period"
                value={satData.VTM10 != null ? satData.VTM10.toFixed(1) : null}
                unit="s"
                sub="Mean period"
                source="satellite"
              />
            </div>
          </div>

          {/* Ocean currents */}
          <div className="dashboard__subgrid">
            <span className="micro dashboard__subgrid-label">OCEAN CURRENTS</span>
            <div className="dashboard__tile-grid">
              <DataTile
                label="Current Speed"
                value={satData.current_speed != null ? satData.current_speed.toFixed(2) : null}
                unit="m/s"
                sub="Surface current magnitude"
                source="satellite"
                status={satData.current_speed != null ? { state: satData.current_speed <= 0.2 ? 'good' : satData.current_speed <= 0.5 ? 'wait' : 'poor', label: satData.current_speed <= 0.2 ? 'CALM' : satData.current_speed <= 0.5 ? 'MODERATE' : 'STRONG' } : null}
              />
              <DataTile
                label="Current Direction"
                value={
                  satData.uo != null && satData.vo != null
                    ? `${Math.round(((Math.atan2(satData.uo, satData.vo) * (180 / Math.PI)) % 360 + 360) % 360)}°`
                    : null
                }
                sub={satData.uo != null ? `u: ${satData.uo.toFixed(4)} · v: ${satData.vo?.toFixed(4)}` : null}
                source="satellite"
              />
            </div>
          </div>

          {/* Environmental context */}
          <div className="dashboard__subgrid">
            <span className="micro dashboard__subgrid-label">ENVIRONMENTAL CONTEXT</span>
            <div className="dashboard__tile-grid">
              <DataTile
                label="Ocean Temp"
                value={satData.thetao != null ? satData.thetao.toFixed(1) : null}
                unit="°C"
                sub="Cross-validates in-situ sensor"
                source="satellite"
              />
              <DataTile
                label="Salinity"
                value={satData.so != null ? satData.so.toFixed(2) : null}
                unit="PSU"
                sub="Cross-validates in-situ sensor"
                source="satellite"
              />
            </div>
          </div>

          {/* Depth structure */}
          {satData.mlotst != null && (
            <div className="data-tile">
              <div className="data-tile__head">
                <span className="micro">MIXED LAYER DEPTH</span>
                <span className="source-tag source-tag--satellite">satellite</span>
              </div>
              <div className="depth-viz">
                <div className="depth-viz__scale">
                  <span>0 m</span>
                  <span>{Math.max(25, satData.depth_max_m ?? 0)} m</span>
                </div>
                <div className="depth-viz__bar">
                  <div
                    className="depth-viz__mixed"
                    style={{ width: `${(satData.mlotst / Math.max(25, satData.depth_max_m ?? 0)) * 100}%` }}
                  />
                  <span className="depth-viz__mld-label">{satData.mlotst.toFixed(1)} m</span>
                </div>
                <div className="micro" style={{ marginTop: 8, color: 'var(--ink-muted)' }}>
                  Mixed layer ends at {satData.mlotst.toFixed(1)} m
                  {satData.depth_max_m != null && satData.depth_max_m > satData.mlotst
                    ? ` — dive range (${satData.depth_min_m}–${satData.depth_max_m} m) extends below it`
                    : ` — mixed layer covers full dive range (${satData.depth_min_m}–${satData.depth_max_m} m)`}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
