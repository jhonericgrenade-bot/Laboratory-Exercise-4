const SUPABASE_URL = "https://kyuxekqiyqavdcgoinkd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_D7nO1QjTPLFo8pCUXUaUvg_oQ8YASPA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  profile: null,
  facilities: [],
  reservations: [],
  serviceRequests: [],
  users: [],
  auditLogs: []
};

const authPanel = document.querySelector("#authPanel");
const appLayout = document.querySelector(".layout");
const roleBadge = document.querySelector("#roleBadge");
const logoutBtn = document.querySelector("#logoutBtn");
const toast = document.querySelector("#toast");
const authTitle = document.querySelector("#authTitle");
const authHint = document.querySelector("#authHint");
const loginBtn = document.querySelector("#loginBtn");
const signupBtn = document.querySelector("#signupBtn");
const toggleAuthBtn = document.querySelector("#toggleAuthBtn");
let authMode = "login";

function authFields() {
  return {
    fullName: document.querySelector("#authName").value.trim(),
    email: document.querySelector("#authEmail").value.trim(),
    password: document.querySelector("#authPassword").value,
    role: document.querySelector("#authRole").value
  };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function showError(error) {
  if (!error) return;
  const message = error.message || String(error);
  if (message.toLowerCase().includes("rate limit")) {
    showToast("Supabase email limit reached. Use Login only, or disable Confirm email in Supabase.");
    return;
  }
  showToast(message);
}

function setAuthLoading(isLoading) {
  loginBtn.disabled = isLoading;
  signupBtn.disabled = isLoading;
  toggleAuthBtn.disabled = isLoading;
  loginBtn.textContent = isLoading && authMode === "login" ? "Logging in..." : "Login";
  signupBtn.textContent = isLoading && authMode === "signup" ? "Creating..." : "Create Account";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  authTitle.textContent = isSignup ? "Create Account" : "Login";
  authHint.textContent = isSignup
    ? "Create only once. If Supabase rate limits email, create users in the dashboard instead."
    : "Use an existing account from Supabase Authentication.";
  document.querySelectorAll(".signup-only").forEach((item) => item.classList.toggle("hidden", !isSignup));
  loginBtn.classList.toggle("hidden", isSignup);
  signupBtn.classList.toggle("hidden", !isSignup);
  toggleAuthBtn.textContent = isSignup ? "Back to login" : "Need account?";
}

function currentUser() {
  return {
    id: state.session?.user?.id,
    name: state.profile?.full_name || state.session?.user?.email || "User",
    role: state.profile?.role || "requester"
  };
}

function hasRole(...roles) {
  return roles.includes(currentUser().role);
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function loadSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return showError(error);
  state.session = data.session;
  await loadData();
}

async function loadData() {
  if (!state.session) {
    authPanel.classList.remove("hidden");
    appLayout.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    roleBadge.textContent = "Not signed in";
    return;
  }

  authPanel.classList.add("hidden");
  appLayout.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  const profile = await loadOrCreateProfile();
  if (!profile) return;

  state.profile = profile;
  roleBadge.textContent = `${profile.full_name} - ${profile.role}`;

  await Promise.all([loadFacilities(), loadReservations(), loadServiceRequests(), loadUsers(), loadAuditLogs()]);
  render();
}

async function loadOrCreateProfile() {
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.session.user.id)
    .maybeSingle();

  if (error) {
    showError(error);
    return null;
  }

  if (profile) return profile;

  const metadata = state.session.user.user_metadata || {};
  const fallbackName = metadata.full_name || state.session.user.email.split("@")[0];
  const fallbackRole = metadata.role || "requester";

  const { data: createdProfile, error: createError } = await supabaseClient
    .from("profiles")
    .insert({
      id: state.session.user.id,
      full_name: fallbackName,
      role: fallbackRole
    })
    .select("*")
    .single();

  if (createError) {
    showError(createError);
    return null;
  }

  return createdProfile;
}

async function loadFacilities() {
  const { data, error } = await supabaseClient.from("facilities").select("*").order("name");
  if (error) return showError(error);
  state.facilities = data || [];
}

async function loadReservations() {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("*, facilities(name), profiles(full_name)")
    .order("created_at", { ascending: false });
  if (error) return showError(error);
  state.reservations = data || [];
}

async function loadServiceRequests() {
  if (!hasRole("admin", "staff")) {
    state.serviceRequests = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("service_requests")
    .select("*, facilities(name), profiles(full_name)")
    .order("created_at", { ascending: false });
  if (error) return showError(error);
  state.serviceRequests = data || [];
}

async function loadUsers() {
  if (!hasRole("admin")) {
    state.users = [];
    return;
  }
  const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return showError(error);
  state.users = data || [];
}

async function loadAuditLogs() {
  if (!hasRole("admin")) {
    state.auditLogs = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("audit_logs")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return showError(error);
  state.auditLogs = data || [];
}

async function signUp() {
  const { fullName, email, password, role } = authFields();

  if (!fullName) {
    showToast("Enter full name before signing up.");
    return;
  }

  setAuthLoading(true);
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } }
  });
  setAuthLoading(false);

  if (error) return showError(error);

  if (data.session) {
    state.session = data.session;
    await loadData();
    showToast("Account created and logged in.");
    return;
  }

  showToast("Account created. Check email confirmation if Supabase requires it, then login.");
}

async function login() {
  const { email, password } = authFields();

  if (!email || !password) {
    showToast("Enter email and password.");
    return;
  }

  setAuthLoading(true);
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setAuthLoading(false);
  if (error) return showError(error);
  state.session = data.session;
  await loadData();
  showToast("Logged in.");
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.session = null;
  state.profile = null;
  await loadData();
}

async function submitReservation(data) {
  const { error } = await supabaseClient.from("reservations").insert({
    facility_id: data.facilityId,
    requester_id: currentUser().id,
    start_time: data.start,
    end_time: data.end,
    purpose: data.purpose,
    status: "Pending"
  });

  if (error) return showError(error);
  await loadData();
  showToast("Reservation saved as Pending.");
}

async function setReservationStatus(id, status) {
  const nextStatus = status === "Approved" ? "Scheduled" : status;
  const { error } = await supabaseClient.from("reservations").update({ status: nextStatus }).eq("id", id);
  if (error) return showError(error);
  await loadData();
  showToast(`Reservation is now ${nextStatus}.`);
}

async function cancelReservation(id) {
  const { error } = await supabaseClient.from("reservations").update({ status: "Cancelled" }).eq("id", id);
  if (error) return showError(error);
  await loadData();
  showToast("Reservation cancelled.");
}

async function addFacility(data) {
  const { error } = await supabaseClient.from("facilities").insert(data);
  if (error) return showError(error);
  await loadData();
  showToast("Facility added.");
}

async function updateFacilityStatus(id, status) {
  const { error } = await supabaseClient.from("facilities").update({ status }).eq("id", id);
  if (error) return showError(error);
  await loadData();
  showToast(`Facility is now ${status}.`);
}

async function addServiceRequest(data) {
  const { error } = await supabaseClient.from("service_requests").insert({
    facility_id: data.facilityId,
    staff_id: currentUser().id,
    concern: data.concern,
    status: "Open"
  });

  if (error) return showError(error);
  await loadData();
  showToast("Service request created.");
}

function renderFacilities() {
  const list = document.querySelector("#facilityList");
  list.innerHTML = state.facilities
    .map((facility) => {
      const actions = hasRole("admin", "staff")
        ? `<div class="actions">
            <button class="secondary" onclick="updateFacilityStatus('${facility.id}', 'Active')">Active</button>
            <button class="secondary" onclick="updateFacilityStatus('${facility.id}', 'Maintenance')">Maintenance</button>
            <button class="secondary" onclick="updateFacilityStatus('${facility.id}', 'Inactive')">Inactive</button>
          </div>`
        : "";

      return `<article class="card">
        <h3>${facility.name}</h3>
        <p class="muted">${facility.location}</p>
        <p><span class="badge ${facility.status}">${facility.status}</span></p>
        <p>Condition: ${facility.condition}</p>
        ${actions}
      </article>`;
    })
    .join("");
}

function renderReservations() {
  const rows = state.reservations
    .map((reservation) => {
      const adminActions = hasRole("admin") && reservation.status === "Pending"
        ? `<button onclick="setReservationStatus('${reservation.id}', 'Approved')">Approve</button>
           <button class="danger" onclick="setReservationStatus('${reservation.id}', 'Rejected')">Reject</button>`
        : "";
      const staffActions = hasRole("staff") && reservation.status === "Scheduled"
        ? `<button onclick="setReservationStatus('${reservation.id}', 'In Use')">In Use</button>`
        : "";
      const completeAction = hasRole("staff") && reservation.status === "In Use"
        ? `<button onclick="setReservationStatus('${reservation.id}', 'Completed')">Complete</button>`
        : "";
      const cancelAction = currentUser().role === "requester" && reservation.requester_id === currentUser().id && reservation.status === "Pending"
        ? `<button class="secondary" onclick="cancelReservation('${reservation.id}')">Cancel</button>`
        : "";

      return `<tr>
        <td>${reservation.facilities?.name || "Unknown"}</td>
        <td>${reservation.profiles?.full_name || "Requester"}</td>
        <td>${formatDate(reservation.start_time)}<br>${formatDate(reservation.end_time)}</td>
        <td>${reservation.purpose}</td>
        <td><span class="badge ${reservation.status.replaceAll(" ", ".")}">${reservation.status}</span></td>
        <td class="actions">${adminActions}${staffActions}${completeAction}${cancelAction}</td>
      </tr>`;
    })
    .join("");

  document.querySelector("#reservationList").innerHTML = `<table>
    <thead><tr><th>Facility</th><th>Requester</th><th>Schedule</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">No reservations yet.</td></tr>`}</tbody>
  </table>`;
}

function renderServices() {
  const rows = state.serviceRequests
    .map((item) => `<tr>
      <td>${item.facilities?.name || "Unknown"}</td>
      <td>${item.concern}</td>
      <td>${item.profiles?.full_name || "Staff"}</td>
      <td>${item.status}</td>
      <td>${formatDate(item.created_at)}</td>
    </tr>`)
    .join("");

  document.querySelector("#serviceList").innerHTML = `<table>
    <thead><tr><th>Facility</th><th>Concern</th><th>Staff</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5">No service requests yet.</td></tr>`}</tbody>
  </table>`;
}

function renderUsers() {
  const rows = state.users
    .map((user) => `<tr><td>${user.full_name}</td><td>${user.role}</td><td>${user.status}</td></tr>`)
    .join("");
  document.querySelector("#userList").innerHTML = `<table>
    <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3">No users visible.</td></tr>`}</tbody>
  </table>`;
}

function renderAudit() {
  const rows = state.auditLogs
    .map((logItem) => `<tr>
      <td>${formatDate(logItem.created_at)}</td>
      <td>${logItem.profiles?.full_name || "System"}</td>
      <td>${logItem.action}</td>
      <td>${logItem.table_name}</td>
      <td>${logItem.record_id || ""}</td>
    </tr>`)
    .join("");
  document.querySelector("#auditList").innerHTML = `<table>
    <thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Table</th><th>Record</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5">No audit logs yet.</td></tr>`}</tbody>
  </table>`;
}

function renderRoleVisibility() {
  const role = currentUser().role;
  document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("hidden", role !== "admin"));
  document.querySelectorAll(".staff-only").forEach((item) => item.classList.toggle("hidden", role !== "staff"));
  document.querySelectorAll(".requester-only").forEach((item) => item.classList.toggle("hidden", role !== "requester"));

  const activeProtected = document.querySelector(".view.active.protected");
  if (activeProtected && role !== "admin") {
    document.querySelector(`[data-view="facilities"]`).click();
    showToast("Access denied. Administrator only.");
  }
}

function renderFacilityOptions() {
  const options = state.facilities
    .map((facility) => `<option value="${facility.id}">${facility.name} - ${facility.status}</option>`)
    .join("");
  document.querySelector("#reservationFacility").innerHTML = options;
  document.querySelector("#serviceFacility").innerHTML = options;
}

function render() {
  renderRoleVisibility();
  renderFacilityOptions();
  renderFacilities();
  renderReservations();
  renderServices();
  renderUsers();
  renderAudit();
}

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", async () => {
    if ((button.dataset.view === "audit" || button.dataset.view === "users") && !hasRole("admin")) {
      showToast("Access denied. Administrator only.");
      return;
    }
    document.querySelectorAll(".nav").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}`).classList.add("active");
    await loadData();
  });
});

document.querySelector("#openReservationBtn").addEventListener("click", () => document.querySelector("#reservationDialog").showModal());
document.querySelector("#addFacilityBtn").addEventListener("click", () => document.querySelector("#facilityDialog").showModal());
document.querySelector("#openServiceBtn").addEventListener("click", () => document.querySelector("#serviceDialog").showModal());
document.querySelectorAll(".closeDialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
signupBtn.addEventListener("click", signUp);
loginBtn.addEventListener("click", login);
toggleAuthBtn.addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));
document.querySelector("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authMode === "signup") {
    await signUp();
  } else {
    await login();
  }
});
logoutBtn.addEventListener("click", logout);

document.querySelector("#reservationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitReservation({
    facilityId: document.querySelector("#reservationFacility").value,
    start: document.querySelector("#reservationStart").value,
    end: document.querySelector("#reservationEnd").value,
    purpose: document.querySelector("#reservationPurpose").value
  });
  event.target.reset();
  document.querySelector("#reservationDialog").close();
});

document.querySelector("#facilityForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addFacility({
    name: document.querySelector("#facilityName").value,
    location: document.querySelector("#facilityLocation").value,
    status: document.querySelector("#facilityStatus").value,
    condition: document.querySelector("#facilityCondition").value
  });
  event.target.reset();
  document.querySelector("#facilityDialog").close();
});

document.querySelector("#serviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addServiceRequest({
    facilityId: document.querySelector("#serviceFacility").value,
    concern: document.querySelector("#serviceConcern").value
  });
  event.target.reset();
  document.querySelector("#serviceDialog").close();
});

setAuthMode("login");
loadSession();
