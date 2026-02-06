gsap.registerPlugin(ScrollTrigger);

const SLASH_DEG = 47;

// -----------------------
// Video scrub (scene 0)
// -----------------------
const video = document.getElementById("earthVideo");
const endSlash = document.getElementById("endSlash");
const endSlashPath = document.getElementById("endSlashPath");

let duration = 0;
let targetTime = 0;

async function primeVideo() {
  try {
    video.muted = true;
    await video.play();
    video.pause();
  } catch (e) {
    console.warn("Video prime blocked (ok for POC):", e);
  }
}

function setupVideoScene() {
  duration = video.duration || 1;

  ScrollTrigger.create({
    trigger: "#scene",
    start: "top top",
    end: "+=3000",
    scrub: true,
    pin: true,
    anticipatePin: 1,
    onUpdate: (self) => {
      if (!video.duration) return;
      targetTime = video.duration * self.progress;
    }
  });

  // Smoothly ease video time to reduce stepping
  gsap.ticker.add(() => {
    if (!video.duration) return;
    video.currentTime += (targetTime - video.currentTime) * 0.15;
  });

  // End slash draw-on near the end of the scroll
  const len = endSlashPath.getTotalLength();
  endSlashPath.style.strokeDasharray = `${len}`;
  endSlashPath.style.strokeDashoffset = `${len}`;

  gsap.to(endSlash, {
    opacity: 1,
    scale: 1,
    ease: "none",
    scrollTrigger: {
      trigger: "#scene",
      start: "top top+=2600",
      end: "top top+=3000",
      scrub: true
    }
  });

  gsap.to(endSlashPath, {
    strokeDashoffset: 0,
    ease: "none",
    scrollTrigger: {
      trigger: "#scene",
      start: "top top+=2600",
      end: "top top+=3000",
      scrub: true
    }
  });
}

video.addEventListener("loadedmetadata", async () => {
  await primeVideo();
  setupVideoScene();
});

// If metadata is already ready:
if (video.readyState >= 1) {
  (async () => {
    await primeVideo();
    setupVideoScene();
  })();
}

// -----------------------
// Split wipe scenes (47°)
// -----------------------

function setDiagonalClipPathsOnViewport(viewportEl, deg = 47) {
  const rect = viewportEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  // Line passes through center of the viewport
  const cx = w / 2;
  const cy = h / 2;

  const theta = (deg * Math.PI) / 180;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);

  const points = [];
  const addIfInside = (x, y) => {
    const eps = 1e-6;
    if (x >= -eps && x <= w + eps && y >= -eps && y <= h + eps) points.push({ x, y });
  };

  if (Math.abs(dx) > 1e-6) {
    let t = (0 - cx) / dx;
    addIfInside(0, cy + t * dy);
    t = (w - cx) / dx;
    addIfInside(w, cy + t * dy);
  }

  if (Math.abs(dy) > 1e-6) {
    let t = (0 - cy) / dy;
    addIfInside(cx + t * dx, 0);
    t = (h - cy) / dy;
    addIfInside(cx + t * dx, h);
  }

  const uniq = [];
  for (const p of points) {
    if (!uniq.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 0.5)) uniq.push(p);
  }
  if (uniq.length < 2) return;

  const p1 = uniq[0], p2 = uniq[1];

  // choose which side is A by testing a point offset along the normal
  const nx = -dy, ny = dx;
  const test = { x: cx + nx * 10, y: cy + ny * 10 };
  const refSide = (p2.x - p1.x) * (test.y - p1.y) - (p2.y - p1.y) * (test.x - p1.x);

  const corners = [
    { x: 0, y: 0 },   // TL
    { x: w, y: 0 },   // TR
    { x: w, y: h },   // BR
    { x: 0, y: h }    // BL
  ];

  const isOnASide = (pt) => {
    const s = (p2.x - p1.x) * (pt.y - p1.y) - (p2.y - p1.y) * (pt.x - p1.x);
    return refSide >= 0 ? s >= 0 : s <= 0;
  };

  const polyA = [];
  const polyB = [];

  for (const c of corners) (isOnASide(c) ? polyA : polyB).push(c);
  polyA.push(p1, p2);
  polyB.push(p1, p2);

  const toPct = (p) => `${(p.x / w) * 100}% ${(p.y / h) * 100}%`;
  const clipA = `polygon(${polyA.map(toPct).join(",")})`;
  const clipB = `polygon(${polyB.map(toPct).join(",")})`;

  const halfA = viewportEl.querySelector(".halfA");
  const halfB = viewportEl.querySelector(".halfB");
  if (halfA) halfA.style.clipPath = clipA;
  if (halfB) halfB.style.clipPath = clipB;
}

function setupWipeScene(sectionEl) {
  const viewport = sectionEl.querySelector(".wipeViewport");
  const current = viewport.querySelector(".card.current");
  const halfA = viewport.querySelector(".halfA");
  const halfB = viewport.querySelector(".halfB");

  // Clone the current card into both halves (so we don’t duplicate markup manually)
  const cloneA = current.cloneNode(true);
  const cloneB = current.cloneNode(true);
  cloneA.classList.add("clone");
  cloneB.classList.add("clone");

  halfA.appendChild(cloneA);
  halfB.appendChild(cloneB);

  // Hide the original current card (next remains underneath)
  current.style.visibility = "hidden";

  // Set clip paths (responsive)
  setDiagonalClipPathsOnViewport(viewport, SLASH_DEG);

  // Animate halves away
  const id = `#${sectionEl.id}`;

  gsap.to(`${id} .halfA`, {
    xPercent: -115,
    ease: "none",
    scrollTrigger: {
      trigger: id,
      start: "top top",
      end: "+=1200",
      scrub: true,
      pin: true,
      anticipatePin: 1
    }
  });

  gsap.to(`${id} .halfB`, {
    xPercent: 115,
    ease: "none",
    scrollTrigger: {
      trigger: id,
      start: "top top",
      end: "+=1200",
      scrub: true,
      pin: true,
      anticipatePin: 1
    }
  });
}

// Initialize all wipe scenes
const wipes = Array.from(document.querySelectorAll(".wipe"));
wipes.forEach(setupWipeScene);

// Update clip paths on resize
window.addEventListener("resize", () => {
  wipes.forEach(w => {
    const viewport = w.querySelector(".wipeViewport");
    setDiagonalClipPathsOnViewport(viewport, SLASH_DEG);
  });
  ScrollTrigger.refresh();
});
