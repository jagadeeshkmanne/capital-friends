const fs = require('fs');
const file = fs.readFileSync('react-app/src/pages/dashboard/Dashboard.jsx', 'utf8');
console.log(file.split('\n').slice(118, 140).join('\n'));
