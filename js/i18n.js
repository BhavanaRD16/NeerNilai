/**
 * NeerNilai – Bilingual Internationalization (English & Tamil)
 * Provides comprehensive language translation across the dashboard, metrics, alerts, and navigation.
 */

export const TRANSLATIONS = {
    en: {
        app_title: "NEERNILAI",
        app_sub: "Smart Reservoir Monitoring System",
        tagline: "Real-Time ESP32 Monitoring & Administrative Control",
        nav_dashboard: "Dashboard",
        nav_admin: "Admin Control",
        nav_simulator: "Simulator",
        nav_login: "Login",
        nav_logout: "Logout",
        select_dam: "Select Tamil Nadu Dam",
        real_dam_toggle: "Real-Dam Equivalent Units",
        prototype_scale: "Prototype Scale (cm, L, L/min)",

        // Metrics
        water_level: "Water Level",
        reservoir_capacity: "Reservoir Capacity",
        current_storage: "Current Storage",
        inflow_rate: "Inflow Rate",
        outflow_rate: "Outflow Rate",
        gate_position: "Gate Position",

        // Digital twin
        digital_twin_title: "Hardware Prototype Digital Twin",
        digital_twin_sub: "Real-time synchronous software model mirroring sensors, pump, stepper motor, and spillway",

        // Alerts & Status
        alert_section: "Alert Centre",
        sys_status: "Connection Status",
        data_last_updated: "Data Last Updated",
        waiting_for_data: "Waiting for telemetry…",
        status_normal: "NORMAL CONDITIONS",
        status_warning: "WARNING LEVEL",
        status_critical: "CRITICAL WATER LEVEL",
        status_overflow: "OVERFLOW SAFETY ACTIVE",

        // Analytics
        real_time_analytics: "Real-Time Analytics",
        water_storage_chart: "Water Storage History",
        historical_data: "Historical Telemetry Logs",
        download_csv: "Download CSV",
        export_report: "Export PDF Report",

        // Predictions
        predictions_title: "Predictive Inflow & Time-to-Threshold",
        time_to_critical: "Estimated Time to Critical:",
        time_to_warning: "Estimated Time to Warning:",
        rate_of_rise: "Net Accumulation Rate:"
    },
    ta: {
        app_title: "நீர்நிலை",
        app_sub: "ஸ்மார்ட் அணை கண்காணிப்பு அமைப்பு",
        tagline: "நிகழ்நேர ESP32 கண்காணிப்பு மற்றும் நிர்வாகக் கட்டுப்பாடு",
        nav_dashboard: "முகப்பு பலகை",
        nav_admin: "நிர்வாகக் கட்டுப்பாடு",
        nav_simulator: "மாதிரி இயக்கி",
        nav_login: "உள்நுழை",
        nav_logout: "வெளியேறு",
        select_dam: "தமிழக அணையைத் தேர்ந்தெடுக்கவும்",
        real_dam_toggle: "உண்மையான அணை அலகுகள்",
        prototype_scale: "முன்மாதிரி அளவீடு (செ.மீ, லிட்டர்)",

        // Metrics
        water_level: "நீர் மட்டம்",
        reservoir_capacity: "அணை கொள்ளளவு",
        current_storage: "தற்போதைய நீர் இருப்பு",
        inflow_rate: "நீர் வரத்து விகிதம்",
        outflow_rate: "நீர் வெளியேற்ற விகிதம்",
        gate_position: "மதகு திறப்பு நிலை",

        // Digital twin
        digital_twin_title: "வன்பொருள் முன்மாதிரி டிஜிட்டல் இரட்டை (Digital Twin)",
        digital_twin_sub: "சென்சார்கள், பம்பு மற்றும் மதகுகளை நிகழ்நேரத்தில் பிரதிபலிக்கும் மென்பொருள் வடிவம்",

        // Alerts & Status
        alert_section: "எச்சரிக்கை மையம்",
        sys_status: "இணைப்பு நிலை",
        data_last_updated: "கடைசியாக புதுப்பிக்கப்பட்டது",
        waiting_for_data: "தகவலுக்காக காத்திருக்கிறது…",
        status_normal: "இயல்பான நிலை",
        status_warning: "எச்சரிக்கை நீர் மட்டம்",
        status_critical: "ஆபத்தான நீர் மட்டம்",
        status_overflow: "வெள்ளப் பெருக்கு பாதுகாப்பு இயங்குகிறது",

        // Analytics
        real_time_analytics: "நிகழ்நேர பகுப்பாய்வு",
        water_storage_chart: "நீர் இருப்பு வரலாறு",
        historical_data: "வரலாற்றுப் பதிவுகள்",
        download_csv: "CSV தரவிறக்கம்",
        export_report: "அறிக்கை தரவிறக்கம்",

        // Predictions
        predictions_title: "முன்கணிப்பு & அவசர கால கணிப்பு",
        time_to_critical: "ஆபத்தான நிலையை அடைய உத்தேச நேரம்:",
        time_to_warning: "எச்சரிக்கை நிலையை அடைய உத்தேச நேரம்:",
        rate_of_rise: "நிகர நீர் சேர்ப்பு வேகம்:"
    }
};

const LANG_KEY = "neernilai_lang";

export function getCurrentLang() {
    return localStorage.getItem(LANG_KEY) || "en";
}

export function setLanguage(lang) {
    if (lang !== "en" && lang !== "ta") lang = "en";
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
    document.documentElement.lang = lang;
}

export function t(key) {
    const lang = getCurrentLang();
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

export function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        const text = t(key);
        if (text) el.textContent = text;
    });
}
