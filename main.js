gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");

const wipeUnderlay = document.getElementById("wipeUnderlay");
const wipeOverlay = document.getElementById("wipeOverlay");
const wipeLeft = document.getElementById("wipeLeft");
const wipeRight = document.getElementById("wipeRight");

const slashStaticGlobal = document.getElementById("slashStaticGlobal");

let initialized = false;
let earthTargetTime = 0;
let slashTargetTime = 0;

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

function resetOpenerVisuals() {
  gsap.set(earthVideo, { opacity: 1 });
  gsap.set(slashVideo, { opacity: 0 });
  gsap.set(slashStaticGlobal, { opacity: 0 });

  gsap.set([wipeUnderlay, wipeOverlay], { opacity: 0 });
  wipeLeft.style.transform = "translate3d(0%,0,0)";
  wipeRight.style.transform = "translate3d(0%,0,0)";
}

function setupOpenerScroll() {
  if (initialized) return;
  initialized = true;

  const SCROLL_LEN = 4800;

  // Opener phases
  const PHASE_A = 0.76; // earth scrub
  const PHASE_B = 0.10; // slash scrub
  const PHASE_C = 0.14; // split

  const A_END = PHASE_A;
  const B_END = PHASE_A + PHASE_B;

  resetOpenerVisuals();

  // Smooth easing for both videos
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

      // Phase A: earth scrub
      if (p <= A_END) {
        const vp = clamp01(p / A_END);
        earthTargetTime = earthVideo.duration * vp;

        slashVideo.style.opacity = "0";
        wipeUnderlay.style.opacity = "0";
        wipeOverlay.style.opacity = "0";
        slashStaticGlobal.style.opacity = "0";

        wipeLeft.style.transform = "translate3d(0%,0,0)";
        wipeRight.style.transform = "translate3d(0%,0,0)";
        return;
      }

      // Freeze earth
      earthTargetTime = Math.max(0, earthVideo.duration - 0.05);

      // Phase B: slash scrub
      if (p <= B_END) {
        const sp = clamp01((p - A_END) / (B_END - A_END));

        slashVideo.style.opacity = "1";
        slashStaticGlobal.style.opacity = "0";

        wipeUnderlay.style.opacity = "0";
        wipeOverlay.style.opacity = "0";

        slashTargetTime = slashVideo.duration * sp;
        return;
      }

      // After Phase B: lock slash video & enable global slash overlay forever
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";
      slashStaticGlobal.style.opacity = "1";

      // Phase C: split opener (reveals solid underlay)
      const wp = clamp01((p - B_END) / (1 - B_END));
      wipeUnderlay.style.opacity = "1";
      wipeOverlay.style.opacity = "1";

      const leftX = (-120 * wp);
      const rightX = (120 * wp);
      wipeLeft.style.transform = `translate3d(${leftX}%, 0, 0)`;
      wipeRight.style.transform = `translate3d(${rightX}%, 0, 0)`;
    }
  });
}

function setupSplitSections() {
  // Each splitSection pins and scrubs its overlay halves apart
  document.querySelectorAll(".splitSection").forEach((section) => {
    const overlay = section.querySelector(".splitOverlay");
    if (!overlay) return;

    const left = overlay.querySelector(".splitHalf.left");
    const right = overlay.querySelector(".splitHalf.right");
    if (!left || !right) return;

    // Reset positions
    gsap.set(left, { xPercent: 0 });
    gsap.set(right, { xPercent: 0 });

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=140%",      // how long the split takes; tune this
      scrub: true,
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const p = self.progress; // 0..1
        gsap.set(left, { xPercent: -120 * p });
        gsap.set(right, { xPercent: 120 * p });
      }
    });
  });
}

(async function init() {
  await allMetadataReady([earthVideo, slashVideo]);
  await prime(earthVideo);
  await prime(slashVideo);

  try { slashVideo.currentTime = 0; } catch (_) {}

  setupOpenerScroll();
  setupSplitSections();
})();
