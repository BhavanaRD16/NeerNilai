/**
 * NeerNilai – Role-Based Authentication & Tamil Nadu Dam Supervisor Management
 * 
 * Roles:
 * 1. SUPER_ADMIN:     Full access, can manage Dam Supervisors, full controls on all dams.
 * 2. DAM_SUPERVISOR:  Access to assigned dam, telemetry, motor controls, logs, settings.
 * 3. GENERAL:         Public access (no credentials required). Safety metrics only.
 * 
 * v2: Passwords are stored as SHA-256(salt + password). Migration of plaintext on first load.
 */

import { db, ref, set, get, push, remove, onValue, GLOBAL } from "./firebase.js";

export const ROLES = {
    SUPER_ADMIN: "SUPER_ADMIN",
    DAM_SUPERVISOR: "DAM_SUPERVISOR",
    GENERAL: "GENERAL"
};

export const TN_DAMS = [
    { id: "mettur",       name: "Mettur Dam (Stanley Reservoir)", district: "Salem",           capacity: "93.47 TMC", deviceId: "ESP32_RESERVOIR_01" },
    { id: "vaigai",       name: "Vaigai Dam",                     district: "Theni",           capacity: "6.09 TMC",  deviceId: "ESP32_RESERVOIR_02" },
    { id: "bhavanisagar", name: "Bhavanisagar Dam",               district: "Erode",           capacity: "32.8 TMC",  deviceId: "ESP32_RESERVOIR_03" },
    { id: "periyar",      name: "Mullaperiyar Dam",               district: "Theni",           capacity: "15.5 TMC",  deviceId: "ESP32_RESERVOIR_04" },
    { id: "pechiparai",   name: "Pechiparai Dam",                 district: "Kanyakumari",     capacity: "4.3 TMC",   deviceId: "ESP32_RESERVOIR_05" },
    { id: "aliyar",       name: "Aliyar Reservoir",               district: "Coimbatore",      capacity: "3.86 TMC",  deviceId: "ESP32_RESERVOIR_06" },
    { id: "sathanur",     name: "Sathanur Dam",                   district: "Tiruvannamalai",  capacity: "7.3 TMC",   deviceId: "ESP32_RESERVOIR_07" }
];

/* ------------------------------------------------------------------ */
/*  SHA-256 Hashing with Web Crypto                                   */
/* ------------------------------------------------------------------ */

function generateSalt(len = 16) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
    return sha256(salt + password);
}

async function verifyPassword(password, salt, storedHash) {
    const computed = await hashPassword(password, salt);
    return computed === storedHash;
}

/* ------------------------------------------------------------------ */
/*  Default Users (seeded on first load)                              */
/* ------------------------------------------------------------------ */

const DEFAULT_USERS_PLAINTEXT = [
    {
        id: "admin_01",
        username: "superadmin",
        _plainPassword: "admin123",
        name: "Chief Water Resource Engineer",
        role: ROLES.SUPER_ADMIN,
        assignedDam: "all",
        assignedDamName: "All Tamil Nadu Dams",
        contact: "+91 94440 12345"
    },
    {
        id: "sup_mettur",
        username: "sup_mettur",
        _plainPassword: "supervisor123",
        name: "Er. K. Ramesh (Dam Supervisor)",
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: "mettur",
        assignedDamName: "Mettur Dam (Stanley Reservoir)",
        contact: "+91 94441 56789"
    },
    {
        id: "sup_vaigai",
        username: "sup_vaigai",
        _plainPassword: "supervisor123",
        name: "Er. S. Murugan (Dam Supervisor)",
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: "vaigai",
        assignedDamName: "Vaigai Dam",
        contact: "+91 94442 98765"
    }
];

/**
 * Prepare default users with hashed passwords for seeding.
 */
async function prepareHashedUsers() {
    const users = [];
    for (const u of DEFAULT_USERS_PLAINTEXT) {
        const salt = generateSalt();
        const passwordHash = await hashPassword(u._plainPassword, salt);
        users.push({
            id: u.id,
            username: u.username,
            passwordHash,
            salt,
            name: u.name,
            role: u.role,
            assignedDam: u.assignedDam,
            assignedDamName: u.assignedDamName,
            contact: u.contact
        });
    }
    return users;
}

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

const AUTH_KEY = "neernilai_auth_user";
const SELECTED_DAM_KEY = "neernilai_selected_dam";

let usersCache = [];
let authStateListeners = [];

/* ------------------------------------------------------------------ */
/*  Initialization                                                    */
/* ------------------------------------------------------------------ */

/**
 * Initialize Auth system, load users from Firebase and seed defaults if missing.
 * Handles migration from plaintext to hashed passwords.
 */
export async function initAuth() {
    try {
        const usersRef = ref(db, GLOBAL.users);
        // Timeout guard so offline or slow Firebase response doesn't block DOM rendering
        const snap = await Promise.race([
            get(usersRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Auth fetch timeout")), 2500))
        ]);

        if (snap.exists()) {
            const data = snap.val();
            usersCache = Object.values(data);

            // Check if any user still has plaintext password (migration needed)
            const needsMigration = usersCache.some((u) => u.password && !u.passwordHash);
            if (needsMigration) {
                await migrateToHashedPasswords(usersCache);
                // Re-read after migration
                const freshSnap = await get(usersRef);
                if (freshSnap.exists()) {
                    usersCache = Object.values(freshSnap.val());
                }
            }
        } else {
            // Seed initial users with hashed passwords
            const hashedUsers = await prepareHashedUsers();
            const seedObj = {};
            hashedUsers.forEach((u) => { seedObj[u.id] = u; });
            await set(usersRef, seedObj);
            usersCache = hashedUsers;
        }

        // Realtime listener for user updates
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                usersCache = Object.values(snapshot.val());
                notifyListeners();
            }
        });
    } catch (err) {
        console.warn("Could not sync auth with Firebase Realtime DB, using local fallback:", err);
        // Use in-memory defaults so the app still works offline
        usersCache = await prepareHashedUsers();
    }

    // Default active dam check
    if (!getSelectedDam()) {
        setSelectedDam(TN_DAMS[0].id);
    }
}

/**
 * Migrate plaintext passwords to SHA-256 hashed.
 */
async function migrateToHashedPasswords(users) {
    console.log("[NeerNilai Auth] Migrating plaintext passwords to SHA-256…");
    for (const u of users) {
        if (u.password && !u.passwordHash) {
            const salt = generateSalt();
            const passwordHash = await hashPassword(u.password, salt);
            const updates = {
                passwordHash,
                salt,
                password: null   // Remove plaintext
            };
            try {
                const userRef = ref(db, `${GLOBAL.users}/${u.id}`);
                const snap = await get(userRef);
                if (snap.exists()) {
                    const existing = snap.val();
                    delete existing.password;
                    existing.passwordHash = passwordHash;
                    existing.salt = salt;
                    await set(userRef, existing);
                }
            } catch (err) {
                console.warn(`Failed to migrate user ${u.username}:`, err);
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Session Management                                                */
/* ------------------------------------------------------------------ */

/**
 * Get current active user from session (localStorage).
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
    } catch {
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
 * Login with username and password.
 * Verifies against SHA-256 hash + salt.
 */
export async function loginUser(username, password) {
    const trimmedUser = String(username || "").trim().toLowerCase();
    const user = usersCache.find(
        (u) => u.username.toLowerCase() === trimmedUser
    );

    if (!user) {
        return { success: false, message: "Invalid username or password." };
    }

    // Verify password hash
    let passwordValid = false;
    if (user.passwordHash && user.salt) {
        passwordValid = await verifyPassword(password, user.salt, user.passwordHash);
    } else if (user.password) {
        // Legacy plaintext fallback (should not happen after migration)
        passwordValid = user.password === password;
    }

    if (passwordValid) {
        // Store session (no sensitive data)
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
 * Logout current user (switches to General public role).
 */
export function logoutUser() {
    localStorage.removeItem(AUTH_KEY);
    notifyListeners();
}

/* ------------------------------------------------------------------ */
/*  Dam Selection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Get active Tamil Nadu Dam selection.
 */
export function getSelectedDam() {
    const damId = localStorage.getItem(SELECTED_DAM_KEY) || TN_DAMS[0].id;
    return TN_DAMS.find((d) => d.id === damId) || TN_DAMS[0];
}

/**
 * Set active Tamil Nadu Dam.
 */
export function setSelectedDam(damId) {
    const dam = TN_DAMS.find((d) => d.id === damId);
    if (dam) {
        localStorage.setItem(SELECTED_DAM_KEY, dam.id);
        notifyListeners();
    }
}

/* ------------------------------------------------------------------ */
/*  Supervisor Management (Super Admin)                               */
/* ------------------------------------------------------------------ */

/**
 * Add a new Dam Supervisor (Super Admin action).
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
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const newSupervisor = {
        id: newId,
        username: username.trim(),
        passwordHash,
        salt,
        name: name.trim(),
        role: ROLES.DAM_SUPERVISOR,
        assignedDam: dam.id,
        assignedDamName: dam.name,
        contact: contact ? contact.trim() : ""
    };

    try {
        await set(ref(db, `${GLOBAL.users}/${newId}`), newSupervisor);
    } catch (e) {
        console.warn("Could not save to Firebase, updating local cache:", e);
    }

    usersCache.push(newSupervisor);
    notifyListeners();
    return newSupervisor;
}

/**
 * Delete / Revoke a Dam Supervisor (Super Admin action).
 */
export async function removeDamSupervisor(supervisorId) {
    const currentUser = getCurrentUser();
    if (currentUser.role !== ROLES.SUPER_ADMIN) {
        throw new Error("Only Super Admin can remove Dam Supervisors.");
    }

    try {
        await remove(ref(db, `${GLOBAL.users}/${supervisorId}`));
    } catch (e) {
        console.warn("Could not delete from Firebase, updating local cache:", e);
    }

    usersCache = usersCache.filter((u) => u.id !== supervisorId);
    notifyListeners();
}

/**
 * List all registered Dam Supervisors.
 */
export function getAllSupervisors() {
    return usersCache.filter((u) => u.role === ROLES.DAM_SUPERVISOR);
}

/* ------------------------------------------------------------------ */
/*  Auth State Listeners                                              */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to Auth or Dam state changes.
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
