/* Physical calculations, independent of the UI. See acoustic-model.md. */
(function (root) {
  'use strict';
  const frequencies = [2000, 4000, 6000, 8000, 10000];
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  function validAir(a) {
    return a && finite(a.temp) && a.temp >= -20 && a.temp <= 50 &&
      finite(a.humidity) && a.humidity >= 10 && a.humidity <= 100 &&
      finite(a.pressure) && a.pressure >= 500 && a.pressure <= 1100;
  }
  // ISO 9613-1 pure-tone absorption, dB/m. RH input is percent, pressure hPa.
  // Conservative operating envelope: -20..50 C, RH 10..100%, 500..1100 hPa.
  function absorption(f, a) {
    if (!validAir(a) || !finite(f) || f < 50 || f > 10000) return null;
    const T = a.temp + 273.15, tr = T / 293.15, pr = a.pressure / 1013.25;
    const saturationRatio = 10 ** (-6.8346 * (273.16 / T) ** 1.261 + 4.6151);
    const h = a.humidity * saturationRatio / pr;
    const oxygen = pr * (24 + 40400 * h * (0.02 + h) / (0.391 + h));
    const nitrogen = pr / Math.sqrt(tr) * (9 + 280 * h * Math.exp(-4.17 * (tr ** (-1 / 3) - 1)));
    return 8.686 * f * f * (1.84e-11 * Math.sqrt(tr) / pr + tr ** -2.5 * (
      0.01275 * Math.exp(-2239.1 / T) / (oxygen + f * f / oxygen) +
      0.1068 * Math.exp(-3352 / T) / (nitrogen + f * f / nitrogen)));
  }
  function validateSettings(s) {
    return s && finite(s.microphone_m) && s.microphone_m >= 0.5 && s.microphone_m <= 30;
  }
  // A coefficient at the model's near-surface conditions, not a bird-to-mic loss.
  function analyze(weather) {
    const valid = validAir(weather);
    return {
      status: valid ? 'available' : 'unavailable',
      basis: 'Near-surface temperature, relative humidity and surface pressure from the weather model',
      units: 'dB/100m',
      air_inputs: {temperature_c: weather?.temp ?? null, relative_humidity_pct: weather?.humidity ?? null, pressure_hpa: weather?.pressure ?? null},
      coefficients: frequencies.map(hz => ({hz, db_per_100m: valid ? absorption(hz, weather) * 100 : null})),
    };
  }
  function summarize(hourly) {
    const finiteValues = values => values.filter(finite);
    const range = values => {
      const known = finiteValues(values);
      return {min: known.length ? Math.min(...known) : null, max: known.length ? Math.max(...known) : null, available_hours:known.length, total_hours:values.length};
    };
    const precipitation = finiteValues(hourly.map(h => h.precipitation_mm));
    return {
      absorption: frequencies.map((hz,i) => ({hz,...range(hourly.map(h => h.absorption.coefficients[i].db_per_100m))})),
      wind_10m_ms: range(hourly.map(h=>h.wind_10m_ms)),
      gust_10m_ms: range(hourly.map(h=>h.gust_10m_ms)),
      precipitation: {positive_intervals:precipitation.filter(v=>v>0).length,available_intervals:precipitation.length,total_intervals:hourly.length},
    };
  }
  const api = {frequencies, absorption, validateSettings, analyze, summarize};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AcousticPropagation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
