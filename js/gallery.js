// Renders the Wall of Wishes from js/testimonies.js.
// Pure DOM — no framework, no build step.

import { testimonies } from "./testimonies.js";

const PLATFORM_ICON = {
  instagram: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/></svg>`,
  tiktok: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3c.6 2.4 2.2 3.9 4.6 4.2v3.1c-1.7.1-3.2-.4-4.6-1.4v6.6c0 3.6-2.9 6-6.1 6-3.2 0-6-2.6-6-5.9 0-3.4 2.9-5.9 6.1-5.9.4 0 .8 0 1.2.1v3.2a3 3 0 1 0 2.1 2.9V3H15z" fill="currentColor"/></svg>`,
};

const PLAY_GLYPH = `<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" focusable="false"><circle cx="26" cy="26" r="25" fill="rgba(36,30,26,0.55)" stroke="#F4EDE1" stroke-width="1.5"/><path d="M21 16.5v19l16-9.5-16-9.5z" fill="#F4EDE1"/></svg>`;

const PUSHPIN_SVG = `<svg class="pushpin" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
  <line x1="11" y1="9" x2="11" y2="20" stroke="#6A5C50" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="11" cy="8" r="7" fill="#E0912F"/>
  <path d="M6.5 5.5a6 6 0 0 1 6-2.4" stroke="#f5c98a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldsMissing(t) {
  const missing = [];
  if (!t.id) missing.push("id");
  if (!t.name) missing.push("name");
  if (t.mediaType === "photo" && !t.excerpt) missing.push("excerpt");
  if (!t.date) missing.push("date");
  if (!t.mediaType) missing.push("mediaType");

  if (t.mediaType === "photo") {
    if (!t.src) missing.push("src");
    if (!t.alt) missing.push("alt");
  } else if (t.mediaType === "video-file") {
    if (!t.src) missing.push("src");
  } else if (t.mediaType === "video-drive") {
    if (!/^[\w-]{10,200}$/.test(t.driveFileId || "")) missing.push("driveFileId");
  } else if (t.mediaType === "video-youtube") {
    if (!t.youtubeId) missing.push("youtubeId");
    if (!t.poster) missing.push("poster");
  } else {
    missing.push("mediaType(unknown value)");
  }
  return missing;
}

function renderMedia(t) {
  if (t.mediaType === "photo") {
    return `<div class="card__media">
      <img src="${escapeHtml(t.src)}" alt="${escapeHtml(t.alt)}" loading="lazy" decoding="async">
    </div>`;
  }
  if (t.mediaType === "video-file") {
    return `<div class="card__media">
      <video controls preload="metadata"${t.poster ? ` poster="${escapeHtml(t.poster)}"` : ""} aria-label="${escapeHtml(t.name)}'s video testimony">
        <source src="${escapeHtml(t.src)}">
      </video>
    </div>`;
  }
  if (t.mediaType === "video-drive") {
    return `<div class="card__media">
      <iframe src="https://drive.google.com/file/d/${encodeURIComponent(t.driveFileId)}/preview"
        title="${escapeHtml(t.name)}'s video testimony" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
    </div>`;
  }
  if (t.mediaType === "video-youtube") {
    return `<div class="card__media">
      <button type="button" class="card__media-btn" data-youtube-id="${escapeHtml(t.youtubeId)}" data-name="${escapeHtml(t.name)}" aria-label="Play ${escapeHtml(t.name)}'s video testimony">
        <img src="${escapeHtml(t.poster)}" alt="" loading="lazy" decoding="async">
        <span class="card__play">${PLAY_GLYPH}</span>
      </button>
    </div>`;
  }
  return "";
}

function activateYoutubeFacades(root) {
  root.querySelectorAll(".card__media-btn[data-youtube-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.youtubeId;
      const name = btn.dataset.name || "";
      const mediaBox = btn.closest(".card__media");
      mediaBox.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1"
        title="${escapeHtml(name)}'s testimony"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowfullscreen loading="lazy"
        style="width:100%;height:100%;border:0"></iframe>`;
    });
  });
}

function renderCard(t, isNew) {
  const platformIcon = t.platform && PLATFORM_ICON[t.platform] ? PLATFORM_ICON[t.platform] : "";
  const handle = t.handle && t.handleUrl
    ? `<a class="card__handle" href="${escapeHtml(t.handleUrl)}" target="_blank" rel="noopener noreferrer">${platformIcon}${escapeHtml(t.handle)}</a>`
    : t.handle
      ? `<span class="card__handle">${platformIcon}${escapeHtml(t.handle)}</span>`
      : "";

  return `<div class="card-wrap${t.isSample ? " card-wrap--sample" : ""}">
    ${PUSHPIN_SVG}
    ${isNew ? `<span class="new-tag">new</span>` : ""}
    <article class="card torn">
      ${renderMedia(t)}
      ${t.excerpt ? `<p class="card__excerpt${t.isSample ? "" : " card__excerpt--full"}">${escapeHtml(t.excerpt)}</p>` : ""}
      <div class="card__footer">
        <span class="card__name">${escapeHtml(t.name)}</span>
        ${handle}
      </div>
    </article>
  </div>`;
}

export function renderGallery(approvedStories = []) {
  const track = document.getElementById("wall-track");
  const viewport = document.querySelector(".wall__viewport");
  const progress = document.getElementById("wall-progress");
  const empty = document.getElementById("wall-empty");
  const countEl = document.getElementById("wall-count");
  if (!track) return;

  const sorted = [...testimonies, ...approvedStories].sort((a, b) => new Date(b.date) - new Date(a.date));

  const valid = [];
  let skipped = 0;
  sorted.forEach((t) => {
    const missing = fieldsMissing(t);
    if (missing.length) {
      console.warn(`[mayday.eco] Skipping testimony "${t.id || "(no id)"}" — missing required field(s): ${missing.join(", ")}`);
      skipped++;
      return;
    }
    valid.push(t);
  });

  const placeholderCount = valid.filter((t) => t.isPlaceholder).length;
  if (placeholderCount > 0) {
    console.warn(`[mayday.eco] ${placeholderCount} placeholder testimony entr${placeholderCount === 1 ? "y" : "ies"} still present — replace before launch.`);
  }
  if (skipped > 0) {
    console.warn(`[mayday.eco] ${skipped} testimony entr${skipped === 1 ? "y" : "ies"} skipped due to missing fields.`);
  }

  if (valid.length === 0) {
    if (viewport) viewport.hidden = true;
    if (progress) progress.hidden = true;
    if (empty) empty.hidden = false;
    if (countEl) countEl.textContent = "";
    return;
  }

  if (empty) empty.hidden = true;
  if (viewport) viewport.hidden = false;
  if (progress) progress.hidden = false;

  const newestNonSample = valid.find((t) => !t.isSample && !t.isPlaceholder);

  track.innerHTML = valid
    .map((t) => renderCard(t, !!(newestNonSample && t.id === newestNonSample.id)))
    .join("");

  activateYoutubeFacades(track);

  const realCount = valid.filter((t) => !t.isSample && !t.isPlaceholder).length;
  if (countEl) {
    countEl.textContent = realCount > 0 ? `${realCount} stor${realCount === 1 ? "y" : "ies"} and counting` : "";
  }
}
