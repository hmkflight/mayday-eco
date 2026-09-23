# mayday.eco

**The Kindness Ledger.** mayday.eco is a place where people who've granted a wish on
[One Simple Wish](https://onesimplewish.com) come back to post a short testimony — a
video, or a photo plus a few sentences — about how it felt to give. Their Instagram or
TikTok handle is displayed and linked so they get public credit. All testimonies appear
together on the Wall of Wishes, so the site becomes a growing, visible chain of people
inspiring other people to go grant a wish too.

The website remains static with no build step. Existing sample stories live in
`js/testimonies.js`. The new Google Forms integration uses a private review sheet
and Google Apps Script to publish an approved-only feed. The published responder
and feed URLs are configured in `js/story-config.js`.
See [Share Your Story setup and review](google-apps-script/SETUP.md).

Run local workflow checks with `node --test tests/stories.test.mjs`.

## Running locally

From the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Any static file server works — this is plain HTML/CSS/JS with no build step, so there's
nothing to install or compile.

## How to add a testimony manually

1. Drop the photo or video file in `media/testimonies/` (skip this step for the YouTube
   path — just note the video ID).
2. Open `js/testimonies.js` and add one object to the `testimonies` array, using the
   blank template below.
3. Commit and push (or redeploy, if you're not using git-based deploys).

The gallery re-sorts by `date` automatically and re-renders on every page load — there's
nothing else to wire up.

### Blank template

```js
{
  id: "t-XXX",                 // any unique string, e.g. "t-014"
  name: "Full Name",           // required; submissions are not anonymous
  handle: "@their_handle",     // their Instagram/TikTok handle, or null if none given
  handleUrl: "https://instagram.com/their_handle", // full profile URL, or null
  platform: "instagram",       // "instagram" | "tiktok" | null — controls which glyph shows
  mediaType: "photo",          // "photo" | "video-file" | "video-youtube"
  src: "media/testimonies/your-file.jpg", // photo or .mp4 path; null for video-youtube
  poster: null,                // optional for video-file; required for video-youtube
  youtubeId: null,             // REQUIRED for video-youtube — just the 11-char video ID
  alt: "Plain description of the image, for screen readers",
  excerpt: "Two to three sentences, in their words, about how granting the wish felt.",
  date: "2026-08-27",          // ISO date (YYYY-MM-DD) — also the sort key and "new" tag source
  // isPlaceholder: true,      // omit this line entirely for real entries
}
```

**Video files over ~15MB** should use the `video-youtube` path instead of `video-file` —
upload the clip to YouTube (unlisted is fine) and use its video ID. `gallery.js` will
render a click-to-load facade backed by `youtube-nocookie.com` so nothing autoplays or
loads until someone clicks play.

If an entry is missing a field its `mediaType` requires, `gallery.js` skips it and prints
a `console.warn` naming the entry and the missing field — it will never render a broken
card.

## Deploying

No build command. The publish directory is the project root (wherever `index.html`
lives).

- **Netlify / Vercel:** point the project at this folder, leave the build command empty,
  set the publish directory to `.` (project root).
- **GitHub Pages:** enable Pages on the repo, serving from the root of the branch you
  push to.

Point the `mayday.eco` domain at whichever host you pick — Netlify and Vercel both walk
you through the DNS records in their dashboard.

## Before launch — checklist

- Review the configured Google Form and private approval sheet using
  [the review guide](google-apps-script/SETUP.md). Adults may submit their own story;
  parents/legal guardians may submit a child's story with additional consent.
- Keep every new response Pending until reviewed. Child stories additionally
  require the reviewer to check Guardian Consent Verified before approval.
- Existing fictional sample cards remain labeled. Remove them from
  `js/testimonies.js` when you are ready to replace them with real approved stories.
- `assets/og-image.png` was generated in this build from `assets/og-image.svg` via
  `librsvg` (`rsvg-convert -w 1200 -h 630 -o assets/og-image.png assets/og-image.svg`). If
  you edit `og-image.svg` later, re-run that command to regenerate the PNG — social
  platforms require a PNG/JPEG `og:image`, not SVG.
- Double check the two "not affiliated with One Simple Wish" lines (hero band small
  print + footer) are still present. They're there deliberately — see the project notes
  if you want the reasoning.
