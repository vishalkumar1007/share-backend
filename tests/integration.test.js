import './setup-env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import connectDb from '../lib/db.js';
import userModel from '../models/userModel.js';
import shareModel from '../models/shareModel.js';
import { buildApp } from '../app.js';

let server;
let base;
const created = { email: null, shareIds: [] };

const api = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (error) {
    json = null;
  }
  return { status: res.status, json };
};

before(async () => {
  await connectDb();
  server = buildApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (created.email) {
    const user = await userModel.findOne({ email: created.email }).select({ _id: 1 }).lean();
    if (user) {
      await shareModel.deleteMany({ ownerId: user._id });
      await userModel.deleteOne({ _id: user._id });
    }
  }
  for (const shareId of created.shareIds) {
    await shareModel.deleteOne({ shareId });
  }
  await new Promise((resolve) => server.close(resolve));
  await connectDb().then((conn) => conn.disconnect());
});

test('auth: signup -> login -> verify -> me', async () => {
  const email = `test-${Date.now()}@example.com`;
  created.email = email;

  const signup = await api('POST', '/api/auth/signup', {
    body: { firstName: 'Test', lastName: 'User', email, password: 'secret123' },
  });
  assert.equal(signup.status, 201);
  assert.ok(signup.json.accessToken);

  const login = await api('POST', '/api/auth/login', { body: { email, password: 'secret123' } });
  assert.equal(login.status, 200);
  const token = login.json.accessToken;
  assert.ok(token);

  const badLogin = await api('POST', '/api/auth/login', { body: { email, password: 'wrongpass' } });
  assert.equal(badLogin.status, 401);

  const verify = await api('GET', '/api/auth/verify', { token });
  assert.equal(verify.status, 200);

  const me = await api('GET', '/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.email, email);
});

test('shares: create public text share, fetch it, read count increments', async () => {
  const login = await api('POST', '/api/auth/login', {
    body: { email: created.email, password: 'secret123' },
  });
  const token = login.json.accessToken;

  const create = await api('POST', '/api/shares', {
    token,
    body: { type: 'text', title: 'hello share', text: 'Hello from the multiverse' },
  });
  assert.equal(create.status, 201);
  assert.ok(create.json.shareId);
  assert.ok(create.json.url.includes('/s/'));
  created.shareIds.push(create.json.shareId);

  const first = await api('GET', `/api/shares/${create.json.shareId}`);
  assert.equal(first.status, 200);
  assert.equal(first.json.data.content, 'Hello from the multiverse');
  assert.equal(first.json.data.readCount, 1);

  const second = await api('GET', `/api/shares/${create.json.shareId}`);
  assert.equal(second.json.data.readCount, 2);

  const status = await api('GET', `/api/shares/${create.json.shareId}/status`);
  assert.equal(status.status, 200);
  assert.equal(status.json.data.readCount, 2);
  assert.equal(status.json.data.exists, true);
});

test('shares: incognito share is read-once and 410 on second read', async () => {
  const login = await api('POST', '/api/auth/login', {
    body: { email: created.email, password: 'secret123' },
  });
  const token = login.json.accessToken;

  const create = await api('POST', '/api/shares', {
    token,
    body: { type: 'text', text: 'burn after reading', privacy: 'incognito' },
  });
  assert.equal(create.status, 201);
  created.shareIds.push(create.json.shareId);

  const first = await api('GET', `/api/shares/${create.json.shareId}`);
  assert.equal(first.status, 200);
  assert.equal(first.json.data.content, 'burn after reading');

  const second = await api('GET', `/api/shares/${create.json.shareId}`);
  assert.equal(second.status, 410);

  const status = await api('GET', `/api/shares/${create.json.shareId}/status`);
  assert.equal(status.json.data.exists, true);
  assert.equal(status.json.data.consumed, true);
});

test('shares: owner can list and delete; delete blocks non-owners', async () => {
  const login = await api('POST', '/api/auth/login', {
    body: { email: created.email, password: 'secret123' },
  });
  const token = login.json.accessToken;

  const mine = await api('GET', '/api/shares/me', { token });
  assert.equal(mine.status, 200);
  assert.ok(mine.json.shares.length >= 1);

  const victim = await api('POST', '/api/shares', { body: { type: 'text', text: 'ownerless' } });
  created.shareIds.push(victim.json.shareId);

  const forbidden = await api('DELETE', `/api/shares/${victim.json.shareId}`, { token });
  assert.equal(forbidden.status, 403);

  const owned = await api('POST', '/api/shares', {
    token,
    body: { type: 'text', text: 'mine to delete' },
  });
  created.shareIds.push(owned.json.shareId);

  const del = await api('DELETE', `/api/shares/${owned.json.shareId}`, { token });
  assert.equal(del.status, 200);

  const gone = await api('GET', `/api/shares/${owned.json.shareId}`);
  assert.equal(gone.status, 404);
});

test('validation: rejects bad payloads', async () => {
  const missing = await api('POST', '/api/shares', { body: { type: 'text' } });
  assert.equal(missing.status, 422);

  const badType = await api('POST', '/api/shares', {
    body: { type: 'video', text: 'x' },
  });
  assert.equal(badType.status, 422);

  const badCode = await api('GET', '/api/shares/!!bad!!');
  assert.equal(badCode.status, 400);

  const notFound = await api('GET', '/api/shares/zzzzzzzzzzzz');
  assert.equal(notFound.status, 404);
});

test('legacy: universalTextSave and universalTextData still work', async () => {
  const save = await api('POST', '/api/TextMultiverse/universalTextSave', {
    body: { textData: 'legacy text payload' },
  });
  assert.equal(save.status, 200);
  assert.equal(save.json.responseStatus, 'success');
  assert.match(String(save.json.code), /^\d{6}$/);
  created.shareIds.push(save.json.code);

  const get = await api('GET', `/api/TextMultiverse/universalTextData?multiverseCode=${save.json.code}`);
  assert.equal(get.status, 200);
  assert.equal(get.json.codeMappedText, 'legacy text payload');
});

test('legacy: user signup/login/verify/profile still work', async () => {
  const email = `legacy-${Date.now()}@example.com`;
  created.email = email;

  const signup = await api('POST', '/api/user/signup', {
    body: { firstName: 'Legacy', lastName: 'User', email, password: 'legacy123' },
  });
  assert.equal(signup.status, 201);
  assert.ok(signup.json.accessToken);

  const login = await api('GET', `/api/user/login?email=${encodeURIComponent(email)}&password=legacy123`);
  assert.equal(login.status, 200);
  const token = login.json.accessToken;

  const verify = await api('GET', '/api/user/verifyUserAuthToken', { token });
  assert.equal(verify.status, 200);

  const profile = await api('GET', '/api/user/getUserProfileData', { token });
  assert.equal(profile.status, 200);
  assert.equal(profile.json.data.email, email);
});

test('misc: health and ip endpoints', async () => {
  const health = await api('GET', '/api');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'running');

  const ip = await api('GET', '/api/ip');
  assert.equal(ip.status, 200);
  assert.ok(ip.json.ip);
});
