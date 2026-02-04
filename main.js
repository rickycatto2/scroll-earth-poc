gsap.registerPlugin(ScrollTrigger);

const video = document.getElementById("earthVideo");
const graphic = document.getElementById("endGraphic");

let duration = 0;

// iOS/Safari quirks: "prime" the video so currentTime changes work reliably.
async function primeVideo() {
  try {
    video.muted = true;
    await video.play();
    video.pause();
  } catch (e) {
    // Autoplay may be blocked until first user gesture; scroll usually counts,
    // but if not, the user can tap once and it’ll start behaving.
    console.warn("Video prime blocked (ok for POC):", e);
  }
}

function setupScroll() {
  duration = video.duration || 1;

  // Pin the scene & scrub video by scroll position.
 let targetTime = 0;

ScrollTrigger.create({
  trigger: "#scene",
  start: "top top",
  end: "+=3000",
  scrub: true,
  pin: true,
  anticipatePin: 1,
  onUpdate: self => {
    if (!video.duration) return;
    targetTime = video.duration * self.progress;
  }
});

// Smoothly ease the video time toward targetTime
gsap.ticker.add(() => {
  if (!video.duration) return;
  video.currentTime += (targetTime - video.currentTime) * 0.15;
});


  // Fade graphic in near end of the pinned scroll.
  gsap.to(graphic, {
    opacity: 1,
    y: 0,
    ease: "none",
    scrollTrigger: {
      trigger: "#scene",
      start: "top top+=2400",
      end: "top top+=3000",
      scrub: true
    }
  });

  // Horizontal reveal: pin, and slide track left.
  gsap.to("#track", {
    xPercent: -50,
    ease: "none",
    scrollTrigger: {
      trigger: "#horizontal",
      start: "top top",
      end: "+=2000",
      scrub: true,
      pin: true,
      anticipatePin: 1
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
