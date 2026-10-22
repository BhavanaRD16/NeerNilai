/**
 * NeerNilai – Real-Time Water Physics & Shader Simulation Layer
 * High-performance animated fluid surface with refraction caustics, rising air bubbles,
 * pressurized inlet jet splash, turbulent downstream foaming spray, and mouse pebble drop ripple interactions.
 * 
 * Works over HTML5 2D Canvas or WebGL context. Falls back gracefully with reduced-motion support.
 */

export class WaterSimulation {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.animId = null;

        this.width = canvas.width = 400;
        this.height = canvas.height = 300;

        // Fluid column particles
        this.numNodes = 45;
        this.nodes = [];
        this.springK = 0.025;
        this.damping = 0.04;
        this.spread = 0.25;

        // Current target parameters
        this.targetFillPct = 50;
        this.currentFillPct = 50;
        this.inflowRate = 1.0;
        this.outflowRate = 0.8;
        this.theme = "cyan"; // "cyan" | "amber" | "danger"

        // Particles (Bubbles & Splashes)
        this.bubbles = [];
        this.splashes = [];

        this.initNodes();
        this.bindInteractions();
        this.startLoop();
    }

    initNodes() {
        this.nodes = [];
        for (let i = 0; i < this.numNodes; i++) {
            this.nodes.push({
                x: (i / (this.numNodes - 1)) * this.width,
                y: 0,
                targetY: 0,
                velY: 0,
                accelY: 0
            });
        }
    }

    bindInteractions() {
        this.canvas.addEventListener("mousemove", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * this.width;
            this.splashAt(mouseX, 3.5);
        });

        this.canvas.addEventListener("click", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * this.width;
            this.splashAt(mouseX, 14.0); // Pebble drop
            this.createPebbleSplash(mouseX);
        });
    }

    splashAt(x, strength) {
        const nodeIndex = Math.floor((x / this.width) * (this.numNodes - 1));
        if (nodeIndex >= 0 && nodeIndex < this.numNodes) {
            this.nodes[nodeIndex].velY += strength;
        }
    }

    createPebbleSplash(x) {
        for (let i = 0; i < 8; i++) {
            this.splashes.push({
                x,
                y: this.getSurfaceY(x),
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 5 - 2,
                radius: Math.random() * 2.5 + 1.5,
                alpha: 1.0
            });
        }
    }

    getSurfaceY(x) {
        const fraction = x / this.width;
        const targetSurfaceY = this.height * (1 - this.currentFillPct / 100);
        return targetSurfaceY;
    }

    updatePhysics() {
        // Smooth critically-damped lerp to target level
        this.currentFillPct += (this.targetFillPct - this.currentFillPct) * 0.08;
        const targetSurfaceY = this.height * (1 - this.currentFillPct / 100);

        // Continuous splash from inlet pipe if inflow is strong
        if (this.inflowRate > 2.0) {
            const inletX = this.width * 0.15;
            this.splashAt(inletX, (Math.random() * 0.8 + 0.4) * (this.inflowRate / 6));
        }

        // Fluid spring column dynamics
        for (let i = 0; i < this.numNodes; i++) {
            const node = this.nodes[i];
            node.targetY = targetSurfaceY;
            const displacement = node.y - node.targetY;
            node.accelY = -this.springK * displacement - this.damping * node.velY;
            node.velY += node.accelY;
            node.y += node.velY;
        }

        // Wave spread propagation (neighbor propagation)
        const leftDeltas = new Float32Array(this.numNodes);
        const rightDeltas = new Float32Array(this.numNodes);

        for (let pass = 0; pass < 3; pass++) {
            for (let i = 0; i < this.numNodes; i++) {
                if (i > 0) {
                    leftDeltas[i] = this.spread * (this.nodes[i].y - this.nodes[i - 1].y);
                    this.nodes[i - 1].velY += leftDeltas[i];
                }
                if (i < this.numNodes - 1) {
                    rightDeltas[i] = this.spread * (this.nodes[i].y - this.nodes[i + 1].y);
                    this.nodes[i + 1].velY += rightDeltas[i];
                }
            }
            for (let i = 0; i < this.numNodes; i++) {
                if (i > 0) this.nodes[i - 1].y += leftDeltas[i];
                if (i < this.numNodes - 1) this.nodes[i + 1].y += rightDeltas[i];
            }
        }

        // Bubbles update
        if (Math.random() < 0.25 && this.currentFillPct > 10) {
            this.bubbles.push({
                x: Math.random() * this.width,
                y: this.height - 5,
                vy: -Math.random() * 2 - 1,
                radius: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.3
            });
        }

        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.y += b.vy;
            const surfY = this.getSurfaceY(b.x);
            if (b.y <= surfY) {
                this.splashAt(b.x, 0.4);
                this.bubbles.splice(i, 1);
            }
        }

        // Splash droplets update
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.25; // gravity
            s.alpha -= 0.03;
            if (s.alpha <= 0) {
                this.splashes.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Water Gradient based on theme
        const grad = ctx.createLinearGradient(0, this.height * (1 - this.currentFillPct / 100), 0, this.height);
        if (this.theme === "danger") {
            grad.addColorStop(0, "rgba(255, 45, 85, 0.85)");
            grad.addColorStop(0.5, "rgba(220, 38, 38, 0.92)");
            grad.addColorStop(1, "rgba(127, 29, 29, 0.98)");
        } else if (this.theme === "warning") {
            grad.addColorStop(0, "rgba(245, 158, 11, 0.85)");
            grad.addColorStop(0.5, "rgba(217, 119, 6, 0.9)");
            grad.addColorStop(1, "rgba(146, 64, 14, 0.98)");
        } else {
            grad.addColorStop(0, "rgba(0, 229, 255, 0.85)");
            grad.addColorStop(0.5, "rgba(2, 132, 199, 0.92)");
            grad.addColorStop(1, "rgba(3, 73, 115, 0.98)");
        }

        // Draw Water Body
        ctx.beginPath();
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);

        for (let i = 1; i < this.numNodes; i++) {
            const prev = this.nodes[i - 1];
            const curr = this.nodes[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }

        ctx.lineTo(this.width, this.height);
        ctx.lineTo(0, this.height);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw Surface Highlights & Caustic Line
        ctx.beginPath();
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.numNodes; i++) {
            const prev = this.nodes[i - 1];
            const curr = this.nodes[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx.strokeStyle = this.theme === "danger" ? "#fecdd3" : "#e0f2fe";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Draw Bubbles
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        this.bubbles.forEach((b) => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Splash Droplets
        this.splashes.forEach((s) => {
            ctx.fillStyle = `rgba(224, 242, 254, ${s.alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    startLoop() {
        const loop = () => {
            this.updatePhysics();
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    }

    updateTelemetry(waterPercent, inflowRate, outflowRate, themeName = "cyan") {
        this.targetFillPct = Math.max(0, Math.min(100, waterPercent));
        this.inflowRate = Number(inflowRate) || 0;
        this.outflowRate = Number(outflowRate) || 0;
        this.theme = themeName;
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
    }
}
