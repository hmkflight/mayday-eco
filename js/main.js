// mayday.eco — init, gallery render, header/menu behavior, and all motion.
import { renderGallery } from "./gallery.js";

renderGallery();

// Reduced motion never runs the hero intro tween (Context A below), so the
// headline needs its settled, post-intro variable-font weight applied directly.
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const headline = document.querySelector(".hero__headline");
  if (headline) {
    headline.style.fontVariationSettings = '"opsz" 144, "wght" 760, "SOFT" 10, "WONK" 1';
  }
}

// ---------- Lenis CDN resilience ----------
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureLenis() {
  if (typeof Lenis === "function") return;
  try {
    await loadScript("https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js");
  } catch (e) {
    console.warn("[mayday.eco] Lenis failed to load from both CDN URLs — falling back to native scroll.", e);
  }
}

// ---------- Header scroll state ----------
const header = document.getElementById("site-header");
function onScrollHeader() {
  if (window.scrollY > 40) header.classList.add("is-scrolled");
  else header.classList.remove("is-scrolled");
}
onScrollHeader();
window.addEventListener("scroll", onScrollHeader, { passive: true });

// ---------- Footer year ----------
const yearEl = document.getElementById("copyright-year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Mobile menu ----------
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuClose = document.getElementById("mobile-menu-close");
let lastFocused = null;

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled])')
  );
}

function openMobileMenu() {
  lastFocused = document.activeElement;
  mobileMenu.classList.add("is-open");
  mobileMenu.setAttribute("aria-hidden", "false");
  mobileMenu.removeAttribute("inert");
  hamburgerBtn.setAttribute("aria-expanded", "true");
  window.__lenis?.stop();
  document.body.style.overflow = "hidden";
  const focusables = getFocusable(mobileMenu);
  if (focusables.length) focusables[0].focus();
  document.addEventListener("keydown", onMobileMenuKeydown);
}

function closeMobileMenu() {
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  mobileMenu.setAttribute("inert", "");
  hamburgerBtn.setAttribute("aria-expanded", "false");
  window.__lenis?.start();
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onMobileMenuKeydown);
  if (lastFocused) lastFocused.focus();
}

function onMobileMenuKeydown(e) {
  if (e.key === "Escape") {
    closeMobileMenu();
    return;
  }
  if (e.key === "Tab") {
    const focusables = getFocusable(mobileMenu);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

hamburgerBtn?.addEventListener("click", () => {
  if (mobileMenu.classList.contains("is-open")) closeMobileMenu();
  else openMobileMenu();
});
mobileMenuClose?.addEventListener("click", closeMobileMenu);
mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobileMenu));

// ---------- Anchor scroll routing ----------
document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute("href");
  if (id.length < 2) return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  if (window.__lenis) {
    window.__lenis.scrollTo(target, { offset: -72 });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (link.classList.contains("skip-link")) {
    target.focus({ preventScroll: true });
  }
});

// ---------- Motion ----------
async function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  await ensureLenis();

  const mm = gsap.matchMedia();

  // Context A — base motion for any width, motion allowed.
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    let lenis = null;
    let raf = null;

    if (typeof Lenis === "function") {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, autoRaf: false });
      window.__lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      raf = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    // --- Hero: kinetic variable-font headline ---
    const headline = document.querySelector(".hero__headline");
    const axes = { wght: 220, SOFT: 90, WONK: 0, opsz: 144 };
    const applyAxes = () => {
      headline.style.fontVariationSettings =
        `"opsz" ${axes.opsz}, "wght" ${axes.wght}, "SOFT" ${axes.SOFT}, "WONK" ${axes.WONK}`;
    };
    applyAxes();

    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".hero__headline .word", { yPercent: 115, duration: 1.1, stagger: 0.07 }, 0)
      .to(axes, { wght: 760, SOFT: 10, WONK: 1, duration: 1.4, onUpdate: applyAxes }, 0)
      .from(".hero__kicker", { autoAlpha: 0, y: 12, duration: 0.6 }, 0.15)
      .from(".hero__sub", { autoAlpha: 0, y: 16, duration: 0.7 }, 0.45)
      .from(".hero__actions > *", { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.08 }, 0.6)
      .from(".hero__annotation", { autoAlpha: 0, rotate: -14, duration: 0.7 }, 0.75);

    const hst = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true };
    gsap.to(axes, {
      wght: 300, ease: "none", overwrite: "auto",
      scrollTrigger: { ...hst, onUpdate: applyAxes },
    });
    gsap.to(".hero__inner", { yPercent: -12, autoAlpha: 0.25, ease: "none", scrollTrigger: { ...hst } });

    // --- Generic section reveals (unpinned elements) ---
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0, y: 24, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
    });

    return () => {
      if (lenis) {
        gsap.ticker.remove(raf);
        lenis.destroy();
        window.__lenis = null;
      }
    };
  });

  // Context B — desktop: pinned How It Works + pinned horizontal Wall.
  mm.add("(prefers-reduced-motion: no-preference) and (min-width: 900px)", () => {
    // --- How It Works: pin + self-drawing horizontal thread ---
    const pathH = document.querySelector("#thread-path-h");
    const lenH = pathH.getTotalLength();
    gsap.set(pathH, { strokeDasharray: lenH, strokeDashoffset: lenH });

    gsap.timeline({
      scrollTrigger: {
        trigger: "#how",
        start: () => "top " + document.querySelector(".header").offsetHeight + "px",
        end: "+=1800",
        pin: true,
        scrub: 0.8,
        refreshPriority: 1,
        invalidateOnRefresh: true,
      },
    })
      .to(pathH, { strokeDashoffset: 0, duration: 3, ease: "none" }, 0)
      .from(".how__step", { autoAlpha: 0, y: 40, duration: 0.6, stagger: 0.9, ease: "power2.out" }, 0.5);

    // --- Wall of Wishes: vertical scroll drives horizontal motion ---
    const track = document.querySelector(".wall__track");
    const progressFill = document.getElementById("wall-progress-fill");
    const getDistance = () =>
      Math.max(0, track.scrollWidth - document.documentElement.clientWidth + 120);

    const wallTween = gsap.to(track, {
      x: () => -getDistance(),
      ease: "none",
      scrollTrigger: {
        trigger: "#wall",
        start: () => "top " + document.querySelector(".header").offsetHeight + "px",
        end: () => "+=" + getDistance(),
        pin: true,
        scrub: 1,
        refreshPriority: 2,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (progressFill) progressFill.style.transform = `scaleX(${self.progress})`;
        },
        onToggle: (self) => {
          track.style.willChange = self.isActive ? "transform" : "auto";
        },
      },
    });

    // Both pin triggers (#how above, #wall above) now exist — safe to attach
    // the pinned-section reveals per §8.5's "created after that section's
    // pin trigger" rule.
    gsap.utils.toArray("[data-reveal-pinned]").forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0, y: 24, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 95%", once: true },
      });
    });

    gsap.utils.toArray(".wall__track .card").forEach((card) => {
      gsap.from(card, {
        scale: 0.92, duration: 0.38, ease: "back.out(2)",
        scrollTrigger: {
          trigger: card,
          containerAnimation: wallTween,
          start: "left 92%",
          toggleActions: "play none none none",
        },
      });
    });
  });

  // Context C — mobile/tablet, motion allowed: no pins, vertical thread scrub,
  // step + card fade-ups in place of the desktop pin timelines.
  mm.add("(prefers-reduced-motion: no-preference) and (max-width: 899px)", () => {
    const pathV = document.querySelector("#thread-path-v");
    const lenV = pathV.getTotalLength();
    gsap.set(pathV, { strokeDasharray: lenV, strokeDashoffset: lenV });
    gsap.to(pathV, {
      strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger: "#how", start: "top 80%", end: "bottom 60%", scrub: 0.8 },
    });

    gsap.utils.toArray("[data-reveal-pinned]").forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0, y: 24, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
    });

    gsap.from(".how__step", {
      autoAlpha: 0, y: 30, duration: 0.6, stagger: 0.15, ease: "power2.out",
      scrollTrigger: { trigger: ".how__steps", start: "top 85%", once: true },
    });

    gsap.from(".wall__track .card", {
      autoAlpha: 0, y: 30, duration: 0.6, stagger: 0.12, ease: "power2.out",
      scrollTrigger: { trigger: ".wall__track", start: "top 85%", once: true },
    });
  });

  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

initMotion();
