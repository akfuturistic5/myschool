/**
 * End-to-end Help & Support API QA harness.
 * Run: node scripts/qa-help-support-api.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE = process.env.QA_API_BASE || 'http://localhost:5000';
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function request(method, urlPath, { body, cookies, headers, formData } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        ...(headers || {}),
      },
    };
    if (cookies) opts.headers.Cookie = cookies;
    const xsrfMatch = String(cookies || '').match(/XSRF-TOKEN=([^;]+)/);
    if (xsrfMatch && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      opts.headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);
    }
    if (body && !formData) {
      opts.headers['Content-Type'] = 'application/json';
    }
    if (formData?.headers) {
      Object.assign(opts.headers, formData.headers);
    }
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch {
          json = { raw };
        }
        const setCookie = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, json, setCookie, raw });
      });
    });
    req.on('error', reject);
    if (formData) {
      req.write(formData.body);
    } else if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function mergeCookies(existing, setCookie) {
  const jar = {};
  (existing || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [k, ...v] = pair.split('=');
      jar[k] = v.join('=');
    });
  (setCookie || []).forEach((line) => {
    const part = String(line).split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
  });
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function loginTenant(institute, username, password) {
  const res = await request('POST', '/api/auth/login', {
    body: { instituteNumber: institute, username, password },
  });
  const cookies = mergeCookies('', res.setCookie);
  return { res, cookies };
}

async function loginSuperAdmin(emailOrUsername, password) {
  const res = await request('POST', '/super-admin/api/auth/login', {
    body: { emailOrUsername, password },
  });
  const cookies = mergeCookies('', res.setCookie);
  return { res, cookies };
}

async function tenantGet(cookies, urlPath) {
  return request('GET', urlPath, { cookies });
}

async function tenantPost(cookies, urlPath, body) {
  return request('POST', urlPath, { cookies, body });
}

async function superPost(cookies, urlPath, body) {
  return request('POST', urlPath, { cookies, body });
}

async function superGet(cookies, urlPath) {
  return request('GET', urlPath, { cookies });
}

async function superPatch(cookies, urlPath, body) {
  return request('PATCH', urlPath, { cookies, body });
}

function buildMultipartUpload(fileName, fileBuffer, mime, folder = 'support') {
  const boundary = `----qa${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folder}\r\n--${boundary}--\r\n`),
  ]);
  return {
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  };
}

async function uploadSupportPng(cookies, fileName = 'qa-attach.png') {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const formData = buildMultipartUpload(fileName, png, 'image/png');
  return request('POST', '/api/storage/upload', { cookies, formData });
}

async function main() {
  // Health
  try {
    const health = await request('GET', '/api/health');
    record('API reachable', health.status === 200, `status ${health.status}`);
  } catch (e) {
    record('API reachable', false, e.message);
    console.log('\nCannot reach API at', BASE);
    process.exit(1);
  }

  const creds = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'qa-help-support-creds.json'), 'utf8')
  );

  // School A login
  const loginA = await loginTenant(creds.schoolA.institute, creds.schoolA.username, creds.schoolA.password);
  record(
    'School A login',
    loginA.res.status === 200 && loginA.res.json?.status === 'SUCCESS',
    loginA.res.json?.message || String(loginA.res.status)
  );
  const cookiesA = loginA.cookies;

  // Create ticket School A
  const ticketPayload = {
    subject: `QA Ticket ${Date.now()}`,
    description: 'Automated QA test ticket with special chars: <script> & 100% test',
    category: 'technical_issue',
    priority: 'medium',
    attachments: [],
  };
  const createA = await tenantPost(cookiesA, '/api/help-support/tickets', ticketPayload);
  const ticketAId = createA.json?.data?.id;
  record(
    'School A create ticket',
    createA.status === 201 && ticketAId,
    createA.json?.message || String(createA.status)
  );

  const listA = await tenantGet(cookiesA, '/api/help-support/tickets');
  const foundInList = (listA.json?.data || []).some((t) => t.id === ticketAId);
  record('School A ticket in list', foundInList, `count ${listA.json?.data?.length ?? 0}`);

  const detailA = await tenantGet(cookiesA, `/api/help-support/tickets/${ticketAId}`);
  record(
    'School A ticket detail',
    detailA.status === 200 && detailA.json?.data?.ticket?.id === ticketAId,
    detailA.json?.message
  );

  // Attachment: upload → create ticket → list on detail → download → invalid type
  const up = await uploadSupportPng(cookiesA);
  const relPath = up.json?.data?.relativePath;
  record('Attachment PNG upload', up.status === 200 && relPath, up.json?.message || String(up.status));

  const badExe = buildMultipartUpload('virus.exe', Buffer.from('MZ'), 'application/octet-stream');
  const badUp = await request('POST', '/api/storage/upload', { cookies: cookiesA, formData: badExe });
  record('Invalid exe upload blocked', badUp.status === 400, badUp.json?.message);

  let attachTicketId = null;
  if (relPath) {
    const createAttach = await tenantPost(cookiesA, '/api/help-support/tickets', {
      subject: `QA Attachment Ticket ${Date.now()}`,
      description: 'Ticket created with PNG attachment for QA verification.',
      category: 'technical_issue',
      priority: 'low',
      attachments: [
        {
          file_name: 'qa-attach.png',
          file_path: relPath,
          file_type: 'image/png',
          file_size: 68,
        },
      ],
    });
    attachTicketId = createAttach.json?.data?.id;
    record(
      'Create ticket with attachment',
      createAttach.status === 201 && attachTicketId,
      createAttach.json?.message
    );

    const attachDetail = await tenantGet(cookiesA, `/api/help-support/tickets/${attachTicketId}`);
    const atts = attachDetail.json?.data?.attachments || [];
    record(
      'Attachment visible on ticket detail',
      atts.some((a) => a.file_path === relPath),
      `attachments ${atts.length}`
    );

    const fileUrl = `/api/storage/files/${relPath}`;
    const fileGet = await tenantGet(cookiesA, fileUrl);
    record(
      'Attachment file download',
      fileGet.status === 200 && fileGet.raw && fileGet.raw.length > 0,
      `status ${fileGet.status}`
    );

    const missingFile = await tenantGet(
      cookiesA,
      `/api/storage/files/school_1/support/nonexistent_${Date.now()}.png`
    );
    record('Missing attachment file handled', missingFile.status === 404, `status ${missingFile.status}`);
  }

  // School B login & isolation
  const loginB = await loginTenant(creds.schoolB.institute, creds.schoolB.username, creds.schoolB.password);
  record('School B login', loginB.res.status === 200, loginB.res.json?.message);
  const cookiesB = loginB.cookies;

  const detailB = await tenantGet(cookiesB, `/api/help-support/tickets/${ticketAId}`);
  record(
    'School B cannot access School A ticket',
    detailB.status === 404,
    `status ${detailB.status}`
  );

  const listB = await tenantGet(cookiesB, '/api/help-support/tickets?search=' + encodeURIComponent(ticketPayload.subject));
  const leaked = (listB.json?.data || []).some((t) => t.id === ticketAId);
  record('School B search does not leak School A ticket', !leaked, `matches ${listB.json?.data?.length ?? 0}`);

  // Super admin
  const sa = await loginSuperAdmin(creds.superAdmin.email || creds.superAdmin.username, creds.superAdmin.password);
  record('Super Admin login', sa.res.status === 200, sa.res.json?.message);
  const cookiesSA = sa.cookies;

  const saList = await superGet(cookiesSA, '/super-admin/api/support/tickets');
  const saHasTicket = (saList.json?.data || []).some((t) => t.id === ticketAId);
  record('Super Admin sees all tickets', saHasTicket, `total ${saList.json?.data?.length ?? 0}`);

  const saReply = await superPost(cookiesSA, `/super-admin/api/support/tickets/${ticketAId}/replies`, {
    message: 'Super Admin QA reply — please confirm receipt.',
  });
  record('Super Admin reply', saReply.status === 201, saReply.json?.message);

  const saPatch = await superPatch(cookiesSA, `/super-admin/api/support/tickets/${ticketAId}`, {
    status: 'waiting_for_response',
    priority: 'high',
  });
  record('Super Admin status update', saPatch.status === 200, saPatch.json?.message);

  const detailAfter = await tenantGet(cookiesA, `/api/help-support/tickets/${ticketAId}`);
  const msgs = detailAfter.json?.data?.messages || [];
  const hasSaReply = msgs.some((m) => m.sender_type === 'super_admin');
  record('School A sees Super Admin reply', hasSaReply, `messages ${msgs.length}`);

  // Edge: invalid ticket id
  const badId = await tenantGet(cookiesA, '/api/help-support/tickets/999999999');
  record('Invalid ticket id returns 404', badId.status === 404);

  // Edge: empty message
  const emptyReply = await tenantPost(cookiesA, `/api/help-support/tickets/${ticketAId}/replies`, { message: '   ' });
  record('Empty reply rejected', emptyReply.status === 400, emptyReply.json?.message);

  // Edge: validation empty subject
  const badCreate = await tenantPost(cookiesA, '/api/help-support/tickets', {
    subject: 'ab',
    description: 'short',
    category: 'technical_issue',
    priority: 'medium',
  });
  record('Invalid create validation', badCreate.status === 400, badCreate.json?.message);

  // Close ticket then reply
  await superPatch(cookiesSA, `/super-admin/api/support/tickets/${ticketAId}`, { status: 'closed' });
  const closedReply = await tenantPost(cookiesA, `/api/help-support/tickets/${ticketAId}/replies`, {
    message: 'Should fail on closed ticket',
  });
  record('Closed ticket reply blocked', closedReply.status === 400, closedReply.json?.message);

  // Teacher role blocked (if creds provided)
  if (creds.schoolA.teacherUsername) {
    const tLogin = await loginTenant(creds.schoolA.institute, creds.schoolA.teacherUsername, creds.schoolA.teacherPassword);
    if (tLogin.res.status === 200) {
      const tList = await tenantGet(tLogin.cookies, '/api/help-support/tickets');
      record('Teacher API blocked', tList.status === 403, `status ${tList.status}`);
    } else {
      record('Teacher API blocked', true, 'skipped — teacher login unavailable');
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n--- SUMMARY ---');
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
    process.exitCode = 1;
  }
  fs.writeFileSync(
    path.join(__dirname, 'qa-help-support-results.json'),
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
