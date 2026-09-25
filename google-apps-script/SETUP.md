# Share Your Story setup and review

## Current resources

- Form editor: https://docs.google.com/forms/d/1VlWvKKgIfdbhOKdxWB-UOI009EgkaA_ZaSu_PpZMKaw/edit
- Automation: https://script.google.com/home/projects/1ESjYULRAM2bo6a4bDAytNCBXq_hOV_2yvEaFO0ZROdMcnN3cn-5UDKQj/edit
- Private review sheet: https://docs.google.com/spreadsheets/d/1tA3Cua9hDUolhXdXY9B93w3MBK39oahfjheiU3yD_8Q/edit

The form is published and the review triggers are installed. The responder URL and
approved-only web app URL are configured in `js/story-config.js`.

- Respond: https://docs.google.com/forms/d/e/1FAIpQLSe57fkRAFkiVwyGQbiuRwxMwMdPUR6MFF96RRPcGPWd0RtGZw/viewform
- Approved feed: https://script.google.com/macros/s/AKfycbzZsaAMQ4cmxh3c-Q1N8GSt_nT7W1thEL49NuAzc684k-eDZg_md1-5t7Drfv5d3c9P/exec

## Remove the live age confirmation question

The repository no longer creates or validates **Age confirmation**. Pushing to
GitHub updates the website only; the existing Google Form and Apps Script must
be updated separately:

1. In the Automation editor linked above, update `Code.gs` from this repository
   and save it **before deleting the question**. The existing review triggers
   must use the updated validation so responses without age confirmation can
   enter review. Keep the existing triggers and Script Properties.
2. In the Form editor linked above, delete only **Age confirmation** (the checkbox
   “I confirm that I am 18 years of age or older.” / “Are you 18 or older?”).
   Keep every other question, section routing, and required photo/video upload.
3. Check a new submission reaches Pending and follows the existing review flow.

Do not rerun `prepareForm`; it is for the original draft, not live form updates.
The website references the responder URL in `js/story-config.js` and the
`data-story-link` anchors in `index.html`; `js/stories.js` applies that URL.

## Recreate setup (already completed)

1. In the Apps Script project, save `Code.gs` and run `prepareForm` once. Review
   Google's authorization request for Forms, Sheets, Drive and trigger access.
   The function refuses to overwrite a form that has already been configured.
2. Google does not support creating upload questions through the Forms API.
   In the form editor, add **Upload a Photo of Yourself** to the photo section,
   before the writing prompts. Choose File upload, Required, images only, one
   file, 10 MB. Add **Upload Your Video** to the video section before its optional
   description. Choose File upload, Required, videos only, one file, 100 MB.
3. Verify branching: self → format; parent/guardian → guardian consent → format;
   photo → photo and written story → permission; video → video → permission.
   Neither path should require the other path's upload. Keep response summaries
   private and response editing disabled. Confirm the exact thank-you message.
4. Set Script Property `REVIEW_SHEET_ID` to
   `1tA3Cua9hDUolhXdXY9B93w3MBK39oahfjheiU3yD_8Q`. Run `setupReview`.
   It installs form-submit, review-edit, and hourly recovery triggers and creates
   a private folder for approved media copies. Do not share the response sheet,
   original uploads, or entire media folder publicly.
5. Publish the form for respondents. Deploy the script as a Web app, executing
   as its owner, accessible to Anyone. The public endpoint only serves approved
   snapshots and has no submission or approval operations.
6. Set `formUrl` to the actual copied responder URL and `feedUrl` to the deployed
   `/exec` URL in `js/story-config.js`. Deploy the static website using its existing
   hosting workflow. No secrets belong in this file.

## Review a submission

New stories arrive with **Decision = Pending**. Read the story and open the
**Private Upload** link to review the whole photo/video. For a child's story,
use the private guardian details to verify consent according to your review
process, then check **Guardian Consent Verified**. The automation blocks approval
without this check. It does not send messages or verify the relationship itself.

Choose **Approved** in the Decision dropdown. Wait for **Publication Result** to
say “Published”, then reload the website. The automation rechecks the original
form response and permissions and publishes a separate copy of the approved file.
Names, stories and optional handles are public; emails and guardian details are not.
Username-only submissions display as text because the form does not identify the
social platform reliably enough to construct a profile link.

Choose **Rejected** or **Pending** to remove a story from the feed and revoke
public access to its media copy. Existing open pages must be reloaded. Previously
downloaded material cannot be recalled. If Publication Result reports a media
removal failure, select Pending again to retry and verify the file's sharing.

Do not edit the technical ID/snapshot columns or sort only a subset of a row.
Display-cell edits do not change approved stories: publication uses the original
Form response. Do not programmatically change Decision using the Sheets API;
Google on-edit triggers fire for human edits in Sheets, not API writes.

## Completed live validation — September 22, 2026

Published site: https://hmkflight.github.io/mayday-eco/
GitHub Pages serves the root of `master`; pushes publish updates. The custom
`mayday.eco` domain is not connected (DNS did not resolve during setup).

- Followed the website button into the published form.
- Submitted a labeled synthetic PNG/photo story as an adult and a labeled MP4
  through the parent/guardian path. Both required their own upload only.
- Verified the exact confirmation message, required identity and consent,
  photo writing prompts, video prompts, and optional blank video description/handle.
- Both responses arrived Pending in the private review sheet and were absent
  from the anonymous public feed.
- A human edit approving the photo published it. Attempting to approve the
  guardian video first failed closed, reset it to Pending, and explained the
  required guardian verification. Checking verification and approving published it.
- Verified approved cards on the live Pages site, complete photo text and handle,
  anonymous photo display and video playback, including the embedded player in
  a 400px mobile viewport. Added playback permission and a direct-view fallback.
- Rejected both tests through Sheets. Verified empty public feed, no test cards
  after site reload, cleared published snapshots, and owner-only access on both
  original uploads and formerly public media copies. Test rows remain Rejected
  in the private sheet as an audit trail.
- All 11 local workflow tests passed; `git diff --check` passed.

## Repeat validation after changes

Local checks: `node --test tests/stories.test.mjs`. These use mocked Google
services to exercise pending/approved/rejected states, guardian consent, privacy,
duplicate-trigger recovery, invalid media, withdrawal, and frontend normalization.
They do not establish live Google upload, trigger, playback, or deployment success.

Before launch, submit clearly labeled test photo and video stories through the
actual responder form (including one guardian submission). Verify each is absent
from the public feed before approval, visible afterward, playable/viewable while
signed out, and absent again after rejection. Verify the name, full written story,
optional handle, exact confirmation message, required questions and branching.
Test all Share Your Story links on desktop and mobile. Reject test stories when done.

Google Drive may need time to process a video. Test the actual uploaded format in
the embedded player. Image publication accepts JPEG, PNG, WebP and GIF; other image
formats remain pending with an explanatory result. Keep uploads within Google
storage quotas. The hourly recovery trigger imports missed submissions without
resetting existing review decisions.
