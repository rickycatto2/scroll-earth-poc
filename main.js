gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");

const revealPage2 = document.getElementById("revealPage2");

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
  gsap.set(earthVideo, { opacity: 1 });
  gsap.set(slashVideo, { opacity: 0 });

  gsap.set(slashStatic, { opacity: 0 });

  gsap.set(revealPage2, { opacity: 0 });
  gsap.set(wipeOverlay, { opacity: 0 });

  wipeLeft.style.transform = "translate3d(0%,0,0)";
  wipeRight.style.transform = "translate3d(0%,0,0)";
}

function setupScroll() {
  if (initialized) return;
  initialized = true;

  // Tune to taste
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
      const p = self.progress;

      if (!earthVideo.duration || !slashVideo.duration) return;

      // -----------------------
      // Phase A: Earth scrub
      // -----------------------
      if (p <= A_END) {
        const vp = clamp01(p / A_END);

        earthTargetTime = earthVideo.duration * vp;

        slashVideo.style.opacity = "0";
        slashStatic.style.opacity = "0";

        revealPage2.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        wipeLeft.style.transform = "translate3d(0%,0,0)";
        wipeRight.style.transform = "translate3d(0%,0,0)";

        earthVideo.style.opacity = "1";
        return;
      }

      // Freeze earth on last frame
      earthTargetTime = Math.max(0, earthVideo.duration - 0.05);
      earthVideo.style.opacity = "1";

      // -----------------------
      // Phase B: Slash video scrub
      // -----------------------
      if (p <= B_END) {
        const sp = clamp01((p - A_END) / (B_END - A_END));

        slashVideo.style.opacity = "1";
        slashStatic.style.opacity = "0";

        revealPage2.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        wipeLeft.style.transform = "translate3d(0%,0,0)";
        wipeRight.style.transform = "translate3d(0%,0,0)";

        slashTargetTime = slashVideo.duration * sp;
        return;
      }

      // After Phase B completes:
      // - lock slash video to end
      // - hide slash video
      // - show the static slash PNG forever
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";
      slashStatic.style.opacity = "1";

      // -----------------------
      // Phase C: Split wipe reveals Page 2 behind
      // -----------------------
      const wp = clamp01((p - B_END) / (1 - B_END));

      revealPage2.style.opacity = "1";
      wipeOverlay.style.opacity = "1";

      const leftX = (-120 * wp);
      const rightX = (120 * wp);
      wipeLeft.style.transform = `translate3d(${leftX}%, 0, 0)`;
      wipeRight.style.transform = `translate3d(${rightX}%, 0, 0)`;
    }
  });
}

(async function init() {
  await allMetadataReady([earthVideo, slashVideo]);

  await prime(earthVideo);
  await prime(slashVideo);

  try { slashVideo.currentTime = 0; } catch (_) {}

  setupScroll();
})();
