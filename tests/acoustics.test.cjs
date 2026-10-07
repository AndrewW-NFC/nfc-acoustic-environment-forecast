const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const a=require('../acoustics.js');
const air={temp:20,humidity:70,pressure:1013.25};
test('conditional absorption agrees with rounded reference coefficients',()=>{
  for(const [f,expected] of [[1000,5],[2000,9],[4000,22.9],[8000,76.6]])
    assert.ok(Math.abs(a.absorption(f,air)*1000-expected)/expected<0.02);
});
test('missing or out-of-envelope air cannot become zero loss',()=>{
  for(const change of [{temp:null},{humidity:null},{pressure:null},{temp:-30},{humidity:0},{pressure:400}]){
    const result=a.analyze({...air,...change});assert.equal(result.status,'unavailable');
    assert.ok(result.coefficients.every(f=>f.db_per_100m===null));
  }
  assert.equal(a.analyze(null).status,'unavailable');
});
test('active API has no source geometry, inferred microphone wind, rating or bending model',()=>{
  for(const k of ['outlook','windAtHeight','parseProfiles','interpolate']) assert.equal(a[k],undefined);
  const result=a.analyze(air);assert.equal(result.units,'dB/100m');
  assert.equal(result.path_m,undefined);assert.equal(result.directions,undefined);
  assert.equal(result.coefficients[2].db_per_100m,a.absorption(6000,air)*100);
});
test('partial summaries preserve coverage and zero precipitation distinctly from missing',()=>{
  const result=a.summarize([{absorption:a.analyze(air),wind_10m_ms:0,gust_10m_ms:4,precipitation_mm:0},
    {absorption:a.analyze(null),wind_10m_ms:null,gust_10m_ms:null,precipitation_mm:null}]);
  assert.equal(result.absorption[2].available_hours,1);assert.equal(result.absorption[2].total_hours,2);
  assert.equal(result.wind_10m_ms.min,0);assert.equal(result.wind_10m_ms.available_hours,1);
  assert.deepEqual(result.precipitation,{positive_intervals:0,available_intervals:1,total_intervals:2});
  assert.equal(a.summarize([]).absorption[0].min,null);
});
function app(){
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const MODEL_VERSION'));
  new vm.Script(source);
  const script=source.slice(0,source.indexOf('els.runBtn.addEventListener')).replace(/^\s*(initLocationMap|initializeHistoricalExportDates|initializeApproximateLocation)\(\);/gm,'');
  const elements=new Map();
  const context=vm.createContext({AcousticPropagation:a,URL,Date,console,
    document:{getElementById(id){if(!elements.has(id))elements.set(id,{value:'2',selectedOptions:[{textContent:'Selected'}]});return elements.get(id)},createElement(){return {}}},
    localStorage:{getItem(){return null},setItem(){}},});
  vm.runInContext(script,context);return context;
}
test('UI, TXT, JSON and CSV expose coefficients without unvalidated predictions',()=>{
  const c=app();c.night={night_date:'2026-10-07',window_start:new Date('2026-10-07T20:00'),window_end:new Date('2026-10-07T20:00'),
    all_forecasts:[{time:new Date('2026-10-07T20:00'),weather:{...air,wind_speed_10m:3,gust_speed_10m:7,precipitation:0}}]};
  const n=vm.runInContext('serializeNight(night,"Tonight","forecast")',c);
  for(const k of ['outlook','scenario','lowest_absorption_hour_6khz','profile_coverage_hours'])assert.equal(n[k],undefined);
  const csv=vm.runInContext('rowsToCsv(exportRowsForNight(night,true))',c);
  assert.match(csv,/absorption_6000_db_per_100m/);assert.doesNotMatch(csv,/caller_m|promising_hours|wind_at_microphone|outlook/);
  const txt=vm.runInContext('generateReport(42,-71,"America/New_York","Test",[night],[])',c);
  assert.match(txt,/dB\/100 m/);assert.doesNotMatch(txt,/Favorable|Most promising hours|caller scenario/);
  const card=vm.runInContext('renderNightCard(serializeNight(night,"Tonight","forecast")).innerHTML',c);
  assert.match(card,/coefficient, not the loss/);assert.doesNotMatch(card,/Mixed|Most promising|downward bending/);
});
test('weather parsing rejects unsupported units and preserves missing data',()=>{
  const c=app();c.payload={hourly_units:{temperature_2m:'°C',relative_humidity_2m:'%',surface_pressure:'hPa',wind_speed_10m:'km/h',wind_gusts_10m:'m/s',precipitation:'mm'},
    hourly:{time:['2026-10-07T20:00'],temperature_2m:[20],relative_humidity_2m:[70],surface_pressure:[1013.25],wind_speed_10m:[36],wind_gusts_10m:[null],precipitation:[0]}};
  let r=vm.runInContext('parseHourlyPayload(payload,false)[0]',c);assert.equal(r.wind_speed_10m,10);assert.equal(r.gust_speed_10m,null);assert.equal(r.precipitation,0);
  c.payload.hourly_units={};r=vm.runInContext('parseHourlyPayload(payload,false)[0]',c);
  assert.equal(r.temp,null);assert.equal(r.pressure,null);assert.equal(r.wind_speed_10m,null);assert.equal(r.precipitation,null);
});
