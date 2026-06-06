/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../packages/hooks/node_modules/@deriv-com/auth-client/dist/tmb/tmb.js');
if (!fs.existsSync(file)) { process.exit(0); }

const content = fs.readFileSync(file, 'utf8');
const old = `https://\${r}/oauth2/sessions/active`;
const newUrl = 'https://tradexpro-backend.apexricky20.workers.dev/session';
const result = content.replace(old, newUrl);
if (result !== content) { fs.writeFileSync(file, result); }
