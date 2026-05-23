require('dotenv').config();
const fs = require('fs');
const http = require('http');
const creds = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'qa-help-support-creds.json'), 'utf8'));

function jar(set, prev = '') {
  const j = {};
  (prev || '').split(';').filter(Boolean).forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) j[p.slice(0, i).trim()] = p.slice(i + 1);
  });
  (set || []).forEach((l) => {
    const p = String(l).split(';')[0];
    const i = p.indexOf('=');
    if (i > 0) j[p.slice(0, i)] = p.slice(i + 1);
  });
  return Object.entries(j).map(([k, v]) => `${k}=${v}`).join('; ');
}

function req(method, urlPath, body, cookies, extra = {}) {
  return new Promise((resolve, reject) => {
    const isBuf = Buffer.isBuffer(body);
    const data = body && !isBuf ? JSON.stringify(body) : body;
    const u = new URL(urlPath, 'http://localhost:5000');
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { Accept: 'application/json', ...extra },
    };
    if (cookies) opts.headers.Cookie = cookies;
    const m = cookies && cookies.match(/XSRF-TOKEN=([^;]+)/);
    if (m && method !== 'GET') opts.headers['X-XSRF-TOKEN'] = decodeURIComponent(m[1]);
    if (data && !isBuf) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    } else if (isBuf) {
      opts.headers['Content-Length'] = data.length;
    }
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let json = {};
        try {
          json = JSON.parse(raw);
        } catch {
          json = { raw };
        }
        resolve({ status: res.statusCode, json, set: res.headers['set-cookie'] });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const admin = await req('POST', '/api/auth/login', {
    instituteNumber: creds.schoolA.institute,
    username: creds.schoolAAdmin.username,
    password: creds.schoolAAdmin.password,
  });
  console.log('Administrative login', admin.status, admin.json.message);
  const cAdmin = jar(admin.set);
  const list = await req('GET', '/api/help-support/tickets', null, cAdmin);
  console.log('Administrative ticket count', list.json.data?.length ?? 0);

  const hm = await req('POST', '/api/auth/login', {
    instituteNumber: creds.schoolA.institute,
    username: creds.schoolA.username,
    password: creds.schoolA.password,
  });
  const cHm = jar(hm.set);
  const boundary = `----qa${Date.now()}`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n`
    ),
    png,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\nsupport\r\n--${boundary}--\r\n`),
  ]);
  const up = await req('POST', '/api/storage/upload', body, cHm, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  });
  console.log('Valid PNG upload', up.status, up.json.data?.relativePath);

  const badBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="bad.exe"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ),
    Buffer.from('MZ'),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\nsupport\r\n--${boundary}--\r\n`),
  ]);
  const bad = await req('POST', '/api/storage/upload', badBody, cHm, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  });
  console.log('Invalid exe upload', bad.status, bad.json.message);
}

main().catch(console.error);
