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
  function submit(kind, overrides = {}, renamedTitles = {}, wishDetails = null) {
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
    const title = (key, fallback) => renamedTitles[key] || fallback;
    const answers = {
      [title('name', 'Full Name')]: '<img src=x onerror=alert(1)>', [title('email', 'Email Address')]: 'private@example.test',
      [title('handle', 'Instagram or TikTok Username')]: '@example',
      [title('role', 'Who is submitting this story?')]: vm.runInContext('SELF', context),
      [title('sharePermission', 'Permission to share')]: [vm.runInContext('PERMISSION', context)],
      [title('ownStory', 'Your story and media')]: [vm.runInContext('OWN_STORY', context)],
      [title('type', 'How would you like to share your story?')]: vm.runInContext(kind === 'photo' ? 'PHOTO' : 'VIDEO', context),
      [title(kind === 'photo' ? 'photoUpload' : 'videoUpload', kind === 'photo' ? 'Upload a Photo of Yourself' : 'Upload Your Video')]: [fileId],
      ...(kind === 'photo' ? { [title('story', 'Tell Us Your Story')]: '=A1 <script>private text</script>' } : {}),
      ...overrides,
    };
    if (wishDetails) {
      answers[title('recipient', 'Who did you grant a wish for?')] = wishDetails.recipient;
      answers[title('gift', 'What did you purchase or give to fulfill their wish?')] = wishDetails.gift;
      answers[title('reason', "Why did you choose to grant this person's wish?")] = wishDetails.reason;
    }
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
  test(`${type}: submission without age confirmation → private review → approval → public feed → withdrawal → reapproval`, () => {
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
    if (type === 'photo') assert.match(cards[0].fullSrc, /uc\?export=view&id=/);
    if (type === 'video') assert.equal(cards[0].excerpt, '');
    h.decide(2, 'Rejected');
    assert.deepEqual(h.feed().stories, []);
    assert.equal(h.files.get(story.driveFileId).access, 'PRIVATE');
    h.decide(2, 'Approved');
    assert.equal(h.feed().stories.length, 1);
  });
}

test('required consent, photo text and upload are enforced again at publication', () => {
  for (const overrides of [
    { 'Permission to share': [] }, { 'Your story and media': [] },
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

test('renamed form questions still map to the private review fields', () => {
  const h = harness();
  h.submit('photo', {}, {
    name: 'Name', email: 'Email', handle: 'Social Username', role: 'Who is submitting?',
    type: 'Story Type', photoUpload: 'Upload a Photo', story: 'Story / Description',
    sharePermission: 'Permission', ownStory: 'Story and media',
  });
  assert.equal(h.rows[1][0], 'Pending');
  assert.equal(h.rows[1][5], 'photo');
  assert.match(h.rows[1][6], /private text/);
  assert.match(h.rows[1][7], /original-file-0/);
  h.decide(2, 'Approved');
  assert.equal(h.feed().stories.length, 1);
});

test('new wish details are stored and published, while legacy responses remain valid', () => {
  const current = harness();
  current.submit('photo', {}, {}, {
    recipient: 'A nickname only', gift: 'A warm winter coat', reason: 'Their request spoke to me.',
  });
  assert.equal(current.rows[1][0], 'Pending');
  assert.equal(current.rows[1][14], 'A nickname only');
  assert.equal(current.rows[1][15], 'A warm winter coat');
  assert.equal(current.rows[1][16], 'Their request spoke to me.');
  current.decide(2, 'Approved');
  const published = current.feed().stories[0];
  assert.equal(published.recipient, 'A nickname only');
  assert.equal(published.gift, 'A warm winter coat');
  assert.equal(published.reason, 'Their request spoke to me.');

  const legacy = harness();
  legacy.submit('photo');
  assert.equal(legacy.rows[1][0], 'Pending');
  assert.equal(legacy.rows[1][14], '');
});

test('new details are required only when the new questions are present', () => {
  const h = harness();
  h.submit('photo', {}, {}, { recipient: 'Only recipient', gift: '', reason: 'Missing gift must fail.' });
  assert.equal(h.rows[1][0], 'Invalid');
  assert.match(h.rows[1][10], /Required identity/);
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
    assert.match(track.innerHTML, /card--interactive/);
    assert.match(track.innerHTML, /card__read-more/);
    assert.doesNotMatch(track.innerHTML, /card__excerpt--full/);
    assert.match(track.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.ok(!track.innerHTML.includes('<script>private text</script>'));
    assert.equal(elements['wall-count'].textContent, '2 stories and counting');
  } finally { delete globalThis.document; }
});

test('gallery renders approved wish details as escaped postcard and modal data', () => {
  const track = { innerHTML: '', querySelectorAll: () => [], classList: { toggle() {} } };
  globalThis.document = { getElementById: id => id === 'wall-track' ? track : id === 'wall-progress' ? {} : id === 'wall-count' ? {} : null, querySelector: () => ({}) };
  try {
    renderGallery([{
      id: 'submission-details', name: 'Storyteller', mediaType: 'photo', src: 'https://example.test/photo.jpg',
      alt: 'Approved photo', excerpt: 'A short story.', recipient: '<private>', gift: 'A bike & helmet', reason: 'A meaningful choice', date: '2026-01-01',
    }]);
    assert.match(track.innerHTML, /For:<\/strong> &lt;private&gt;/);
    assert.match(track.innerHTML, /Gift:<\/strong> A bike &amp; helmet/);
  } finally { delete globalThis.document; }
});
