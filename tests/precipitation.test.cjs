const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rain = require('../precipitation.js');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'precipitation-fixtures.json')));
for (const c of cases) test(c.name, () => {
  const result = rain.summarizePayload(c.data, c.evening, 42.41465, -71.17286, c.timezone, c.now);
  assert.equal(result.total_mm, c.total);
  assert.equal(result.status, c.status);
  assert.equal(result.expected_hours, c.hours);
  assert.equal(new Set(result.intervals.map(i => i.interval_end_utc)).size, c.hours);
});
test('app script syntax and missing precipitation remain explicit', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const MODEL_VERSION'));
  new vm.Script(script);
  const start = script.indexOf('function parseHourlyPayload(');
  const end = script.indexOf('async function detectTimezoneName', start);
  const parse = new Function('windToMps', 'sanitizeGust', 'estimateGroundWind', 'estimateVisibility', 'parseLocalDateTime',
    script.slice(start, end) + '; return parseHourlyPayload;')(v => v, (_, g) => g, v => v, () => 10000, v => v);
  assert.equal(parse({hourly:{time:['2026-09-21T02:00'],precipitation:[null]}}, true)[0].precipitation, null);
  assert.equal(parse({hourly:{time:['2026-09-21T02:00'],precipitation:[0]}}, true)[0].precipitation, 0);
});

test('fetch pins the shared source; failure cannot become a dry night', async () => {
  const originalFetch = global.fetch;
  let requested;
  try {
    global.fetch = async url => { requested = new URL(url); return {ok: true, json: async () => cases[0].data}; };
    const nights = [{night_date: '2026-03-07'}];
    await rain.fetchSummaries(nights, 42, -71, 'America/New_York');
    assert.equal(requested.origin + requested.pathname, rain.SOURCE);
    for (const [key, value] of Object.entries({models:'ecmwf_ifs', timezone:'UTC', timeformat:'unixtime', precipitation_unit:'mm', cell_selection:'land'})) {
      assert.equal(requested.searchParams.get(key), value);
    }
    global.fetch = async () => { throw Error('offline'); };
    await rain.fetchSummaries(nights, 42, -71, 'America/New_York');
    assert.equal(nights[0].precipitation_summary.total_mm, null);
    assert.equal(nights[0].precipitation_summary.status, 'incomplete');
    assert.equal(nights[0].precipitation_summary.error, 'offline');
  } finally { global.fetch = originalFetch; }
});
