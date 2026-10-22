# NeerNilai (நீர்நிலை) v2 — Smart Reservoir Monitoring & Digital Twin System

> **A software-defined hardware prototype & smart monitoring system for Tamil Nadu dams.**

NeerNilai combines a **truthful interactive SVG digital twin**, an **autonomous firmware-brain simulator**, and a **real-time supervisory dashboard** connected to Firebase Realtime Database. It monitors telemetry from 7 major Tamil Nadu reservoirs (Mettur, Vaigai, Bhavanisagar, Mullaperiyar, Pechiparai, Aliyar, Sathanur) at prototype scale (`cm`, `L`, `L/min`) with live conversion to real-dam units (`ft`, `TMC`, `cusecs`).

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Hardware_Rig [Software-Defined Hardware Prototype]
        ESP32[ESP32 Firmware Brain]
        HCSR04[Ultrasonic Level Sensor]
        Pump[12V Inflow Pump]
        Stepper[Stepper Motor + Gear Train]
        SluiceGate[Spillway Sluice Gate]
        Solenoid[Solenoid Irrigation Valve]
        YFS201[Pulse Flow Sensors]
    end

    subgraph Cloud_Layer [Firebase Realtime Database]
        RTDB[Firebase RTDB /dams/{damId}/...]
        Rules[database.rules.json]
    end

    subgraph Client_Applications [Supervisory & Public Web App]
        Twin[SVG Digital Twin Model]
        Dashboard[Real-Time Analytics Dashboard]
        Admin[Administrative Motor HMI]
        Scenarios[Scenario Director Engine]
        Map[Tamil Nadu Water Grid Map]
        Tour[Automated Demo Director]
    end

    ESP32 -->|Autonomous Safety Logic| SluiceGate
    ESP32 -->|Telemetry Stream| RTDB
    RTDB -->|Live Listeners| Dashboard
    RTDB -->|Real-Time State| Twin
    RTDB -->|Fleet Status| Map
    Admin -->|Motor / Gate Commands| RTDB
    RTDB -->|Command Dispatch| ESP32
    Tour -->|Hazard Scenarios| Scenarios
    Scenarios -->|Physics Overrides| ESP32
```

---

## ✨ Key Features & Upgrades

1. **Live SVG Digital Twin**:
   - Interactive, realistic visual twin mirroring the physical prototype rig (acrylic tank, ultrasonic sonar pulses, spinning pump impeller, gear-train rotation, translating sluice gate blade, turbulent cascade spray, and solenoid status indicator).
   - Driven synchronously by Firebase telemetry with `prefers-reduced-motion` compliance.

2. **Firmware-Brain Simulator & Scenario Director**:
   - Emulates autonomous on-chip ESP32 firmware logic: if water touches **80% (12 cm)**, the device-side firmware overrides commands, auto-opens the spillway sluice gate to 100%, and cuts power to the intake pump, even when the browser dashboard is closed.
   - **7 Physical Hazard Scenarios**: `Monsoon Surge`, `Drought`, `Pump Failure`, `Sluice Gate Jam`, `Ultrasonic Sensor Fault`, `Wi-Fi Telemetry Drop`, and `Flash Flood`.
   - **Speed Multiplier**: Accelerate simulation clock by 1x, 5x, 20x, or 60x.

3. **Multi-Dam Namespacing (7 Tamil Nadu Dams)**:
   - All data is isolated under `/dams/{damId}/...` (`mettur`, `vaigai`, `bhavanisagar`, `periyar`, `pechiparai`, `aliyar`, `sathanur`).
   - Interactive Tamil Nadu state map with live health markers.
   - Backward-compatible migration helper for legacy flat structures.

4. **Predictive Analytics & Water Balance**:
   - Calculates net inflow rate ($Q_{in} - Q_{out}$) and projects accurate time-to-warning and time-to-critical overflow.

5. **Security & Role-Based Access Control**:
   - Passwords stored as **salted SHA-256 hashes** via the Web Crypto API (`crypto.subtle`).
   - Three operational roles:
     - `SUPER_ADMIN`: Statewide access, dam supervisor assignment, full actuator control.
     - `DAM_SUPERVISOR`: Delegated control of assigned reservoir.
     - `GENERAL`: Public read-only safety view with simplified non-technical language.

6. **Bilingual Support (English & தமிழ்)**:
   - One-click instant UI toggle between English and Tamil.

7. **One-Click Automated Demo Tour**:
   - Automated unattended tour for college project reviews exercising normal ops, monsoon surge, predictive alerts, spillway auto-dispatch, and safe drainage.

---

## 🚀 Quick Start Guide

### 1. Run Locally
1. Clone or open the project folder in VS Code.
2. Launch with **Live Server** (Right-click `index.html` → *Open with Live Server*).
3. Open `simulator.html` in a second tab and click **START FIRMWARE ENGINE**.
4. Return to `index.html` — watch the live Digital Twin, telemetry gauges, and charts update in real time!

### 2. Demo Tour for Reviewers
- On the dashboard header, click **Demo Tour**.
- The system will automatically step through 5 guided operational phases with step-by-step explanatory banners.

---

## 🗄️ Database Paths

| Path | Purpose |
|------|---------|
| `/dams/{damId}/device` | Device state (`online`, `id`, `lastSeen`, `firmwareSafety`) |
| `/dams/{damId}/telemetry/current` | Latest water level, percentage, storage, flows, gate pos |
| `/dams/{damId}/telemetry/history/{ts}` | Historical time-series telemetry |
| `/dams/{damId}/controls` | Motor commands (`pump`, `solenoid`, `gate`) |
| `/dams/{damId}/settings` | Configured thresholds (`maxTankHeight`, `warningLevel`, `criticalLevel`) |
| `/dams/{damId}/alerts` | Active alert list with severity rankings |
| `/dams/{damId}/logs` | Audit trail of administrative and firmware actions |
| `/users` | Salted SHA-256 user credentials and role assignments |
| `/meta` | System migration flags and global metadata |

---

## 🛡️ Default Demo Credentials

| Role | Username | Demo Password | Dam Assignment |
|------|----------|---------------|----------------|
| **Super Admin** | `admin` | `admin123` | Statewide (All) |
| **Dam Supervisor** | `supervisor_mettur` | `mettur123` | Mettur Dam |
| **Dam Supervisor** | `supervisor_vaigai` | `vaigai123` | Vaigai Dam |
| **General Public** | *No login needed* | *N/A* | Public Safety View |

*Note: Plaintext passwords are automatically migrated to salted SHA-256 hashes on first load.*
