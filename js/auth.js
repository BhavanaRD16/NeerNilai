/**
 * NeerNilai – Role-Based Authentication & Tamil Nadu Dam Supervisor Management Module
 * Roles:
 * 1. SUPER_ADMIN: Full access, can add/manage Dam Administrators for Tamil Nadu dams, full controls.
 * 2. DAM_SUPERVISOR: Access to assigned dam, telemetry, motor controls, logs, settings.
 * 3. GENERAL: General public access (no login credentials required). Access to public safety metrics only.
 */

import { db, ref, set, get, push, remove, onValue } from "./firebase.js";

export const ROLES = {
    SUPER_ADMIN: "SUPER_ADMIN",
    DAM_SUPERVISOR: "DAM_SUPERVISOR",
    GENERAL: "GENERAL"
};

export const TN_DAMS = [
    { id: "mettur", name: "Mettur Dam (Stanley Reservoir)", district: "Salem", capacity: "93.47 TMC", deviceId: "ESP32_RESERVOIR_01" },
    { id: "vaigai", name: "Vaigai Dam", district: "Theni", capacity: "6.09 TMC", deviceId: "ESP32_RESERVOIR_02" },
    { id: "bhavanisagar", name: "Bhavanisagar Dam", district: "Erode", capacity: "32.8 TMC", deviceId: "ESP32_RESERVOIR_03" },
    { id: "periyar", name: "Mullaperiyar Dam", district: "Theni", capacity: "15.5 TMC", deviceId: "ESP32_RESERVOIR_04" },
    { id: "pechiparai", name: "Pechiparai Dam", district: "Kanyakumari", capacity: "4.3 TMC", deviceId: "ESP32_RESERVOIR_05" },
    { id: "aliyar", name: "Aliyar Reservoir", district: "Coimbatore", capacity: "3.86 TMC", deviceId: "ESP32_RESERVOIR_06" },
    { id: "sathanur", name: "Sathanur Dam", district: "Tiruvannamalai", capacity: "7.3 TMC", deviceId: "ESP32_RESERVOIR_07" }
];

const DEFAULT_SUPERADMIN = {
    id: "admin_01",
    username: "superadmin",
    password: "admin123",
    name: "Chief Water Resource Engineer",
    role: ROLES.SUPER_ADMIN,
    assignedDam: "all",
    assignedDamName: "All Tamil Nadu Dams",
    contact: "+91 94440 12345"
};

const DEFAULT_SUPERVISORS = [
    {
        id: "sup_mettur",
        username: "sup_mettur",
        password: "supervisor123",
        name: "Er. K. Ramesh (Dam Supervisor)",
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: "mettur",
        assignedDamName: "Mettur Dam (Stanley Reservoir)",
        contact: "+91 94441 56789"
    },
    {
        id: "sup_vaigai",
        username: "sup_vaigai",
        password: "supervisor123",
        name: "Er. S. Murugan (Dam Supervisor)",
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: "vaigai",
        assignedDamName: "Vaigai Dam",
        contact: "+91 94442 98765"
    }
];

const AUTH_KEY = "neernilai_auth_user";
const SELECTED_DAM_KEY = "neernilai_selected_dam";

// Internal in-memory users cache
let usersCache = [DEFAULT_SUPERADMIN, ...DEFAULT_SUPERVISORS];
let authStateListeners = [];

/**
 * Initialize Auth system, load users from Firebase and seed default Super Admin if missing
 */
export async function initAuth() {
    try {
        const usersRef = ref(db, "users");
        const snap = await get(usersRef);
        if (snap.exists()) {
            const data = snap.val();
            usersCache = Object.values(data);
        } else {
            // Seed initial default Super Admin and Supervisors to Firebase
            const seedObj = {};
            [DEFAULT_SUPERADMIN, ...DEFAULT_SUPERVISORS].forEach((u) => {
                seedObj[u.id] = u;
            });
            await set(usersRef, seedObj);
            usersCache = [DEFAULT_SUPERADMIN, ...DEFAULT_SUPERVISORS];
        }

        // Realtime listener for user updates
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                usersCache = Object.values(snapshot.val());
                notifyListeners();
            }
        });
    } catch (err) {
        console.warn("Could not sync auth with Firebase Realtime DB, using local fallback users:", err);
    }

    // Default active dam check
    if (!getSelectedDam()) {
        setSelectedDam(TN_DAMS[0].id);
    }
}

/**
 * Get current active user from session
 */
export function getCurrentUser() {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
        return {
            username: "guest",
            name: "General Public",
            role: ROLES.GENERAL,
            assignedDam: "all",
            assignedDamName: "Public View"
        };
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {
            username: "guest",
            name: "General Public",
            role: ROLES.GENERAL,
            assignedDam: "all",
            assignedDamName: "Public View"
        };
    }
}

/**
 * Login with username and password
 */
export async function loginUser(username, password) {
    const trimmedUser = String(username || "").trim().toLowerCase();
    const user = usersCache.find(
        (u) => u.username.toLowerCase() === trimmedUser && u.password === password
    );

    if (user) {
        // Strip sensitive password before saving to session
        const sessionUser = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            assignedDam: user.assignedDam,
            assignedDamName: user.assignedDamName,
            contact: user.contact || ""
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(sessionUser));
        if (user.assignedDam && user.assignedDam !== "all") {
            setSelectedDam(user.assignedDam);
        }
        notifyListeners();
        return { success: true, user: sessionUser };
    } else {
        return { success: false, message: "Invalid username or password." };
    }
}

/**
 * Logout current user (switches to General public role)
 */
export function logoutUser() {
    localStorage.removeItem(AUTH_KEY);
    notifyListeners();
}

/**
 * Get active Tamil Nadu Dam selection
 */
export function getSelectedDam() {
    const damId = localStorage.getItem(SELECTED_DAM_KEY) || TN_DAMS[0].id;
    return TN_DAMS.find((d) => d.id === damId) || TN_DAMS[0];
}

/**
 * Set active Tamil Nadu Dam
 */
export function setSelectedDam(damId) {
    const dam = TN_DAMS.find((d) => d.id === damId);
    if (dam) {
        localStorage.setItem(SELECTED_DAM_KEY, dam.id);
        notifyListeners();
    }
}

/**
 * Add a new Dam Supervisor (Super Admin action)
 */
export async function addDamSupervisor({ username, password, name, assignedDamId, contact }) {
    const currentUser = getCurrentUser();
    if (currentUser.role !== ROLES.SUPER_ADMIN) {
        throw new Error("Only Super Admin can add Dam Supervisors.");
    }

    const existing = usersCache.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (existing) {
        throw new Error(`Username '${username}' already exists.`);
    }

    const dam = TN_DAMS.find((d) => d.id === assignedDamId) || TN_DAMS[0];
    const newId = "sup_" + Date.now();

    const newSupervisor = {
        id: newId,
        username: username.trim(),
        password: password,
        name: name.trim(),
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: dam.id,
        assignedDamName: dam.name,
        contact: contact ? contact.trim() : ""
    };

    try {
        await set(ref(db, `users/${newId}`), newSupervisor);
    } catch (e) {
        console.warn("Could not save to Firebase, updating local cache:", e);
    }

    usersCache.push(newSupervisor);
    notifyListeners();
    return newSupervisor;
}

/**
 * Delete / Revoke a Dam Supervisor (Super Admin action)
 */
export async function removeDamSupervisor(supervisorId) {
    const currentUser = getCurrentUser();
    if (currentUser.role !== ROLES.SUPER_ADMIN) {
        throw new Error("Only Super Admin can remove Dam Supervisors.");
    }

    try {
        await remove(ref(db, `users/${supervisorId}`));
    } catch (e) {
        console.warn("Could not delete from Firebase, updating local cache:", e);
    }

    usersCache = usersCache.filter((u) => u.id !== supervisorId);
    notifyListeners();
}

/**
 * List all registered Dam Supervisors
 */
export function getAllSupervisors() {
    return usersCache.filter((u) => u.role === ROLES.DAM_SUPERVISOR);
}

/**
 * Subscribe to Auth or Dam state changes
 */
export function onAuthChange(callback) {
    authStateListeners.push(callback);
    // Initial call
    callback(getCurrentUser(), getSelectedDam(), usersCache);
    return () => {
        authStateListeners = authStateListeners.filter((cb) => cb !== callback);
    };
}

function notifyListeners() {
    const user = getCurrentUser();
    const dam = getSelectedDam();
    authStateListeners.forEach((cb) => cb(user, dam, usersCache));
}
