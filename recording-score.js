/* A transparent planning index for masking noise, not a calibrated detection model. */
(function(root) {
  'use strict';
  const finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const limits = {'Wind noise':7,'Precipitation noise':7,'Leaf rustle':1,'Insect noise':3};
  const roundHalf = x => Math.round(x * 2) / 2;
  function descriptor(score) {
    if(score == null) return 'Unavailable';
    if(score>=9) return 'Excellent';
    if(score>=8) return 'Great';
    if(score>=7) return 'Good';
    if(score>=6) return 'Fair';
    if(score>=5) return 'Marginal';
    if(score>=3) return 'Poor';
    return 'Bad';
  }
  function interpolate(x, points) {
    for(let i=1;i<points.length;i++) if(x<=points[i][0]) {
      const [a,b]=points[i-1], [c,d]=points[i];
      return b+(d-b)*(x-a)/(c-a);
    }
    return points.at(-1)[1];
  }
  function analyze(weather, settings) {
    const w=weather?.wind_speed_10m, g=weather?.gust_speed_10m, p=weather?.precipitation;
    if(![w,g,p].every(finite) || ![1,1.15,1.35,1.6].includes(settings?.foliage) || !['low','moderate','heavy'].includes(settings?.insects))
      return {score_10:null,descriptor:'Unavailable',deductions:null};
    // Speeds are weather-model 10 m values; do not infer wind at the microphone.
    // Gusts and sustained wind share one penalty, avoiding double counting.
    const wind=Math.max(interpolate(w,[[0,0],[1,0],[3,1],[5,2.5],[8,5],[12,7]]),
      interpolate(g,[[0,0],[3,0],[6,1],[10,2.5],[15,5],[20,7]]));
    const rain=interpolate(p,[[0,0],[0.1,0.5],[0.5,2],[1,3.5],[2.5,5.5],[5,7]]);
    const foliage=({1:0,1.15:0.25,1.35:0.6,1.6:1})[settings.foliage];
    const leaves=foliage*interpolate(Math.max(w,g/2),[[0,0],[1,0],[5,1]]);
    const insects=({low:0,moderate:1.5,heavy:3})[settings.insects];
    const deductions={'Wind noise':wind,'Precipitation noise':rain,'Leaf rustle':leaves,'Insect noise':insects};
    const raw=Math.max(0,10-Object.values(deductions).reduce((a,b)=>a+b,0));
    return {raw_score_10:raw,score_10:roundHalf(raw),descriptor:descriptor(roundHalf(raw)),deductions};
  }
  function summarize(hourly, contiguous=true) {
    const valid=hourly.filter(h=>h.recording?.score_10!=null);
    const complete=hourly.length>0 && valid.length===hourly.length && contiguous;
    const deductions=complete?Object.fromEntries(Object.keys(limits).map(k=>[k,valid.reduce((sum,h)=>sum+h.recording.deductions[k],0)/valid.length])):null;
    const raw=complete?valid.reduce((sum,h)=>sum+h.recording.raw_score_10,0)/valid.length:null;
    const score=raw==null?null:roundHalf(raw);
    const sorted=deductions?Object.entries(deductions).sort((a,b)=>b[1]-a[1]):[];
    const concerns=sorted.filter(([,v])=>v>=0.25).slice(0,2).map(([k])=>k);
    const explanations={'Wind noise':'Wind at the microphone can cover faint calls.',
      'Precipitation noise':'Wet weather may add tapping or splashing near the microphone.',
      'Leaf rustle':'Wind moving nearby leaves can cover faint calls.',
      'Insect noise':'The insect noise you selected may overlap bird calls.'};
    return {score_10:score,descriptor:descriptor(score),available_hours:valid.length,total_hours:hourly.length,
      deductions,top_issue:!complete?'Missing weather data':concerns[0] || 'No major noise concern indicated',
      explanation:!complete?'Not enough weather data to rate this night.':concerns.length?concerns.map(k=>explanations[k]).join(' '):'Little interference from the noise sources included in this score.',
      expectation:score==null?'Rating unavailable.':score>=8?'Promising conditions for clear calls.':score>=6?'Some background noise may cover faint calls.':score>=4?'Background noise may make faint calls difficult to hear.':'Substantial noise interference is possible.'};
  }
  const api={analyze,summarize,descriptor,limits};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  root.RecordingScore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
