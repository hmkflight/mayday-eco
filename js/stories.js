import { storyConfig } from "./story-config.js";

export function isFormUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      (url.hostname === "docs.google.com" && /^\/forms\/d\/(?:e\/)?[^/]+\/viewform$/.test(url.pathname)) ||
      (url.hostname === "forms.gle" && /^\/[^/]+$/.test(url.pathname))
    );
  } catch { return false; }
}

export function configureStoryLinks(config = storyConfig, root = document) {
  if (!isFormUrl(config.formUrl)) return false;
  root.querySelectorAll("[data-story-link]").forEach((link) => {
    link.href = config.formUrl;
    link.setAttribute("aria-label", "Share your story on Google Forms");
  });
  const heading = root.getElementById("form-embed-heading");
  const status = root.getElementById("story-form-status");
  const detail = root.getElementById("story-form-detail");
  if (heading) heading.textContent = "Your story starts here.";
  if (status) status.textContent = "Share your experience";
  if (detail) detail.textContent = "Choose a photo and written story or a video. Google sign-in is required to upload your file. Your name is required, and every submission is reviewed before publication.";
  return true;
}

// This is defense in depth. The server must only return approved public fields;
// pending records and contact details must never reach the browser.
export function normalizeApprovedStories(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.stories)) throw new Error("Invalid story feed");
  const seen = new Set();
  return payload.stories.filter((story) => {
    if (!story || story.status !== "Approved" || typeof story.id !== "string" || seen.has(story.id)) return false;
    if (typeof story.name !== "string" || !story.name.trim()) return false;
    if (!/^[\w-]{10,200}$/.test(story.driveFileId || "")) return false;
    if (!["photo", "video-drive"].includes(story.mediaType)) return false;
    if (typeof story.date !== "string" || !Number.isFinite(Date.parse(story.date))) return false;
    if (story.mediaType === "photo" && (typeof story.excerpt !== "string" || !story.excerpt.trim())) return false;
    seen.add(story.id);
    return true;
  }).map((story) => ({
    id: `submission-${story.id}`,
    name: story.name,
    handle: typeof story.handle === "string" ? story.handle : null,
    // A username alone does not identify which social network it belongs to.
    handleUrl: null,
    platform: null,
    mediaType: story.mediaType,
    driveFileId: story.driveFileId,
    src: story.mediaType === "photo"
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(story.driveFileId)}&sz=w1000`
      : null,
    alt: `Photo shared by ${story.name}`,
    excerpt: typeof story.excerpt === "string" ? story.excerpt : "",
    date: story.date,
  }));
}

export async function loadApprovedStories(config = storyConfig, fetcher = fetch) {
  if (!config.feedUrl) return [];
  const url = new URL(config.feedUrl);
  if (url.origin !== "https://script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
    throw new Error("Invalid approved-story endpoint");
  }
  const response = await fetcher(url.href, {
    cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Story feed unavailable");
  return normalizeApprovedStories(await response.json());
}
