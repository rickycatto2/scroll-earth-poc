gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");

const wipeUnderlay = document.getElementById("wipeUnderlay");
const wipeOverlay = document.getElementById("wipeOverlay");
const wipeLeft = document.getElementById("wipeLeft");
const wipeRight = document.getElementById("wipeRight");

const slashStatic = document.getElementById("slashStatic");

let initialized = false;
let earthTargetTime = 0;
let slashTargetTime = 0;

// iOS/Safari: "prime" videos so currentTime seeking works reliably.
async function prime(videoEl) {
  try {
    videoEl.muted = true;
    await videoEl.play();
    videoEl.pause();
  } catch (e) {
    // Fine for POC: user gesture may be required on some devices.
    console.warn("Video prime blocked (ok for POC):", e);
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function allMetadataReady(videos) {
  return Promise.all(
    videos.map((v) => new Promise((resolve) => {
      if (v.readyState >= 1 && v.duration) return resolve();
      v.addEventListener("loadedmetadata", () => resolve(), { once: true });
    }))
  );
}

function resetVisuals() {
  // Video visibility
  gsap.set(earthVideo, { opacity: 1 });
  gsap.set(slashVideo, { opacity: 0 });

  // Slash static overlay off by default
  gsap.set(slashStatic, { opacity: 0 });

  // Wipe off by default
  gsap.set([wipeUnderlay, wipeOverlay], { opacity: 0 });
  wipeLeft.style.transform = "translate3d(0%,0,0)";
  wipeRight.style.transform = "translate3d(0%,0,0)";
}

function setupScroll() {
  if (initialized) return;
  initialized = true;

  // Tune this to taste
  const SCROLL_LEN = 4800;

  // Explicit phases (sum to 1.0)
  const PHASE_A = 0.76; // earth scrub
  const PHASE_B = 0.10; // slash scrub
  const PHASE_C = 0.14; // split

  const A_END = PHASE_A;
  const B_END = PHASE_A + PHASE_B;

  resetVisuals();

  // Smooth easing for both videos (reduces stepping during scrubbing)
  gsap.ticker.add(() => {
    if (earthVideo.duration) {
      earthVideo.currentTime += (earthTargetTime - earthVideo.currentTime) * 0.15;
    }
    if (slashVideo.duration) {
      slashVideo.currentTime += (slashTargetTime - slashVideo.currentTime) * 0.25;
    }
  });

  ScrollTrigger.create({
    trigger: "#scene",
    start: "top top",
    end: `+=${SCROLL_LEN}`,
    scrub: true,
    pin: true,
    anticipatePin: 1,
    onUpdate: (self) => {
      const p = self.progress; // 0..1

      // Guard: durations might be 0 briefly
      if (!earthVideo.duration || !slashVideo.duration) return;

      // -----------------------
      // Phase A: Earth scrub
      // -----------------------
      if (p <= A_END) {
        const vp = clamp01(p / A_END);

        // Scrub earth 0 -> end
        earthTargetTime = earthVideo.duration * vp;

        // Keep everything else off
        slashVideo.style.opacity = "0";
        slashStatic.style.opacity = "0";
        wipeUnderlay.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        wipeLeft.style.transform = "translate3d(0%,0,0)";
        wipeRight.style.transform = "translate3d(0%,0,0)";

        earthVideo.style.opacity = "1";
        return;
      }

      // Freeze earth on last frame for remaining phases
      earthTargetTime = Math.max(0, earthVideo.duration - 0.05);
      earthVideo.style.opacity = "1";

      // -----------------------
      // Phase B: Slash video scrub
      // -----------------------
      if (p <= B_END) {
        const sp = clamp01((p - A_END) / (B_END - A_END));

        // Show slash video, hide static slash (until complete)
        slashVideo.style.opacity = "1";
        slashStatic.style.opacity = "0";

        // Keep wipe off
        wipeUnderlay.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        wipeLeft.style.transform = "translate3d(0%,0,0)";
        wipeRight.style.transform = "translate3d(0%,0,0)";

        // Scrub slash 0 -> end
        slashTargetTime = slashVideo.duration * sp;
        return;
      }

      // Once Phase B is complete:
      // - Lock slash video to its end (so it doesn't jump if the browser hiccups)
      // - Hide slash video
      // - Show the static transparent slash PNG for all remaining phases
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";
      slashStatic.style.opacity = "1";

      // -----------------------
      // Phase C: Split wipe
      // -----------------------
      const wp = clamp01((p - B_END) / (1 - B_END)); // 0..1

      wipeUnderlay.style.opacity = "1";
      wipeOverlay.style.opacity = "1";

      // Slide halves apart (GPU-friendly)
      const leftX = (-120 * wp);
      const rightX = (120 * wp);
      wipeLeft.style.transform = `translate3d(${leftX}%, 0, 0)`;
      wipeRight.style.transform = `translate3d(${rightX}%, 0, 0)`;
    }
  });
}

(async function init() {
  // Wait for both videos to have metadata
  await allMetadataReady([earthVideo, slashVideo]);

  // Prime both videos for iOS/Safari seek behavior
  await prime(earthVideo);
  await prime(slashVideo);

  // Ensure slash starts at 0
  try { slashVideo.currentTime = 0; } catch (_) {}

  setupScroll();
})();
