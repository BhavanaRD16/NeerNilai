# NeerNilai

Smart Reservoir Monitoring and Control System for Tamil Nadu Dams.

This version is a static web dashboard (HTML, CSS, vanilla JavaScript, Bootstrap 5, Chart.js) connected to **Firebase Realtime Database**. An on-site ESP32 is not required yet: `simulator.html` writes realistic telemetry to the same database paths the hardware will use later.

## How to run

1. Open the project folder in VS Code.
2. Install the **Live Server** extension if you do not have it.
3. Right-click `index.html` → **Open with Live Server**.
4. Keep a second tab on `simulator.html`, click **START SIMULATOR**, then return to the dashboard. Metrics, tank, charts, and alerts update without a page refresh.

You can also open the HTML files directly, but Live Server is more reliable with ES modules.

## Firebase setup

The web app already uses this project:

- Project name: **NeerNilai**
- Project ID: **neernilai**
- Database URL: `https://neernilai-default-rtdb.firebaseio.com`

Configuration lives only in `js/firebase.js`.

In the [Firebase console](https://console.firebase.google.com/):

1. Enable **Realtime Database**.
2. For development, use open rules (see below). Lock them down before any public deployment.
3. Do not enable Authentication for this college demo unless you add it later.

On first load, the app seeds:

- `settings/` — tank height 15 cm, capacity 50 L, warning 12 cm, critical 13.5 cm, overflow safety on
- `controls/` — pump OFF, solenoid CLOSED, gate STOP
- `device/` — `ESP32_RESERVOIR_01`

## Start the simulator

1. Open `simulator.html`.
2. Choose 1 / 2 / 5 / 10 second interval.
3. Click **START SIMULATOR**.
4. Leave that tab open while you use Dashboard and Admin Control.
5. Click **STOP SIMULATOR** when finished (marks the device offline). Closing the tab also tries to set `device/online` to `false`.

The simulator reads `controls/` (admin + overflow-safety commands) and writes `telemetry/current`, `telemetry/history/{timestamp}`, and `device/`.

## Verify data in Firebase

Console → Realtime Database → Data:

- `telemetry/current` should change every interval.
- `telemetry/history` should grow with timestamp keys.
- `device/online` should be `true` while the simulator runs.
- Admin buttons should change `controls/` and append `logs/`.
- Overflow at ≥ 80% of max height writes `controls/gate/command = OPEN_FULL`.

## How the dashboard connects

Pages load ES modules. `js/firebase.js` initializes the modular SDK once. `dashboard.js` attaches `onValue()` listeners to `.info/connected`, `device`, `telemetry/current`, `telemetry/history`, `settings`, and `controls`. Charts and the history table follow `telemetry/history` (last 500 samples). Alerts are computed from telemetry + settings and stored under `alerts/`.

## Development database rules

Realtime Database → Rules (development only):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

These rules allow any visitor to read and write the database. Use them only for a private demo. For production, restrict write access to the ESP32 and authenticated operators.

## Features implemented now

- Monitoring dashboard with live ESP32 / Firebase status
- Dynamic alerts (normal, low, warning, critical, overflow, disconnect, high inflow/outflow)
- Metric cards and CSS reservoir visualization
- Chart.js water level / inflow / outflow and storage charts
- History table, time filters, CSV export
- Settings summary from `settings/`
- Admin pump, solenoid, and gate commands (`Command Sent` vs telemetry-confirmed position)
- Administrative command log in `logs/`
- Software overflow safety (gate-open **command**, not a claimed physical move)
- ESP32 telemetry simulator with coupled pump / gate / level physics
- Responsive Bootstrap layout

## Later, with ESP32 hardware

- Arduino / ESP32 firmware (not in this repo yet)
- JSN-SR04T ultrasonic level sensing
- Water flow sensors for inflow / outflow
- DC pump motor, solenoid valve, servo/stepper gate
- Replace `simulator.html` with the device; keep the same Firebase schema
- Tighter database rules and optional operator login
- Field calibration of tank height and storage curve

Architecture when hardware is ready:

Sensors → ESP32 → Wi-Fi → Firebase Realtime Database → NeerNilai Dashboard
