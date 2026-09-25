/**
 * NeerNilai – Auth UI Module
 * Automatically renders header auth badges, Tamil Nadu dam selector,
 * Login Modal, and Super Admin Supervisor Management modal on every page.
 */

import {
    ROLES,
    TN_DAMS,
    getCurrentUser,
    loginUser,
    logoutUser,
    getSelectedDam,
    setSelectedDam,
    addDamSupervisor,
    removeDamSupervisor,
    getAllSupervisors,
    onAuthChange
} from "./auth.js";

/**
 * Inject Auth Header & Modals into document
 */
export function setupAuthUi() {
    renderHeaderAuthBar();
    injectModals();
    bindEvents();
    onAuthChange(updateUiState);
}

function renderHeaderAuthBar() {
    // Container is pre-rendered in HTML inside <nav> — just populate its contents
    const authContainer = document.getElementById("nnAuthHeaderContainer");
    if (!authContainer) return;

    authContainer.innerHTML = `
        <div class="dam-selector-wrap d-flex align-items-center gap-1">
            <i class="bi bi-geo-alt-fill text-teal small"></i>
            <select id="nnDamSelect" class="form-select form-select-sm dam-select" aria-label="Select Tamil Nadu Dam">
                ${TN_DAMS.map(
                    (d) => `<option value="${d.id}">${d.name} (${d.district})</option>`
                ).join("")}
            </select>
        </div>

        <div id="nnUserBadgeContainer" class="d-flex align-items-center gap-2">
            <!-- Dynamic Role Badge & Action Buttons rendered here -->
        </div>
    `;

    // Event listener for Dam Selection change
    const damSelect = document.getElementById("nnDamSelect");
    if (damSelect) {
        damSelect.value = getSelectedDam().id;
        damSelect.addEventListener("change", (e) => {
            setSelectedDam(e.target.value);
        });
    }
}

function updateUiState(user, activeDam, allSupervisors) {
    // 1. Update Dam Selector
    const damSelect = document.getElementById("nnDamSelect");
    if (damSelect && damSelect.value !== activeDam.id) {
        damSelect.value = activeDam.id;
    }

    // 2. Update Header User Badge & Action Buttons
    const badgeContainer = document.getElementById("nnUserBadgeContainer");
    if (badgeContainer) {
        if (user.role === ROLES.GENERAL) {
            badgeContainer.innerHTML = `
                <span class="user-role-badge role-general" title="Public View Access">
                    <i class="bi bi-people-fill"></i> General Public
                </span>
                <button type="button" class="btn btn-teal btn-sm btn-auth-action" id="btnHeaderLogin">
                    <i class="bi bi-shield-lock-fill"></i> Login
                </button>
            `;
        } else if (user.role === ROLES.DAM_SUPERVISOR) {
            badgeContainer.innerHTML = `
                <span class="user-role-badge role-supervisor" title="Dam Supervisor: ${user.assignedDamName}">
                    <i class="bi bi-person-badge-fill"></i> ${user.name} <small>(${user.assignedDamName})</small>
                </span>
                <button type="button" class="btn btn-navy btn-sm btn-auth-action" id="btnHeaderLogout">
                    <i class="bi bi-box-arrow-right"></i> Logout
                </button>
            `;
        } else if (user.role === ROLES.SUPER_ADMIN) {
            badgeContainer.innerHTML = `
                <span class="user-role-badge role-superadmin" title="Super Admin – Full Access">
                    <i class="bi bi-award-fill"></i> ${user.name} <small>(Super Admin)</small>
                </span>
                <button type="button" class="btn btn-amber btn-sm btn-auth-action" id="btnHeaderSupervisors">
                    <i class="bi bi-person-gear"></i> Manage Supervisors
                </button>
                <button type="button" class="btn btn-navy btn-sm btn-auth-action" id="btnHeaderLogout">
                    <i class="bi bi-box-arrow-right"></i> Logout
                </button>
            `;
        }

        // Bind header button actions
        document.getElementById("btnHeaderLogin")?.addEventListener("click", openLoginModal);
        document.getElementById("btnHeaderLogout")?.addEventListener("click", logoutUser);
        document.getElementById("btnHeaderSupervisors")?.addEventListener("click", openSupervisorsModal);
    }

    // 3. Enforce Page-Level Role Visibility
    enforcePagePermissions(user, activeDam);
}

function injectModals() {
    if (document.getElementById("nnLoginModal")) return;

    const modalWrap = document.createElement("div");
    modalWrap.innerHTML = `
        <!-- LOGIN MODAL -->
        <div class="modal fade" id="nnLoginModal" tabindex="-1" aria-labelledby="loginModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content glass-modal">
                    <div class="modal-header border-0 pb-0">
                        <div class="d-flex align-items-center gap-2">
                            <div class="brand-mark sm"><i class="bi bi-shield-lock-fill"></i></div>
                            <div>
                                <h5 class="modal-title font-title mb-0" id="loginModalLabel">NeerNilai Portal Access</h5>
                                <p class="text-muted small mb-0">Select role or enter credentials to sign in</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Quick Demo Pre-fills -->
                        <div class="demo-login-bar mb-3 p-2 border-slate rounded">
                            <p class="small text-muted mb-2 fw-semibold"><i class="bi bi-lightning-charge-fill text-amber"></i> Quick Demo Logins:</p>
                            <div class="d-flex flex-wrap gap-1">
                                <button type="button" class="btn btn-xs btn-demo" id="demoSuperAdmin">👑 Super Admin</button>
                                <button type="button" class="btn btn-xs btn-demo" id="demoMetturSupervisor">🛠️ Mettur Supervisor</button>
                                <button type="button" class="btn btn-xs btn-demo" id="demoVaigaiSupervisor">🛠️ Vaigai Supervisor</button>
                            </div>
                        </div>

                        <form id="loginForm">
                            <div class="mb-3">
                                <label class="form-label small text-muted">Username / Email</label>
                                <div class="input-group">
                                    <span class="input-group-text input-group-icon"><i class="bi bi-person"></i></span>
                                    <input type="text" class="form-control form-control-nn" id="loginUsername" required placeholder="Enter username (e.g. superadmin)">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small text-muted">Password</label>
                                <div class="input-group">
                                    <span class="input-group-text input-group-icon"><i class="bi bi-key"></i></span>
                                    <input type="password" class="form-control form-control-nn" id="loginPassword" required placeholder="Enter password">
                                </div>
                            </div>
                            <div id="loginErrorMsg" class="alert alert-danger py-2 small d-none"></div>
                            <button type="submit" class="btn btn-teal w-100 btn-nn mt-2">
                                <i class="bi bi-box-arrow-in-right me-1"></i> Sign In
                            </button>
                        </form>
                    </div>
                    <div class="modal-footer border-0 pt-0 text-center justify-content-center">
                        <span class="small text-muted">General public users do not require login. Close to browse public telemetry.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- SUPERVISOR MANAGEMENT MODAL (SUPER ADMIN ONLY) -->
        <div class="modal fade" id="nnSupervisorsModal" tabindex="-1" aria-labelledby="supervisorsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content glass-modal">
                    <div class="modal-header border-0">
                        <div class="d-flex align-items-center gap-2">
                            <div class="brand-mark sm bg-amber"><i class="bi bi-person-gear"></i></div>
                            <div>
                                <h5 class="modal-title font-title mb-0" id="supervisorsModalLabel">Tamil Nadu Dam Administrators</h5>
                                <p class="text-muted small mb-0">Super Admin Panel: Assign and manage credentials for reservoir supervisors</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Add Supervisor Form -->
                        <form id="addSupervisorForm" class="p-3 border-slate rounded mb-4">
                            <h6 class="text-teal mb-3 font-title"><i class="bi bi-person-plus-fill me-1"></i> Add New Dam Supervisor</h6>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <label class="form-label small text-muted">Supervisor Full Name</label>
                                    <input type="text" class="form-control form-control-nn" id="supFullName" required placeholder="e.g. Er. P. Sundaram">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small text-muted">Assign Tamil Nadu Dam</label>
                                    <select class="form-select form-control-nn" id="supDamId" required>
                                        ${TN_DAMS.map(
                                            (d) => `<option value="${d.id}">${d.name} (${d.district})</option>`
                                        ).join("")}
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small text-muted">Login Username</label>
                                    <input type="text" class="form-control form-control-nn" id="supUsername" required placeholder="e.g. sup_bhavani">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small text-muted">Login Password</label>
                                    <input type="password" class="form-control form-control-nn" id="supPassword" required placeholder="Set password">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small text-muted">Contact Phone</label>
                                    <input type="text" class="form-control form-control-nn" id="supContact" placeholder="+91 9444x xxxxx">
                                </div>
                            </div>
                            <div id="addSupMsg" class="alert py-2 small mt-2 d-none"></div>
                            <button type="submit" class="btn btn-teal btn-sm btn-nn mt-3">
                                <i class="bi bi-check-circle-fill me-1"></i> Create Supervisor Account
                            </button>
                        </form>

                        <!-- Existing Supervisors List -->
                        <h6 class="text-muted small text-uppercase mb-2"><i class="bi bi-list-ul me-1"></i> Registered Dam Administrators</h6>
                        <div class="table-responsive">
                            <table class="table table-nn table-striped align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Name / Contact</th>
                                        <th>Assigned Dam</th>
                                        <th>Username</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="supervisorsTableBody">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalWrap);
}

function bindEvents() {
    // Quick login buttons
    document.getElementById("demoSuperAdmin")?.addEventListener("click", () => {
        document.getElementById("loginUsername").value = "superadmin";
        document.getElementById("loginPassword").value = "admin123";
    });
    document.getElementById("demoMetturSupervisor")?.addEventListener("click", () => {
        document.getElementById("loginUsername").value = "sup_mettur";
        document.getElementById("loginPassword").value = "supervisor123";
    });
    document.getElementById("demoVaigaiSupervisor")?.addEventListener("click", () => {
        document.getElementById("loginUsername").value = "sup_vaigai";
        document.getElementById("loginPassword").value = "supervisor123";
    });

    // Login Form submission
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById("loginErrorMsg");
            errorEl.classList.add("d-none");

            const u = document.getElementById("loginUsername").value;
            const p = document.getElementById("loginPassword").value;

            const res = await loginUser(u, p);
            if (res.success) {
                const modalEl = document.getElementById("nnLoginModal");
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                loginForm.reset();
            } else {
                errorEl.textContent = res.message;
                errorEl.classList.remove("d-none");
            }
        });
    }

    // Add Supervisor Form submission
    const addSupForm = document.getElementById("addSupervisorForm");
    if (addSupForm) {
        addSupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById("addSupMsg");
            msgEl.className = "alert py-2 small mt-2 d-none";

            try {
                await addDamSupervisor({
                    name: document.getElementById("supFullName").value,
                    assignedDamId: document.getElementById("supDamId").value,
                    username: document.getElementById("supUsername").value,
                    password: document.getElementById("supPassword").value,
                    contact: document.getElementById("supContact").value
                });
                msgEl.textContent = "Supervisor added successfully!";
                msgEl.className = "alert alert-success py-2 small mt-2";
                addSupForm.reset();
                renderSupervisorsTable();
            } catch (err) {
                msgEl.textContent = err.message || "Failed to add supervisor.";
                msgEl.className = "alert alert-danger py-2 small mt-2";
            }
        });
    }
}

export function openLoginModal() {
    const modalEl = document.getElementById("nnLoginModal");
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

export function openSupervisorsModal() {
    renderSupervisorsTable();
    const modalEl = document.getElementById("nnSupervisorsModal");
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function renderSupervisorsTable() {
    const tbody = document.getElementById("supervisorsTableBody");
    if (!tbody) return;

    const sups = getAllSupervisors();
    if (!sups.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No dam supervisors added yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = sups
        .map(
            (s) => `
        <tr>
            <td>
                <strong>${s.name}</strong>
                <div class="small text-muted">${s.contact || "No phone listed"}</div>
            </td>
            <td><span class="badge bg-navy border border-teal text-teal">${s.assignedDamName}</span></td>
            <td><code>${s.username}</code></td>
            <td>
                <button type="button" class="btn btn-outline-danger btn-xs btn-remove-sup" data-id="${s.id}">
                    <i class="bi bi-trash"></i> Revoke
                </button>
            </td>
        </tr>
    `
        )
        .join("");

    // Bind remove button actions
    tbody.querySelectorAll(".btn-remove-sup").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            if (confirm("Are you sure you want to revoke access for this Dam Supervisor?")) {
                await removeDamSupervisor(id);
                renderSupervisorsTable();
            }
        });
    });
}

/**
 * Enforce role-based element restrictions on admin.html and simulator.html pages
 */
function enforcePagePermissions(user, activeDam) {
    const pageName = window.location.pathname.split("/").pop() || "index.html";

    // 1. Admin Control Page Access Control
    if (pageName === "admin.html") {
        const adminPanelContent = document.getElementById("adminPanelContent");
        const adminRestrictedView = document.getElementById("adminRestrictedView");
        const controlButtons = document.querySelectorAll("#pumpOn, #pumpOff, #solenoidOpen, #solenoidClose, #gateOpenFull, #gateStop, #gateCloseFull, #gateStepOpen, #gateStepClose");
        const scopeInfo = document.getElementById("supervisorScopeInfo");

        if (user.role === ROLES.GENERAL) {
            // General Public: Completely hide sensitive controls & command log panel
            if (adminPanelContent) adminPanelContent.classList.add("d-none");
            if (adminRestrictedView) adminRestrictedView.classList.remove("d-none");
        } else {
            // Authorized User (Super Admin or Dam Supervisor)
            if (adminPanelContent) adminPanelContent.classList.remove("d-none");
            if (adminRestrictedView) adminRestrictedView.classList.add("d-none");

            if (user.role === ROLES.SUPER_ADMIN) {
                // Super Admin: Unrestricted control over all dams
                controlButtons.forEach((b) => (b.disabled = false));
                if (scopeInfo) {
                    scopeInfo.innerHTML = `<span class="badge bg-amber text-dark"><i class="bi bi-award-fill me-1"></i> Master Authority: Super Admin Control (${activeDam.name})</span>`;
                    scopeInfo.classList.remove("d-none");
                }
            } else if (user.role === ROLES.DAM_SUPERVISOR) {
                const isAssignedDam = user.assignedDam === activeDam.id;
                controlButtons.forEach((b) => (b.disabled = !isAssignedDam));
                if (scopeInfo) {
                    if (isAssignedDam) {
                        scopeInfo.innerHTML = `<span class="badge bg-navy border border-teal text-teal"><i class="bi bi-person-badge-fill me-1"></i> Active Supervisor Control: ${user.assignedDamName}</span>`;
                    } else {
                        scopeInfo.innerHTML = `<span class="badge bg-warning text-dark"><i class="bi bi-eye-fill me-1"></i> Read-Only View: You are Supervisor for ${user.assignedDamName}. Switch dam selector to control your assigned dam.</span>`;
                    }
                    scopeInfo.classList.remove("d-none");
                }
            }
        }
    }

    // 2. Simulator Page Access Control
    if (pageName === "simulator.html") {
        const simButtons = document.querySelectorAll("#startSim, #stopSim, #simInterval");
        const simBanner = document.getElementById("nnSimRestrictionBanner");

        if (user.role === ROLES.GENERAL) {
            simButtons.forEach((b) => (b.disabled = true));
            if (!simBanner) {
                const mainContainer = document.querySelector("main.container");
                if (mainContainer) {
                    const banner = document.createElement("div");
                    banner.id = "nnSimRestrictionBanner";
                    banner.className = "alert alert-warning d-flex align-items-center justify-content-between p-3 mb-3 border-amber rounded-3";
                    banner.innerHTML = `
                        <div class="d-flex align-items-center gap-3">
                            <i class="bi bi-shield-lock-fill fs-3 text-amber"></i>
                            <div>
                                <strong>Read-Only Mode for General Public</strong>
                                <p class="mb-0 small">Hardware physics simulation and telemetry state modification require Dam Supervisor or Super Admin credentials.</p>
                            </div>
                        </div>
                        <button class="btn btn-teal btn-sm" onclick="document.getElementById('btnHeaderLogin').click()">Sign In</button>
                    `;
                    mainContainer.prepend(banner);
                }
            } else {
                simBanner.classList.remove("d-none");
            }
        } else {
            simButtons.forEach((b) => (b.disabled = false));
            if (simBanner) simBanner.classList.add("d-none");
        }
    }
}
