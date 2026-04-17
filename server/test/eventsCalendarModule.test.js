const test = require('node:test');
const assert = require('node:assert/strict');

function createRes() {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  return res;
}

function loadEventsControllerWithMocks({ queryMock, storageProvider, schoolId } = {}) {
  const dbPath = require.resolve('../src/config/database');
  const storagePath = require.resolve('../src/storage');
  const schoolContextPath = require.resolve('../src/utils/schoolContext');
  const controllerPath = require.resolve('../src/controllers/eventsController');

  const originalDb = require.cache[dbPath];
  const originalStorage = require.cache[storagePath];
  const originalSchoolContext = require.cache[schoolContextPath];
  const originalController = require.cache[controllerPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: queryMock || (async () => ({ rows: [] })) },
  };
  require.cache[storagePath] = {
    id: storagePath,
    filename: storagePath,
    loaded: true,
    exports: {
      getStorageProvider: () =>
        storageProvider || {
          upload: async () => ({ relativePath: 'school_1/documents/mock.txt' }),
          delete: async () => {},
        },
    },
  };
  require.cache[schoolContextPath] = {
    id: schoolContextPath,
    filename: schoolContextPath,
    loaded: true,
    exports: {
      getSchoolIdFromRequest: () => schoolId || 1,
    },
  };
  delete require.cache[controllerPath];
  const controller = require('../src/controllers/eventsController');

  return {
    controller,
    restore: () => {
      if (originalDb) require.cache[dbPath] = originalDb;
      else delete require.cache[dbPath];
      if (originalStorage) require.cache[storagePath] = originalStorage;
      else delete require.cache[storagePath];
      if (originalSchoolContext) require.cache[schoolContextPath] = originalSchoolContext;
      else delete require.cache[schoolContextPath];
      if (originalController) require.cache[controllerPath] = originalController;
      else delete require.cache[controllerPath];
    },
  };
}

test('events createEvent rejects invalid event_for', async () => {
  const { controller, restore } = loadEventsControllerWithMocks();
  try {
    const req = {
      user: { id: 10 },
      body: {
        title: 'Exam Event',
        start_date: '2026-04-17T10:00:00.000Z',
        event_for: 'nobody',
      },
    };
    const res = createRes();
    await controller.createEvent(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.payload?.message || '', /Invalid event_for/i);
  } finally {
    restore();
  }
});

test('events createEvent accepts parents event_for', async () => {
  const queryMock = async () => ({
    rows: [{ id: 11, title: 'PTM', event_for: 'parents' }],
  });
  const { controller, restore } = loadEventsControllerWithMocks({ queryMock });
  try {
    const req = {
      user: { id: 10 },
      body: {
        title: 'PTM',
        start_date: '2026-04-17T10:00:00.000Z',
        event_for: 'parents',
      },
    };
    const res = createRes();
    await controller.createEvent(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload?.data?.event_for, 'parents');
  } finally {
    restore();
  }
});

test('events createEvent rejects unsafe attachment URL', async () => {
  const { controller, restore } = loadEventsControllerWithMocks();
  try {
    const req = {
      user: { id: 10 },
      body: {
        title: 'Exam Event',
        start_date: '2026-04-17T10:00:00.000Z',
        attachment_url: 'javascript:alert(1)',
      },
    };
    const res = createRes();
    await controller.createEvent(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.payload?.message || '', /Invalid attachment URL/i);
  } finally {
    restore();
  }
});

test('events getAllEvents builds filter query and returns data', async () => {
  let capturedSql = '';
  let capturedParams = [];
  const queryMock = async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [{ id: 1, title: 'A' }] };
  };
  const { controller, restore } = loadEventsControllerWithMocks({ queryMock });
  try {
    const req = {
      query: {
        start_date: '2026-04-01T00:00:00.000Z',
        end_date: '2026-04-30T23:59:59.999Z',
        event_category: 'Meeting',
        event_for: 'staff',
        q: 'board',
        limit: '20',
        offset: '0',
      },
    };
    const res = createRes();
    await controller.getAllEvents(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(capturedSql.includes('WHERE'));
    assert.ok(Array.isArray(capturedParams));
    assert.ok(capturedParams.length >= 4);
    assert.equal(res.payload?.data?.length, 1);
  } finally {
    restore();
  }
});

test('events getAllEvents restricts parent visibility by event_for', async () => {
  let capturedSql = '';
  const queryMock = async (sql) => {
    capturedSql = sql;
    return { rows: [] };
  };
  const { controller, restore } = loadEventsControllerWithMocks({ queryMock });
  try {
    const req = {
      user: { role_id: 4 },
      query: {},
    };
    const res = createRes();
    await controller.getAllEvents(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(capturedSql, /IN \('all','parents'\)/i);
  } finally {
    restore();
  }
});

test('events uploadEventAttachment stores metadata', async () => {
  const callLog = [];
  const queryMock = async (sql, params) => {
    callLog.push({ sql, params });
    if (/SELECT id FROM events/i.test(sql)) return { rows: [{ id: 5 }] };
    if (/INSERT INTO event_attachments/i.test(sql)) {
      return {
        rows: [
          {
            id: 99,
            event_id: 5,
            file_url: '/api/storage/files/school_1/documents/doc.pdf',
            file_name: 'doc.pdf',
            file_type: 'application/pdf',
            file_size: 1234,
            relative_path: 'school_1/documents/doc.pdf',
            uploaded_by: 7,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  };
  const storageProvider = {
    upload: async () => ({ relativePath: 'school_1/documents/doc.pdf' }),
    delete: async () => {},
  };
  const { controller, restore } = loadEventsControllerWithMocks({
    queryMock,
    storageProvider,
    schoolId: 1,
  });
  try {
    const req = {
      params: { id: '5' },
      user: { id: 7 },
      file: {
        buffer: Buffer.from('abc'),
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 1234,
      },
    };
    const res = createRes();
    await controller.uploadEventAttachment(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload?.data?.event_id, 5);
    assert.ok(callLog.some((c) => /INSERT INTO event_attachments/i.test(c.sql)));
  } finally {
    restore();
  }
});

