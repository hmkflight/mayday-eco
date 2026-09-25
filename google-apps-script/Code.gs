/* Google Apps Script, V8 runtime. See SETUP.md before running.
 * Private responses stay in Google Forms. The review sheet is private.
 * Only an explicit reviewer decision creates a public media copy.
 * There is intentionally no public write/approval endpoint.
 */
const FORM_ID = '1VlWvKKgIfdbhOKdxWB-UOI009EgkaA_ZaSu_PpZMKaw';
const TITLE = 'One Simple Wish — Share Your Story';
const PHOTO = '📸 Photo + Written Story';
const VIDEO = '🎥 Video';
const PERMISSION = 'I give One Simple Wish permission to display my name, photo/video, testimony, and social media username (if provided) on the One Simple Wish website and social media to share my story and show the impact of One Simple Wish.';
const OWN_STORY = 'I confirm that this is my own story and that I have permission to submit the photo/video and information included in this form.';
const SELF = 'I am sharing my own story';
const GUARDIAN = 'I am a parent/legal guardian submitting a child’s story';
const GUARDIAN_PERMISSION = 'I confirm that I am this child’s parent or legal guardian and authorize One Simple Wish to publish the child’s name, photo/video, story, and social media username (if provided) on its website and social media. I have reviewed this submission and consent to its use.';
const CONFIRMATION = 'Thank you for sharing your story! Your submission has been received and will be reviewed before being published on our website.';
const HEADERS = ['Decision', 'Received', 'Full Name', 'Email Address', 'Social Username', 'Story Type', 'Story / Description', 'Private Upload', 'Response ID', 'Published Snapshot', 'Publication Result', 'Guardian Name (private)', 'Guardian Email (private)', 'Guardian Consent Verified'];

// Run once on the existing draft. File-upload questions must be added in the
// Forms editor: Google does not offer an API for creating them.
function prepareForm() {
  const form = FormApp.openById(FORM_ID);
  if (form.getItems().length !== 1 || String(form.getItems()[0].getType()) !== 'TEXT') {
    throw new Error('Expected the original draft with only Full Name. Refusing to overwrite existing questions.');
  }
  form.setTitle(TITLE).setDescription('This form is not anonymous. Submitters must be 18 or older. A parent or legal guardian must submit on behalf of anyone under 18 and give consent. Your email and guardian contact details remain private; the storyteller’s name and approved story may be published. Google sign-in is required for uploads. Please do not include other people’s private information.');
  form.setConfirmationMessage(CONFIRMATION).setShowLinkToRespondAgain(false)
    .setAllowResponseEdits(false).setPublishingSummary(false);
  form.getItems()[0].asTextItem().setTitle('Full Name').setRequired(true).setHelpText('The name of the person whose story is being shared. For a child’s story, enter the child’s name. This name may appear with the approved story.');
  form.addTextItem().setTitle('Email Address').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addTextItem().setTitle('Instagram or TikTok Username')
    .setHelpText("If you'd like us to credit you when we share your story, enter your Instagram or TikTok username.\nExample: @username");
  const role = form.addMultipleChoiceItem().setTitle('Who is submitting this story?').setRequired(true);
  const guardianSection = form.addPageBreakItem().setTitle('Parent / Legal Guardian Consent');
  form.addTextItem().setTitle('Parent / Legal Guardian Full Name').setRequired(true);
  form.addTextItem().setTitle('Parent / Legal Guardian Email Address').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addCheckboxItem().setTitle('Parent / Legal Guardian Permission').setChoiceValues([GUARDIAN_PERMISSION]).setRequired(true)
    .setHelpText('Our team must verify parent/guardian consent before a child’s story can be published.');
  const formatSection = form.addPageBreakItem().setTitle('Choose Your Story Format');
  role.setChoices([role.createChoice(SELF, formatSection), role.createChoice(GUARDIAN, guardianSection)]);
  const choice = form.addMultipleChoiceItem().setTitle('How would you like to share your story?').setRequired(true);
  const photoSection = form.addPageBreakItem().setTitle(PHOTO);
  form.addSectionHeaderItem().setTitle('Not sure what to write about? You can talk about:')
    .setHelpText('• How did the wish make you feel?\n• What did the wish mean to you?\n• Did the wish create a special memory or moment for you?\n• How did One Simple Wish make a difference for you or your family?\n• Why would you recommend One Simple Wish to other people?\n• What would you want other people to know about your experience?');
  form.addParagraphTextItem().setTitle('Tell Us Your Story').setRequired(true)
    .setHelpText('Tell us about your experience. You can share how the wish made you feel, what it meant to you, how it made a difference, or why you would recommend One Simple Wish to others.');
  const videoSection = form.addPageBreakItem().setTitle(VIDEO)
    .setHelpText("Not sure what to say? You could talk about:\n• How the wish made you feel\n• What the wish meant to you\n• Your favorite part of the experience\n• How the wish made a difference\n• Why you'd recommend One Simple Wish\n• What you'd like other people to know about your experience.\n\nUse your own words and explain your experience naturally.");
  form.addParagraphTextItem().setTitle('Video Description (optional)');
  const permissionSection = form.addPageBreakItem().setTitle('Permission');
  form.addCheckboxItem().setTitle('Permission to share').setChoiceValues([PERMISSION]).setRequired(true);
  form.addCheckboxItem().setTitle('Your story and media').setChoiceValues([OWN_STORY]).setRequired(true)
    .setHelpText('For parent/guardian submissions, confirm this is your family’s own experience and that you are authorized to submit the child’s story and media.');
  choice.setChoices([choice.createChoice(PHOTO, photoSection), choice.createChoice(VIDEO, videoSection)]);
  // A page break's navigation controls the section BEFORE that page break.
  videoSection.setGoToPage(permissionSection);
  permissionSection.setGoToPage(FormApp.PageNavigationType.CONTINUE);
  console.log('Add required file uploads in the editor before enabling submissions: ' + form.getEditUrl());
}

function validateForm_() {
  const form = FormApp.openById(FORM_ID);
  const titles = form.getItems().map(item => item.getTitle());
  ['Full Name', 'Email Address', 'How would you like to share your story?',
    'Tell Us Your Story', 'Permission to share', 'Your story and media', 'Who is submitting this story?',
    'Parent / Legal Guardian Full Name', 'Parent / Legal Guardian Email Address', 'Parent / Legal Guardian Permission'].forEach(title => {
    if (titles.filter(t => t === title).length !== 1) throw new Error('Missing or duplicate question: ' + title);
  });
  ['Upload a Photo of Yourself', 'Upload Your Video'].forEach(title => {
    const items = form.getItems().filter(item => item.getTitle() === title);
    if (items.length !== 1 || String(items[0].getType()) !== 'FILE_UPLOAD') {
      throw new Error('Create the required file-upload question in Google Forms: ' + title);
    }
  });
  return form;
}

// Set REVIEW_SHEET_ID in Script Properties to the private review spreadsheet.
// Run once after adding and checking uploads. Safe to run again.
function setupReview() {
  const form = validateForm_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('REVIEW_SHEET_ID')) throw new Error('Set REVIEW_SHEET_ID first.');
  const book = SpreadsheetApp.openById(props.getProperty('REVIEW_SHEET_ID'));
  let sheet = book.getSheetByName('Review');
  if (!sheet) sheet = book.insertSheet('Review');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f4ede1');
    sheet.setColumnWidths(1, HEADERS.length, 180);
    sheet.setColumnWidth(7, 420);
    sheet.hideColumns(9, 2);
  }
  if (!props.getProperty('PUBLIC_MEDIA_FOLDER_ID')) {
    // The folder itself stays private. Only approved individual copies are public.
    const folder = DriveApp.createFolder(TITLE + ' — Approved Media');
    props.setProperty('PUBLIC_MEDIA_FOLDER_ID', folder.getId());
  }
  const handlers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!handlers.includes('receiveStory')) ScriptApp.newTrigger('receiveStory').forForm(form).onFormSubmit().create();
  if (!handlers.includes('reviewDecision')) ScriptApp.newTrigger('reviewDecision').forSpreadsheet(book).onEdit().create();
  if (!handlers.includes('syncResponses')) ScriptApp.newTrigger('syncResponses').timeBased().everyHours(1).create();
  syncResponses();
  console.log('Private review sheet: ' + book.getUrl());
  console.log('Responder URL (publish and test first): ' + form.getPublishedUrl());
}

function reviewSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('REVIEW_SHEET_ID');
  if (!id) throw new Error('Review is not configured');
  return SpreadsheetApp.openById(id).getSheetByName('Review');
}

function answers_(response) {
  const answers = {};
  response.getItemResponses().forEach(item => { answers[item.getItem().getTitle()] = item.getResponse(); });
  return answers;
}

function checked_(answer, expected) { return Array.isArray(answer) && answer.length === 1 && answer[0] === expected; }

function storyFromResponse_(response) {
  const a = answers_(response);
  const text = value => typeof value === 'string' ? value.trim() : '';
  const type = a['How would you like to share your story?'];
  const photo = type === PHOTO;
  const role = a['Who is submitting this story?'];
  const guardian = role === GUARDIAN;
  const files = a[photo ? 'Upload a Photo of Yourself' : 'Upload Your Video'];
  if (![PHOTO, VIDEO].includes(type) || ![SELF, GUARDIAN].includes(role) || !text(a['Full Name']) || !text(a['Email Address']) ||
      (guardian && (!text(a['Parent / Legal Guardian Full Name']) || !text(a['Parent / Legal Guardian Email Address']) ||
        !checked_(a['Parent / Legal Guardian Permission'], GUARDIAN_PERMISSION))) ||
      !checked_(a['Permission to share'], PERMISSION) || !checked_(a['Your story and media'], OWN_STORY) ||
      !Array.isArray(files) || files.length !== 1 ||
      !/^[\w-]{10,200}$/.test(files[0]) || (photo && !text(a['Tell Us Your Story']))) {
    throw new Error('Required identity, media, story, or permission is missing. Do not publish.');
  }
  return {
    id: response.getId(), name: text(a['Full Name']), email: text(a['Email Address']),
    handle: text(a['Instagram or TikTok Username']), mediaType: photo ? 'photo' : 'video-drive',
    excerpt: text(a[photo ? 'Tell Us Your Story' : 'Video Description (optional)']),
    sourceFileId: files[0], date: response.getTimestamp().toISOString(), guardian,
    guardianName: guardian ? text(a['Parent / Legal Guardian Full Name']) : '',
    guardianEmail: guardian ? text(a['Parent / Legal Guardian Email Address']) : '',
  };
}

// Prevent spreadsheet-formula injection in visible, submitter-controlled cells.
function cellText_(value) { return /^[=+\-@\t\r\n]/.test(String(value)) ? "'" + value : value; }

function receiveStory(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { queueResponse_(event.response); } finally { lock.releaseLock(); }
}

function queueResponse_(response) {
  const sheet = reviewSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.slice(1).some(row => row[8] === response.getId())) return;
  const a = answers_(response);
  let story;
  try { story = storyFromResponse_(response); } catch (error) {
    sheet.appendRow(['Invalid', response.getTimestamp(), cellText_(String(a['Full Name'] || '')), '', '', '', '', '', response.getId(), '', error.message, '', '', false]);
    return;
  }
  sheet.appendRow(['Pending', story.date, cellText_(story.name), cellText_(story.email), cellText_(story.handle),
    story.mediaType, cellText_(story.excerpt), 'https://drive.google.com/file/d/' + story.sourceFileId + '/view', story.id, '',
    story.guardian ? 'Verify guardian consent before approving' : 'Awaiting review', cellText_(story.guardianName), cellText_(story.guardianEmail), false]);
  sheet.getRange(sheet.getLastRow(), 14).insertCheckboxes();
  sheet.getRange(sheet.getLastRow(), 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Approved', 'Rejected'], true).setAllowInvalid(false).build());
  sheet.getRange(sheet.getLastRow(), 7).setWrap(true);
}

// Backfill missed triggers without duplicating or resetting review decisions.
function syncResponses() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { FormApp.openById(FORM_ID).getResponses().forEach(queueResponse_); }
  finally { lock.releaseLock(); }
}

function reviewDecision(event) {
  const range = event.range;
  const sheet = reviewSheet_();
  if (range.getSheet().getSheetId() !== sheet.getSheetId() || range.getColumn() !== 1 || range.getRow() < 2) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let row = range.getRow(); row <= range.getLastRow(); row++) publishDecision_(sheet, row);
  } finally { lock.releaseLock(); }
}

function publishDecision_(sheet, rowNumber) {
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const snapshotCell = sheet.getRange(rowNumber, 10);
  const resultCell = sheet.getRange(rowNumber, 11);
  let old;
  try { old = row[9] ? JSON.parse(row[9]) : null; } catch (_) { old = null; }
  if (row[0] !== 'Approved') {
    // Hide the story first, then revoke the public media copy.
    snapshotCell.clearContent();
    if (old && old.driveFileId) {
      try { DriveApp.getFileById(old.driveFileId).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }
      catch (_) {
        // Keep the ID to permit retry, but doGet never publishes this status.
        snapshotCell.setValue(JSON.stringify(old));
        resultCell.setValue('Story hidden; media removal failed. Select Pending again to retry.');
        return;
      }
    }
    resultCell.setValue(row[0] === 'Rejected' ? 'Rejected — not published' : 'Awaiting review — not published');
    return;
  }
  if (old && old.status === 'Approved') { resultCell.setValue('Already published'); return; }
  let copy;
  try {
    // Always use the original Form response and consent, never editable display cells.
    const response = FormApp.openById(FORM_ID).getResponse(String(row[8]));
    const story = storyFromResponse_(response);
    if (story.guardian && row[13] !== true) throw new Error('Verify parent/guardian consent and check Guardian Consent Verified before approving.');
    const source = DriveApp.getFileById(story.sourceFileId);
    const mime = source.getMimeType();
    if (story.mediaType === 'photo' ? !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) : !mime.startsWith('video/')) {
      throw new Error('Unsupported media type. Photos must be JPEG, PNG, WebP, or GIF; videos must be video files.');
    }
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PUBLIC_MEDIA_FOLDER_ID'));
    copy = source.makeCopy('Approved story ' + story.id, folder);
    // This is the only place where a media file becomes publicly readable.
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const snapshot = {
      id: story.id, status: 'Approved', name: story.name, handle: story.handle,
      mediaType: story.mediaType, driveFileId: copy.getId(), excerpt: story.excerpt, date: story.date,
    };
    snapshotCell.setValue(JSON.stringify(snapshot));
    resultCell.setValue('Published ' + new Date().toISOString());
  } catch (error) {
    if (copy) copy.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    snapshotCell.clearContent();
    sheet.getRange(rowNumber, 1).setValue('Pending');
    resultCell.setValue('Not published: ' + error.message);
  }
}

// Deploy as a web app, executing as the owner, readable by Anyone.
// Only sanitized, explicitly approved snapshots are returned. No query parameters
// select sheets, response IDs, private fields, or administrative operations.
function doGet() {
  const rows = reviewSheet_().getDataRange().getValues().slice(1);
  const stories = rows.filter(row => row[0] === 'Approved' && row[9]).flatMap(row => {
    try {
      const s = JSON.parse(row[9]);
      if (s.status !== 'Approved' || !/^[\w-]{10,200}$/.test(s.driveFileId)) return [];
      return [{ id: s.id, status: 'Approved', name: s.name, handle: s.handle,
        mediaType: s.mediaType, driveFileId: s.driveFileId, excerpt: s.excerpt, date: s.date }];
    } catch (_) { return []; }
  });
  return ContentService.createTextOutput(JSON.stringify({ version: 1, stories }))
    .setMimeType(ContentService.MimeType.JSON);
}
