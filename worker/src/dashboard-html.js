/**
 * Dashboard — self-contained HTML page served by the Worker at "/".
 *
 * Mobile-first responsive design with dark mode support.
 * Shows the authenticated user's photos and sites.
 * Admins see an "Admin" link to /admin.
 */

export function getDashboardHtml(origin) {
  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Dokumentasjon — Dashbord</title>
  <style>
    /* ---- Reset & base ---- */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f5f7;
      color: #333;
      line-height: 1.6;
      min-height: 100vh;
    }

    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a1a; color: #e0e0e0; }
    }

    /* ---- Layout ---- */
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
    }

    header {
      padding: 16px 0 12px;
      border-bottom: 1px solid #ddd;
      margin-bottom: 24px;
    }

    @media (prefers-color-scheme: dark) {
      header { border-bottom-color: #444; }
    }

    header h1 { font-size: 1.5rem; font-weight: 700; }

    header p {
      font-size: 0.85rem;
      color: #888;
      margin-top: 4px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
    }

    .user-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .user-name {
      font-size: 0.85rem;
      color: #555;
    }

    @media (prefers-color-scheme: dark) {
      .user-name { color: #aaa; }
    }

    /* ---- Buttons ---- */
    .btn {
      -webkit-appearance: none;
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      font-size: 0.95rem;
      font-family: inherit;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 0.15s;
      text-decoration: none;
    }

    .btn-primary { color: #fff; background-color: #007aff; }
    .btn-primary:hover { background-color: #0063d1; }

    .btn-secondary {
      color: #333;
      background-color: #e8e8e8;
      border: 1px solid #ccc;
    }
    .btn-secondary:hover { background-color: #ddd; }

    @media (prefers-color-scheme: dark) {
      .btn-secondary { background-color: #333; color: #e0e0e0; border-color: #555; }
      .btn-secondary:hover { background-color: #444; }
    }

    .btn-sm { padding: 5px 12px; font-size: 0.85rem; }

    .btn-admin {
      color: #fff;
      background-color: #5856d6;
      padding: 5px 14px;
      font-size: 0.85rem;
      border-radius: 6px;
      text-decoration: none;
    }
    .btn-admin:hover { background-color: #4a48c4; }

    .btn-logout {
      padding: 5px 12px;
      font-size: 0.8rem;
      font-family: inherit;
      color: #ff3b30;
      background: none;
      border: 1px solid #ff3b30;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .btn-logout:hover { background-color: rgba(255,59,48,0.08); }

    @media (prefers-color-scheme: dark) {
      .btn-logout { border-color: #ff453a; color: #ff453a; }
      .btn-logout:hover { background-color: rgba(255,69,58,0.12); }
    }

    /* ---- Login screen ---- */
    .login-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }

    .login-card {
      text-align: center;
      max-width: 340px;
      width: 100%;
    }

    .login-card .icon { font-size: 3rem; margin-bottom: 12px; }

    .login-card h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .login-card p {
      font-size: 0.9rem;
      color: #888;
      margin-bottom: 24px;
    }

    .btn-login {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 28px;
      font-size: 1rem;
      font-family: inherit;
      color: #fff;
      background-color: #007aff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .btn-login:hover { background-color: #0063d1; }
    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }

    .login-status {
      margin-top: 12px;
      font-size: 0.85rem;
      color: #888;
    }

    /* ---- Cards ---- */
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      padding: 16px;
      margin-bottom: 16px;
    }

    @media (prefers-color-scheme: dark) {
      .card { background: #2a2a2a; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    }

    /* ---- Section headings ---- */
    .section-title {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 12px;
    }

    /* ---- Stats row ---- */
    .stats-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .stat-card {
      flex: 1;
      min-width: 120px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      padding: 16px;
      text-align: center;
    }

    @media (prefers-color-scheme: dark) {
      .stat-card { background: #2a2a2a; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    }

    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      color: #007aff;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #888;
      margin-top: 4px;
    }

    /* ---- Photo grid ---- */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .photo-card {
      background: #fff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.15s;
    }

    .photo-card:hover { transform: translateY(-2px); }

    @media (prefers-color-scheme: dark) {
      .photo-card { background: #2a2a2a; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    }

    .photo-card img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      display: block;
      background-color: #e8e8e8;
    }

    @media (prefers-color-scheme: dark) {
      .photo-card img { background-color: #333; }
    }

    .photo-meta {
      padding: 10px 12px;
      font-size: 0.8rem;
      color: #888;
    }

    .photo-meta .photo-user {
      font-weight: 600;
      color: #333;
    }

    @media (prefers-color-scheme: dark) {
      .photo-meta .photo-user { color: #e0e0e0; }
    }

    .photo-meta .photo-location {
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ---- Site list ---- */
    .site-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background-color 0.15s;
      border-radius: 8px;
      padding: 12px;
      margin: 0 -12px;
    }

    .site-item:hover { background-color: rgba(0,122,255,0.06); }

    .site-item:last-child { border-bottom: none; }

    @media (prefers-color-scheme: dark) {
      .site-item { border-bottom-color: #444; }
      .site-item:hover { background-color: rgba(0,122,255,0.12); }
    }

    .site-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .site-info { flex: 1; min-width: 0; }

    .site-name {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .site-desc {
      font-size: 0.82rem;
      color: #888;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .site-chevron {
      color: #bbb;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    @media (prefers-color-scheme: dark) {
      .site-chevron { color: #666; }
    }

    /* ---- Site detail header ---- */
    .site-detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .btn-back {
      padding: 6px 14px;
      font-size: 0.85rem;
      font-family: inherit;
      color: #007aff;
      background: none;
      border: 1px solid #007aff;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s;
      flex-shrink: 0;
    }
    .btn-back:hover { background-color: rgba(0,122,255,0.08); }

    @media (prefers-color-scheme: dark) {
      .btn-back { border-color: #0a84ff; color: #0a84ff; }
      .btn-back:hover { background-color: rgba(10,132,255,0.12); }
    }

    .site-detail-title {
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .site-detail-subtitle {
      font-size: 0.82rem;
      color: #888;
    }

    /* ---- Empty state ---- */
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: #aaa;
    }

    .empty-state .icon { font-size: 2.5rem; margin-bottom: 8px; }

    /* ---- Loading ---- */
    .loading {
      text-align: center;
      padding: 24px;
      color: #aaa;
    }

    /* ---- Toast ---- */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      padding: 10px 20px;
      background: #333;
      color: #fff;
      border-radius: 8px;
      font-size: 0.9rem;
      opacity: 0;
      transition: transform 0.3s, opacity 0.3s;
      pointer-events: none;
      z-index: 999;
    }
    .toast.visible { transform: translateX(-50%) translateY(0); opacity: 1; }
    .toast.error { background: #ff3b30; }
    .toast.success { background: #34c759; }

    /* ---- Tabs ---- */
    .tabs {
      display: flex;
      gap: 0;
      margin-bottom: 16px;
      border-bottom: 2px solid #eee;
    }

    @media (prefers-color-scheme: dark) {
      .tabs { border-bottom-color: #444; }
    }

    .tab-btn {
      padding: 10px 20px;
      font-size: 0.9rem;
      font-family: inherit;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      color: #888;
      transition: color 0.15s, border-color 0.15s;
    }

    .tab-btn:hover { color: #333; }
    .tab-btn.active { color: #007aff; border-bottom-color: #007aff; font-weight: 600; }

    @media (prefers-color-scheme: dark) {
      .tab-btn:hover { color: #e0e0e0; }
    }

    /* ---- Hidden ---- */
    [hidden] { display: none !important; }

    /* ---- Fullscreen Lightbox ---- */
    .lightbox-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0,0,0,0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s;
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }

    .lightbox-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .lightbox-img {
      max-width: 95vw;
      max-height: 92vh;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.5);
      user-select: none;
      -webkit-user-select: none;
    }

    .lightbox-close {
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 2rem;
      color: #fff;
      background: none;
      border: none;
      cursor: pointer;
      z-index: 2001;
      line-height: 1;
      padding: 8px;
      opacity: 0.8;
      transition: opacity 0.15s;
    }

    .lightbox-close:hover { opacity: 1; }

    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 2.2rem;
      color: #fff;
      background: rgba(255,255,255,0.13);
      border: none;
      cursor: pointer;
      z-index: 2001;
      line-height: 1;
      padding: 12px 10px;
      border-radius: 50%;
      opacity: 0.7;
      transition: opacity 0.15s, background 0.15s;
      user-select: none;
      -webkit-user-select: none;
    }

    .lightbox-nav:hover { opacity: 1; background: rgba(255,255,255,0.22); }

    .lightbox-prev { left: 12px; }
    .lightbox-next { right: 12px; }

    /* Make photo cards indicate they are clickable for fullscreen */
    .photo-card img { cursor: zoom-in; }

    /* ---- Language switcher ---- */
    .lang-switcher {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 100;
    }

    .lang-switcher select {
      font-family: inherit;
      font-size: 0.8rem;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #ccc;
      background: #fff;
      color: #333;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      padding-right: 20px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
    }

    @media (prefers-color-scheme: dark) {
      .lang-switcher select {
        background-color: #333;
        color: #e0e0e0;
        border-color: #555;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23aaa'/%3E%3C/svg%3E");
      }
    }
  </style>
</head>
<body>
  <!-- Language selector -->
  <div class="lang-switcher">
    <select id="lang-select" aria-label="Språk" data-i18n="langSwitcher.label" data-i18n-attr="aria-label">
      <option value="no">🇳🇴 Norsk</option>
      <option value="en">🇬🇧 English</option>
      <option value="sv">🇸🇪 Svenska</option>
      <option value="da">🇩🇰 Dansk</option>
      <option value="pl">🇵🇱 Polski</option>
    </select>
  </div>

  <!-- Login screen (shown when not authenticated) -->
  <div class="login-screen" id="login-screen">
    <div class="login-card">
      <div class="icon">📋</div>
      <h1 data-i18n="login.title">Dokumentasjon</h1>
      <p data-i18n="login.subtitle">Logg inn med din Microsoft-konto for å se dashbordet ditt</p>
      <button class="btn-login" id="login-btn" disabled>
        <svg width="20" height="20" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
        <span data-i18n="login.button">Logg inn med Microsoft</span>
      </button>
      <div class="login-status" id="login-status" data-i18n="login.loading">Laster…</div>
    </div>
  </div>

  <!-- Dashboard content (hidden until authenticated) -->
  <div id="dashboard-content" hidden>
  <div class="container">
    <header>
      <div class="header-row">
        <div>
          <h1 data-i18n="header.title">📋 Dokumentasjon</h1>
          <p data-i18n="header.subtitle">Ditt prosjekt-dashbord</p>
        </div>
        <div class="user-bar">
          <a class="btn-admin" id="admin-link" href="/admin" hidden data-i18n="header.admin">⚙️ Admin</a>
          <span class="user-name" id="user-name"></span>
          <button class="btn-logout" id="logout-btn" data-i18n="header.logout">Logg ut</button>
        </div>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-row" id="stats-row">
      <div class="stat-card">
        <div class="stat-number" id="stat-photos">–</div>
        <div class="stat-label" data-i18n="stats.photos">Bilder</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="stat-sites">–</div>
        <div class="stat-label" data-i18n="stats.sites">Prosjekter</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="sites" data-i18n="tab.sites">🏗️ Prosjekter</button>
      <button class="tab-btn" data-tab="photos" data-i18n="tab.photos">📷 Bilder</button>
    </div>

    <!-- Sites tab (default view) -->
    <div id="tab-sites">
      <div class="loading" id="sites-loading" data-i18n="sites.loading">Laster prosjekter…</div>
      <div class="card" id="site-list"></div>
    </div>

    <!-- Photos tab -->
    <div id="tab-photos" hidden>
      <div class="site-detail-header" id="site-detail-header" hidden>
        <button class="btn-back" id="back-to-sites-btn" data-i18n="photos.backToSites">← Alle prosjekter</button>
        <div>
          <div class="site-detail-title" id="site-detail-name"></div>
          <div class="site-detail-subtitle" id="site-detail-count"></div>
        </div>
      </div>
      <div class="loading" id="photos-loading" data-i18n="photos.loading">Laster bilder…</div>
      <div class="photo-grid" id="photo-grid"></div>
    </div>

  </div> <!-- /.container -->
  </div> <!-- /#dashboard-content -->

  <!-- Toast notification -->
  <div class="toast" id="toast"></div>

  <!-- Fullscreen lightbox overlay -->
  <div class="lightbox-overlay" id="lightbox-overlay">
    <button class="lightbox-close" id="lightbox-close" aria-label="Lukk" data-i18n="lightbox.close" data-i18n-attr="aria-label">&times;</button>
    <button class="lightbox-nav lightbox-prev" id="lightbox-prev" aria-label="Forrige bilde" data-i18n="lightbox.prev" data-i18n-attr="aria-label">&#8249;</button>
    <img class="lightbox-img" id="lightbox-img" alt="Full size image">
    <button class="lightbox-nav lightbox-next" id="lightbox-next" aria-label="Neste bilde" data-i18n="lightbox.next" data-i18n-attr="aria-label">&#8250;</button>
  </div>

  <script type="module">
    import { PublicClientApplication } from 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@5.6.1/+esm';

    // ---- i18n ----
    const __locales = {
      no: {
        'page.title': 'Dokumentasjon — Dashbord',
        'login.title': 'Dokumentasjon',
        'login.subtitle': 'Logg inn med din Microsoft-konto for å se dashbordet ditt',
        'login.button': 'Logg inn med Microsoft',
        'login.loading': 'Laster…',
        'login.notSignedIn': 'Ikke innlogget',
        'login.redirecting': 'Omdirigerer…',
        'header.title': '📋 Dokumentasjon',
        'header.subtitle': 'Ditt prosjekt-dashbord',
        'header.admin': '⚙️ Admin',
        'header.logout': 'Logg ut',
        'stats.photos': 'Bilder',
        'stats.sites': 'Prosjekter',
        'tab.sites': '🏗️ Prosjekter',
        'tab.photos': '📷 Bilder',
        'sites.loading': 'Laster prosjekter…',
        'sites.empty': 'Ingen prosjekter registrert ennå.',
        'photos.loading': 'Laster bilder…',
        'photos.empty': 'Ingen bilder ennå.<br>Last opp bilder fra mobilappen.',
        'photos.emptySite': 'Ingen dokumentasjon for dette prosjektet ennå.<br>Last opp bilder nær dette prosjektet fra mobilappen.',
        'photos.backToSites': '← Alle prosjekter',
        'photos.singular': 'bilde',
        'photos.plural': 'bilder',
        'photos.nearSuffix': ' nær dette prosjektet',
        'photos.by': 'Bilde av',
        'photos.at': 'ved',
        'photos.unknown': 'Ukjent',
        'photos.failedLoad': 'Kunne ikke laste bilde',
        'lightbox.close': 'Lukk',
        'lightbox.prev': 'Forrige bilde',
        'lightbox.next': 'Neste bilde',
        'toast.sessionExpired': 'Økten utløpt — vennligst logg inn igjen',
        'toast.failedPhotos': 'Kunne ikke laste bilder',
        'toast.failedSites': 'Kunne ikke laste prosjekter',
        'error.azureConfig': 'Azure AD-konfigurasjonsfeil: omdirigerings-URIen må være registrert som en «Single-page application» (ikke «Web») i Azure-appregistreringen. Se README for oppsettsinstruksjoner.',
        'langSwitcher.label': 'Språk',
      },
      en: {
        'page.title': 'Documentation Dashboard',
        'login.title': 'Documentation',
        'login.subtitle': 'Sign in with your Microsoft account to view your dashboard',
        'login.button': 'Sign in with Microsoft',
        'login.loading': 'Loading…',
        'login.notSignedIn': 'Not signed in',
        'login.redirecting': 'Redirecting…',
        'header.title': '📋 Documentation',
        'header.subtitle': 'Your project dashboard',
        'header.admin': '⚙️ Admin',
        'header.logout': 'Sign out',
        'stats.photos': 'Photos',
        'stats.sites': 'Sites',
        'tab.sites': '🏗️ Sites',
        'tab.photos': '📷 Photos',
        'sites.loading': 'Loading sites…',
        'sites.empty': 'No sites registered yet.',
        'photos.loading': 'Loading photos…',
        'photos.empty': 'No photos yet.<br>Upload photos from the mobile app.',
        'photos.emptySite': 'No documentation for this site yet.<br>Upload photos near this site from the mobile app.',
        'photos.backToSites': '← All Sites',
        'photos.singular': 'photo',
        'photos.plural': 'photos',
        'photos.nearSuffix': ' near this site',
        'photos.by': 'Photo by',
        'photos.at': 'at',
        'photos.unknown': 'Unknown',
        'photos.failedLoad': 'Failed to load image',
        'lightbox.close': 'Close',
        'lightbox.prev': 'Previous photo',
        'lightbox.next': 'Next photo',
        'toast.sessionExpired': 'Session expired — please sign in again',
        'toast.failedPhotos': 'Failed to load photos',
        'toast.failedSites': 'Failed to load sites',
        'error.azureConfig': 'Azure AD configuration error: the redirect URI must be registered as a "Single-page application" (not "Web") in the Azure app registration. See the README for setup instructions.',
        'langSwitcher.label': 'Language',
      },
      sv: {
        'page.title': 'Dokumentation — Översikt',
        'login.title': 'Dokumentation',
        'login.subtitle': 'Logga in med ditt Microsoft-konto för att se din översikt',
        'login.button': 'Logga in med Microsoft',
        'login.loading': 'Laddar…',
        'login.notSignedIn': 'Inte inloggad',
        'login.redirecting': 'Omdirigerar…',
        'header.title': '📋 Dokumentation',
        'header.subtitle': 'Din projektöversikt',
        'header.admin': '⚙️ Admin',
        'header.logout': 'Logga ut',
        'stats.photos': 'Foton',
        'stats.sites': 'Projekt',
        'tab.sites': '🏗️ Projekt',
        'tab.photos': '📷 Foton',
        'sites.loading': 'Laddar projekt…',
        'sites.empty': 'Inga projekt registrerade ännu.',
        'photos.loading': 'Laddar foton…',
        'photos.empty': 'Inga foton ännu.<br>Ladda upp foton från mobilappen.',
        'photos.emptySite': 'Ingen dokumentation för detta projekt ännu.<br>Ladda upp foton nära detta projekt från mobilappen.',
        'photos.backToSites': '← Alla projekt',
        'photos.singular': 'foto',
        'photos.plural': 'foton',
        'photos.nearSuffix': ' nära detta projekt',
        'photos.by': 'Foto av',
        'photos.at': 'vid',
        'photos.unknown': 'Okänd',
        'photos.failedLoad': 'Kunde inte ladda bild',
        'lightbox.close': 'Stäng',
        'lightbox.prev': 'Föregående foto',
        'lightbox.next': 'Nästa foto',
        'toast.sessionExpired': 'Sessionen har gått ut — vänligen logga in igen',
        'toast.failedPhotos': 'Kunde inte ladda foton',
        'toast.failedSites': 'Kunde inte ladda projekt',
        'error.azureConfig': 'Azure AD-konfigurationsfel: omdirigerings-URI:n måste vara registrerad som en "Single-page application" (inte "Web") i Azure-appregistreringen. Se README för installationsinstruktioner.',
        'langSwitcher.label': 'Språk',
      },
      da: {
        'page.title': 'Dokumentation — Dashboard',
        'login.title': 'Dokumentation',
        'login.subtitle': 'Log ind med din Microsoft-konto for at se dit dashboard',
        'login.button': 'Log ind med Microsoft',
        'login.loading': 'Indlæser…',
        'login.notSignedIn': 'Ikke logget ind',
        'login.redirecting': 'Omdirigerer…',
        'header.title': '📋 Dokumentation',
        'header.subtitle': 'Dit projektoversigt',
        'header.admin': '⚙️ Admin',
        'header.logout': 'Log ud',
        'stats.photos': 'Billeder',
        'stats.sites': 'Projekter',
        'tab.sites': '🏗️ Projekter',
        'tab.photos': '📷 Billeder',
        'sites.loading': 'Indlæser projekter…',
        'sites.empty': 'Ingen projekter registreret endnu.',
        'photos.loading': 'Indlæser billeder…',
        'photos.empty': 'Ingen billeder endnu.<br>Upload billeder fra mobilappen.',
        'photos.emptySite': 'Ingen dokumentation for dette projekt endnu.<br>Upload billeder nær dette projekt fra mobilappen.',
        'photos.backToSites': '← Alle projekter',
        'photos.singular': 'billede',
        'photos.plural': 'billeder',
        'photos.nearSuffix': ' nær dette projekt',
        'photos.by': 'Billede af',
        'photos.at': 'ved',
        'photos.unknown': 'Ukendt',
        'photos.failedLoad': 'Kunne ikke indlæse billede',
        'lightbox.close': 'Luk',
        'lightbox.prev': 'Forrige billede',
        'lightbox.next': 'Næste billede',
        'toast.sessionExpired': 'Sessionen er udløbet — log venligst ind igen',
        'toast.failedPhotos': 'Kunne ikke indlæse billeder',
        'toast.failedSites': 'Kunne ikke indlæse projekter',
        'error.azureConfig': 'Azure AD-konfigurationsfejl: omdirigerings-URI\\'en skal være registreret som en "Single-page application" (ikke "Web") i Azure-appregistreringen. Se README for opsætningsinstruktioner.',
        'langSwitcher.label': 'Sprog',
      },
      pl: {
        'page.title': 'Dokumentacja — Panel',
        'login.title': 'Dokumentacja',
        'login.subtitle': 'Zaloguj się za pomocą konta Microsoft, aby wyświetlić panel',
        'login.button': 'Zaloguj się przez Microsoft',
        'login.loading': 'Ładowanie…',
        'login.notSignedIn': 'Nie zalogowano',
        'login.redirecting': 'Przekierowywanie…',
        'header.title': '📋 Dokumentacja',
        'header.subtitle': 'Twój panel projektów',
        'header.admin': '⚙️ Admin',
        'header.logout': 'Wyloguj się',
        'stats.photos': 'Zdjęcia',
        'stats.sites': 'Projekty',
        'tab.sites': '🏗️ Projekty',
        'tab.photos': '📷 Zdjęcia',
        'sites.loading': 'Ładowanie projektów…',
        'sites.empty': 'Brak zarejestrowanych projektów.',
        'photos.loading': 'Ładowanie zdjęć…',
        'photos.empty': 'Brak zdjęć.<br>Prześlij zdjęcia z aplikacji mobilnej.',
        'photos.emptySite': 'Brak dokumentacji dla tego projektu.<br>Prześlij zdjęcia w pobliżu tego projektu z aplikacji mobilnej.',
        'photos.backToSites': '← Wszystkie projekty',
        'photos.singular': 'zdjęcie',
        'photos.plural': 'zdjęcia',
        'photos.nearSuffix': ' w pobliżu tego projektu',
        'photos.by': 'Zdjęcie',
        'photos.at': 'o',
        'photos.unknown': 'Nieznany',
        'photos.failedLoad': 'Nie udało się załadować zdjęcia',
        'lightbox.close': 'Zamknij',
        'lightbox.prev': 'Poprzednie zdjęcie',
        'lightbox.next': 'Następne zdjęcie',
        'toast.sessionExpired': 'Sesja wygasła — zaloguj się ponownie',
        'toast.failedPhotos': 'Nie udało się załadować zdjęć',
        'toast.failedSites': 'Nie udało się załadować projektów',
        'error.azureConfig': 'Błąd konfiguracji Azure AD: identyfikator URI przekierowania musi być zarejestrowany jako „Single-page application" (nie „Web") w rejestracji aplikacji Azure. Szczegóły w README.',
        'langSwitcher.label': 'Język',
      },
    };
    const DEFAULT_LOCALE = 'no';
    const LOCALE_STORAGE_KEY = 'app_locale';

    let currentLocale = (() => {
      try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved && __locales[saved]) return saved;
      } catch (_) {}
      return DEFAULT_LOCALE;
    })();

    function t(key) {
      const bundle = __locales[currentLocale] || __locales[DEFAULT_LOCALE];
      return bundle[key] ?? __locales[DEFAULT_LOCALE][key] ?? key;
    }

    function applyTranslations() {
      document.title = t('page.title');
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');
        if (attr) el.setAttribute(attr, t(key));
        else el.textContent = t(key);
      });
    }

    let onLocaleChange = null;

    function setLocale(code) {
      if (!__locales[code]) return;
      currentLocale = code;
      try { localStorage.setItem(LOCALE_STORAGE_KEY, code); } catch (_) {}
      document.documentElement.lang = code;
      applyTranslations();
      if (onLocaleChange) onLocaleChange();
    }

    // Wire up language selector and apply initial translations
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
      langSelect.value = currentLocale;
      langSelect.addEventListener('change', (e) => setLocale(e.target.value));
    }
    document.documentElement.lang = currentLocale;
    applyTranslations();

    // ---- MSAL configuration ----
    const CLIENT_ID = '65702384-9248-47a3-80d9-bcf5abb69424';
    const msalConfig = {
      auth: {
        clientId: CLIENT_ID,
        authority: 'https://login.microsoftonline.com/organizations',
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: 'localStorage' },
    };
    const loginRequest = { scopes: ['User.Read'] };

    const pca = new PublicClientApplication(msalConfig);
    await pca.initialize();

    // Process redirect response
    let authResponse;
    try {
      authResponse = await pca.handleRedirectPromise();
    } catch (err) {
      // AADSTS9002326: redirect URI registered as "Web" instead of "SPA"
      if (err.errorCode === 'invalid_request' || (err.message && err.message.includes('AADSTS9002326'))) {
        document.getElementById('login-status').textContent = t('error.azureConfig');
        document.getElementById('login-btn').disabled = true;
      }
      throw err;
    }
    if (authResponse && authResponse.account) {
      pca.setActiveAccount(authResponse.account);
    } else {
      const accounts = pca.getAllAccounts();
      if (accounts.length > 0) pca.setActiveAccount(accounts[0]);
    }

    async function getIdToken() {
      const account = pca.getActiveAccount();
      if (!account) return null;
      try {
        const result = await pca.acquireTokenSilent({ ...loginRequest, account });
        return result.idToken;
      } catch (err) {
        console.warn('acquireTokenSilent failed:', err);
        return null;
      }
    }

    // ---- Auth-gated UI ----
    const loginScreen = document.getElementById('login-screen');
    const loginBtn = document.getElementById('login-btn');
    const loginStatus = document.getElementById('login-status');
    const dashboardContent = document.getElementById('dashboard-content');
    const userNameEl = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');

    const account = pca.getActiveAccount();
    if (account) {
      loginScreen.hidden = true;
      dashboardContent.hidden = false;
      userNameEl.textContent = account.name || account.username || '';
    } else {
      loginStatus.textContent = t('login.notSignedIn');
      loginBtn.disabled = false;
    }

    loginBtn.addEventListener('click', () => {
      loginBtn.disabled = true;
      loginStatus.textContent = t('login.redirecting');
      pca.loginRedirect(loginRequest);
    });

    logoutBtn.addEventListener('click', () => {
      pca.logoutRedirect();
    });

    // ---- Dashboard logic (only runs when authenticated) ----
    if (account) {
      const ORIGIN = '${origin}';
      const PHOTOS_API = ORIGIN + '/api/photos';
      const SITES_API = ORIGIN + '/api/sites';
      const ME_API = ORIGIN + '/api/me';

      // ---- Toast ----
      const toast = document.getElementById('toast');
      let toastTimer;
      function showToast(msg, type) {
        clearTimeout(toastTimer);
        toast.textContent = msg;
        toast.className = 'toast visible' + (type ? ' ' + type : '');
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
      }

      // ---- API helpers ----
      async function authFetch(url, options = {}) {
        const token = await getIdToken();
        if (!token) {
          showToast(t('toast.sessionExpired'), 'error');
          setTimeout(() => pca.loginRedirect(loginRequest), 1500);
          throw new Error('No token');
        }
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = 'Bearer ' + token;
        return fetch(url, options);
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      // ---- Haversine distance (metres) between two GPS points ----
      function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in metres
        const toRad = (d) => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      // Find nearest site for a photo; returns site id or null
      function nearestSiteId(photo, sitesWithCoords) {
        if (!photo.imagelocation) return null;
        const parts = photo.imagelocation.split(',');
        if (parts.length < 2) return null;
        const pLat = parseFloat(parts[0]);
        const pLng = parseFloat(parts[1]);
        if (isNaN(pLat) || isNaN(pLng)) return null;

        let bestId = null;
        let bestDist = Infinity;
        for (const s of sitesWithCoords) {
          const d = haversineDistance(pLat, pLng, s.latitude, s.longitude);
          if (d < bestDist) {
            bestDist = d;
            bestId = s.id;
          }
        }
        return bestId;
      }

      // Get photos assigned to a site (nearest-site match)
      // Uses a cached mapping rebuilt when data changes.
      let photoSiteMap = null; // Map<photoIndex, siteId>

      function buildPhotoSiteMap() {
        photoSiteMap = new Map();
        const sitesWithCoords = sites.filter(s => s.latitude !== null && s.longitude !== null);
        if (sitesWithCoords.length === 0) return;
        for (let i = 0; i < photos.length; i++) {
          const sid = nearestSiteId(photos[i], sitesWithCoords);
          if (sid !== null) photoSiteMap.set(i, sid);
        }
      }

      function photosForSite(siteId) {
        if (photoSiteMap === null) buildPhotoSiteMap();
        const result = [];
        for (let i = 0; i < photos.length; i++) {
          if (photoSiteMap.get(i) === siteId) result.push(photos[i]);
        }
        return result;
      }

      // ---- Check admin status ----
      async function checkAdmin() {
        try {
          const res = await authFetch(ME_API);
          if (res.ok) {
            const data = await res.json();
            if (data.isAdmin) {
              adminLink.hidden = false;
            }
          }
        } catch { /* ignore */ }
      }

      // ---- Tabs ----
      const tabBtns = document.querySelectorAll('.tab-btn');
      const tabPhotos = document.getElementById('tab-photos');
      const tabSites = document.getElementById('tab-sites');

      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tab = btn.dataset.tab;
          tabPhotos.hidden = tab !== 'photos';
          tabSites.hidden = tab !== 'sites';
          // Reset to all photos when switching to photos tab
          if (tab === 'photos') {
            activeSiteId = null;
            siteDetailHeader.hidden = true;
            renderPhotos();
          }
        });
      });

      // ---- Photos ----
      const photoGrid = document.getElementById('photo-grid');
      const photosLoading = document.getElementById('photos-loading');
      const statPhotos = document.getElementById('stat-photos');
      const siteDetailHeader = document.getElementById('site-detail-header');
      const siteDetailName = document.getElementById('site-detail-name');
      const siteDetailCount = document.getElementById('site-detail-count');
      const backToSitesBtn = document.getElementById('back-to-sites-btn');
      let photos = [];
      let activeSiteId = null; // when set, only show photos for this site

      backToSitesBtn.addEventListener('click', () => {
        activeSiteId = null;
        siteDetailHeader.hidden = true;
        renderPhotos();
        // Switch back to Sites tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabBtns.forEach(b => { if (b.dataset.tab === 'sites') b.classList.add('active'); });
        tabPhotos.hidden = true;
        tabSites.hidden = false;
      });

      async function fetchPhotos() {
        try {
          const res = await authFetch(PHOTOS_API);
          if (!res.ok) throw new Error(t('toast.failedPhotos'));
          const data = await res.json();
          photos = data.photos || [];
          statPhotos.textContent = photos.length;
        } catch (err) {
          showToast(err.message, 'error');
          photos = [];
          statPhotos.textContent = '0';
        }
        photoSiteMap = null; // invalidate cache
        renderPhotos();
      }

      // Revoke previously created blob URLs to free memory
      let activeBlobUrls = [];

      function revokeActiveBlobUrls() {
        activeBlobUrls.forEach(u => URL.revokeObjectURL(u));
        activeBlobUrls = [];
      }

      /**
       * Fetch a single image that requires JWT auth and set its src to a
       * blob URL.  Browser <img> tags cannot send Authorization headers
       * natively, so we use authFetch() and convert to a blob URL.
       */
      async function loadAuthImage(img) {
        const url = img.getAttribute('data-auth-src');
        try {
          const res = await authFetch(url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrls.push(blobUrl);
          img.src = blobUrl;
        } catch (err) {
          console.warn('Failed to load image', url, err);
          img.alt = t('photos.failedLoad');
        }
      }

      // Lazy-load authenticated images as they scroll into view
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            imageObserver.unobserve(entry.target);
            loadAuthImage(entry.target);
          }
        });
      }, { rootMargin: '200px' });

      function renderPhotos() {
        photosLoading.hidden = true;
        revokeActiveBlobUrls();
        const displayPhotos = activeSiteId !== null ? photosForSite(activeSiteId) : photos;

        if (displayPhotos.length === 0) {
          const msg = activeSiteId !== null ? t('photos.emptySite') : t('photos.empty');
          photoGrid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1">' +
            '  <div class="icon">📷</div>' +
            '  <p>' + msg + '</p>' +
            '</div>';
          return;
        }

        let html = '';
        for (const photo of displayPhotos) {
          const date = photo.created ? new Date(photo.created).toLocaleDateString() : '';
          const hasImage = !!photo.imageurl;
          const altText = t('photos.by') + ' ' + escapeHtml(photo.user || t('photos.unknown')) + (photo.imagelocation ? ' ' + t('photos.at') + ' ' + escapeHtml(photo.imagelocation) : '');
          html +=
            '<div class="photo-card">' +
            (hasImage
              ? '<img data-auth-src="' + escapeHtml(photo.imageurl) + '" alt="' + altText + '" tabindex="0" role="button">'
              : '<div style="height:160px;display:flex;align-items:center;justify-content:center;background:#e8e8e8;color:#aaa;font-size:2rem">📷</div>') +
            '  <div class="photo-meta">' +
            '    <div class="photo-user">' + escapeHtml(photo.user || t('photos.unknown')) + '</div>' +
            (photo.imagelocation
              ? '    <div class="photo-location">📍 ' + escapeHtml(photo.imagelocation) + '</div>'
              : '') +
            (date ? '    <div>' + escapeHtml(date) + '</div>' : '') +
            '  </div>' +
            '</div>';
        }
        photoGrid.innerHTML = html;
        photoGrid.querySelectorAll('img[data-auth-src]').forEach(img => imageObserver.observe(img));
      }

      // ---- Fullscreen Lightbox ----
      const lightboxOverlay = document.getElementById('lightbox-overlay');
      const lightboxImg = document.getElementById('lightbox-img');
      const lightboxClose = document.getElementById('lightbox-close');
      const lightboxPrev = document.getElementById('lightbox-prev');
      const lightboxNext = document.getElementById('lightbox-next');
      let lightboxIndex = -1;
      let lightboxImages = [];

      function openLightbox(imgEl) {
        if (!imgEl.src || imgEl.src.startsWith('data:')) return;
        lightboxImages = Array.from(photoGrid.querySelectorAll('.photo-card img[src]')).filter(img => !img.src.startsWith('data:'));
        lightboxIndex = lightboxImages.indexOf(imgEl);
        lightboxImg.src = imgEl.src;
        lightboxOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateLightboxNav();
      }

      function updateLightboxNav() {
        lightboxPrev.style.display = lightboxIndex > 0 ? '' : 'none';
        lightboxNext.style.display = lightboxIndex < lightboxImages.length - 1 ? '' : 'none';
      }

      function navigateLightbox(direction) {
        const newIndex = lightboxIndex + direction;
        if (newIndex < 0 || newIndex >= lightboxImages.length) return;
        lightboxIndex = newIndex;
        lightboxImg.src = lightboxImages[lightboxIndex].src;
        updateLightboxNav();
      }

      function closeLightbox() {
        lightboxOverlay.classList.remove('active');
        document.body.style.overflow = '';
        lightboxIndex = -1;
        lightboxImages = [];
      }

      photoGrid.addEventListener('click', (e) => {
        const img = e.target.closest('.photo-card img');
        if (img) openLightbox(img);
      });

      photoGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const img = e.target.closest('.photo-card img');
          if (img) { e.preventDefault(); openLightbox(img); }
        }
      });

      lightboxClose.addEventListener('click', closeLightbox);
      lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
      lightboxNext.addEventListener('click', () => navigateLightbox(1));

      lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) closeLightbox();
      });

      document.addEventListener('keydown', (e) => {
        if (!lightboxOverlay.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
      });

      // ---- Sites ----
      const siteListEl = document.getElementById('site-list');
      const sitesLoading = document.getElementById('sites-loading');
      const statSites = document.getElementById('stat-sites');
      let sites = [];

      async function fetchSites() {
        try {
          const res = await authFetch(SITES_API);
          if (!res.ok) throw new Error(t('toast.failedSites'));
          const data = await res.json();
          sites = data.sites || [];
          statSites.textContent = sites.length;
        } catch (err) {
          showToast(err.message, 'error');
          sites = [];
          statSites.textContent = '0';
        }
        photoSiteMap = null; // invalidate cache
        renderSites();
      }

      function renderSites() {
        sitesLoading.hidden = true;
        if (sites.length === 0) {
          siteListEl.innerHTML =
            '<div class="empty-state">' +
            '  <div class="icon">🏗️</div>' +
            '  <p>' + t('sites.empty') + '</p>' +
            '</div>';
          return;
        }

        let html = '';
        const sortedSites = [...sites].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        for (const site of sortedSites) {
          const count = photosForSite(site.id).length;
          html +=
            '<div class="site-item" data-site-id="' + site.id + '">' +
            '  <div class="site-icon">🏗️</div>' +
            '  <div class="site-info">' +
            '    <div class="site-name">' + escapeHtml(site.name) + '</div>' +
            (site.description ? '    <div class="site-desc">' + escapeHtml(site.description) + '</div>' : '') +
            (site.address ? '    <div class="site-desc">📍 ' + escapeHtml(site.address) + '</div>' : '') +
            '    <div class="site-desc">📷 ' + count + ' ' + (count !== 1 ? t('photos.plural') : t('photos.singular')) + '</div>' +
            '  </div>' +
            '  <div class="site-chevron">›</div>' +
            '</div>';
        }
        siteListEl.innerHTML = html;

        // Attach click handlers
        siteListEl.querySelectorAll('.site-item').forEach(el => {
          el.addEventListener('click', () => {
            const siteId = parseInt(el.dataset.siteId, 10);
            showSitePhotos(siteId);
          });
        });
      }

      function showSitePhotos(siteId) {
        const site = sites.find(s => s.id === siteId);
        if (!site) return;

        activeSiteId = siteId;
        const count = photosForSite(siteId).length;
        siteDetailName.textContent = '🏗️ ' + site.name;
        siteDetailCount.textContent = count + ' ' + (count !== 1 ? t('photos.plural') : t('photos.singular')) + t('photos.nearSuffix');
        siteDetailHeader.hidden = false;

        // Switch to photos tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabBtns.forEach(b => { if (b.dataset.tab === 'photos') b.classList.add('active'); });
        tabPhotos.hidden = false;
        tabSites.hidden = true;

        renderPhotos();
      }

      // Re-render dynamic content when language changes
      onLocaleChange = () => {
        renderPhotos();
        renderSites();
        // Update site detail header if visible
        if (activeSiteId !== null) {
          const site = sites.find(s => s.id === activeSiteId);
          if (site) {
            const count = photosForSite(activeSiteId).length;
            siteDetailName.textContent = '🏗️ ' + site.name;
            siteDetailCount.textContent = count + ' ' + (count !== 1 ? t('photos.plural') : t('photos.singular')) + t('photos.nearSuffix');
          }
        }
      };

      // ---- Init ----
      checkAdmin();
      // Fetch photos first so site photo-counts are correct
      await fetchPhotos();
      fetchSites();
    }
  </script>
</body>
</html>`;
}
