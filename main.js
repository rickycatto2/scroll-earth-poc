gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");
const layerStack = document.getElementById("layerStack");
const slashStaticGlobal = document.getElementById("slashStaticGlobal");

// Collect split layers in top->bottom order we want to animate:
// page1, page2, page3, page4, page5
const splitLayers = Array.from(document.querySelectorAll(".layer[data-layer]"))
  .filter(el => el.getAttribute("data-layer") !== "final")
  .sort((a, b) => Number(a.getAttribute("data-layer")) - Number(b.getAttribute("data-layer"))); // 1..5

let initialized = false;
let earthTargetTime = 0;
let slashTargetTime = 0;

// iOS/Safari: prime videos so seeking is reliable.
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

function resetAll() {
  // Default visibility
  gsap.set(slashVideo, { opacity: 0 });
  gsap.set(layerStack, { opacity: 0 });
  gsap.set(slashStaticGlobal, { opacity: 0 });

  // Reset split halves positions
  splitLayers.forEach((layer) => {
    const left = layer.querySelector(".half.left");
    const right = layer.querySelector(".half.right");
    if (!left || !right) return;
    gsap.set(left, { xPercent: 0 });
    gsap.set(right, { xPercent: 0 });
  });
}

function setupScroll() {
  if (initialized) return;
  initialized = true;

  // Total pinned scroll length (tune to taste)
  const SCROLL_LEN = 9000;

  // Phases of the ONE pinned experience:
  // A: Earth scrub
  // B: Slash scrub
  // C: Split chain (pages 1..5)
  const PHASE_A = 0.68;
  const PHASE_B = 0.10;
  const PHASE_C = 0.22;

  const A_END = PHASE_A;
  const B_END = PHASE_A + PHASE_B; // start of split chain

  // How far halves move when fully split
  const SPLIT_DISTANCE = 120;

  resetAll();

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
    trigger: "#experience",
    start: "top top",
    end: `+=${SCROLL_LEN}`,
    scrub: true,
    pin: true,
    anticipatePin: 1,
    onUpdate: (self) => {
      const p = self.progress; // 0..1

      if (!earthVideo.duration || !slashVideo.duration) return;

      // -----------------------
      // Phase A: Earth scrub
      // -----------------------
      if (p <= A_END) {
        const vp = clamp01(p / A_END);
        earthTargetTime = earthVideo.duration * vp;

        // Keep everything else off
        slashVideo.style.opacity = "0";
        layerStack.style.opacity = "0";
        slashStaticGlobal.style.opacity = "0";

        // Reset layers while we’re here (so backscroll behaves)
        splitLayers.forEach((layer) => {
          const left = layer.querySelector(".half.left");
          const right = layer.querySelector(".half.right");
          if (!left || !right) return;
          gsap.set(left, { xPercent: 0 });
          gsap.set(right, { xPercent: 0 });
        });

        return;
      }

      // Freeze earth on last frame for the rest
      earthTargetTime = Math.max(0, earthVideo.duration - 0.05);

      // -----------------------
      // Phase B: Slash scrub
      // -----------------------
      if (p <= B_END) {
        const sp = clamp01((p - A_END) / (B_END - A_END));

        slashVideo.style.opacity = "1";
        layerStack.style.opacity = "0";
        slashStaticGlobal.style.opacity = "0";

        slashTargetTime = slashVideo.duration * sp;

        // Reset layers while slash plays (so backscroll is clean)
        splitLayers.forEach((layer) => {
          const left = layer.querySelector(".half.left");
          const right = layer.querySelector(".half.right");
          if (!left || !right) return;
          gsap.set(left, { xPercent: 0 });
          gsap.set(right, { xPercent: 0 });
        });

        return;
      }

      // After Phase B:
      // - lock slash video at end
      // - hide slash video
      // - show global static slash overlay forever
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";
      slashStaticGlobal.style.opacity = "1";

      // -----------------------
      // Phase C: Split chain (Page 1 -> Page 5)
      // -----------------------
      layerStack.style.opacity = "1";

      const cp = clamp01((p - B_END) / (1 - B_END)); // 0..1 over split chain
      const perLayer = 1 / splitLayers.length;

      splitLayers.forEach((layer, idx) => {
        const start = idx * perLayer;
        const local = clamp01((cp - start) / perLayer); // 0..1 for this layer

        const left = layer.querySelector(".half.left");
        const right = layer.querySelector(".half.right");
        if (!left || !right) return;

        gsap.set(left,  { xPercent: -SPLIT_DISTANCE * local });
        gsap.set(right, { xPercent:  SPLIT_DISTANCE * local });
      });
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
