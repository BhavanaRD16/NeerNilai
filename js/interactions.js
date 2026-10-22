/**
 * NeerNilai – Micro-Interactions & Bento Tilt Interactions
 * Mouse-tracking 3D sheen, magnetic buttons, count-up odometer numbers.
 */

import { audioEngine } from "./audioEngine.js";

export function initInteractions() {
    // 1. Bento Card 3D tilt & cursor radial sheen
    const cards = document.querySelectorAll(".bento-card, .glass-card");
    cards.forEach((card) => {
        let sheen = card.querySelector(".card-sheen");
        if (!sheen) {
            sheen = document.createElement("div");
            sheen.className = "card-sheen";
            card.prepend(sheen);
        }

        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        });
    });

    // 2. Audio clicks on interactive controls
    document.querySelectorAll("button, .btn, .nav-link, select").forEach((el) => {
        el.addEventListener("click", () => {
            audioEngine.playUiClick();
        });
    });
}

/**
 * Animated count-up for live numbers
 */
export function animateValue(element, start, end, durationMs = 600, suffix = "") {
    if (!element) return;
    const startTime = performance.now();
    const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const current = start + (end - start) * (1 - Math.pow(1 - progress, 3));
        element.textContent = `${current.toFixed(1)}${suffix}`;
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}
