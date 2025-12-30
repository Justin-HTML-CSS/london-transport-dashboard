const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/vehicles-test',
  method: 'GET',
  timeout: 10000
};

const req = http.request(options, (res) => {
  let data = '';
  console.error('HTTP status:', res.statusCode);
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.error('Response length (bytes):', data.length);
    try {
      const arr = JSON.parse(data);
      console.log(JSON.stringify(arr.slice(0, 3), null, 2));
      process.exit(0);
    } catch (err) {
      console.error('❌ Parse error:', err.message);
      console.error('Response snippet:', data.slice(0, 1000));
      process.exit(2);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Request timed out');
  req.destroy();
  process.exit(3);
});

req.end();
