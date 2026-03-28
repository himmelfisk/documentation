/**
 * Admin dashboard — self-contained HTML page served by the Worker.
 *
 * Mobile-first responsive design with dark mode support.
 * Manages construction sites via the /api/sites endpoints.
 */

export function getAdminHtml(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Admin — Sites</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
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
      max-width: 800px;
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

    header h1 {
      font-size: 1.5rem;
      font-weight: 700;
    }

    header p {
      font-size: 0.85rem;
      color: #888;
      margin-top: 4px;
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
    }

    .btn-primary {
      color: #fff;
      background-color: #007aff;
    }
    .btn-primary:hover { background-color: #0063d1; }
    .btn-primary:active { background-color: #005ecb; }

    .btn-secondary {
      color: #333;
      background-color: #e8e8e8;
      border: 1px solid #ccc;
    }
    .btn-secondary:hover { background-color: #ddd; }
    .btn-secondary:active { background-color: #d0d0d0; }

    .btn-danger {
      color: #fff;
      background-color: #ff3b30;
    }
    .btn-danger:hover { background-color: #e0332a; }
    .btn-danger:active { background-color: #cc2d25; }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8rem;
      border-radius: 6px;
    }

    @media (prefers-color-scheme: dark) {
      .btn-secondary {
        color: #e0e0e0;
        background-color: #333;
        border-color: #555;
      }
      .btn-secondary:hover { background-color: #3d3d3d; }
      .btn-secondary:active { background-color: #444; }
    }

    /* ---- Card ---- */
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    @media (prefers-color-scheme: dark) {
      .card {
        background: #2a2a2a;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
    }

    /* ---- Form ---- */
    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
      color: #555;
    }

    @media (prefers-color-scheme: dark) {
      .form-group label { color: #bbb; }
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      font-size: 1rem;
      font-family: inherit;
      border: 1px solid #ccc;
      border-radius: 8px;
      background-color: #fafafa;
      color: #333;
      transition: border-color 0.15s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #007aff;
      box-shadow: 0 0 0 3px rgba(0,122,255,0.15);
    }

    @media (prefers-color-scheme: dark) {
      .form-group input,
      .form-group textarea {
        background-color: #1e1e1e;
        color: #e0e0e0;
        border-color: #555;
      }
      .form-group input:focus,
      .form-group textarea:focus {
        border-color: #007aff;
        box-shadow: 0 0 0 3px rgba(0,122,255,0.25);
      }
    }

    .form-group textarea {
      resize: vertical;
      min-height: 60px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    /* ---- Toolbar ---- */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .toolbar h2 {
      font-size: 1.15rem;
      font-weight: 600;
    }

    /* ---- Site list ---- */
    .site-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px;
      border-bottom: 1px solid #eee;
      gap: 12px;
    }

    .site-item:last-child {
      border-bottom: none;
    }

    @media (prefers-color-scheme: dark) {
      .site-item { border-bottom-color: #3a3a3a; }
    }

    .site-info {
      flex: 1;
      min-width: 0;
    }

    .site-name {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 4px;
      word-break: break-word;
    }

    .site-desc {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 6px;
      word-break: break-word;
    }

    @media (prefers-color-scheme: dark) {
      .site-desc { color: #999; }
    }

    .site-coords {
      font-size: 0.8rem;
      color: #888;
      font-family: "SF Mono", "Menlo", "Monaco", monospace;
    }

    .site-coords a {
      color: #007aff;
      text-decoration: none;
    }
    .site-coords a:hover { text-decoration: underline; }

    @media (prefers-color-scheme: dark) {
      .site-coords { color: #777; }
      .site-coords a { color: #64d2ff; }
    }

    .site-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    /* ---- Empty state ---- */
    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: #999;
    }

    .empty-state .icon {
      font-size: 2.5rem;
      margin-bottom: 12px;
    }

    .empty-state p {
      font-size: 0.95rem;
    }

    /* ---- Toast / status ---- */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #fff;
      background-color: #333;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 100;
    }

    .toast.visible { opacity: 1; }

    .toast.success { background-color: #34c759; }
    .toast.error { background-color: #ff3b30; }

    /* ---- Confirm dialog overlay ---- */
    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 50;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .overlay.active {
      display: flex;
    }

    .dialog {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      max-width: 360px;
      width: 100%;
      text-align: center;
    }

    @media (prefers-color-scheme: dark) {
      .dialog { background: #2a2a2a; }
    }

    .dialog h3 {
      margin-bottom: 8px;
      font-size: 1.1rem;
    }

    .dialog p {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 20px;
    }

    @media (prefers-color-scheme: dark) {
      .dialog p { color: #999; }
    }

    .dialog-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    /* ---- Responsive: larger screens ---- */
    @media (min-width: 600px) {
      .container { padding: 24px; }
      header h1 { font-size: 1.75rem; }

      .site-item { padding: 20px; }
    }

    @media (min-width: 900px) {
      .container { max-width: 960px; }
    }

    /* ---- Loading spinner ---- */
    .loading {
      text-align: center;
      padding: 32px;
      color: #888;
    }

    /* ---- Map picker ---- */
    #map-container {
      height: 300px;
      border-radius: 8px;
      border: 1px solid #ccc;
      overflow: hidden;
      cursor: crosshair;
    }

    @media (prefers-color-scheme: dark) {
      #map-container { border-color: #555; }
      #map-container .leaflet-tile { filter: brightness(0.85); }
    }

    .map-coords {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 0.85rem;
      color: #666;
      font-family: "SF Mono", "Menlo", "Monaco", monospace;
    }

    @media (prefers-color-scheme: dark) {
      .map-coords { color: #999; }
    }

    .map-coords .clear-pin {
      font-family: inherit;
      font-size: 0.8rem;
      color: #ff3b30;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 6px;
    }
    .map-coords .clear-pin:hover { text-decoration: underline; }

    /* ---- Hidden ---- */
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏗️ Site Admin</h1>
      <p>Manage construction sites and locations</p>
    </header>

    <!-- Site form (add / edit) -->
    <div id="site-form-section" hidden>
      <div class="card">
        <h2 id="form-title">Add New Site</h2>
        <form id="site-form" autocomplete="off">
          <input type="hidden" id="site-id" value="">

          <div class="form-group">
            <label for="site-name-input">Site Name *</label>
            <input type="text" id="site-name-input" placeholder="e.g. Byggeprosjekt Aker Brygge" required>
          </div>

          <div class="form-group">
            <label for="site-desc-input">Description</label>
            <textarea id="site-desc-input" rows="2" placeholder="Optional description of the site"></textarea>
          </div>

          <div class="form-group">
            <label>Pick Location</label>
            <div id="map-container"></div>
            <input type="hidden" id="site-lat-input" value="">
            <input type="hidden" id="site-lng-input" value="">
            <div class="map-coords">
              <span id="map-coords-display">Click the map to set a pin</span>
              <button type="button" class="clear-pin" id="clear-pin-btn" hidden>✕ Clear pin</button>
            </div>
          </div>

          <div class="form-group">
            <label for="site-address-input">Address</label>
            <input type="text" id="site-address-input" placeholder="e.g. Dronning Eufemias gate 30, Oslo">
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="form-submit-btn">Add Site</button>
            <button type="button" class="btn btn-secondary" id="form-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Site list -->
    <div id="site-list-section">
      <div class="toolbar">
        <h2>Sites <span id="site-count"></span></h2>
        <button class="btn btn-primary btn-sm" id="add-site-btn">＋ Add Site</button>
      </div>

      <div id="site-list" class="card">
        <div class="loading" id="loading-indicator">Loading sites…</div>
      </div>
    </div>
  </div>

  <!-- Delete confirmation -->
  <div class="overlay" id="delete-overlay">
    <div class="dialog">
      <h3>Delete Site?</h3>
      <p id="delete-message">Are you sure you want to delete this site?</p>
      <div class="dialog-actions">
        <button class="btn btn-danger btn-sm" id="delete-confirm-btn">Delete</button>
        <button class="btn btn-secondary btn-sm" id="delete-cancel-btn">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Toast notification -->
  <div class="toast" id="toast"></div>

  <script>
    (() => {
      const API = '${origin}/api/sites';
      let sites = [];
      let deleteTargetId = null;

      // ---- DOM refs ----
      const siteListSection = document.getElementById('site-list-section');
      const siteFormSection = document.getElementById('site-form-section');
      const siteForm = document.getElementById('site-form');
      const formTitle = document.getElementById('form-title');
      const formSubmitBtn = document.getElementById('form-submit-btn');
      const siteIdInput = document.getElementById('site-id');
      const siteNameInput = document.getElementById('site-name-input');
      const siteDescInput = document.getElementById('site-desc-input');
      const siteLatInput = document.getElementById('site-lat-input');
      const siteLngInput = document.getElementById('site-lng-input');
      const siteAddressInput = document.getElementById('site-address-input');
      const siteList = document.getElementById('site-list');
      const siteCount = document.getElementById('site-count');
      const loadingIndicator = document.getElementById('loading-indicator');
      const deleteOverlay = document.getElementById('delete-overlay');
      const deleteMessage = document.getElementById('delete-message');
      const toast = document.getElementById('toast');
      const mapCoordsDisplay = document.getElementById('map-coords-display');
      const clearPinBtn = document.getElementById('clear-pin-btn');

      // ---- Map state ----
      let map = null;
      let marker = null;
      const DEFAULT_CENTER = [59.9139, 10.7522]; // Oslo
      const DEFAULT_ZOOM = 5;

      // ---- Toast ----
      let toastTimer;
      function showToast(msg, type = '') {
        clearTimeout(toastTimer);
        toast.textContent = msg;
        toast.className = 'toast visible' + (type ? ' ' + type : '');
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
      }

      // ---- API helpers ----
      async function fetchSites() {
        try {
          const res = await fetch(API);
          if (!res.ok) throw new Error('Failed to load sites');
          const data = await res.json();
          sites = data.sites || [];
        } catch (err) {
          showToast(err.message, 'error');
          sites = [];
        }
        render();
      }

      async function saveSite(siteData) {
        const isEdit = !!siteData.id;
        const url = isEdit ? API + '/' + siteData.id : API;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(siteData),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save site');
        }
        return res.json();
      }

      async function deleteSite(id) {
        const res = await fetch(API + '/' + id, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to delete site');
        }
      }

      // ---- Render ----
      function render() {
        loadingIndicator.hidden = true;
        siteCount.textContent = '(' + sites.length + ')';

        if (sites.length === 0) {
          siteList.innerHTML =
            '<div class="empty-state">' +
            '  <div class="icon">🏗️</div>' +
            '  <p>No sites registered yet.<br>Tap <strong>Add Site</strong> to get started.</p>' +
            '</div>';
          return;
        }

        let html = '';
        for (const site of sites) {
          const hasCoords = site.latitude != null && site.longitude != null;
          const coordsHtml = hasCoords
            ? '<a href="https://www.google.com/maps?q=' + encodeURIComponent(site.latitude + ',' + site.longitude) +
              '" target="_blank" rel="noopener">' + Number(site.latitude).toFixed(5) + ', ' + Number(site.longitude).toFixed(5) + '</a>'
            : '<span style="opacity:0.5">No coordinates</span>';

          html +=
            '<div class="site-item" data-id="' + parseInt(site.id, 10) + '">' +
            '  <div class="site-info">' +
            '    <div class="site-name">' + escapeHtml(site.name) + '</div>' +
            (site.description ? '    <div class="site-desc">' + escapeHtml(site.description) + '</div>' : '') +
            (site.address ? '    <div class="site-desc">📍 ' + escapeHtml(site.address) + '</div>' : '') +
            '    <div class="site-coords">' + coordsHtml + '</div>' +
            '  </div>' +
            '  <div class="site-actions">' +
            '    <button class="btn btn-secondary btn-sm edit-btn" data-id="' + parseInt(site.id, 10) + '">Edit</button>' +
            '    <button class="btn btn-danger btn-sm delete-btn" data-id="' + parseInt(site.id, 10) + '">Delete</button>' +
            '  </div>' +
            '</div>';
        }
        siteList.innerHTML = html;
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      // ---- Map helpers ----
      function initMap() {
        if (map) return;
        map = L.map('map-container', { attributionControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);
        L.control.attribution({ prefix: false }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>').addTo(map);

        map.on('click', function (e) {
          setPin(e.latlng.lat, e.latlng.lng);
        });
      }

      function setPin(lat, lng) {
        siteLatInput.value = lat;
        siteLngInput.value = lng;
        mapCoordsDisplay.textContent = Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5);
        clearPinBtn.hidden = false;

        if (marker) {
          marker.setLatLng([lat, lng]);
        } else {
          marker = L.marker([lat, lng]).addTo(map);
        }
      }

      function clearPin() {
        siteLatInput.value = '';
        siteLngInput.value = '';
        mapCoordsDisplay.textContent = 'Click the map to set a pin';
        clearPinBtn.hidden = true;
        if (marker) {
          map.removeLayer(marker);
          marker = null;
        }
      }

      clearPinBtn.addEventListener('click', clearPin);

      // ---- Form ----
      function showForm(site) {
        siteFormSection.hidden = false;
        siteListSection.hidden = true;

        // Initialise map on first show, then fix tile rendering
        initMap();
        setTimeout(() => map.invalidateSize(), 50);

        if (site) {
          formTitle.textContent = 'Edit Site';
          formSubmitBtn.textContent = 'Save Changes';
          siteIdInput.value = site.id;
          siteNameInput.value = site.name || '';
          siteDescInput.value = site.description || '';
          siteAddressInput.value = site.address || '';

          if (site.latitude != null && site.longitude != null) {
            setPin(site.latitude, site.longitude);
            map.setView([site.latitude, site.longitude], 14);
          } else {
            clearPin();
            map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
          }
        } else {
          formTitle.textContent = 'Add New Site';
          formSubmitBtn.textContent = 'Add Site';
          siteForm.reset();
          siteIdInput.value = '';
          clearPin();
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }

        siteNameInput.focus();
      }

      function hideForm() {
        siteFormSection.hidden = true;
        siteListSection.hidden = false;
      }

      // ---- Events ----
      document.getElementById('add-site-btn').addEventListener('click', () => showForm(null));
      document.getElementById('form-cancel-btn').addEventListener('click', hideForm);

      siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formSubmitBtn.disabled = true;

        const siteData = {
          name: siteNameInput.value.trim(),
          description: siteDescInput.value.trim(),
          latitude: siteLatInput.value ? parseFloat(siteLatInput.value) : null,
          longitude: siteLngInput.value ? parseFloat(siteLngInput.value) : null,
          address: siteAddressInput.value.trim(),
        };

        if (siteIdInput.value) {
          siteData.id = parseInt(siteIdInput.value, 10);
        }

        try {
          await saveSite(siteData);
          showToast(siteData.id ? 'Site updated' : 'Site added', 'success');
          hideForm();
          await fetchSites();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          formSubmitBtn.disabled = false;
        }
      });

      // Delegate edit/delete clicks
      siteList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
          const id = parseInt(editBtn.dataset.id, 10);
          const site = sites.find(s => s.id === id);
          if (site) showForm(site);
          return;
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
          const id = parseInt(deleteBtn.dataset.id, 10);
          const site = sites.find(s => s.id === id);
          deleteTargetId = id;
          deleteMessage.textContent = site
            ? 'Delete "' + site.name + '"? This cannot be undone.'
            : 'Are you sure you want to delete this site?';
          deleteOverlay.classList.add('active');
          return;
        }
      });

      document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
        if (deleteTargetId == null) return;
        try {
          await deleteSite(deleteTargetId);
          showToast('Site deleted', 'success');
          deleteOverlay.classList.remove('active');
          deleteTargetId = null;
          await fetchSites();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      document.getElementById('delete-cancel-btn').addEventListener('click', () => {
        deleteOverlay.classList.remove('active');
        deleteTargetId = null;
      });

      // Close overlay on backdrop click
      deleteOverlay.addEventListener('click', (e) => {
        if (e.target === deleteOverlay) {
          deleteOverlay.classList.remove('active');
          deleteTargetId = null;
        }
      });

      // ---- Init ----
      fetchSites();
    })();
  </script>
</body>
</html>`;
}
