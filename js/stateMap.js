/**
 * NeerNilai – Tamil Nadu Dam Fleet Status Map
 * Interactive SVG map of Tamil Nadu with live pulsing status indicators for all 7 major reservoirs.
 * Supports clicking to switch active monitored dam.
 */

import { TN_DAMS, setSelectedDam, getSelectedDam } from "./auth.js";
import { damPath, SUB, db, ref, onValue } from "./firebase.js";

// Geographical positions projected on SVG canvas 450x550
export const DAM_COORDINATES = {
    mettur:       { x: 210, y: 190, district: "Salem" },
    bhavanisagar: { x: 155, y: 220, district: "Erode" },
    aliyar:       { x: 140, y: 295, district: "Coimbatore" },
    sathanur:     { x: 285, y: 155, district: "Tiruvannamalai" },
    vaigai:       { x: 195, y: 360, district: "Theni" },
    periyar:      { x: 170, y: 390, district: "Theni / Idukki" },
    pechiparai:   { x: 165, y: 495, district: "Kanyakumari" }
};

export class StateMap {
    constructor(container) {
        this.container = typeof container === "string" ? document.querySelector(container) : container;
        this.damStatuses = {};
        this.unsubscribers = [];
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
        this.subscribeDamLevels();
    }

    render() {
        const activeDam = getSelectedDam();
        this.container.innerHTML = `
        <div class="tn-map-card position-relative">
            <svg viewBox="0 0 450 560" class="tn-map-svg w-100" aria-label="Tamil Nadu Dam Network Map">
                <defs>
                    <filter id="mapMarkerGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                </defs>

                <!-- Stylized Tamil Nadu Boundary Silhouette -->
                <path d="M 230 40 L 320 60 L 360 120 L 330 160 L 370 200 L 320 260 L 340 310 L 290 350 L 290 410 L 210 470 L 170 530 L 150 500 L 160 440 L 130 360 L 120 280 L 140 210 L 180 140 L 190 70 Z"
                      fill="rgba(15, 23, 42, 0.75)" stroke="#38bdf8" stroke-width="1.8" stroke-linejoin="round" opacity="0.85"/>

                <!-- Gridlines -->
                <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
                    <line x1="50" y1="150" x2="400" y2="150"/>
                    <line x1="50" y1="300" x2="400" y2="300"/>
                    <line x1="50" y1="450" x2="400" y2="450"/>
                </g>

                <!-- Map Title -->
                <text x="30" y="45" fill="#38bdf8" font-size="12" font-weight="bold" font-family="sans-serif">TAMIL NADU WATER GRID</text>
                <text x="30" y="60" fill="#94a3b8" font-size="9">7 Key Monitored Reservoirs</text>

                <!-- Dam Markers -->
                ${TN_DAMS.map((dam) => {
                    const coords = DAM_COORDINATES[dam.id] || { x: 200, y: 250 };
                    const isSelected = dam.id === activeDam.id;
                    return `
                    <g class="dam-map-pin" data-dam-id="${dam.id}" style="cursor:pointer" transform="translate(${coords.x}, ${coords.y})">
                        <!-- Pulsing outer wave -->
                        <circle class="dam-pin-pulse" r="14" fill="${isSelected ? '#38bdf8' : '#10b981'}" opacity="0.25"/>
                        <!-- Marker body -->
                        <circle r="7" fill="${isSelected ? '#0284c7' : '#0f766e'}" stroke="#ffffff" stroke-width="2" filter="url(#mapMarkerGlow)"/>
                        <circle r="3" fill="#ffffff"/>
                        <!-- Label -->
                        <text x="12" y="4" fill="${isSelected ? '#38bdf8' : '#e2e8f0'}" font-size="10" font-weight="${isSelected ? 'bold' : 'normal'}" font-family="sans-serif">
                            ${dam.name.split(" ")[0]}
                        </text>
                    </g>
                    `;
                }).join("")}
            </svg>
        </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelectorAll(".dam-map-pin").forEach((pin) => {
            pin.addEventListener("click", () => {
                const damId = pin.dataset.damId;
                if (damId) {
                    setSelectedDam(damId);
                    this.render();
                }
            });
        });
    }

    subscribeDamLevels() {
        TN_DAMS.forEach((dam) => {
            const devRef = ref(db, damPath(dam.id, SUB.device));
            const unsub = onValue(devRef, (snap) => {
                const dev = snap.val();
                this.damStatuses[dam.id] = dev?.online ? "ONLINE" : "OFFLINE";
            });
            this.unsubscribers.push(unsub);
        });
    }

    destroy() {
        this.unsubscribers.forEach((u) => { try { u(); } catch (e) {} });
    }
}
