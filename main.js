gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");
const layerStack = document.getElementById("layerStack");
const slashStaticGlobal = document.getElementById("slashStaticGlobal");

// Layers 1..5 only (final is revealed underneath)
const splitLayers = Array.from(document.querySelectorAll(".layer[data-layer]"))
  .filter(el => el.getAttribute("data-layer") !== "final")
  .sort((a, b) => Number(a.getAttribute("data-layer")) - Number(b.getAttribute("data-layer"))); // 1..5

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

function resetAll() {
  gsap.set(slashVideo, { opacity: 0 });
  gsap.set(layerStack, { opacity: 0 });
  gsap.set(slashStaticGlobal, { opacity: 0 });

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

  const SCROLL_LEN = 9000;

  // A: Earth scrub, B: Slash scrub, C: Split chain (1..5)
  const PHASE_A = 0.68;
  const PHASE_B = 0.10;
  // PHASE_C is the remainder

  const A_END = PHASE_A;
  const B_END = PHASE_A + PHASE_B;

  const SPLIT_DISTANCE = 120;

  resetAll();

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
      const p = self.progress;

      if (!earthVideo.duration || !slashVideo.duration) return;

      // Phase A
      if (p <= A_END) {
        const vp = clamp01(p / A_END);
        earthTargetTime = earthVideo.duration * vp;

        slashVideo.style.opacity = "0";
        layerStack.style.opacity = "0";
        slashStaticGlobal.style.opacity = "0";

        splitLayers.forEach((layer) => {
          const left = layer.querySelector(".half.left");
          const right = layer.querySelector(".half.right");
          if (!left || !right) return;
          gsap.set(left, { xPercent: 0 });
          gsap.set(right, { xPercent: 0 });
        });

        return;
      }

      // Freeze earth
      earthTargetTime = Math.max(0, earthVideo.duration - 0.05);

      // Phase B
      if (p <= B_END) {
        const sp = clamp01((p - A_END) / (B_END - A_END));

        slashVideo.style.opacity = "1";
        layerStack.style.opacity = "0";
        slashStaticGlobal.style.opacity = "0";

        slashTargetTime = slashVideo.duration * sp;

        splitLayers.forEach((layer) => {
          const left = layer.querySelector(".half.left");
          const right = layer.querySelector(".half.right");
          if (!left || !right) return;
          gsap.set(left, { xPercent: 0 });
          gsap.set(right, { xPercent: 0 });
        });

        return;
      }

      // After Phase B: show global slash overlay (for now)
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";

      // Phase C: Split chain
      layerStack.style.opacity = "1";

      const cp = clamp01((p - B_END) / (1 - B_END)); // 0..1 across split chain
      const perLayer = 1 / splitLayers.length;

      splitLayers.forEach((layer, idx) => {
        const start = idx * perLayer;
        const local = clamp01((cp - start) / perLayer);

        const left = layer.querySelector(".half.left");
        const right = layer.querySelector(".half.right");
        if (!left || !right) return;

        gsap.set(left,  { xPercent: -SPLIT_DISTANCE * local });
        gsap.set(right, { xPercent:  SPLIT_DISTANCE * local });
      });

      // Hide slash overlay when CTA is revealed:
      // CTA is fully revealed when the LAST split layer is ~fully open.
      const ctaRevealThreshold = 0.98; // tweak if you want it to disappear earlier/later
      const isCtaRevealed = cp >= ctaRevealThreshold;

      slashStaticGlobal.style.opacity = isCtaRevealed ? "0" : "1";
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
