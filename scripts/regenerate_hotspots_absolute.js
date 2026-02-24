#!/usr/bin/env node
// Fetch /api/hotspots and write a GeoJSON file with `risk_level` computed by absolute thresholds
const http = require('http');
const fs = require('fs');
const url = process.argv[2] || 'http://localhost:5000/api/hotspots';
const outPath = process.argv[3] || 'data/processed/hotspots.absolute.geojson';

function mapAbsolute(score) {
  const TH = { MINIMAL: 0.05, LOW: 0.10, MEDIUM: 0.20, HIGH: 0.40, CRITICAL: 1.0 };
  if (score == null) return 'Minimal';
  if (score > TH.HIGH) return 'High';
  if (score > TH.MEDIUM) return 'Medium';
  if (score > TH.LOW) return 'Low';
  return 'Minimal';
}

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      if (!j || !Array.isArray(j.features)) { console.error('Not GeoJSON'); process.exit(2); }
      j.features.forEach(f => {
        const comp = f.properties && (f.properties.composite_poverty_score ?? f.properties.MPI);
        const abs = mapAbsolute(comp);
        f.properties.risk_level = abs;
        // keep previous cluster info in a separate property
        f.properties.baked_risk_level = f.properties.risk_level_backup || f.properties.cluster_label || f.properties.risk_level;
      });
      fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(j, null, 2), 'utf8');
      console.log('WROTE:', outPath);
    } catch (err) { console.error('PARSE_ERROR', err.message); process.exit(2); }
  });
}).on('error', (e) => { console.error('REQUEST_ERROR', e.message); process.exit(2); });
