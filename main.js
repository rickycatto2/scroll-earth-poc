gsap.registerPlugin(ScrollTrigger);

const video = document.getElementById("earthVideo");
const wipeUnderlay = document.getElementById("wipeUnderlay");
const wipeOverlay = document.getElementById("wipeOverlay");
const wipeLeft = document.getElementById("wipeLeft");
const wipeRight = document.getElementById("wipeRight");

let targetTime = 0;

// iOS/Safari quirks: "prime" the video so currentTime changes work reliably.
async function primeVideo() {
  try {
    video.muted = true;
    await video.play();
    video.pause();
  } catch (e) {
    // Autoplay may be blocked until first user gesture; scroll usually counts.
    console.warn("Video prime blocked (ok for POC):", e);
  }
}

function setupScroll() {
  // One pinned scroll region does two phases:
  // 1) Scrub video (most of scroll)
  // 2) Hold last frame + slide PNG halves away (end of scroll)
  const SCROLL_LEN = 4200;     // total scroll distance while pinned (tweak to taste)
  const VIDEO_PORTION = 0.75;  // 75% scrub, 25% wipe (tweak: 0.7–0.85)

  // Timeline used only for the wipe portion (simple and reliable)
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#scene",
      start: "top top",
      end: `+=${SCROLL_LEN}`,
      scrub: true,
      pin: true,
      anticipatePin: 1
    }
  });

  // Separate ScrollTrigger to compute targetTime based on scroll progress
  // (We keep this separate so video smoothing stays clean.)
  ScrollTrigger.create({
    trigger: "#scene",
    start: "top top",
    end: `+=${SCROLL_LEN}`,
    scrub: true,
    onUpdate: (self) => {
      if (!video.duration) return;

      const p = self.progress;

      // During first portion, map 0..VIDEO_PORTION => 0..1 of the video
      const vp = Math.min(1, p / VIDEO_PORTION);
      targetTime = video.duration * vp;

      // During wipe portion, freeze on last frame
      if (p >= VIDEO_PORTION) {
        targetTime = Math.max(0, video.duration - 0.05);
      }
    }
  });

  // Smoothly ease the video time toward targetTime
  gsap.ticker.add(() => {
    if (!video.duration) return;
    video.currentTime += (targetTime - video.currentTime) * 0.15;
  });

  // Ensure wipe layers start hidden + reset transforms
  gsap.set([wipeUnderlay, wipeOverlay], { opacity: 0 });
  gsap.set([wipeLeft, wipeRight], { xPercent: 0 });

  // Wipe begins at VIDEO_PORTION of the timeline
  // Turn on underlay + overlay instantly
  tl.to(wipeUnderlay, { opacity: 1, duration: 0.001 }, VIDEO_PORTION);
  tl.to(wipeOverlay, { opacity: 1, duration: 0.001 }, VIDEO_PORTION);

  // Slide halves apart
  tl.to(wipeLeft,  { xPercent: -120, ease: "none", duration: 1 }, VIDEO_PORTION);
  tl.to(wipeRight, { xPercent:  120, ease: "none", duration: 1 }, VIDEO_PORTION);

  // Optional: dim the video slightly so the blue read is strong
  tl.to(video, { opacity: 0.15, ease: "none", duration: 0.25 }, VIDEO_PORTION);
}

video.addEventListener("loadedmetadata", async () => {
  await primeVideo();
  setupScroll();
});

// In case metadata is cached and loads instantly:
if (video.readyState >= 1) {
  (async () => {
    await primeVideo();
    setupScroll();
  })();
}
