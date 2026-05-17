import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import Papa from 'papaparse'
import './Dashboard.css'

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
    return {
      status: 'SENSOR FAULT',
      desc: 'Active sensor malfunction - readings unreliable.',
      icon: '!',
      bg: '#1a0a0a',
      bc: '#ff4d4d',
      sc: '#ff4d4d',
    }
  }
  if (score >= 75) {
    return {
      status: 'GO',
      desc: 'Water clarity is good. Conditions are suitable for diving.',
      icon: 'OK',
      bg: '#071a10',
      bc: '#00e5a0',
      sc: '#00e5a0',
    }
  }
  if (score >= 50) {
    return {
      status: 'CAUTION',
      desc: 'Marginal clarity. Exercise caution and monitor conditions.',
      icon: '!',
      bg: '#18100a',
      bc: '#ffb300',
      sc: '#ffb300',
    }
  }
  return {
    status: 'NO-GO',
    desc: 'Poor clarity or hazardous wave conditions. Do not dive.',
    icon: 'X',
    bg: '#1a0a0a',
    bc: '#ff4d6a',
    sc: '#ff4d6a',
  }
}

const tStatus = (v, lo, hi) => {
  if (v <= lo) return { c: '#00e5a0', t: 'GOOD' }
  if (v <= hi) return { c: '#ffb300', t: 'CAUTION' }
  return { c: '#ff4d6a', t: 'HIGH' }
}

const baseOpts = (yLabel, minY = null) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(3,13,23,.97)',
      borderColor: 'rgba(56,190,255,.2)',
      borderWidth: 1,
      titleColor: '#3a6080',
      bodyColor: '#c0d8f0',
      titleFont: { family: 'Space Mono', size: 9 },
      bodyFont: { family: 'Space Mono', size: 10 },
      callbacks: {
        label: (c) => `  ${c.dataset.label}: ${Number(c.parsed.y).toFixed(2)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(13,37,64,.7)', lineWidth: 0.5 },
      ticks: { color: '#2a4060', font: { family: 'Space Mono', size: 8 }, maxTicksLimit: 6, maxRotation: 0 },
      border: { display: false },
    },
    y: {
      min: minY,
      grid: { color: 'rgba(13,37,64,.7)', lineWidth: 0.5 },
      ticks: { color: '#2a4060', font: { family: 'Space Mono', size: 8 }, maxTicksLimit: 5 },
      border: { display: false },
      title: yLabel
        ? { display: true, text: yLabel, color: '#2a4060', font: { family: 'Space Mono', size: 8 } }
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

export function Dashboard() {
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
        ds(sampled.map((d) => d.turbidity_ntu), 'rgba(56,190,255,.25)', 'Raw NTU'),
        ds(sampled.map(() => 5), '#ff4d6a', 'Safe limit', true),
      ],
      baseOpts('NTU', 0),
    )

    mkChart(
      'w',
      cWRef,
      [
        ds(sampled.map((d) => d.wave_height_m), 'rgba(167,139,250,.3)', 'Wave h m'),
        ds(sampled.map(() => 1.0), '#ff9f43', 'Caution', true),
      ],
      baseOpts('m', 0),
    )

    mkChart(
      'wind',
      cWindRef,
      [
        ds(sampled.map((d) => d.wind_speed_kmh), 'rgba(249,115,22,.25)', 'Wind km/h'),
        ds(sampled.map(() => 25), '#ff9f43', 'Caution', true),
      ],
      baseOpts('km/h', 0),
    )

    mkChart('sst', cSSTRef, [ds(sampled.map((d) => d.sea_surface_temperature_c), '#fb923c', 'SST C', false, true)], baseOpts('C'))

    return () => {
      Object.values(chartsRef.current).forEach((c) => c?.destroy())
      chartsRef.current = {}
    }
  }, [labels, sampled])

  const kpis = latest
    ? [
        {
          lbl: 'Datetime (latest)',
          val: latest.dt.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          unit: 'UTC/local browser',
          ac: '#6ea8d8',
          ...(faults === 0 ? { c: '#00e5a0', t: 'SYNCED' } : { c: '#ffb300', t: 'CHECK' }),
        },
        {
          lbl: 'Turbidity (latest)',
          val: latest.turbidity_ntu.toFixed(2),
          unit: 'NTU',
          ac: '#38beff',
          ...tStatus(latest.turbidity_ntu, 3, 5),
        },
        {
          lbl: 'Wave height',
          val: latest.wave_height_m.toFixed(2),
          unit: 'm',
          ac: '#a78bfa',
          ...tStatus(latest.wave_height_m, 0.6, 1.2),
        },
        {
          lbl: 'Wind speed',
          val: latest.wind_speed_kmh.toFixed(1),
          unit: 'km/h',
          ac: '#f97316',
          ...tStatus(latest.wind_speed_kmh, 12, 25),
        },
        {
          lbl: 'Sea surface temp',
          val: latest.sea_surface_temperature_c.toFixed(1),
          unit: 'C',
          ac: '#fb923c',
          ...tStatus(Math.abs(latest.sea_surface_temperature_c - 22), 0, 6),
        },
        {
          lbl: 'Sensor faults',
          val: String(faults),
          unit: 'readings',
          ac: '#ff4d6a',
          ...(faults === 0 ? { c: '#00e5a0', t: 'OK' } : { c: '#ff4d6a', t: 'ALERT' }),
        },
      ]
    : []

  const meters = latest
    ? [
        {
          lbl: 'Turbidity clarity',
          val: Math.max(0, 100 - Math.min(100, (latest.turbidity_ntu / 10) * 100)),
          color: '#38beff',
          unit: `NTU: ${latest.turbidity_ntu.toFixed(2)}`,
        },
        {
          lbl: 'Wave safety',
          val: Math.max(0, 100 - Math.min(100, (latest.wave_height_m / 2) * 100)),
          color: '#a78bfa',
          unit: `Height: ${latest.wave_height_m.toFixed(2)} m`,
        },
        {
          lbl: 'Wind safety',
          val: Math.max(0, 100 - Math.min(100, (latest.wind_speed_kmh / 35) * 100)),
          color: '#f97316',
          unit: `Wind: ${latest.wind_speed_kmh.toFixed(1)} km/h`,
        },
        {
          lbl: 'Overall clarity',
          val: score,
          color: v.sc,
          unit: `Score: ${score} / 100`,
        },
      ]
    : []

  const rangeLabel = useMemo(() => {
    if (!win.length) return 'No data loaded'
    const first = win[0].dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const last = win[win.length - 1].dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${win.length.toLocaleString()} readings - ${first} - ${last}`
  }, [win])

  return (
    <section className="wc-dashboard">
      <h2 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        Water clarity monitoring dashboard showing turbidity, wave height, wind speed, and sea surface temperature over datetime.
      </h2>

      <div className="wc-hdr">
        <div>
          <div className="wc-brand">
            HYDRO<span>CLEAR</span> · Water Clarity Monitor
          </div>
          <div className="wc-coords">41.18°N 1.75°E · Depth 20 m · Mediterranean</div>
        </div>
        <div className="wc-hdr-right">
          <span className="wc-live-dot" />
          <span>{rangeLabel}</span>
        </div>
      </div>

      <div className="wc-verdict-band" style={{ background: v.bg, borderBottom: `1px solid ${v.bc}44` }}>
        <div className="wc-verdict-icon" style={{ color: v.bc }}>
          {v.icon}
        </div>
        <div>
          <div className="wc-verdict-label">Dive clearance</div>
          <div className="wc-verdict-status" style={{ color: v.bc }}>
            {latest ? v.status : 'Loading...'}
          </div>
          <div className="wc-verdict-desc">{latest ? v.desc : 'Analysing sensor data...'}</div>
        </div>
        <div className="wc-verdict-score">
          <div className="wc-score-num" style={{ color: v.sc }}>
            {latest ? score : '-'}
          </div>
          <div className="wc-score-lbl">clarity score / 100</div>
        </div>
      </div>

      <div className="wc-controls">
        <span className="wc-ctl">Data</span>
        <select className="wc-select" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="local">Local CSV</option>
          <option value="api">API</option>
        </select>
        {source === 'api' && <input className="wc-input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="/api/sensor-data" />}
        <button className="wc-btn" onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </button>
        <span className="wc-ctl" style={{ marginLeft: 10 }}>
          Auto refresh
        </span>
        <button className={`wc-btn ${autoOn ? 'wc-on' : ''}`} onClick={() => setAutoOn((s) => !s)}>
          {autoOn ? 'On' : 'Off'}
        </button>
        <select className="wc-select" value={refreshMin} onChange={(e) => setRefreshMin(Number(e.target.value))}>
          <option value={1}>1 min</option>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
        <span className="wc-live-stamp wc-ctl" style={{ marginLeft: 8 }}>
          Last fetch: {lastFetch}
        </span>
      </div>

      {error && <div className="wc-fault-banner">{error}</div>}
      {!!faults && (
        <div className="wc-fault-banner">{faults} sensor fault readings in window - affected data points excluded from clarity score.</div>
      )}

      <div className="wc-section">
        <div className="wc-stitle">Live sensor snapshot</div>
      </div>
      <div className="wc-kpis">
        {latest &&
          [
            {
              lbl: 'Datetime',
              val: latest.dt.toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              unit: 'latest sensor timestamp',
              ac: '#6ea8d8',
              c: '#00e5a0',
              t: 'LIVE',
            },
            { lbl: 'Sea surface temp', val: latest.sea_surface_temperature_c.toFixed(1), unit: 'C', ac: '#fb923c', c: '#fb923c', t: 'CURRENT' },
            { lbl: 'Wave height', val: latest.wave_height_m.toFixed(2), unit: 'm', ac: '#a78bfa', c: '#a78bfa', t: 'CURRENT' },
            { lbl: 'Wind speed', val: latest.wind_speed_kmh.toFixed(1), unit: 'km/h', ac: '#f97316', c: '#f97316', t: 'CURRENT' },
            { lbl: 'Turbidity', val: latest.turbidity_ntu.toFixed(2), unit: 'NTU', ac: '#38beff', c: '#38beff', t: 'CURRENT' },
          ].map((k) => (
            <div className="wc-kcard" key={k.lbl} style={{ '--ac': k.ac }}>
              <div className="wc-klbl">{k.lbl}</div>
              <div className="wc-kval">{k.val}</div>
              <div className="wc-kunit">{k.unit}</div>
              <div className="wc-kstatus" style={{ color: k.c }}>
                {k.t}
              </div>
            </div>
          ))}
      </div>

      <div className="wc-kpis">
        {kpis.map((k) => (
          <div className="wc-kcard" key={k.lbl} style={{ '--ac': k.ac }}>
            <div className="wc-klbl">{k.lbl}</div>
            <div className="wc-kval">{k.val}</div>
            <div className="wc-kunit">{k.unit}</div>
            <div className="wc-kstatus" style={{ color: k.c }}>
              {k.t}
            </div>
          </div>
        ))}
      </div>

      <div className="wc-meter-row">
        {meters.map((m) => (
          <div className="wc-meter" key={m.lbl}>
            <div className="wc-mlbl">{m.lbl}</div>
            <div className="wc-mbar-bg">
              <div className="wc-mbar-fg" style={{ width: `${Math.round(m.val)}%`, background: m.color }} />
            </div>
            <div className="wc-mval" style={{ color: m.color }}>
              {Math.round(m.val)}%
            </div>
            <div className="wc-munit">{m.unit}</div>
          </div>
        ))}
      </div>

      <div className="wc-section">
        <div className="wc-stitle">Turbidity · water clarity over time</div>
      </div>
      <div className="wc-panel-wrap">
        <div className="wc-panel wc-full">
          <div className="wc-ctitle">
            <span>Turbidity (NTU) - raw, with safe-dive threshold</span>
            <span className="wc-cbadge" style={{ color: '#38beff', borderColor: '#1a4060' }}>
              PRIMARY
            </span>
          </div>
          <div className="wc-chart wc-chart-lg">
            <canvas ref={cTRef} />
          </div>
          <div className="wc-leg">
            <span className="wc-li">
              <span className="wc-ls" style={{ background: '#38beff' }} />Raw NTU
            </span>
            <span className="wc-li">
              <span className="wc-ld" style={{ borderColor: '#ff4d6a' }} />Safe limit (5 NTU)
            </span>
          </div>
        </div>
      </div>

      <div className="wc-section">
        <div className="wc-stitle">Sea conditions</div>
      </div>
      <div className="wc-charts-wrap">
        <div className="wc-panel">
          <div className="wc-ctitle">
            <span>Wave height (m)</span>
            <span className="wc-cbadge" style={{ color: '#a78bfa', borderColor: '#2d1f5a' }}>
              SAFETY
            </span>
          </div>
          <div className="wc-chart">
            <canvas ref={cWRef} />
          </div>
        </div>
        <div className="wc-panel">
          <div className="wc-ctitle">
            <span>Wind speed (km/h)</span>
            <span className="wc-cbadge" style={{ color: '#f97316', borderColor: '#3a210d' }}>
              SAFETY
            </span>
          </div>
          <div className="wc-chart">
            <canvas ref={cWindRef} />
          </div>
        </div>
      </div>

      <div className="wc-section">
        <div className="wc-stitle">Temperature context</div>
      </div>
      <div className="wc-charts-wrap" style={{ paddingBottom: '1.5rem' }}>
        <div className="wc-panel wc-full">
          <div className="wc-ctitle">
            <span>Sea surface temp (C)</span>
            <span className="wc-cbadge" style={{ color: '#fb923c', borderColor: '#3a1f0a' }}>
              ENV
            </span>
          </div>
          <div className="wc-chart">
            <canvas ref={cSSTRef} />
          </div>
        </div>
      </div>
    </section>
  )
}
