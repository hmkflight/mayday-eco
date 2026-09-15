# mayday.eco

**The Kindness Ledger.** mayday.eco is a place where people who've granted a wish on
[One Simple Wish](https://onesimplewish.com) come back to post a short testimony — a
video, or a photo plus a few sentences — about how it felt to give. Their Instagram or
TikTok handle is displayed and linked so they get public credit. All testimonies appear
together on the Wall of Wishes, so the site becomes a growing, visible chain of people
inspiring other people to go grant a wish too.

It's a static site: no build step, no backend, no database. Testimonies live in a plain
JavaScript array (`js/testimonies.js`) and form submissions are handled by an embedded
third-party form (Tally or Google Forms).

## Running locally

From the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Any static file server works — this is plain HTML/CSS/JS with no build step, so there's
nothing to install or compile.

## How to add a testimony

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
  name: "Full Name",           // or "Anonymous" if they asked not to be named
  handle: "@their_handle",     // their Instagram/TikTok handle, or null if none given
  handleUrl: "https://instagram.com/their_handle", // full profile URL, or null
  platform: "instagram",       // "instagram" | "tiktok" | null — controls which glyph shows
  mediaType: "photo",          // "photo" | "video-file" | "video-youtube"
  src: "media/testimonies/your-file.jpg", // photo or .mp4 path; null for video-youtube
  poster: null,                // REQUIRED for video-file and video-youtube — a still image path
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

Five bracketed tokens live under three `REPLACE-BEFORE-LAUNCH` comments. Find them and
replace them before this goes live:

| Token | File / location |
|---|---|
| `[MISSION_PARAGRAPH_ONE]` | `index.html` — `<!-- REPLACE-BEFORE-LAUNCH (1 of 3): mission copy -->`, in the `#mission` section |
| `[MISSION_PARAGRAPH_TWO]` | `index.html` — same comment block, second `<p>` |
| Submission-form embed | `index.html` — `<!-- REPLACE-BEFORE-LAUNCH (2 of 3) ... -->`, in the `#share` section. Replace the invitation card with a Google Forms or Tally iframe. |
| `[LINKEDIN_URL]` | `index.html` — `<!-- REPLACE-BEFORE-LAUNCH (3 of 3): social URLs -->`, in the footer |
| `[INSTAGRAM_URL]` | `index.html` — same comment block, second link |

Also:

- **Configure the submission form before launch:** require one upload field that accepts a photo **or** short video of the submitter from their wish-granting experience. Explain that the upload is reviewed to help keep the Wall of Wishes real; it must not request IDs, addresses, phone numbers, or other sensitive personal information. Ask submitters to upload only media they have permission to share and that does not disclose another person's private information. Keep consent to publish the story/media as a separate, explicit choice, and review every submission before publishing.

- **Delete the three placeholder entries** in `js/testimonies.js` (`t-placeholder-001/002/003`).
  The console warns on every page load while any remain.
- **Add 2–3 real testimonies** so the wall isn't empty on day one.
- `assets/og-image.png` was generated in this build from `assets/og-image.svg` via
  `librsvg` (`rsvg-convert -w 1200 -h 630 -o assets/og-image.png assets/og-image.svg`). If
  you edit `og-image.svg` later, re-run that command to regenerate the PNG — social
  platforms require a PNG/JPEG `og:image`, not SVG.
- Double check the two "not affiliated with One Simple Wish" lines (hero band small
  print + footer) are still present. They're there deliberately — see the project notes
  if you want the reasoning.
