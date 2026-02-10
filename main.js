gsap.registerPlugin(ScrollTrigger);

const earthVideo = document.getElementById("earthVideo");
const slashVideo = document.getElementById("slashVideo");
const layerStack = document.getElementById("layerStack");
const slashStaticGlobal = document.getElementById("slashStaticGlobal");

// Split layers: page0..page5 (final is revealed underneath)
const splitLayers = Array.from(document.querySelectorAll(".layer[data-layer]"))
  .filter(el => el.getAttribute("data-layer") !== "final")
  .sort((a, b) => Number(a.getAttribute("data-layer")) - Number(b.getAttribute("data-layer"))); // 0..5

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

// Smoothstep for nicer fades
function smoothstep(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
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

  const SCROLL_LEN = 9800; // slightly longer since we added page0 + a hold

  // Phases
  const PHASE_A = 0.64; // earth scrub
  const PHASE_B = 0.10; // slash scrub
  const PHASE_H = 0.04; // HOLD on slash end ("a beat")
  // remainder is split chain

  const A_END = PHASE_A;
  const B_END = PHASE_A + PHASE_B;
  const H_END = PHASE_A + PHASE_B + PHASE_H;

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
      const p = self.progress;

      if (!earthVideo.duration || !slashVideo.duration) return;

      // -----------------------
      // Phase A: Earth scrub
      // -----------------------
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

        // Reset layers while slash plays (backscroll stays clean)
        splitLayers.forEach((layer) => {
          const left = layer.querySelector(".half.left");
          const right = layer.querySelector(".half.right");
          if (!left || !right) return;
          gsap.set(left, { xPercent: 0 });
          gsap.set(right, { xPercent: 0 });
        });

        return;
      }

      // From here on: slash video is locked to the end frame
      slashTargetTime = Math.max(0, slashVideo.duration - 0.05);
      slashVideo.style.opacity = "0";

      // -----------------------
      // Phase H: HOLD ("beat") on end of slash before splits begin
      // -----------------------
      if (p <= H_END) {
        layerStack.style.opacity = "0";
        slashStaticGlobal.style.opacity = "1"; // show the slash for the beat
        return;
      }

      // -----------------------
      // Phase C: Split chain (Page 0 -> Page 5 -> CTA)
      // -----------------------
      layerStack.style.opacity = "1";

      const cp = clamp01((p - H_END) / (1 - H_END)); // 0..1 over split chain
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

      // Fade the slash overlay out as CTA is revealed (near the end of the split chain)
      // Start fading when the last layer is mostly open.
      const fadeStart = 0.90;
      const fadeEnd = 1.00;
      const t = (cp - fadeStart) / (fadeEnd - fadeStart);
      const fade = 1 - smoothstep(t); // 1 -> 0

      slashStaticGlobal.style.opacity = String(clamp01(fade));
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
