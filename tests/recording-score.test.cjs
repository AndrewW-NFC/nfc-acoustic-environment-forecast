const test=require('node:test'),assert=require('node:assert/strict');
const r=require('../recording-score.js');
const weather={wind_speed_10m:0,gust_speed_10m:0,precipitation:0};
const settings={foliage:1,insects:'low'};
const score=(w=weather,s=settings)=>r.analyze(w,s);
test('calm dry quiet reaches 10 and combined noise can reach 0',()=>{
  assert.equal(score().score_10,10);
  assert.equal(score({...weather,wind_speed_10m:20,gust_speed_10m:30,precipitation:10},{foliage:1.6,insects:'heavy'}).score_10,0);
  assert.equal(score({...weather,wind_speed_10m:20}).descriptor,'Poor');
  assert.equal(score({...weather,precipitation:10}).descriptor,'Poor');
});
test('every weather noise input is monotonic and ratings remain bounded',()=>{
  for(const key of Object.keys(weather)) {
    let previous=10;
    for(let value=0;value<=30;value+=0.25) {
      const result=score({...weather,[key]:value});
      assert.ok(result.score_10<=previous && result.score_10>=0);
      previous=result.score_10;
    }
  }
});
test('gusts do not duplicate sustained wind and calm foliage is not penalized',()=>{
  assert.equal(score(weather,{foliage:1.6,insects:'low'}).score_10,10);
  const wind=score({...weather,wind_speed_10m:8,gust_speed_10m:10});
  assert.equal(wind.deductions['Wind noise'],5);
  assert.ok(score({...weather,wind_speed_10m:8},{foliage:1.6,insects:'low'}).raw_score_10<wind.raw_score_10);
  assert.equal(score(weather,{foliage:1,insects:'heavy'}).score_10,7);
});
test('unscored atmospheric inputs and height cannot change the rating',()=>{
  assert.deepEqual(score({...weather,temp:-30,humidity:0,pressure:800,cloud_cover:100,visibility:0}),score());
  assert.deepEqual(score(weather,{...settings,microphone_m:20}),score());
});
test('missing and invalid weather does not become a quiet hour or complete night',()=>{
  for(const key of Object.keys(weather)) for(const v of [null,undefined,NaN,-1]) assert.equal(score({...weather,[key]:v}).score_10,null);
  assert.equal(r.summarize([]).score_10,null);
  assert.equal(r.summarize([{recording:score()},{recording:score({...weather,precipitation:null})}]).score_10,null);
  assert.equal(r.summarize([{recording:score()}],false).score_10,null);
});
test('night score averages unrounded hourly values, rounds once and uses one-word labels',()=>{
  const hourly=[{recording:score({...weather,wind_speed_10m:2.6})},{recording:score({...weather,precipitation:0.12})}];
  const expected=Math.round(hourly.reduce((sum,h)=>sum+h.recording.raw_score_10,0)/2*2)/2;
  assert.equal(r.summarize(hourly).score_10,expected);
  for(let n=0;n<=10;n+=0.5) assert.match(r.descriptor(n),/^\w+$/);
  for(const [v,label] of [[9,'Excellent'],[8,'Great'],[7,'Good'],[6,'Fair'],[5,'Marginal'],[3,'Poor'],[0,'Bad']]) assert.equal(r.descriptor(v),label);
});
