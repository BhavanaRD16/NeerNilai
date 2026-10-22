/**
 * NeerNilai – Atmospheric Audio Engine (Howler.js + Web Audio Synthesis)
 * Procedural synthesizers for:
 * - Ambient gentle water flow (scales with inflow)
 * - Low-frequency tension drone (fades in on Warning)
 * - Cardiac emergency heartbeat (slow to fast)
 * - Rotating siren alarm pulse (Breach & Lockdown)
 * - Tactile UI interaction clicks
 * 
 * Safety: Muted by default, user-activated via header toggle or first interaction prompt.
 */

class AudioEngine {
    constructor() {
        this.enabled = false;
        this.ctx = null;
        this.gainMaster = null;
        this.gainWater = null;
        this.gainDrone = null;
        this.gainHeartbeat = null;
        this.gainSiren = null;

        this.oscDrone = null;
        this.noiseWaterNode = null;
        this.heartbeatTimer = null;
        this.sirenTimer = null;
        this.heartbeatIntervalMs = 1200;
        this.inflowRate = 1.0;
        this.state = "NOMINAL"; // "NOMINAL" | "WARNING" | "CRITICAL"
    }

    initContext() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.gainMaster = this.ctx.createGain();
        this.gainMaster.gain.setValueAtTime(this.enabled ? 0.35 : 0, this.ctx.currentTime);
        this.gainMaster.connect(this.ctx.destination);

        // Water flow procedural noise bus
        this.createWaterNoise();

        // Tension Drone Bus
        this.createTensionDrone();
    }

    enableAudio() {
        this.initContext();
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
        this.enabled = true;
        this.gainMaster.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.2);
        localStorage.setItem("neernilai_audio", "enabled");
        this.updateSoundscape();
    }

    disableAudio() {
        this.enabled = false;
        if (this.gainMaster && this.ctx) {
            this.gainMaster.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        }
        localStorage.setItem("neernilai_audio", "disabled");
        this.stopHeartbeat();
        this.stopSiren();
    }

    toggleAudio() {
        if (this.enabled) this.disableAudio();
        else this.enableAudio();
        return this.enabled;
    }

    createWaterNoise() {
        // Pink/Brown noise buffer for water trickling / rushing
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            output[i] = (b0 + b1 + b2) * 0.12;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Bandpass filter centered on aquatic splash
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);

        this.gainWater = this.ctx.createGain();
        this.gainWater.gain.setValueAtTime(0.08, this.ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(this.gainWater);
        this.gainWater.connect(this.gainMaster);
        whiteNoise.start(0);
    }

    createTensionDrone() {
        this.oscDrone = this.ctx.createOscillator();
        this.oscDrone.type = "sawtooth";
        this.oscDrone.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(110, this.ctx.currentTime);

        this.gainDrone = this.ctx.createGain();
        this.gainDrone.gain.setValueAtTime(0, this.ctx.currentTime);

        this.oscDrone.connect(filter);
        filter.connect(this.gainDrone);
        this.gainDrone.connect(this.gainMaster);
        this.oscDrone.start(0);
    }

    playUiClick() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.gainMaster);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    triggerHeartbeatPulse() {
        if (!this.enabled || !this.ctx) return;
        // Two-stroke "lub-dub" kick
        const playKick = (timeOffset, freq, vol) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const t = this.ctx.currentTime + timeOffset;
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.09);
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain);
            gain.connect(this.gainMaster);
            osc.start(t);
            osc.stop(t + 0.12);
        };
        playKick(0, 75, 0.45);
        playKick(0.12, 60, 0.32);
    }

    triggerSirenSweep() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(880, t + 0.5);
        osc.frequency.linearRampToValueAtTime(440, t + 1.0);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 1.0);
        osc.connect(gain);
        gain.connect(this.gainMaster);
        osc.start(t);
        osc.stop(t + 1.0);
    }

    setTelemetryState({ inflowRate, stateName }) {
        this.inflowRate = Number(inflowRate) || 1.0;
        this.state = stateName;
        if (!this.enabled || !this.ctx) return;
        this.updateSoundscape();
    }

    updateSoundscape() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Water rushing sound scales with inflow
        const waterVol = Math.min(0.25, 0.05 + (this.inflowRate / 12) * 0.18);
        this.gainWater.gain.setTargetAtTime(waterVol, t, 0.3);

        if (this.state === "CRITICAL" || this.state === "OVERFLOW_SAFETY") {
            // Maximum tension drone + fast cardiac pulse + rotating siren
            this.gainDrone.gain.setTargetAtTime(0.22, t, 0.5);
            this.startHeartbeat(650);
            this.startSiren();
        } else if (this.state === "WARNING") {
            // Low tension drone + slow heartbeat
            this.gainDrone.gain.setTargetAtTime(0.1, t, 0.8);
            this.startHeartbeat(1100);
            this.stopSiren();
        } else {
            // Nominal state
            this.gainDrone.gain.setTargetAtTime(0, t, 1.0);
            this.stopHeartbeat();
            this.stopSiren();
        }
    }

    startHeartbeat(intervalMs) {
        if (this.heartbeatIntervalMs === intervalMs && this.heartbeatTimer) return;
        this.stopHeartbeat();
        this.heartbeatIntervalMs = intervalMs;
        this.triggerHeartbeatPulse();
        this.heartbeatTimer = setInterval(() => this.triggerHeartbeatPulse(), intervalMs);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    startSiren() {
        if (this.sirenTimer) return;
        this.triggerSirenSweep();
        this.sirenTimer = setInterval(() => this.triggerSirenSweep(), 1050);
    }

    stopSiren() {
        if (this.sirenTimer) {
            clearInterval(this.sirenTimer);
            this.sirenTimer = null;
        }
    }
}

export const audioEngine = new AudioEngine();
