/**
 * NeerNilai – Automated Demo Mode Director
 * Allows college project reviewers to press one button to run an unattended,
 * fully guided dynamic demonstration that exercises the entire system:
 * 1. Normal Operations (5s)
 * 2. Monsoon Surge Hazard (10s)
 * 3. Approaching Warning & Critical (8s)
 * 4. Autonomous Overflow Safety Gate Dispatch (10s)
 * 5. Recovery & Water Balance Equilibrium (7s)
 */

import { scenarioDirector } from "./scenarios.js";
import { setSelectedDam } from "./auth.js";

class DemoDirector {
    constructor() {
        this.running = false;
        this.stepIndex = 0;
        this.timer = null;
        this.overlay = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.stepIndex = 0;
        setSelectedDam("mettur");
        this.createBanner();
        this.runStep();
    }

    createBanner() {
        let el = document.getElementById("nnDemoBanner");
        if (!el) {
            el = document.createElement("div");
            el.id = "nnDemoBanner";
            el.className = "demo-director-banner glass-card p-3 shadow-lg";
            document.body.appendChild(el);
        }
        this.overlay = el;
    }

    runStep() {
        const steps = [
            {
                title: "Step 1/5: Normal Operations",
                desc: "Demonstrating nominal diurnal inflow and controlled water balance.",
                scenario: "NORMAL",
                duration: 6000
            },
            {
                title: "Step 2/5: Catchment Monsoon Surge",
                desc: "Injecting heavy catchment rainfall (12+ L/min). Watch water level rise rapidly.",
                scenario: "MONSOON_SURGE",
                duration: 8000
            },
            {
                title: "Step 3/5: Predictive Alert Warning",
                desc: "Predictive engine calculates time-to-critical and fires high water warning.",
                scenario: "MONSOON_SURGE",
                duration: 7000
            },
            {
                title: "Step 4/5: Emergency Spillway Dispatch",
                desc: "Water touches 80%. Autonomous firmware triggers 100% sluice gate opening.",
                scenario: "FLASH_FLOOD",
                duration: 9000
            },
            {
                title: "Step 5/5: Controlled Drainage & Recovery",
                desc: "High outflow successfully relieves reservoir head; returning to safe zone.",
                scenario: "NORMAL",
                duration: 6000
            }
        ];

        if (this.stepIndex >= steps.length) {
            this.finish();
            return;
        }

        const current = steps[this.stepIndex];
        scenarioDirector.setScenario(current.scenario);

        if (this.overlay) {
            this.overlay.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary mb-1">AUTOMATED DEMO TOUR</span>
                        <h5 class="mb-1 text-white">${current.title}</h5>
                        <p class="mb-0 small text-muted">${current.desc}</p>
                    </div>
                    <div>
                        <button id="btnStopDemo" class="btn btn-outline-danger btn-sm">Stop Tour</button>
                    </div>
                </div>
            `;
            document.getElementById("btnStopDemo")?.addEventListener("click", () => this.finish());
        }

        this.stepIndex++;
        this.timer = setTimeout(() => this.runStep(), current.duration);
    }

    finish() {
        this.running = false;
        if (this.timer) clearTimeout(this.timer);
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        scenarioDirector.setScenario("NORMAL");
    }
}

export const demoDirector = new DemoDirector();
