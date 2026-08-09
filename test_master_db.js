const https = require('https');

const MASTER_DB_ID = '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s';
const SHEET_NAME = 'MF_Data';

const url = `https://docs.google.com/spreadsheets/d/${MASTER_DB_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

console.log(`Fetching from: ${url}`);

https.get(url, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Received ${data.length} bytes of CSV data!`);
    console.log('First 5 lines of CSV:');
    console.log(data.split('\n').slice(0, 5).join('\n'));
  });
}).on('error', err => {
  console.error('Error:', err);
});
