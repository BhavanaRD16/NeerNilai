/**
 * NeerNilai – Red Danger Takeover Scene ("Water Full" Incident)
 * Orchestrates an unmissable cinematic lockdown timeline using GSAP:
 * - Stage 0 (Warning): Vignette creep, UI desaturates, low tension heartbeat drone
 * - Stage 1 (Breach): 150ms screen chromatic flash, camera shake, red theme crossfade
 * - Stage 2 (Lockdown): Fullscreen cinematic overlay with glitch text, auto-safety sequence lifecycle tracker,
 *   rotating siren beacon, supervisor slide-to-acknowledge ring, and citizen evacuation advisory
 * - Stage 3 (Recovery): Smooth liquid clip-path drain wipe returning to calm ocean palette
 */

import { themeEngine } from "./themeEngine.js";
import { audioEngine } from "./audioEngine.js";

class DangerSceneDirector {
    constructor() {
        this.activeStage = "NOMINAL"; // "NOMINAL" | "WARNING" | "BREACH" | "LOCKDOWN" | "RECOVERY"
        this.overlayEl = null;
        this.shakeTween = null;
        this.sirenRotationTween = null;
        this.minBreachTimestamp = 0;
        this.isAcknowledged = false;
        this.initOverlay();
    }

    initOverlay() {
        if (document.getElementById("dangerTakeoverOverlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "dangerTakeoverOverlay";
        overlay.className = "danger-lockdown-overlay";
        overlay.innerHTML = `
            <!-- Top & Bottom Animated Hazard Stripes -->
            <div class="hazard-stripe-bar hazard-top"></div>
            <div class="hazard-stripe-bar hazard-bottom"></div>

            <!-- Rotating Beacon Siren Sweep Light -->
            <div class="siren-beacon-sweep" id="sirenSweepLight"></div>

            <div class="container h-100 d-flex flex-column justify-content-between py-4 position-relative z-2">
                <!-- Top Status Header -->
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <span class="badge bg-danger fs-6 px-3 py-2 animate-pulse">
                            <i class="bi bi-exclamation-octagon-fill me-1"></i> BREACH IMMINENT
                        </span>
                        <span class="text-danger fw-bold tracking-wider font-mono">CODE: RESERVOIR_SPILLWAY_MAX</span>
                    </div>
                    <button id="btnDismissDangerDemo" class="btn btn-outline-light btn-sm opacity-75">
                        <i class="bi bi-x-circle me-1"></i> Exit Emergency View (Demo)
                    </button>
                </div>

                <!-- Center Title Card & Hero Glitch -->
                <div class="text-center my-auto">
                    <div class="glitch-title-wrap mb-2">
                        <h1 class="display-3 fw-black text-danger font-display glitch-text mb-0" data-text="RESERVOIR FULL">
                            RESERVOIR FULL
                        </h1>
                        <h2 class="h3 font-tamil text-danger-subtle opacity-90 mt-1">
                            நீர்த்தேக்கம் நிரம்பியது – முழு கொள்ளளவு
                        </h2>
                    </div>
                    <p class="text-white-50 lead max-w-xl mx-auto mb-4" id="dangerSubtitle">
                        Water storage has touched maximum safe spillway crest. Automatic emergency release protocols initiated.
                    </p>

                    <!-- Real-Time Auto-Safety Sequence Tracker -->
                    <div class="auto-safety-panel mx-auto p-3 text-start mb-4" style="max-width: 620px;">
                        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-danger border-opacity-25">
                            <span class="small text-danger font-mono fw-bold">AUTONOMOUS FIRMWARE SPILLWAY LIFECYCLE</span>
                            <span class="badge bg-danger-subtle text-danger" id="safetyCycleState">EXECUTING</span>
                        </div>
                        <div class="row g-2 font-mono small">
                            <div class="col-6 d-flex align-items-center gap-2" id="stepPumpHalt">
                                <i class="bi bi-circle-fill text-muted step-icon"></i>
                                <span>1. Intake Pump Shutdown</span>
                            </div>
                            <div class="col-6 d-flex align-items-center gap-2" id="stepGateOpen">
                                <i class="bi bi-circle-fill text-muted step-icon"></i>
                                <span>2. Sluice Gate 100% Slew</span>
                            </div>
                            <div class="col-6 d-flex align-items-center gap-2" id="stepOutflowRise">
                                <i class="bi bi-circle-fill text-muted step-icon"></i>
                                <span>3. Discharge Inundation</span>
                            </div>
                            <div class="col-6 d-flex align-items-center gap-2" id="stepRecedeConfirm">
                                <i class="bi bi-circle-fill text-muted step-icon"></i>
                                <span>4. Head Stabilization</span>
                            </div>
                        </div>
                    </div>

                    <!-- Core Metrics HUD -->
                    <div class="row g-3 justify-content-center max-w-lg mx-auto">
                        <div class="col-4">
                            <div class="p-2 rounded bg-black bg-opacity-50 border border-danger border-opacity-30">
                                <div class="text-muted small">Current Level</div>
                                <div id="dangerMetricLevel" class="fs-4 fw-bold text-danger">13.8 cm</div>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="p-2 rounded bg-black bg-opacity-50 border border-danger border-opacity-30">
                                <div class="text-muted small">Inflow</div>
                                <div id="dangerMetricInflow" class="fs-4 fw-bold text-warning">12.4 L/m</div>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="p-2 rounded bg-black bg-opacity-50 border border-danger border-opacity-30">
                                <div class="text-muted small">Spillway Gate</div>
                                <div id="dangerMetricGate" class="fs-4 fw-bold text-danger">100% OPEN</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Operator Action Bar -->
                <div class="text-center">
                    <div id="supervisorActionWrap" class="mb-2">
                        <button id="btnAcknowledgeBreach" class="btn btn-danger btn-lg px-5 py-3 fw-bold shadow-lg rounded-pill btn-ack-pulse">
                            <i class="bi bi-shield-check me-2"></i> ACKNOWLEDGE EMERGENCY ALERT
                        </button>
                    </div>
                    <div id="publicWarningBanner" class="alert alert-danger d-none mb-0 mx-auto" style="max-width: 600px;">
                        <strong><i class="bi bi-megaphone-fill me-2"></i> PUBLIC ADVISORY:</strong>
                        Riverbanks downstream of the reservoir are in active spillway discharge. Avoid riverbeds and low-lying crossings immediately.
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlayEl = overlay;

        // Dismiss button for testing/demo
        document.getElementById("btnDismissDangerDemo")?.addEventListener("click", () => {
            this.forceRecovery();
        });

        // Acknowledge button
        document.getElementById("btnAcknowledgeBreach")?.addEventListener("click", () => {
            this.isAcknowledged = true;
            const btn = document.getElementById("btnAcknowledgeBreach");
            if (btn) {
                btn.className = "btn btn-outline-success btn-lg px-5 py-3 rounded-pill";
                btn.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> EMERGENCY ACKNOWLEDGED`;
                btn.disabled = true;
            }
        });
    }

    evaluateState(telemetry, settings, alerts) {
        if (!telemetry || !settings) return;
        const level = Number(telemetry.waterLevel) || 0;
        const maxHeight = Number(settings.maxTankHeight) || 15;
        const pct = maxHeight > 0 ? (level / maxHeight) * 100 : 0;
        const hasOverflowAlert = (alerts || []).some((a) => a.code === "OVERFLOW_SAFETY" || a.code === "CRITICAL");

        if (pct >= 80.0 || hasOverflowAlert) {
            if (this.activeStage !== "LOCKDOWN" && this.activeStage !== "BREACH") {
                this.triggerBreachSequence(telemetry, settings);
            } else {
                this.updateLockdownTelemetry(telemetry);
            }
        } else if (pct >= 75.0) {
            if (this.activeStage === "LOCKDOWN") {
                // Hysteresis: don't exit lockdown until below 75%
                this.updateLockdownTelemetry(telemetry);
            } else {
                this.triggerWarningForeshadowing(telemetry);
            }
        } else {
            if (this.activeStage === "LOCKDOWN" || this.activeStage === "BREACH" || this.activeStage === "WARNING") {
                this.triggerRecoverySequence();
            }
        }
    }

    triggerWarningForeshadowing(telemetry) {
        this.activeStage = "WARNING";
        themeEngine.setTheme("warning");
        audioEngine.setTelemetryState({ inflowRate: telemetry.inflowRate, stateName: "WARNING" });
    }

    triggerBreachSequence(telemetry, settings) {
        this.activeStage = "BREACH";
        this.minBreachTimestamp = Date.now() + 6000; // Minimum 6 seconds before recovery allowed
        themeEngine.setTheme("danger");
        audioEngine.setTelemetryState({ inflowRate: telemetry.inflowRate, stateName: "CRITICAL" });

        // Stage 1: Chromatic White-Red Flash + Screen Shake
        const flash = document.createElement("div");
        flash.className = "danger-flash-screen";
        document.body.appendChild(flash);

        if (window.gsap) {
            gsap.to(flash, {
                opacity: 0,
                duration: 0.25,
                ease: "power2.out",
                onComplete: () => flash.remove()
            });

            // Violent Screen Shake easing out
            gsap.fromTo(document.body, 
                { x: -12, y: 8 },
                { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" }
            );
        } else {
            setTimeout(() => flash.remove(), 200);
        }

        // Transition to Stage 2: Lockdown Fullscreen Overlay
        setTimeout(() => {
            if (this.activeStage === "BREACH") {
                this.activeStage = "LOCKDOWN";
                this.showLockdownOverlay(telemetry);
            }
        }, 300);
    }

    showLockdownOverlay(telemetry) {
        if (!this.overlayEl) return;
        this.overlayEl.classList.add("active");
        this.updateLockdownTelemetry(telemetry);

        // Spin the beacon siren light
        const beacon = document.getElementById("sirenSweepLight");
        if (beacon && window.gsap) {
            this.sirenRotationTween = gsap.to(beacon, {
                rotation: 360,
                duration: 2.2,
                repeat: -1,
                ease: "none"
            });
        }
    }

    updateLockdownTelemetry(telemetry) {
        if (!telemetry) return;
        const elLvl = document.getElementById("dangerMetricLevel");
        const elInf = document.getElementById("dangerMetricInflow");
        const elGate = document.getElementById("dangerMetricGate");

        if (elLvl) elLvl.textContent = `${Number(telemetry.waterLevel).toFixed(1)} cm`;
        if (elInf) elInf.textContent = `${Number(telemetry.inflowRate).toFixed(1)} L/m`;
        if (elGate) elGate.textContent = `${(Number(telemetry.gatePosition) * 100).toFixed(0)}% OPEN`;

        // Update auto-safety steps based on confirmed telemetry
        this.updateStepStatus("stepPumpHalt", String(telemetry.pumpStatus).toUpperCase() === "OFF");
        this.updateStepStatus("stepGateOpen", Number(telemetry.gatePosition) >= 0.85);
        this.updateStepStatus("stepOutflowRise", Number(telemetry.outflowRate) >= 6.0);
        this.updateStepStatus("stepRecedeConfirm", Number(telemetry.waterPercentage) < 82);
    }

    updateStepStatus(stepId, isConfirmed) {
        const el = document.getElementById(stepId);
        if (!el) return;
        const icon = el.querySelector(".step-icon");
        if (isConfirmed) {
            icon.className = "bi bi-check-circle-fill text-success step-icon";
            el.classList.add("text-success");
        } else {
            icon.className = "bi bi-arrow-repeat text-warning spin step-icon";
            el.classList.remove("text-success");
        }
    }

    triggerRecoverySequence() {
        if (Date.now() < this.minBreachTimestamp) return; // Prevent flicker
        this.activeStage = "RECOVERY";

        if (this.overlayEl) {
            this.overlayEl.classList.remove("active");
        }
        if (this.sirenRotationTween) {
            this.sirenRotationTween.kill();
            this.sirenRotationTween = null;
        }

        // Liquid wipe transition back to nominal
        themeEngine.setTheme("nominal");
        audioEngine.setTelemetryState({ inflowRate: 1.0, stateName: "NOMINAL" });

        setTimeout(() => {
            this.activeStage = "NOMINAL";
            this.isAcknowledged = false;
        }, 1200);
    }

    forceRecovery() {
        this.minBreachTimestamp = 0;
        this.triggerRecoverySequence();
    }
}

export const dangerScene = new DangerSceneDirector();
