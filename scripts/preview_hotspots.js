#!/usr/bin/env node
const http = require('http');

const url = process.argv[2] || 'http://localhost:5000/api/hotspots';

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      if (j && Array.isArray(j.features)) {
        console.log('COUNT:' + j.features.length);
        console.log('SAMPLE_PROPERTIES:');
        console.log(JSON.stringify(j.features[0].properties, null, 2));
      } else {
        console.log('RESPONSE_NOT_GEOJSON');
        console.log(typeof j);
      }
    } catch (err) {
      console.error('PARSE_ERROR', err.message);
      console.log(data.slice(0, 2000));
    }
  });
}).on('error', (e) => {
  console.error('REQUEST_ERROR', e.message);
});
