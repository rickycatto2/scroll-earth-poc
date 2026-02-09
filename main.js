gsap.registerPlugin(ScrollTrigger);

const video = document.getElementById("earthVideo");
const wipeUnderlay = document.getElementById("wipeUnderlay");
const wipeOverlay = document.getElementById("wipeOverlay");
const wipeLeft = document.getElementById("wipeLeft");
const wipeRight = document.getElementById("wipeRight");

let initialized = false;
let targetTime = 0;

// iOS/Safari quirks: "prime" the video so currentTime changes work reliably.
async function primeVideo() {
  try {
    video.muted = true;
    await video.play();
    video.pause();
  } catch (e) {
    console.warn("Video prime blocked (ok for POC):", e);
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function setupScroll() {
  if (initialized) return;
  initialized = true;

  const SCROLL_LEN = 4200;     // total scroll distance while pinned
  const VIDEO_PORTION = 0.78;  // first 78% scrubs video; last 22% does the wipe

  // Reset visuals
  gsap.set([wipeUnderlay, wipeOverlay], { opacity: 0 });
  gsap.set([wipeLeft, wipeRight], { xPercent: 0 });
  gsap.set(video, { opacity: 1 });

  // Smooth video time easing (reduces stepping)
  gsap.ticker.add(() => {
    if (!video.duration) return;
    video.currentTime += (targetTime - video.currentTime) * 0.15;
  });

  // One ScrollTrigger to rule them all
  ScrollTrigger.create({
    trigger: "#scene",
    start: "top top",
    end: `+=${SCROLL_LEN}`,
    scrub: true,
    pin: true,
    anticipatePin: 1,

    onUpdate: (self) => {
      if (!video.duration) return;

      const p = self.progress; // 0..1 across the pinned scroll

      // 1) Video scrub phase
      if (p <= VIDEO_PORTION) {
        const vp = p / VIDEO_PORTION;     // 0..1
        targetTime = video.duration * vp; // scrub video

        // Ensure wipe is off
        wipeUnderlay.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        wipeLeft.style.transform = "translateX(0)";
        wipeRight.style.transform = "translateX(0)";
        video.style.opacity = "1";
        return;
      }

      // 2) Wipe phase (hold last frame + slide PNG halves away)
      targetTime = Math.max(0, video.duration - 0.05);

      const wp = clamp01((p - VIDEO_PORTION) / (1 - VIDEO_PORTION)); // 0..1

      // Turn wipe layers on as soon as wipe starts
      wipeUnderlay.style.opacity = "1";
      wipeOverlay.style.opacity = "1";

      // Slide halves apart
      // Use translate3d for smoother GPU compositing
      const leftX = (-120 * wp);
      const rightX = (120 * wp);
      wipeLeft.style.transform = `translate3d(${leftX}%, 0, 0)`;
      wipeRight.style.transform = `translate3d(${rightX}%, 0, 0)`;

      // Optional: dim the video so the blue reads clearly
      const dim = 1 - (0.85 * wp); // 1 -> 0.15
      video.style.opacity = String(dim);
    }
  });
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
