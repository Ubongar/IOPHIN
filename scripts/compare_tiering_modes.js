#!/usr/bin/env node
// Fetch /api/hotspots and compute risk tier counts for 'cluster' vs 'absolute'
const http = require('http');
const url = process.argv[2] || 'http://localhost:5000/api/hotspots';

function mapAbsolute(score) {
  // default thresholds matching server defaults
  const TH = { MINIMAL: 0.05, LOW: 0.10, MEDIUM: 0.20, HIGH: 0.40, CRITICAL: 1.0 };
  if (score == null) return 'Minimal';
  if (score > TH.HIGH) return 'High';
  if (score > TH.MEDIUM) return 'Medium';
  if (score > TH.LOW) return 'Low';
  return 'Minimal';
}

function analyze(geo) {
  const countsAbs = { Critical:0, High:0, Medium:0, Low:0, Minimal:0 };
  const countsBaked = { Critical:0, High:0, Medium:0, Low:0, Minimal:0 };
  const samples = [];
  geo.features.forEach(f => {
    const comp = f.properties && (f.properties.composite_poverty_score ?? f.properties.MPI);
    const abs = mapAbsolute(comp);
    const baked = f.properties && (f.properties.dynamic_risk || f.properties.risk_level || 'Minimal');
    countsAbs[abs] = (countsAbs[abs]||0) + 1;
    countsBaked[baked] = (countsBaked[baked]||0) + 1;
    if (['Eti-Osa','Eti Osa','Etiosa','Eti‑Osa'].includes(f.properties?.LGA_Name)) samples.push({name: f.properties.LGA_Name, composite: comp, baked: baked, absolute: abs});
  });
  return { countsAbs, countsBaked, samples };
}

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      if (!j || !Array.isArray(j.features)) { console.error('Not GeoJSON'); process.exit(2); }
      const result = analyze(j);
      console.log('ABSOLUTE_COUNTS:', JSON.stringify(result.countsAbs, null, 2));
      console.log('BAKED_COUNTS:', JSON.stringify(result.countsBaked, null, 2));
      console.log('SAMPLES (Eti‑Osa matches):', JSON.stringify(result.samples, null, 2));
    } catch (err) { console.error('PARSE_ERROR', err.message); process.exit(2); }
  });
}).on('error', (e) => { console.error('REQUEST_ERROR', e.message); process.exit(2); });
