/* Shared with NFC Tools precipitation.py. See rainfall-contract.md. */
(function (root) {
  const SOURCE = 'https://archive-api.open-meteo.com/v1/archive';
  const MODEL = 'ecmwf_ifs';
  const CONTRACT = 'overnight-precipitation-v1';
  function localParts(instant, timezone) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function instantAt(day, hour, timezone) {
    const target = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
    let instant = target;
    for (let i = 0; i < 4; i++) {
      const p = localParts(new Date(instant), timezone);
      const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
      if (wall === target) return instant / 1000;
      instant += target - wall;
    }
    throw new Error('Could not resolve the overnight window in this timezone.');
  }
  function nightWindow(evening, timezone) {
    const next = new Date(Date.parse(`${evening}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    return [instantAt(evening, 18, timezone), instantAt(next, 6, timezone)];
  }
  const utc = stamp => new Date(stamp * 1000).toISOString();
  function summarizePayload(data, evening, latitude, longitude, timezone, now = Date.now() / 1000) {
    const [start, end] = nightWindow(evening, timezone);
    const expected = [];
    for (let t = start + 3600; t <= end; t += 3600) expected.push(t);
    const byEnd = new Map();
    (data.hourly?.time || []).forEach((t, i) => {
      if (expected.includes(t)) byEnd.set(t, [...(byEnd.get(t) || []), data.hourly.precipitation?.[i]]);
    });
    const intervals = expected.map(t => {
      const candidates = byEnd.get(t) || [];
      const valid = data.hourly_units?.precipitation === 'mm' && candidates.length > 0 &&
        candidates.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) &&
        new Set(candidates).size === 1;
      return { interval_start_utc: utc(t - 3600), interval_end_utc: utc(t),
        precipitation_mm: valid ? candidates[0] : null };
    });
    const values = intervals.map(r => r.precipitation_mm).filter(v => v !== null);
    const complete = now >= end && values.length === expected.length;
    const subtotal = Number(values.reduce((a, b) => a + b, 0).toFixed(6));
    return { contract: CONTRACT, evening_date: evening, source: SOURCE, model: MODEL,
      data_kind: 'modeled_estimate', latitude, longitude, timezone,
      grid_latitude: data.latitude ?? null, grid_longitude: data.longitude ?? null,
      grid_elevation_m: data.elevation ?? null,
      window_start: utc(start), window_end: utc(end), retrieved_at_utc: utc(now),
      status: complete ? 'complete' : now < end ? 'in_progress' : 'incomplete',
      expected_hours: expected.length, available_hours: values.length,
      total_mm: complete ? subtotal : null,
      total_in: complete ? Number((subtotal / 25.4).toFixed(6)) : null,
      available_subtotal_mm: subtotal, intervals };
  }
  async function fetchSummaries(nights, latitude, longitude, timezone) {
    if (!nights.length) return;
    const eligible = nights.filter(n => n.night_date >= '2017-01-01' &&
      nightWindow(n.night_date, timezone)[1] <= Date.now() / 1000);
    let data = {}, error = '';
    if (eligible.length) {
      const bounds = eligible.map(n => nightWindow(n.night_date, timezone));
      const url = new URL(SOURCE);
      Object.entries({ latitude, longitude, hourly: 'precipitation', models: MODEL,
        precipitation_unit: 'mm', timezone: 'UTC', timeformat: 'unixtime', cell_selection: 'land',
        start_date: utc(Math.min(...bounds.map(b => b[0]))).slice(0, 10),
        end_date: utc(Math.max(...bounds.map(b => b[1]))).slice(0, 10),
      }).forEach(([k, v]) => url.searchParams.set(k, v));
      try {
        const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error(`Precipitation source returned HTTP ${response.status}`);
        data = await response.json();
      } catch (e) { error = e.message; }
    }
    nights.forEach(n => {
      n.precipitation_summary = summarizePayload(data, n.night_date, latitude, longitude, timezone);
      if (n.night_date < '2017-01-01') n.precipitation_summary.error = 'The shared ECMWF IFS source starts in 2017.';
      else if (error) n.precipitation_summary.error = error;
    });
  }
  function summaryText(s) {
    if (!s) return 'Not retrieved';
    const amount = s.total_mm == null ? `Total unavailable (${s.status})` :
      `${s.total_in.toFixed(3)} in (${s.total_mm.toFixed(2)} mm)`;
    return `${amount}; ${s.evening_date} 18:00–next day 06:00 ${s.timezone}; ` +
      `${s.available_hours}/${s.expected_hours} hours; Open-Meteo ECMWF IFS model estimate; ` +
      `retrieved ${s.retrieved_at_utc}${s.error ? '; ' + s.error : ''}`;
  }
  const api = {SOURCE, MODEL, CONTRACT, nightWindow, summarizePayload, fetchSummaries, summaryText};
  if (typeof module !== 'undefined') module.exports = api;
  else root.OvernightPrecipitation = api;
})(globalThis);
