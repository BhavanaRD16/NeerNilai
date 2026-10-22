/**
 * NeerNilai – Theme & Atmosphere Engine
 * Drives crossfades between Ocean Nominal, Warning Amber, and Emergency Breach Red themes.
 * Updates CSS root vars, document favicon, and browser <meta name="theme-color">.
 */

class ThemeEngine {
    constructor() {
        this.currentTheme = "nominal"; // "nominal" | "warning" | "danger"
        this.metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!this.metaThemeColor) {
            this.metaThemeColor = document.createElement("meta");
            this.metaThemeColor.name = "theme-color";
            this.metaThemeColor.content = "#050b14";
            document.head.appendChild(this.metaThemeColor);
        }

        this.favicon = document.querySelector('link[rel="icon"]');
        if (!this.favicon) {
            this.favicon = document.createElement("link");
            this.favicon.rel = "icon";
            document.head.appendChild(this.favicon);
        }
    }

    setTheme(theme) {
        if (this.currentTheme === theme) return;
        this.currentTheme = theme;
        const body = document.body;

        if (theme === "danger") {
            body.classList.add("theme-danger");
            body.classList.remove("theme-warning");
            this.metaThemeColor.content = "#120305";
            this.updateFavicon("#ef4444");
        } else if (theme === "warning") {
            body.classList.remove("theme-danger");
            body.classList.add("theme-warning");
            this.metaThemeColor.content = "#171204";
            this.updateFavicon("#f59e0b");
        } else {
            body.classList.remove("theme-danger", "theme-warning");
            this.metaThemeColor.content = "#050b14";
            this.updateFavicon("#00e5ff");
        }
    }

    updateFavicon(color) {
        // Dynamic SVG favicon
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/><path d="M16 6 C16 6, 8 18, 8 22 C8 26.4 11.6 30 16 30 C20.4 30 24 26.4 24 22 C24 18, 16 6, 16 6 Z" fill="#ffffff" opacity="0.9"/></svg>`;
        this.favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    /**
     * Update viewport-level ambient water background height matching real level percentage
     */
    updateAmbientWater(percentage) {
        const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
        let backdrop = document.getElementById("ambientWaterBackdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "ambientWaterBackdrop";
            backdrop.className = "ambient-water-backdrop";
            document.body.prepend(backdrop);
        }
        backdrop.style.height = `${pct * 0.7}%`;
        backdrop.style.opacity = pct > 80 ? "0.32" : (pct > 20 ? "0.18" : "0.08");
    }
}

export const themeEngine = new ThemeEngine();
