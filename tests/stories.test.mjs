import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isFormUrl, normalizeApprovedStories, loadApprovedStories, configureStoryLinks } from '../js/stories.js';
import { renderGallery } from '../js/gallery.js';

const backend = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');

function harness() {
  const rows = [['Decision', 'Received', 'Name', 'Email', 'Handle', 'Type', 'Story', 'Upload', 'ID', 'Snapshot', 'Result']];
  const responses = new Map();
  const files = new Map();
  let nextFile = 0;
  const sheet = {
    getSheetId: () => 1,
    getDataRange: () => ({ getValues: () => structuredClone(rows) }),
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    getRange(row, col, rowCount = 1, colCount = 1) {
      return {
        getSheet: () => sheet, getColumn: () => col,
        getRow: () => row, getLastRow: () => row + rowCount - 1,
        getValues: () => rows.slice(row - 1, row - 1 + rowCount).map(r => r.slice(col - 1, col - 1 + colCount)),
        setValue: value => { rows[row - 1][col - 1] = value; },
        clearContent: () => { rows[row - 1][col - 1] = ''; },
        setDataValidation() {}, setWrap() {}, insertCheckboxes() {},
      };
    },
  };
  const context = vm.createContext({
    console,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'private-id' }) },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return this; } }),
    },
    FormApp: { openById: () => ({ getResponse: id => responses.get(id), getResponses: () => [...responses.values()] }) },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'PUBLIC' },
      Permission: { NONE: 'NONE', VIEW: 'VIEW' },
      getFileById(id) { if (!files.has(id)) throw new Error('File missing'); return files.get(id); },
      getFolderById: () => ({}),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => value }) },
  });
  vm.runInContext(backend, context);
  function submit(kind, overrides = {}) {
    const id = `response-${responses.size}`;
    const fileId = `original-file-${responses.size}`;
    const source = {
      access: 'PRIVATE', getMimeType: () => kind === 'photo' ? 'image/jpeg' : 'video/mp4',
      makeCopy() {
        const copyId = `approved-file-${nextFile++}`;
        const copy = { access: 'PRIVATE', getId: () => copyId, setSharing(access) { this.access = access; return this; } };
        files.set(copyId, copy); return copy;
      },
    };
    files.set(fileId, source);
    const answers = {
      'Full Name': '<img src=x onerror=alert(1)>', 'Email Address': 'private@example.test',
      'Instagram or TikTok Username': '@example',
      'Age confirmation': [vm.runInContext('ADULT', context)],
      'Who is submitting this story?': vm.runInContext('SELF', context),
      'Permission to share': [vm.runInContext('PERMISSION', context)],
      'Your story and media': [vm.runInContext('OWN_STORY', context)],
      'How would you like to share your story?': vm.runInContext(kind === 'photo' ? 'PHOTO' : 'VIDEO', context),
      [kind === 'photo' ? 'Upload a Photo of Yourself' : 'Upload Your Video']: [fileId],
      ...(kind === 'photo' ? { 'Tell Us Your Story': '=A1 <script>private text</script>' } : {}),
      ...overrides,
    };
    const response = { getId: () => id, getTimestamp: () => new Date('2026-09-21T12:00:00Z'),
      getItemResponses: () => Object.entries(answers).map(([title, value]) => ({ getItem: () => ({ getTitle: () => title }), getResponse: () => value })) };
    responses.set(id, response);
    context.receiveStory({ response });
    return { id, fileId, source, response };
  }
  function decide(row, decision) {
    rows[row - 1][0] = decision;
    context.reviewDecision({ range: sheet.getRange(row, 1) });
  }
  return { context, rows, files, submit, decide, feed: () => JSON.parse(context.doGet()) };
}

for (const type of ['photo', 'video']) {
  test(`${type}: submission → private review → approval → public feed → withdrawal → reapproval`, () => {
    const h = harness();
    const { source, fileId } = h.submit(type);
    assert.equal(h.rows[1][0], 'Pending');
    assert.deepEqual(h.feed().stories, []);
    assert.equal(source.access, 'PRIVATE');
    h.context.syncResponses();
    assert.equal(h.rows.length, 2, 'trigger retries must not duplicate submissions');
    h.decide(2, 'Approved');
    const story = h.feed().stories[0];
    assert.equal(story.mediaType, type === 'photo' ? 'photo' : 'video-drive');
    assert.notEqual(story.driveFileId, fileId);
    assert.equal(h.files.get(story.driveFileId).access, 'PUBLIC');
    assert.equal(source.access, 'PRIVATE', 'original uploads stay private');
    const publicJson = JSON.stringify(h.feed());
    assert.ok(!publicJson.includes('private@example.test'));
    assert.ok(!publicJson.includes(fileId));
    const cards = normalizeApprovedStories(h.feed());
    assert.equal(cards.length, 1);
    assert.equal(cards[0].handle, '@example');
    if (type === 'video') assert.equal(cards[0].excerpt, '');
    h.decide(2, 'Rejected');
    assert.deepEqual(h.feed().stories, []);
    assert.equal(h.files.get(story.driveFileId).access, 'PRIVATE');
    h.decide(2, 'Approved');
    assert.equal(h.feed().stories.length, 1);
  });
}

test('required consent, age, photo text and upload are enforced again at publication', () => {
  for (const overrides of [
    { 'Permission to share': [] }, { 'Your story and media': [] }, { 'Age confirmation': [] },
    { 'Full Name': '' }, { 'Email Address': '' }, { 'Tell Us Your Story': '' }, { 'Upload a Photo of Yourself': [] },
  ]) {
    const h = harness(); h.submit('photo', overrides);
    assert.equal(h.rows[1][0], 'Invalid');
    h.decide(2, 'Approved');
    assert.deepEqual(h.feed().stories, []);
  }
});

test('child stories require guardian details, explicit consent, and reviewer verification', () => {
  const h = harness();
  h.submit('photo', {
    'Who is submitting this story?': vm.runInContext('GUARDIAN', h.context),
    'Parent / Legal Guardian Full Name': 'Private Parent',
    'Parent / Legal Guardian Email Address': 'guardian@example.test',
    'Parent / Legal Guardian Permission': [vm.runInContext('GUARDIAN_PERMISSION', h.context)],
  });
  h.decide(2, 'Approved');
  assert.deepEqual(h.feed().stories, []);
  h.rows[1][13] = true;
  h.decide(2, 'Approved');
  assert.equal(h.feed().stories.length, 1);
  assert.ok(!JSON.stringify(h.feed()).includes('Private Parent'));
  assert.ok(!JSON.stringify(h.feed()).includes('guardian@example.test'));
  const missing = harness();
  missing.submit('video', { 'Who is submitting this story?': vm.runInContext('GUARDIAN', missing.context) });
  missing.decide(2, 'Approved');
  assert.deepEqual(missing.feed().stories, []);
});

test('review cells cannot override the original story or consent; formula text is escaped', () => {
  const h = harness(); h.submit('photo');
  assert.equal(h.rows[1][4], "'@example");
  assert.ok(h.rows[1][6].startsWith("'="));
  h.rows[1][2] = 'Changed display cell';
  h.decide(2, 'Approved');
  assert.notEqual(h.feed().stories[0].name, 'Changed display cell');
});

test('unsupported images and missing files fail closed', () => {
  const h = harness(); const { source, fileId } = h.submit('photo');
  source.getMimeType = () => 'image/svg+xml';
  h.decide(2, 'Approved');
  assert.deepEqual(h.feed().stories, []);
  assert.equal(h.rows[1][0], 'Pending');
  h.files.delete(fileId);
  h.decide(2, 'Approved');
  assert.deepEqual(h.feed().stories, []);
});

test('approval is never inferred from an existing snapshot or URL parameters', () => {
  const h = harness(); h.submit('photo'); h.decide(2, 'Approved');
  h.rows[1][0] = 'Pending';
  assert.deepEqual(h.feed().stories, []);
  assert.deepEqual(JSON.parse(h.context.doGet({ parameter: { approve: 'response-0', email: 'true' } })).stories, []);
});

test('frontend validates approved records and strips private fields', () => {
  const h = harness(); h.submit('video'); h.decide(2, 'Approved');
  const good = { ...h.feed().stories[0], email: 'secret', sourceFileId: 'secret' };
  const result = normalizeApprovedStories({ version: 1, stories: [
    good, good, { ...good, id: 'pending', status: 'Pending' },
    { ...good, id: 'bad', driveFileId: 'javascript:alert(1)' },
  ] });
  assert.equal(result.length, 1);
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('only actual Google responder URLs can activate links', () => {
  assert.equal(isFormUrl('https://docs.google.com/forms/d/e/example/viewform'), true);
  for (const url of ['', 'javascript:alert(1)', 'https://evil.test/forms/d/e/example/viewform', 'https://docs.google.com/forms/d/example/edit']) {
    assert.equal(isFormUrl(url), false);
  }
  const links = [{ setAttribute() {} }, { setAttribute() {} }];
  const root = { querySelectorAll: () => links, getElementById: () => null };
  assert.equal(configureStoryLinks({ formUrl: '' }, root), false);
  const url = 'https://forms.gle/example';
  assert.equal(configureStoryLinks({ formUrl: url }, root), true);
  assert.ok(links.every(link => link.href === url));
});

test('unconfigured and failed feeds do not expose or fabricate stories', async () => {
  assert.deepEqual(await loadApprovedStories({ feedUrl: '' }), []);
  await assert.rejects(loadApprovedStories({ feedUrl: 'https://evil.test' }));
  await assert.rejects(loadApprovedStories({ feedUrl: 'https://script.google.com/macros/s/test/exec' }, async () => ({ ok: false })));
});

test('gallery renders photos and captionless videos and escapes submitted HTML', () => {
  const h = harness(); h.submit('photo'); h.submit('video'); h.decide(2, 'Approved'); h.decide(3, 'Approved');
  const track = { innerHTML: '', querySelectorAll: () => [], classList: { toggle() {} } };
  const elements = { 'wall-track': track, 'wall-progress': {}, 'wall-empty': {}, 'wall-count': {} };
  globalThis.document = { getElementById: id => elements[id], querySelector: () => ({}) };
  try {
    renderGallery(normalizeApprovedStories(h.feed()));
    assert.match(track.innerHTML, /drive\.google\.com\/thumbnail/);
    assert.match(track.innerHTML, /drive\.google\.com\/file\/d\/approved-file-1\/preview/);
    assert.match(track.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.ok(!track.innerHTML.includes('<script>private text</script>'));
    assert.equal(elements['wall-count'].textContent, '2 stories and counting');
  } finally { delete globalThis.document; }
});
