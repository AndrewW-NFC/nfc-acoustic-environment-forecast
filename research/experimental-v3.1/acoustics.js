/* Physical calculations, independent of the UI. See acoustic-model.md. */
(function (root) {
  'use strict';
  const frequencies = [2000, 4000, 6000, 8000, 10000];
  const levels = [1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600, 575, 550, 525, 500];
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const rad = d => d * Math.PI / 180;
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
  function windAtHeight(speed, height) {
    if (!finite(speed) || speed < 0 || !finite(height) || height < 0.5 || height > 30) return null;
    return speed * (height / 10) ** 0.2;
  }
  function windVector(speed, direction) {
    if (!finite(speed) || speed < 0 || (!finite(direction) && speed !== 0)) return {u: null, v: null};
    return {u: -speed * Math.sin(rad(direction || 0)), v: -speed * Math.cos(rad(direction || 0))};
  }
  function parseProfiles(data) {
    const hourly = data.hourly || {}, elevation = data.elevation;
    return new Map((hourly.time || []).map((time, i) => {
      if (!finite(elevation)) return [time, []];
      const read = key => finite(hourly[key]?.[i]) ? hourly[key][i] : null;
      const surface = {z: 2, temp: read('temperature_2m'), humidity: read('relative_humidity_2m'),
        pressure: read('surface_pressure'), ...windVector(read('wind_speed_10m'), read('wind_direction_10m'))};
      const profile = [surface];
      for (const p of levels) {
        const h = read(`geopotential_height_${p}hPa`);
        // Exclude below-ground pressure levels, including extrapolated values.
        if (h == null || h - elevation <= 2 || surface.pressure == null || p >= surface.pressure) continue;
        profile.push({z: h - elevation, temp: read(`temperature_${p}hPa`),
          humidity: read(`relative_humidity_${p}hPa`), pressure: p,
          ...windVector(read(`wind_speed_${p}hPa`), read(`wind_direction_${p}hPa`))});
      }
      return [time, profile.sort((a, b) => a.z - b.z)];
    }));
  }
  function interpolate(profile, z) {
    if (!profile?.length) return null;
    // Hold 2 m thermodynamics and 10 m wind constant below the lowest level.
    if (z <= profile[0].z) return {...profile[0], z};
    const i = profile.findIndex(p => p.z >= z);
    if (i < 1) return null;
    const a = profile[i - 1], b = profile[i], t = (z - a.z) / (b.z - a.z);
    const out = {z};
    for (const k of ['temp', 'humidity', 'pressure', 'u', 'v'])
      {
      const fraction = (k === 'u' || k === 'v') && a.z < 10 ? Math.max(0, (z - 10) / (b.z - 10)) : t;
      out[k] = finite(a[k]) && finite(b[k]) ? a[k] + (b[k] - a[k]) * fraction : null;
    }
    return out;
  }
  function validateSettings(s) {
    return finite(s.microphone_m) && s.microphone_m >= 0.5 && s.microphone_m <= 30 &&
      finite(s.caller_m) && s.caller_m >= 50 && s.caller_m <= 1000 &&
      finite(s.horizontal_m) && s.horizontal_m >= 0 && s.horizontal_m <= 2000;
  }
  function analyze(weather, settings) {
    if (!validateSettings(settings)) throw new Error('Invalid acoustic scenario settings.');
    const distance = Math.hypot(settings.caller_m - settings.microphone_m, settings.horizontal_m);
    const profile = weather.acoustic_profile;
    const samples = Array.from({length: 64}, (_, i) => interpolate(profile,
      settings.microphone_m + (settings.caller_m - settings.microphone_m) * (i + 0.5) / 64));
    const profileOK = samples.every(validAir) && validAir(interpolate(profile, settings.caller_m));
    const surfaceOK = validAir(weather);
    const mode = profileOK ? 'vertical_profile' : surfaceOK ? 'surface_uniform' : 'unavailable';
    const used = profileOK ? samples : [weather];
    const losses = frequencies.map(hz => ({hz, absorption_db: mode === 'unavailable' ? null :
      used.reduce((sum, a) => sum + absorption(hz, a), 0) / used.length * distance}));
    const directions = [];
    const bottom = interpolate(profile, Math.max(10, settings.microphone_m));
    const top = interpolate(profile, settings.caller_m);
    if (settings.horizontal_m > 0 && bottom && top && [bottom.temp, top.temp, bottom.u, bottom.v, top.u, top.v].every(finite)) {
      for (const [name, bearing] of [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]) {
        // bearing is the SOURCE location; sound travels in the opposite direction.
        const propagation = rad(bearing + 180);
        const speed = a => Math.sqrt(1.4 * 287.05 * (a.temp + 273.15)) + a.u * Math.sin(propagation) + a.v * Math.cos(propagation);
        const gradient = (speed(top) - speed(bottom)) / (top.z - bottom.z) * 100;
        directions.push({source_direction: name, effective_speed_gradient_ms_per_100m: gradient,
          tendency: Math.abs(gradient) < 0.1 ? 'weak net bending' : gradient > 0 ? 'downward bending tendency' : 'upward bending tendency'});
      }
    }
    const covered = (profile || []).filter(p => p.z <= settings.caller_m);
    const upper = (profile || []).find(p => p.z >= settings.caller_m);
    if (upper && !covered.includes(upper)) covered.push(upper);
    const maxGap = covered.length > 1 ? Math.max(...covered.slice(1).map((p, i) => p.z - covered[i].z)) : null;
    return {mode, scenario: {...settings}, path_m: distance,
      air_inputs: {surface: {temp_c: weather.temp, humidity_pct: weather.humidity, pressure_hpa: weather.pressure},
        profile_source: profile?.length ? "Open-Meteo GFS global" : null, profile: profile || null},
      geometric_spreading_db_re_1m: 20 * Math.log10(distance), losses, directions,
      max_profile_gap_m: maxGap, profile_error: weather.profile_error || null,
      wind_at_microphone_ms: windAtHeight(weather.wind_speed_10m, settings.microphone_m),
      gust_at_microphone_ms: windAtHeight(weather.gust_speed_10m, settings.microphone_m)};
  }
  // Planning bands, not calibrated detection probabilities. See acoustic-model.md.
  function outlook(hourly, local = {}) {
    const bands = ['Favorable', 'Mixed', 'Difficult'];
    const rated = hourly.map(h => {
      const p = h.propagation;
      const loss = p.losses.find(f => f.hz === 6000)?.absorption_db;
      const wind = p.wind_at_microphone_ms, gust = p.gust_at_microphone_ms;
      const valid = finite(loss) && finite(p.path_m) && p.path_m > 0 && finite(wind) && finite(gust) && finite(h.precipitation_mm);
      if (!valid) return {timestamp:h.timestamp, tier:null, factors:[], mode:p.mode};
      const absorption = loss / p.path_m * 100;
      const factors = [
        {name:'High-frequency sound loss', tier:absorption > 10 ? 2 : absorption > 5 ? 1 : 0},
        {name:'Wind noise', tier:wind >= 6 || gust >= 10 ? 2 : wind >= 3 || gust >= 7 ? 1 : 0},
        {name:'Precipitation noise', tier:h.precipitation_mm >= 1 ? 2 : h.precipitation_mm >= 0.25 ? 1 : 0},
        {name:'Insect noise', tier:local.insects === 'heavy' ? 2 : local.insects === 'moderate' ? 1 : 0},
        {name:'Leaf rustle', tier:Number(local.foliage) >= 1.35 && wind >= 3 ? (wind >= 6 ? 2 : 1) : 0},
      ];
      return {timestamp:h.timestamp, tier:Math.max(...factors.map(f=>f.tier)), factors, mode:p.mode};
    });
    const valid = rated.filter(h=>h.tier != null);
    const consistent = new Set(valid.map(h=>h.mode)).size === 1;
    if (!rated.length || valid.length !== rated.length || !consistent) return {
      label:'Uncertain', tone:'uncertain', summary:'Not enough consistent data for a dependable nightly outlook.',
      concern:'Incomplete or mixed acoustic data', window:null, hourly:rated.map(h=>({timestamp:h.timestamp,label:h.tier==null?'Unavailable':bands[h.tier]}))};
    const good = valid.filter(h=>h.tier===0).length, poor = valid.filter(h=>h.tier===2).length;
    const tier = poor >= valid.length/2 ? 2 : good >= valid.length*2/3 ? 0 : 1;
    const totals = valid[0].factors.map((f,i)=>({name:f.name,total:valid.reduce((sum,h)=>sum+h.factors[i].tier,0)})).sort((a,b)=>b.total-a.total);
    const bestTier = Math.min(...valid.map(h=>h.tier));
    const groups=[];
    for (const h of valid) {
      if(h.tier!==bestTier) continue;
      const previous=groups.at(-1);
      if(previous && Date.parse(h.timestamp)-Date.parse(previous.at(-1).timestamp)===3600000) previous.push(h);
      else groups.push([h]);
    }
    groups.sort((a,b)=>b.length-a.length);
    const best=groups[0];
    return {label:bands[tier],tone:['favorable','mixed','difficult'][tier],
      summary:["Relatively little modeled interference; a promising night to record.","Some limitations are likely. Conditions may suit stronger or closer calls.","Substantial interference or sound loss may limit faint and distant calls."][tier],
      concern:totals[0].total ? totals[0].name : 'No major limitation indicated',
      window:bestTier===2 ? null : {start:best[0].timestamp,last_hour:best.at(-1).timestamp,hours:best.length,label:bands[bestTier]},
      hourly:rated.map(h=>({timestamp:h.timestamp,label:bands[h.tier]}))};
  }
  const api = {frequencies, levels, absorption, windAtHeight, windVector, parseProfiles, interpolate, validateSettings, analyze, outlook};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AcousticPropagation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
