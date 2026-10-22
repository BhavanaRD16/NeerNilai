/**
 * NeerNilai – Digital Twin Interactive SVG Component
 * Truthful, animated digital twin of the hardware prototype rig:
 * - Acrylic reservoir tank with dynamic animated water surface (sine waves, caustics, bubbles)
 * - Calibrated depth tick marks & warning/critical coloured zones
 * - Overhead ultrasonic level sensor (HC-SR04) with animated sonar pulse ping waves
 * - DC diaphragm inflow pump with spinning mechanical impeller & pulse flow sensor turbine
 * - Inflow pipe with dynamic velocity particles
 * - Stepper motor + gear train with meshed rotating cogs
 * - Spillway channel & vertically translating sluice gate driven by gear rack
 * - Turbulent water cascade & foaming spray at spillway foot
 * - 12V Solenoid irrigation discharge valve with illuminated solenoid status LED
 * - Real-time state derived directly from Firebase telemetry
 * - Full prefers-reduced-motion support
 */

import { toNumber, clamp, round } from "./utils.js";

export class DigitalTwin {
    /**
     * @param {HTMLElement|string} container - Container element or selector
     */
    constructor(container) {
        this.container = typeof container === "string" ? document.querySelector(container) : container;
        this.svg = null;
        this.animFrameId = null;
        this.phase = 0;
        this.particleOffset = 0;
        this.gearAngle = 0;
        this.pumpImpellerAngle = 0;
        this.flowTurbineAngle = 0;

        // Current hardware state (interpolated)
        this.state = {
            waterLevelCm: 7.5,
            maxHeightCm: 15.0,
            waterPercent: 50.0,
            inflowLpm: 1.2,
            outflowLpm: 0.8,
            gatePos: 0.25,        // 0.0 to 1.0
            gateTargetPos: 0.25,
            pumpOn: false,
            solenoidOpen: false,
            deviceOnline: true
        };

        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.innerHTML = this.renderSvgMarkup();
        this.cacheElements();
        this.bindRippleInteractions();
        this.startAnimationLoop();
    }

    bindRippleInteractions() {
        this.ripples = [];
        const svg = this.container.querySelector("svg");
        if (!svg) return;

        svg.addEventListener("click", (e) => {
            const rect = svg.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * 680;
            const clickY = ((e.clientY - rect.top) / rect.height) * 420;

            // If click inside reservoir tank bounds (220 to 420 x, 140 to 340 y)
            if (clickX >= 220 && clickX <= 420 && clickY >= 140 && clickY <= 340) {
                this.addRipple(clickX, clickY);
            }
        });
    }

    addRipple(x, y) {
        if (!this.elRippleGroup) return;
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("rx", "2");
        circle.setAttribute("ry", "1");
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "#e0f2fe");
        circle.setAttribute("stroke-width", "1.5");
        circle.setAttribute("opacity", "0.9");
        this.elRippleGroup.appendChild(circle);

        let r = 2;
        let opacity = 0.9;
        const expand = () => {
            r += 1.8;
            opacity -= 0.035;
            circle.setAttribute("rx", r);
            circle.setAttribute("ry", r * 0.4);
            circle.setAttribute("opacity", Math.max(0, opacity));
            if (opacity > 0) {
                requestAnimationFrame(expand);
            } else {
                circle.remove();
            }
        };
        requestAnimationFrame(expand);
    }

    cacheElements() {
        this.elWaterBody = this.container.querySelector("#dtWaterBody");
        this.elWaterSurface = this.container.querySelector("#dtWaterSurface");
        this.elRippleGroup = this.container.querySelector("#dtInteractiveRippleGroup");
        this.elSonarRings = this.container.querySelectorAll(".dt-sonar-ring");
        this.elPumpImpeller = this.container.querySelector("#dtPumpImpeller");
        this.elInletTurbine = this.container.querySelector("#dtInletTurbine");
        this.elOutletTurbine = this.container.querySelector("#dtOutletTurbine");
        this.elGearDrive = this.container.querySelector("#dtGearDrive");
        this.elGearPinion = this.container.querySelector("#dtGearPinion");
        this.elSluiceGate = this.container.querySelector("#dtSluiceGate");
        this.elGateRack = this.container.querySelector("#dtGateRack");
        this.elSpillwayCascade = this.container.querySelector("#dtSpillwayCascade");
        this.elSolenoidLed = this.container.querySelector("#dtSolenoidLed");
        this.elInflowParticles = this.container.querySelectorAll(".dt-inflow-particle");
        this.elWaterLevelLabel = this.container.querySelector("#dtWaterLevelLabel");
        this.elInflowLabel = this.container.querySelector("#dtInflowLabel");
        this.elOutflowLabel = this.container.querySelector("#dtOutflowLabel");
        this.elGateLabel = this.container.querySelector("#dtGateLabel");
    }

    /**
     * Update digital twin state from latest telemetry and settings
     */
    update(telemetry, settings, deviceOnline = true) {
        if (!telemetry) return;
        const maxHeight = toNumber(settings?.maxTankHeight, 15);
        const level = clamp(toNumber(telemetry.waterLevel, this.state.waterLevelCm), 0, maxHeight);
        const pct = maxHeight > 0 ? (level / maxHeight) * 100 : 0;

        this.state.waterLevelCm = level;
        this.state.maxHeightCm = maxHeight;
        this.state.waterPercent = pct;
        this.state.inflowLpm = toNumber(telemetry.inflowRate, 0);
        this.state.outflowLpm = toNumber(telemetry.outflowRate, 0);
        this.state.gateTargetPos = clamp(toNumber(telemetry.gatePosition, 0), 0, 1);
        this.state.pumpOn = String(telemetry.pumpStatus || "").toUpperCase() === "ON";
        this.state.solenoidOpen = String(telemetry.solenoidStatus || "").toUpperCase() === "OPEN";
        this.state.deviceOnline = deviceOnline;

        // Update labels
        if (this.elWaterLevelLabel) {
            this.elWaterLevelLabel.textContent = `${level.toFixed(1)} cm (${pct.toFixed(0)}%)`;
        }
        if (this.elInflowLabel) {
            this.elInflowLabel.textContent = `${this.state.inflowLpm.toFixed(1)} L/m`;
        }
        if (this.elOutflowLabel) {
            this.elOutflowLabel.textContent = `${this.state.outflowLpm.toFixed(1)} L/m`;
        }
        if (this.elGateLabel) {
            this.elGateLabel.textContent = `${(this.state.gateTargetPos * 100).toFixed(0)}% OPEN`;
        }
    }

    startAnimationLoop() {
        const checkReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const loop = () => {
            this.phase += checkReducedMotion ? 0.01 : 0.06;
            
            // Lerp gate position towards target smoothly
            this.state.gatePos += (this.state.gateTargetPos - this.state.gatePos) * 0.1;

            this.renderFrame(checkReducedMotion);
            this.animFrameId = requestAnimationFrame(loop);
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    stop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    renderFrame(reducedMotion = false) {
        // Tank coordinate bounds: tank y goes from 140 (top, 100%) to 340 (bottom, 0%)
        const tankBottomY = 340;
        const tankHeightPx = 200;
        const tankLeftX = 220;
        const tankRightX = 420;
        const tankWidthPx = 200;

        const fraction = clamp(this.state.waterPercent / 100, 0, 1);
        const surfaceY = tankBottomY - (fraction * tankHeightPx);

        // Sine wave for water surface
        const waveAmp = reducedMotion ? 0.5 : (this.state.inflowLpm > 3 ? 3.5 : 1.8);
        const p1 = `M ${tankLeftX} ${surfaceY}`;
        const waveMid1X = tankLeftX + tankWidthPx * 0.25;
        const waveMid1Y = surfaceY + Math.sin(this.phase) * waveAmp;
        const waveMid2X = tankLeftX + tankWidthPx * 0.75;
        const waveMid2Y = surfaceY - Math.sin(this.phase + 1.5) * waveAmp;
        const surfaceCurve = `Q ${waveMid1X} ${waveMid1Y}, ${tankLeftX + tankWidthPx / 2} ${surfaceY} T ${tankRightX} ${surfaceY}`;

        if (this.elWaterBody) {
            this.elWaterBody.setAttribute(
                "d",
                `${p1} ${surfaceCurve} L ${tankRightX} ${tankBottomY} L ${tankLeftX} ${tankBottomY} Z`
            );
        }
        if (this.elWaterSurface) {
            this.elWaterSurface.setAttribute("d", `${p1} ${surfaceCurve}`);
        }

        // Sonar pulses from ultrasonic sensor (sensor at x=320, y=100)
        if (this.elSonarRings && this.elSonarRings.length) {
            this.elSonarRings.forEach((ring, idx) => {
                const ringProgress = ((this.phase * 0.35 + idx * 0.33) % 1.0);
                const ringY = 112 + ringProgress * (surfaceY - 112);
                ring.setAttribute("cy", ringY);
                ring.setAttribute("rx", 6 + ringProgress * 28);
                ring.setAttribute("ry", 2 + ringProgress * 6);
                ring.setAttribute("opacity", (1 - ringProgress) * (this.state.deviceOnline ? 0.75 : 0.15));
            });
        }

        // Mechanical pump impeller rotation
        if (this.state.pumpOn && !reducedMotion) {
            this.pumpImpellerAngle = (this.pumpImpellerAngle + 12) % 360;
        }
        if (this.elPumpImpeller) {
            this.elPumpImpeller.setAttribute("transform", `rotate(${this.pumpImpellerAngle} 100 240)`);
        }

        // Flow sensor turbines
        if (this.state.inflowLpm > 0.1 && !reducedMotion) {
            this.flowTurbineAngle = (this.flowTurbineAngle + this.state.inflowLpm * 2.5) % 360;
        }
        if (this.elInletTurbine) {
            this.elInletTurbine.setAttribute("transform", `rotate(${this.flowTurbineAngle} 160 200)`);
        }
        if (this.elOutletTurbine) {
            const outletAngle = (this.flowTurbineAngle * (this.state.outflowLpm / Math.max(0.1, this.state.inflowLpm))) % 360;
            this.elOutletTurbine.setAttribute("transform", `rotate(${outletAngle} 550 340)`);
        }

        // Inflow pipe water particles
        if (this.elInflowParticles && this.state.pumpOn) {
            this.particleOffset = (this.particleOffset + this.state.inflowLpm * 0.8) % 40;
            this.elInflowParticles.forEach((p, idx) => {
                const baseDist = (idx * 25 + this.particleOffset) % 180;
                // Pipe travels from pump (100,240) -> up to (100,200) -> right to (230,200)
                let px, py;
                if (baseDist < 40) {
                    px = 100;
                    py = 240 - baseDist;
                } else {
                    px = 100 + (baseDist - 40);
                    py = 200;
                }
                p.setAttribute("cx", px);
                p.setAttribute("cy", py);
                p.setAttribute("opacity", "0.85");
            });
        } else if (this.elInflowParticles) {
            this.elInflowParticles.forEach((p) => p.setAttribute("opacity", "0.1"));
        }

        // Stepper gear train + Sluice Gate physical lifting
        // Gate travels from y=300 (closed) up to y=250 (100% open, -50px travel)
        const gateTravelPx = 50;
        const gateYOffset = -this.state.gatePos * gateTravelPx;
        this.gearAngle = (this.state.gatePos * 360 * 2.5) % 360;

        if (this.elSluiceGate) {
            this.elSluiceGate.setAttribute("transform", `translate(0, ${gateYOffset})`);
        }
        if (this.elGateRack) {
            this.elGateRack.setAttribute("transform", `translate(0, ${gateYOffset})`);
        }
        if (this.elGearPinion) {
            this.elGearPinion.setAttribute("transform", `rotate(${this.gearAngle} 450 250)`);
        }
        if (this.elGearDrive) {
            this.elGearDrive.setAttribute("transform", `rotate(${-this.gearAngle * 0.5} 450 220)`);
        }

        // Spillway discharge cascade animation
        if (this.elSpillwayCascade) {
            if (this.state.gatePos > 0.05) {
                const cascadeAlpha = clamp(this.state.gatePos * 1.2, 0.2, 0.95);
                const cascadeHeight = 40 + this.state.gatePos * 35;
                this.elSpillwayCascade.setAttribute("opacity", cascadeAlpha);
                this.elSpillwayCascade.setAttribute("height", cascadeHeight);
            } else {
                this.elSpillwayCascade.setAttribute("opacity", "0");
            }
        }

        // Solenoid status LED
        if (this.elSolenoidLed) {
            this.elSolenoidLed.setAttribute("fill", this.state.solenoidOpen ? "#10b981" : "#ef4444");
            this.elSolenoidLed.setAttribute("filter", this.state.solenoidOpen ? "url(#dtGlowGreen)" : "none");
        }
    }

    renderSvgMarkup() {
        return `
        <div class="digital-twin-wrapper position-relative">
            <svg class="digital-twin-svg w-100" viewBox="0 0 680 420" preserveAspectRatio="xMidYMid meet" aria-label="NeerNilai Hardware Prototype Digital Twin">
                <defs>
                    <!-- Dynamic theme-aware fluid gradient driven by CSS custom properties -->
                    <linearGradient id="dtWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="var(--water-cyan-top, #00d2ff)"/>
                        <stop offset="60%" stop-color="var(--water-cyan-mid, #0083b0)"/>
                        <stop offset="100%" stop-color="var(--water-cyan-deep, #004369)"/>
                    </linearGradient>

                    <linearGradient id="dtTankGlassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
                        <stop offset="15%" stop-color="#ffffff" stop-opacity="0.05"/>
                        <stop offset="85%" stop-color="#ffffff" stop-opacity="0.05"/>
                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.22"/>
                    </linearGradient>

                    <linearGradient id="dtPipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#64748b"/>
                        <stop offset="50%" stop-color="#94a3b8"/>
                        <stop offset="100%" stop-color="#475569"/>
                    </linearGradient>

                    <linearGradient id="dtSpillwayWater" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
                        <stop offset="50%" stop-color="#0284c7" stop-opacity="0.85"/>
                        <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.95"/>
                    </linearGradient>

                    <!-- Glow filter for solenoid & sensors -->
                    <filter id="dtGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="glow"/>
                        <feComposite in="SourceGraphic" in2="glow" operator="over"/>
                    </filter>
                    <filter id="dtGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="glow"/>
                        <feComposite in="SourceGraphic" in2="glow" operator="over"/>
                    </filter>
                </defs>

                <!-- Background Workbench Frame -->
                <rect x="20" y="20" width="640" height="380" rx="16" fill="rgba(10, 25, 47, 0.65)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

                <!-- Gridlines for test bench / CAD look -->
                <g stroke="rgba(255,255,255,0.03)" stroke-width="1">
                    <line x1="20" y1="120" x2="660" y2="120"/>
                    <line x1="20" y1="220" x2="660" y2="220"/>
                    <line x1="20" y1="320" x2="660" y2="320"/>
                    <line x1="160" y1="20" x2="160" y2="400"/>
                    <line x1="320" y1="20" x2="320" y2="400"/>
                    <line x1="480" y1="20" x2="480" y2="400"/>
                </g>

                <!-- ================= 1. INFLOW SUBSYSTEM (Left) ================= -->
                <!-- DC Diaphragm Pump Body -->
                <g id="dtPumpSubsystem">
                    <rect x="70" y="220" width="60" height="70" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
                    <circle cx="100" cy="255" r="22" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
                    <!-- Spinning impeller -->
                    <g id="dtPumpImpeller">
                        <line x1="86" y1="255" x2="114" y2="255" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="100" y1="241" x2="100" y2="269" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
                        <circle cx="100" cy="255" r="4" fill="#f8fafc"/>
                    </g>
                    <text x="100" y="305" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="sans-serif">12V DC Pump</text>

                    <!-- Inlet Pipe from pump into reservoir -->
                    <path d="M 100 220 L 100 190 Q 100 180 110 180 L 225 180" fill="none" stroke="url(#dtPipeGrad)" stroke-width="12" stroke-linecap="round"/>
                    <path d="M 100 220 L 100 190 Q 100 180 110 180 L 225 180" fill="none" stroke="#0284c7" stroke-width="4" stroke-linecap="round" opacity="0.6"/>

                    <!-- Inlet Flow Sensor (YF-S201 Hall turbine) -->
                    <rect x="145" y="170" width="30" height="20" rx="4" fill="#334155" stroke="#0ea5e9" stroke-width="1"/>
                    <g id="dtInletTurbine">
                        <circle cx="160" cy="180" r="6" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
                        <line x1="156" y1="180" x2="164" y2="180" stroke="#f1f5f9" stroke-width="1.5"/>
                    </g>
                    <text x="160" y="163" fill="#38bdf8" font-size="9" text-anchor="middle" font-weight="600">IN FLOW</text>

                    <!-- Inflow Animated Water Particles -->
                    <circle class="dt-inflow-particle" cx="100" cy="210" r="2.5" fill="#e0f2fe"/>
                    <circle class="dt-inflow-particle" cx="115" cy="180" r="2.5" fill="#e0f2fe"/>
                    <circle class="dt-inflow-particle" cx="150" cy="180" r="2.5" fill="#e0f2fe"/>
                    <circle class="dt-inflow-particle" cx="190" cy="180" r="2.5" fill="#e0f2fe"/>
                    <circle class="dt-inflow-particle" cx="220" cy="180" r="2.5" fill="#e0f2fe"/>
                </g>

                <!-- ================= 2. RESERVOIR TANK (Center) ================= -->
                <!-- Acrylic Tank Frame: x:220 to 420, y:140 to 340 (200x200 px) -->
                <g id="dtTankSubsystem">
                    <!-- Tank Back Wall -->
                    <rect x="220" y="140" width="200" height="200" fill="rgba(15, 23, 42, 0.45)" rx="4"/>

                    <!-- Colored Zone Indicators on Back Wall (Low, Normal, Warning, Critical) -->
                    <rect x="221" y="300" width="6" height="40" fill="#f59e0b" opacity="0.4" title="Low Water Zone"/>
                    <rect x="221" y="180" width="6" height="120" fill="#10b981" opacity="0.3" title="Normal Operational Zone"/>
                    <rect x="221" y="155" width="6" height="25" fill="#f59e0b" opacity="0.5" title="Warning Threshold (12cm)"/>
                    <rect x="221" y="140" width="6" height="15" fill="#ef4444" opacity="0.6" title="Critical Spillway Zone (13.5cm)"/>

                    <!-- Animated Water Body & Surface Curve -->
                    <path id="dtWaterBody" fill="url(#dtWaterGrad)"/>
                    <path id="dtWaterSurface" fill="none" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round"/>

                    <!-- Interactive Water Ripple & Caustic Canvas Hook -->
                    <g id="dtInteractiveRippleGroup" class="dt-ripples-layer"></g>

                    <!-- Acrylic Tank Front Face (Glass Reflection) -->
                    <rect x="220" y="140" width="200" height="200" fill="url(#dtTankGlassGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="2" rx="4"/>

                    <!-- Depth Scale Ticks (cm calibrated, 0 to 15cm) -->
                    <g font-size="9" fill="#94a3b8" font-family="monospace">
                        <line x1="220" y1="140" x2="230" y2="140" stroke="#ef4444" stroke-width="2"/><text x="233" y="143" fill="#ef4444">15cm (100%)</text>
                        <line x1="220" y1="160" x2="228" y2="160" stroke="#f59e0b" stroke-width="1.5"/><text x="233" y="163" fill="#f59e0b">13.5cm (Crit)</text>
                        <line x1="220" y1="180" x2="228" y2="180" stroke="#f59e0b" stroke-width="1.5"/><text x="233" y="183" fill="#f59e0b">12cm (Warn)</text>
                        <line x1="220" y1="240" x2="226" y2="240" stroke="#94a3b8" stroke-width="1"/><text x="231" y="243">7.5cm (50%)</text>
                        <line x1="220" y1="300" x2="228" y2="300" stroke="#f59e0b" stroke-width="1.5"/><text x="233" y="303">3cm (Low)</text>
                        <line x1="220" y1="340" x2="230" y2="340" stroke="#64748b" stroke-width="2"/><text x="233" y="338">0cm</text>
                    </g>

                    <text x="320" y="365" fill="#cbd5e1" font-size="12" font-weight="600" text-anchor="middle" font-family="sans-serif">Acrylic Reservoir Tank (50L)</text>
                </g>

                <!-- ================= 3. ULTRASONIC SENSOR HC-SR04 (Above) ================= -->
                <g id="dtUltrasonicSubsystem">
                    <!-- Sensor Mount Bracket -->
                    <rect x="290" y="65" width="60" height="8" rx="2" fill="#475569"/>
                    <!-- PCB Board -->
                    <rect x="295" y="73" width="50" height="22" rx="3" fill="#047857" stroke="#10b981" stroke-width="1"/>
                    <!-- Dual Acoustic Transducers -->
                    <circle cx="308" cy="84" r="7" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>
                    <circle cx="308" cy="84" r="3" fill="#475569"/>
                    <circle cx="332" cy="84" r="7" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>
                    <circle cx="332" cy="84" r="3" fill="#475569"/>
                    <text x="320" y="60" fill="#34d399" font-size="9" font-weight="bold" text-anchor="middle">HC-SR04 ULTRASONIC</text>

                    <!-- Animated Sonar Rings -->
                    <ellipse class="dt-sonar-ring" cx="320" cy="115" rx="8" ry="2" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
                    <ellipse class="dt-sonar-ring" cx="320" cy="140" rx="14" ry="4" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
                    <ellipse class="dt-sonar-ring" cx="320" cy="175" rx="22" ry="6" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
                </g>

                <!-- ================= 4. SLUICE GATE & STEPPER MOTOR (Right) ================= -->
                <g id="dtSpillwaySubsystem">
                    <!-- Stepper Motor & Bracket at Top Right -->
                    <rect x="425" y="160" width="50" height="50" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/>
                    <circle cx="450" cy="185" r="16" fill="#1e293b"/>
                    <text x="450" y="153" fill="#e2e8f0" font-size="9" font-weight="bold" text-anchor="middle">STEPPER MOTOR</text>

                    <!-- Gear Train Cogs -->
                    <!-- Drive Gear -->
                    <g id="dtGearDrive">
                        <circle cx="450" cy="220" r="18" fill="#475569" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 2"/>
                        <circle cx="450" cy="220" r="5" fill="#f8fafc"/>
                    </g>
                    <!-- Meshed Pinion Gear -->
                    <g id="dtGearPinion">
                        <circle cx="450" cy="250" r="12" fill="#334155" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 2"/>
                        <circle cx="450" cy="250" r="4" fill="#0284c7"/>
                    </g>

                    <!-- Gear Rack Attached to Sluice Gate -->
                    <g id="dtGateRack">
                        <line x1="432" y1="210" x2="432" y2="330" stroke="#94a3b8" stroke-width="4" stroke-dasharray="3 2"/>
                    </g>

                    <!-- Spillway Outlet Channel Profile -->
                    <path d="M 420 300 L 480 300 Q 500 300 510 320 L 530 350 L 630 350" fill="none" stroke="#475569" stroke-width="16" stroke-linecap="round"/>
                    
                    <!-- Dynamic Spillway Water Cascade (behind gate) -->
                    <rect id="dtSpillwayCascade" x="424" y="295" width="95" height="50" rx="4" fill="url(#dtSpillwayWater)" opacity="0"/>

                    <!-- Sluice Gate Blade (translates vertically) -->
                    <g id="dtSluiceGate">
                        <rect x="420" y="275" width="16" height="65" rx="2" fill="#e2e8f0" stroke="#0284c7" stroke-width="2"/>
                        <line x1="428" y1="280" x2="428" y2="335" stroke="#64748b" stroke-width="1.5"/>
                    </g>

                    <text x="450" y="365" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Sluice Gate</text>
                </g>

                <!-- ================= 5. SOLENOID VALVE & OUTLET (Bottom Right) ================= -->
                <g id="dtSolenoidSubsystem">
                    <!-- Discharge pipe from tank bottom to solenoid -->
                    <path d="M 420 340 L 540 340" fill="none" stroke="url(#dtPipeGrad)" stroke-width="10"/>

                    <!-- Solenoid Valve Body -->
                    <rect x="525" y="325" width="30" height="30" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
                    <rect x="532" y="312" width="16" height="13" rx="2" fill="#475569"/>
                    <!-- Solenoid Status LED -->
                    <circle id="dtSolenoidLed" cx="540" cy="304" r="4" fill="#ef4444"/>
                    <text x="540" y="295" fill="#94a3b8" font-size="9" text-anchor="middle">SOLENOID</text>

                    <!-- Outlet Flow Sensor (Turbine 2) -->
                    <circle cx="585" cy="340" r="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
                    <g id="dtOutletTurbine">
                        <circle cx="585" cy="340" r="4" fill="#38bdf8"/>
                        <line x1="577" y1="340" x2="593" y2="340" stroke="#ffffff" stroke-width="1.5"/>
                    </g>
                    <text x="585" y="365" fill="#38bdf8" font-size="9" font-weight="600" text-anchor="middle">OUT FLOW</text>
                </g>

                <!-- ================= 6. LIVE TELEMETRY OVERLAY HUD ================= -->
                <g class="dt-hud-overlay" transform="translate(30, 35)">
                    <rect x="0" y="0" width="180" height="75" rx="8" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
                    <text x="12" y="18" fill="#38bdf8" font-size="10" font-weight="bold" font-family="sans-serif">DIGITAL TWIN TELEMETRY</text>
                    <text x="12" y="34" fill="#94a3b8" font-size="9">Water Level: <tspan id="dtWaterLevelLabel" fill="#f8fafc" font-weight="600">7.5 cm (50%)</tspan></text>
                    <text x="12" y="48" fill="#94a3b8" font-size="9">Inflow Rate: <tspan id="dtInflowLabel" fill="#38bdf8" font-weight="600">1.2 L/m</tspan></text>
                    <text x="12" y="62" fill="#94a3b8" font-size="9">Gate Outflow: <tspan id="dtOutflowLabel" fill="#38bdf8" font-weight="600">0.8 L/m</tspan></text>
                </g>
            </svg>
        </div>
        `;
    }
}
