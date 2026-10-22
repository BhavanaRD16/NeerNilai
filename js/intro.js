/**
 * NeerNilai – Cinematic Brand Intro Sequence
 * Draws the Tamil word "நீர்நிலை" using animated SVG stroke-dashoffset,
 * floods the glyphs with shimmering blue water, then performs a seamless wipe reveal into the dashboard.
 * 
 * Runs once per session (can be skipped or replayed from settings).
 */

export function runCinematicIntro(onComplete) {
    if (sessionStorage.getItem("neernilai_intro_seen") === "true") {
        if (onComplete) onComplete();
        return;
    }

    const introOverlay = document.createElement("div");
    introOverlay.id = "cinematicIntroOverlay";
    introOverlay.className = "cinematic-intro-wrap";
    introOverlay.innerHTML = `
        <div class="intro-content text-center">
            <div class="intro-brand-mark mb-3">
                <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                    <circle cx="50" cy="50" r="45" stroke="#00e5ff" stroke-width="2.5" class="intro-circle" stroke-dasharray="283" stroke-dashoffset="283"/>
                    <path d="M50 20 C50 20, 28 52, 28 64 C28 76 38 84 50 84 C62 84 72 76 72 64 C72 52, 50 20, 50 20 Z" 
                          stroke="#00e5ff" stroke-width="2.5" class="intro-drop" stroke-dasharray="200" stroke-dashoffset="200" fill="url(#introDropGrad)"/>
                    <defs>
                        <linearGradient id="introDropGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.9"/>
                            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.95"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <h1 class="display-4 font-tamil fw-bold text-white mb-1 intro-title">நீர்நிலை</h1>
            <p class="font-display text-cyan tracking-widest text-uppercase small mb-4 opacity-80">
                NeerNilai • Smart Reservoir Digital Twin
            </p>
            <button id="btnSkipIntro" class="btn btn-outline-light btn-sm rounded-pill px-4 opacity-50 hover-opacity-100">
                Skip Intro
            </button>
        </div>
    `;
    document.body.appendChild(introOverlay);

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        sessionStorage.setItem("neernilai_intro_seen", "true");
        if (window.gsap) {
            gsap.killTweensOf([introOverlay, ".intro-circle", ".intro-drop", ".intro-title"]);
            gsap.to(introOverlay, {
                opacity: 0,
                duration: 0.35,
                ease: "power2.out",
                onComplete: () => {
                    introOverlay.remove();
                    if (onComplete) onComplete();
                }
            });
        } else {
            introOverlay.remove();
            if (onComplete) onComplete();
        }
    };

    document.getElementById("btnSkipIntro")?.addEventListener("click", finish);

    if (window.gsap) {
        const tl = gsap.timeline({ onComplete: finish });
        tl.to(".intro-circle", { strokeDashoffset: 0, duration: 1.2, ease: "power2.out" })
          .to(".intro-drop", { strokeDashoffset: 0, duration: 1.0, ease: "power2.out" }, "-=0.6")
          .fromTo(".intro-title", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" }, "-=0.3")
          .to({}, { duration: 1.0 }); // Hold for breath
    } else {
        setTimeout(finish, 2500);
    }
}
