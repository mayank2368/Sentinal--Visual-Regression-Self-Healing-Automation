// Tiny client-rendered app. Reads URL params to switch variants:
//   ui=v2   -> adds a `v2` class to <body> (visual change only)
//   dom=v2  -> renders the SAME controls with CHANGED attributes/selectors
//              (same text, role, placement) to exercise self-healing.
const params = new URLSearchParams(location.search);
const uiV2 = params.get("ui") === "v2";
const domV2 = params.get("dom") === "v2";
const app = document.getElementById("app");
if (uiV2) document.body.classList.add("v2");

// Attribute sets for the login controls. v1 is the "known-good" set the tests
// first learn; domV2 is the "someone refactored the markup" set.
const attrs = domV2
  ? {
      user: { "data-test": "user-field", id: "user_1", class: "field" },
      pass: { "data-test": "pass-field", id: "pass_1", class: "field" },
      // selector changed AND the button is wrapped, but text/role/type are stable
      button: { "data-test": "auth-submit", id: "btnPrimary", class: "btn-primary" },
    }
  : {
      user: { "data-test": "username", id: "username", class: "field" },
      pass: { "data-test": "password", id: "password", class: "field" },
      button: { "data-test": "login-btn", id: "login", class: "btn-primary" },
    };

function attrString(map) {
  return Object.entries(map)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

function renderLogin(errorText = "") {
  app.innerHTML = `
    <section class="card login" data-test="login-card">
      <h1>Sentinel Shop</h1>
      <p class="muted">Sign in to your account</p>
      <form id="login-form">
        <label for="${attrs.user.id}">Username</label>
        <input ${attrString(attrs.user)} name="username" type="text" placeholder="Username" aria-label="Username" autocomplete="username" />
        <label for="${attrs.pass.id}">Password</label>
        <input ${attrString(attrs.pass)} name="password" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password" />
        <button ${attrString(attrs.button)} type="submit">Sign in</button>
        <p class="error" data-test="login-error">${errorText}</p>
      </form>
    </section>`;

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = app.querySelector('input[name="username"]').value.trim();
    const p = app.querySelector('input[name="password"]').value.trim();
    if (u && p) renderDashboard();
    else renderLogin("Enter a username and password");
  });
}

function renderDashboard() {
  app.innerHTML = `
    <header class="topbar" data-test="topbar">
      <div class="brand">Sentinel Shop</div>
      <button class="logout" data-test="logout" type="button">Log out</button>
    </header>
    <section class="stats" data-test="stats">
      <div class="stat"><div class="label">Orders</div><div class="value" data-test="stat-orders">128</div></div>
      <div class="stat"><div class="label">Revenue</div><div class="value" data-test="stat-revenue">€9,540</div></div>
      <div class="stat"><div class="label">Returns</div><div class="value" data-test="stat-returns">3</div></div>
    </section>`;
  document.querySelector('[data-test="logout"]').addEventListener("click", () => renderLogin());
}

renderLogin();
