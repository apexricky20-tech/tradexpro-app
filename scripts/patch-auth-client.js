/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const OLD = 'https://${r}/oauth2/sessions/active';
const NEW = 'https://tradexpro-backend.apexricky20.workers.dev/session';

const locations = [
  path.join(__dirname, '../packages/hooks/node_modules/@deriv-com/auth-client/dist/tmb/tmb.js'),
  path.join(__dirname, '../node_modules/@deriv-com/auth-client/dist/tmb/tmb.js'),
];

const results = locations
  .filter(file => fs.existsSync(file))
  .map(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(OLD)) {
      fs.writeFileSync(file, content.split(OLD).join(NEW));
      console.log('Patched:', file);
      return true;
    }
    if (content.includes(NEW)) {
      console.log('Already patched:', file);
      return true;
    }
    console.log('Pattern not found in:', file);
    return false;
  });

if (!results.some(Boolean)) {
  console.error('Patch failed - tmb.js not found in any expected location');
  process.exit(1);
}
