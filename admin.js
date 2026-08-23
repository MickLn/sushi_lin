
// ---- GESTION DES ALLERGÈNES PAR PLAT ----
function toggleAdminAllergensSection() {
  const toggleBtn = document.getElementById('admin-allergens-toggle');
  const body = document.getElementById('admin-allergens-body');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (toggleBtn) {
    if (isHidden) toggleBtn.classList.remove('closed');
    else toggleBtn.classList.add('closed');
  }
}

function updateAdminAllergensCount() {
  const countEl = document.getElementById('admin-allergens-count');
  const checked = document.querySelectorAll('input[name="admin-allergen"]:checked');
  if (countEl) countEl.textContent = checked.length;
}

function getItemDefaultAllergens(item) {
  if (Array.isArray(item.allergens)) return item.allergens;
  const text = (item.name + ' ' + (item.desc || '') + ' ' + (item.cat || '')).toLowerCase();
  const list = [];
  if (text.includes('saumon') || text.includes('thon') || text.includes('daurade') || text.includes('bar') || text.includes('maquereau') || text.includes('sashimi') || text.includes('chirashi') || text.includes('sushi') || text.includes('poisson')) {
    list.push('Poissons');
  }
  if (text.includes('crevette') || text.includes('ebi') || text.includes('tempura')) {
    list.push('Crustacés');
  }
  if (text.includes('poulpe') || text.includes('calamar') || text.includes('takoyaki') || text.includes('jacques')) {
    list.push('Mollusques');
  }
  if (text.includes('sesame') || text.includes('sésame') || text.includes('california') || text.includes('wakame') || text.includes('yakitori') || text.includes('brochette')) {
    list.push('Sésame');
  }
  if (text.includes('soja') || text.includes('miso') || text.includes('edamame') || text.includes('tofu')) {
    list.push('Soja');
  }
  if (text.includes('cheese') || text.includes('fromage') || text.includes('lait')) {
    list.push('Lait');
  }
  if (text.includes('oeuf') || text.includes('œuf') || text.includes('mayo') || text.includes('tartare') || text.includes('tamago') || text.includes('dorayaki')) {
    list.push('Œufs');
  }
  if (text.includes('nem') || text.includes('gyoza') || text.includes('tempura') || text.includes('oignon frit') || text.includes('crispy') || text.includes('beignet') || text.includes('bière')) {
    list.push('Céréales');
  }
  if (text.includes('cacahuète') || text.includes('arachide')) {
    list.push('Arachides');
  }
  if (text.includes('noisette') || text.includes('amande') || text.includes('noix')) {
    list.push('Fruits à coque');
  }
  if (text.includes('vin') || text.includes('champagne')) {
    list.push('Sulfites');
  }
  return list;
}

/* ==========================================================================
   SUSHI LIN II — Logique Tableau de Bord Gérant (Admin)
   ========================================================================== */

'use strict';

// ---- STATE ----
let ADMIN_MENU = null;
let ADMIN_SETTINGS = {
  status: 'open',
  exceptionalMessage: '',
  scheduleText: '7j/7 : 12h00 – 14h30 & 18h30 – 22h00',
  midiStart: '12:00',
  midiEnd: '14:30',
  soirStart: '18:30',
  soirEnd: '22:00',
  maxOrdersPerSlot: 5,
  discount: 10,
  phone: '01 30 79 00 88',
  whatsapp: '33130790088',
  address: '32 Rue des Dames, 78340 Les Clayes-sous-Bois',
  mapsLink: 'https://goo.gl/maps/gdgPWQZ2CxFZTC1a7'
};

const DEFAULT_PIN = '1234';

// ---- DOM SELECTORS ----
const pinScreen = document.getElementById('pin-screen');
const adminApp = document.getElementById('admin-app');
const adminPinInput = document.getElementById('admin-pin-input');
const adminProductsTbody = document.getElementById('admin-products-tbody');
const adminSearchInput = document.getElementById('admin-search-input');
const adminCategorySelect = document.getElementById('admin-category-select');
const totalProductsCount = document.getElementById('total-products-count');
const adminToast = document.getElementById('admin-toast');

// Modal
const productModalBackdrop = document.getElementById('product-modal-backdrop');
const adminProductModal = document.getElementById('admin-product-modal');
const modalProductTitle = document.getElementById('modal-product-title');

// ---- AUTHENTICATION (PIN) ----
function handlePinLogin(e) {
  e.preventDefault();
  const enteredPin = adminPinInput.value.trim();
  const savedPin = localStorage.getItem('sushilin_admin_pin') || DEFAULT_PIN;

  if (enteredPin === savedPin) {
    sessionStorage.setItem('sushilin_admin_logged', 'true');
    showAdminDashboard();
    showToast('Connexion réussie au tableau de bord !');
  } else {
    alert('Code PIN incorrect. Veuillez réessayer.');
    adminPinInput.value = '';
    adminPinInput.focus();
  }
}

function handleLogout() {
  sessionStorage.removeItem('sushilin_admin_logged');
  adminApp.style.display = 'none';
  pinScreen.style.display = 'flex';
  adminPinInput.value = '';
}

function checkAdminSession() {
  if (sessionStorage.getItem('sushilin_admin_logged') === 'true') {
    showAdminDashboard();
  }
}

function showAdminDashboard() {
  pinScreen.style.display = 'none';
  adminApp.style.display = 'flex';
  loadAdminData();
}

// ---- LOAD MENU & SETTINGS ----
async function loadAdminData() {
  // 1. Settings from localStorage
  const savedSettings = localStorage.getItem('sushilin_admin_settings');
  if (savedSettings) {
    try {
      ADMIN_SETTINGS = { ...ADMIN_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (err) {
      console.error('Erreur lecture settings:', err);
    }
  }

  // 2. Menu from canonical menu.json + localStorage overrides
  try {
    const res = await fetch('data/menu.json?v=' + Date.now());
    const canonicalMenu = await res.json();
    const savedMenu = localStorage.getItem('sushilin_admin_menu');
    if (savedMenu) {
      try {
        const parsed = JSON.parse(savedMenu);
        if (parsed && Array.isArray(parsed.items)) {
          const overrideMap = new Map(parsed.items.map(i => [i.id, i]));
          const canonicalIds = new Set(canonicalMenu.items.map(i => i.id));

          // 1. Fusionner les modifications sur les plats existants
          canonicalMenu.items = canonicalMenu.items.map(item => {
            const override = overrideMap.get(item.id);
            if (override) {
              return {
                ...item,
                code: override.code !== undefined ? override.code : item.code,
                name: override.name || item.name,
                price: typeof override.price === 'number' ? override.price : item.price,
                available: typeof override.available === 'boolean' ? override.available : item.available,
                pieces: override.pieces !== undefined ? override.pieces : item.pieces,
                desc: override.desc !== undefined ? override.desc : item.desc,
                img: override.img || item.img,
                cat: override.cat || item.cat
              };
            }
            return item;
          });

          // 2. Conserver les nouveaux plats personnalisés créés dans l'admin
          const customItems = parsed.items.filter(i => !canonicalIds.has(i.id));
          if (customItems.length > 0) {
            canonicalMenu.items = [...canonicalMenu.items, ...customItems];
          }
        }
      } catch (e) {
        console.error('Erreur fusion admin menu:', e);
      }
    }
    ADMIN_MENU = canonicalMenu;
    localStorage.setItem('sushilin_admin_menu', JSON.stringify(ADMIN_MENU));
    renderAllAdminUI();
  } catch (err) {
    console.error('Erreur chargement menu.json:', err);
    showToast('Erreur de chargement des produits.');
  }
}

// ---- RENDER UI ----
function renderAllAdminUI() {
  if (!ADMIN_MENU) return;

  // Render categories in filter & modal
  renderCategoryOptions();

  // Render products table
  renderProductsTable(ADMIN_MENU.items);

  // Total count
  if (totalProductsCount) totalProductsCount.textContent = ADMIN_MENU.items.length;

  // Populate Settings fields
  populateSettingsFields();
}

function renderCategoryOptions() {
  if (!adminCategorySelect) return;
  adminCategorySelect.innerHTML = '<option value="all">Toutes les catégories</option>';
  
  const formCatSelect = document.getElementById('form-product-cat');
  if (formCatSelect) formCatSelect.innerHTML = '';

  ADMIN_MENU.categories.forEach(cat => {
    const label = cat.name || cat.label || cat.id;

    // Filter Select
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = label;
    adminCategorySelect.appendChild(opt);

    // Form Modal Select
    if (formCatSelect) {
      const formOpt = document.createElement('option');
      formOpt.value = cat.id;
      formOpt.textContent = label;
      formCatSelect.appendChild(formOpt);
    }
  });
}

function renderProductsTable(items) {
  if (!adminProductsTbody) return;
  adminProductsTbody.innerHTML = '';

  if (items.length === 0) {
    adminProductsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Aucun produit ne correspond à votre recherche.
        </td>
      </tr>`;
    return;
  }

  items.forEach(item => {
    const catObj = ADMIN_MENU.categories.find(c => c.id === item.cat);
    const catLabel = catObj ? (catObj.name || catObj.label || item.cat) : item.cat;

    const tr = document.createElement('tr');
    tr.id = `admin-row-${item.id}`;

    const thumbHtml = item.img
      ? `<img src="${item.img}" class="table-img-thumb" alt="${item.name}" onerror="this.outerHTML='<div class=\\'table-img-placeholder\\'></div>'">`
      : `<div class="table-img-placeholder"></div>`;

    const itemCode = item.code || (item.id ? item.id.replace(/^[a-z]+-/, '').toUpperCase() : '—');

    tr.innerHTML = `
      <td>${thumbHtml}</td>
      <td style="text-align: center;">
        <span class="table-code-badge">${itemCode}</span>
      </td>
      <td>
        <div class="table-product-name">${item.name}</div>
        ${item.desc ? `<div class="table-product-desc" title="${item.desc}">${item.desc}</div>` : ''}
        ${(item.allergens && item.allergens.length > 0) ? `<div style="font-size: 11px; color: var(--sakura-vibrant); margin-top: 3px; font-weight: 600;">Allergènes : ${item.allergens.join(', ')}</div>` : ''}
      </td>
      <td>
        <span class="table-cat-badge">${catLabel}</span>
      </td>
      <td>
        <span style="font-weight: 600; color: var(--text-sub); font-size: 12.5px;">${item.pieces || '—'}</span>
      </td>
      <td>
        <div class="price-input-wrap">
          <input type="number" step="0.10" min="0" value="${item.price.toFixed(2)}" onchange="handleInlinePriceChange('${item.id}', this.value)" aria-label="Prix de ${item.name}">
          <span class="price-unit">€</span>
        </div>
      </td>
      <td>
        <button class="stock-toggle-btn ${item.available ? 'in-stock' : 'out-of-stock'}" onclick="toggleProductStock('${item.id}')">
          <span>${item.available ? 'En stock' : 'En rupture'}</span>
        </button>
      </td>
      <td style="text-align: right;">
        <button class="btn-edit-item" onclick="openEditProductModal('${item.id}')" title="Modifier les détails">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </td>
    `;

    adminProductsTbody.appendChild(tr);
  });
}

// ---- FILTER & SEARCH PRODUCTS ----
function filterAdminProducts() {
  if (!ADMIN_MENU) return;
  const searchVal = adminSearchInput.value.toLowerCase().trim();
  const catVal = adminCategorySelect.value;

  const filtered = ADMIN_MENU.items.filter(item => {
    const codeVal = (item.code || item.id || '').toString().toLowerCase().trim();
    const nameVal = (item.name || '').toLowerCase();
    const descVal = (item.desc || '').toLowerCase();

    const matchesSearch = !searchVal || 
      codeVal === searchVal ||
      codeVal.includes(searchVal) ||
      nameVal.includes(searchVal) || 
      descVal.includes(searchVal);
    const matchesCat = catVal === 'all' || item.cat === catVal;
    return matchesSearch && matchesCat;
  });

  renderProductsTable(filtered);
}

// ---- INLINE PRICE & AVAILABILITY EDIT ----
function handleInlinePriceChange(itemId, newPriceStr) {
  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice < 0) {
    alert('Prix invalide');
    return;
  }

  const item = ADMIN_MENU.items.find(i => i.id === itemId);
  if (item) {
    item.price = Math.round(newPrice * 100) / 100;
    saveMenuToLocalStorage();
    showToast(`Prix de « ${item.name} » mis à jour : ${item.price.toFixed(2)} €`);
  }
}

function toggleProductStock(itemId) {
  const item = ADMIN_MENU.items.find(i => i.id === itemId);
  if (item) {
    item.available = !item.available;
    saveMenuToLocalStorage();
    filterAdminProducts();
    showToast(`« ${item.name} » marqué comme ${item.available ? 'En stock' : 'En rupture'}`);
  }
}

// ---- PRODUCT MODAL (ADD / EDIT) ----
function openAddProductModal() {
  modalProductTitle.textContent = 'Ajouter un nouveau plat';
  document.getElementById('form-product-id').value = '';
  const codeField = document.getElementById('form-product-code');
  if (codeField) codeField.value = '';
  document.getElementById('form-product-name').value = '';
  document.getElementById('form-product-price').value = '';
  document.getElementById('form-product-pieces').value = '';
  document.getElementById('form-product-img').value = '';
  document.getElementById('form-product-desc').value = '';
  document.getElementById('form-product-available').checked = true;

  // Reset allergens
  document.querySelectorAll('input[name="admin-allergen"]').forEach(cb => cb.checked = false);
  updateAdminAllergensCount();

  adminProductModal.classList.add('open');
  productModalBackdrop.classList.add('active');
}

function openEditProductModal(itemId) {
  const item = ADMIN_MENU.items.find(i => i.id === itemId);
  if (!item) return;

  modalProductTitle.textContent = `Modifier : ${item.name}`;
  document.getElementById('form-product-id').value = item.id;
  const codeField = document.getElementById('form-product-code');
  if (codeField) codeField.value = item.code || '';
  document.getElementById('form-product-name').value = item.name;
  document.getElementById('form-product-cat').value = item.cat;
  document.getElementById('form-product-price').value = item.price.toFixed(2);
  document.getElementById('form-product-pieces').value = item.pieces || '';
  document.getElementById('form-product-img').value = item.img || '';
  document.getElementById('form-product-desc').value = item.desc || '';
  document.getElementById('form-product-available').checked = item.available !== false;

  // Set allergens
  const itemAllergens = getItemDefaultAllergens(item);
  document.querySelectorAll('input[name="admin-allergen"]').forEach(cb => {
    cb.checked = itemAllergens.some(a => a.toLowerCase() === cb.value.toLowerCase() || (cb.value === 'Céréales' && a.toLowerCase().includes('gluten')) || (cb.value === 'Poissons' && a.toLowerCase().includes('poisson')));
  });
  updateAdminAllergensCount();

  adminProductModal.classList.add('open');
  productModalBackdrop.classList.add('active');
}

function closeProductModal() {
  adminProductModal.classList.remove('open');
  productModalBackdrop.classList.remove('active');
}

function handleSaveProductForm(e) {
  e.preventDefault();
  const id = document.getElementById('form-product-id').value;
  const codeField = document.getElementById('form-product-code');
  const code = codeField ? codeField.value.trim() : '';
  const name = document.getElementById('form-product-name').value.trim();
  const cat = document.getElementById('form-product-cat').value;
  const price = parseFloat(document.getElementById('form-product-price').value);
  const pieces = document.getElementById('form-product-pieces').value.trim();
  const img = document.getElementById('form-product-img').value.trim();
  const desc = document.getElementById('form-product-desc').value.trim();
  const available = document.getElementById('form-product-available').checked;

  if (!name || isNaN(price)) {
    alert('Veuillez renseigner au moins un nom et un prix valide.');
    return;
  }

  if (id) {
    // Edit existing
    const item = ADMIN_MENU.items.find(i => i.id === id);
    if (item) {
      if (code) item.code = code;
      item.name = name;
      item.cat = cat;
      item.price = price;
      item.pieces = pieces;
      item.img = img;
      item.desc = desc;
      item.available = available;
      item.allergens = Array.from(document.querySelectorAll('input[name="admin-allergen"]:checked')).map(cb => cb.value);
    }
  } else {
    // Create new
    const newId = `custom_${Date.now()}`;
    ADMIN_MENU.items.push({
      id: newId,
      code: code || '',
      name,
      cat,
      price,
      pieces,
      img,
      desc,
      available,
      allergens: Array.from(document.querySelectorAll('input[name="admin-allergen"]:checked')).map(cb => cb.value)
    });
  }

  saveMenuToLocalStorage();
  closeProductModal();
  filterAdminProducts();
  showToast(`Plat « ${name} » enregistré avec succès !`);
}

// ---- POPULATE & SAVE SETTINGS (HOURS, DISCOUNTS, INFO) ----
function populateSettingsFields() {
  if (ADMIN_SETTINGS.status === 'closed-exceptional') {
    document.getElementById('status-closed-radio').checked = true;
  } else {
    document.getElementById('status-open-radio').checked = true;
  }

  document.getElementById('exceptional-msg-input').value = ADMIN_SETTINGS.exceptionalMessage || '';
  document.getElementById('schedule-text-input').value = ADMIN_SETTINGS.scheduleText || '';
  document.getElementById('midi-start').value = ADMIN_SETTINGS.midiStart || '12:00';
  document.getElementById('midi-end').value = ADMIN_SETTINGS.midiEnd || '14:30';
  document.getElementById('soir-start').value = ADMIN_SETTINGS.soirStart || '18:30';
  document.getElementById('soir-end').value = ADMIN_SETTINGS.soirEnd || '22:00';
  document.getElementById('discount-input').value = ADMIN_SETTINGS.discount || 10;
  const maxOrdersEl = document.getElementById('max-orders-slot-input');
  if (maxOrdersEl) maxOrdersEl.value = ADMIN_SETTINGS.maxOrdersPerSlot || 5;
  document.getElementById('phone-display-input').value = ADMIN_SETTINGS.phone || '01 30 79 00 88';
  document.getElementById('whatsapp-number-input').value = ADMIN_SETTINGS.whatsapp || '33130790088';
  document.getElementById('address-input').value = ADMIN_SETTINGS.address || '32 Rue des Dames, 78340 Les Clayes-sous-Bois';
  document.getElementById('maps-link-input').value = ADMIN_SETTINGS.mapsLink || 'https://goo.gl/maps/gdgPWQZ2CxFZTC1a7';
}

function collectSettingsFromForm() {
  ADMIN_SETTINGS.status = document.querySelector('input[name="restaurant-status"]:checked')?.value || 'open';
  ADMIN_SETTINGS.exceptionalMessage = document.getElementById('exceptional-msg-input').value.trim();
  ADMIN_SETTINGS.scheduleText = document.getElementById('schedule-text-input').value.trim();
  ADMIN_SETTINGS.midiStart = document.getElementById('midi-start').value;
  ADMIN_SETTINGS.midiEnd = document.getElementById('midi-end').value;
  ADMIN_SETTINGS.soirStart = document.getElementById('soir-start').value;
  ADMIN_SETTINGS.soirEnd = document.getElementById('soir-end').value;
  ADMIN_SETTINGS.discount = parseInt(document.getElementById('discount-input').value, 10) || 10;
  const maxOrdersInput = document.getElementById('max-orders-slot-input');
  ADMIN_SETTINGS.maxOrdersPerSlot = maxOrdersInput ? (parseInt(maxOrdersInput.value, 10) || 5) : 5;
  ADMIN_SETTINGS.phone = document.getElementById('phone-display-input').value.trim();
  ADMIN_SETTINGS.whatsapp = document.getElementById('whatsapp-number-input').value.trim();
  ADMIN_SETTINGS.address = document.getElementById('address-input').value.trim();
  ADMIN_SETTINGS.mapsLink = document.getElementById('maps-link-input').value.trim();

  localStorage.setItem('sushilin_admin_settings', JSON.stringify(ADMIN_SETTINGS));
}

// ---- STORAGE & SAVE ALL ----
function saveMenuToLocalStorage() {
  if (ADMIN_MENU) {
    localStorage.setItem('sushilin_admin_menu', JSON.stringify(ADMIN_MENU));
  }
}

function saveAllChanges() {
  collectSettingsFromForm();
  saveMenuToLocalStorage();
  showToast('Toutes les modifications ont été enregistrées avec succès !');
}

// Export Menu JSON file for persistence
function exportMenuJsonFile() {
  if (!ADMIN_MENU) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ADMIN_MENU, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "menu.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Fichier menu.json téléchargé !');
}

// ---- TAB SWITCHING ----
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-pane').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const tabBtn = document.getElementById(`nav-tab-${tabName}`);
  const tabPane = document.getElementById(`pane-${tabName}`);

  if (tabBtn) tabBtn.classList.add('active');
  if (tabPane) {
    tabPane.classList.add('active');
    tabPane.style.display = 'block';
  }

  if (tabName === 'orders') {
    renderAdminOrders();
  } else if (tabName === 'reservations') {
    renderAdminReservations();
  }
}

// ---- SUBTAB SWITCHING (COMMANDES vs RÉSERVATIONS) ----
function switchOrdersSubtab(type) {
  const btnOrders = document.getElementById('subtab-btn-orders');
  const btnRes = document.getElementById('subtab-btn-res');
  const listOrders = document.getElementById('admin-orders-list');
  const listRes = document.getElementById('admin-res-list');

  if (type === 'orders') {
    btnOrders?.classList.add('active');
    btnRes?.classList.remove('active');
    if (listOrders) listOrders.style.display = 'block';
    if (listRes) listRes.style.display = 'none';
  } else {
    btnRes?.classList.add('active');
    btnOrders?.classList.remove('active');
    if (listOrders) listOrders.style.display = 'none';
    if (listRes) listRes.style.display = 'block';
  }
}

// ---- RENDU DES COMMANDES EN DIRECT (POSTGRESQL & LOCALSTORAGE) ----
async function syncAndGetOrders() {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders) && data.orders.length > 0) {
        localStorage.setItem('sushilin_orders', JSON.stringify(data.orders));
        return data.orders;
      }
    }
  } catch (err) {
    // Mode hors-ligne ou fallback localStorage
  }
  return JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
}

async function renderAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  const badgeNav = document.getElementById('total-orders-count');
  const badgeSubtab = document.getElementById('badge-subtab-orders');
  if (!container) return;

  const orders = await syncAndGetOrders();
  const newCount = orders.filter(o => o.status === 'new').length;

  if (badgeNav) badgeNav.textContent = newCount > 0 ? `${newCount} NEW` : orders.length;
  if (badgeSubtab) badgeSubtab.textContent = orders.length;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 16px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">Aucune commande pour le moment</p>
        <p style="font-size: 13.5px; margin-bottom: 18px;">Passez une commande sur la carte client ou cliquez sur le bouton ci-dessus pour simuler une commande test.</p>
        <button onclick="generateTestOrder()" style="background: var(--sakura-bg-soft); color: var(--indigo-primary); border: 1px solid var(--sakura-border-strong); padding: 8px 18px; border-radius: var(--radius-md); font-weight: 800; cursor: pointer;">
          + Créer une commande de test
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;">
      ${orders.map(order => `
        <div style="background: #FFFFFF; border: 1.5px solid var(--sakura-border); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-card); display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--sakura-border);">
            <div>
              <span style="font-family: var(--font-heading); font-size: 18px; font-weight: 900; color: var(--indigo-dark);">#${order.id}</span>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${order.dateFormatted || (order.timestamp ? new Date(order.timestamp).toLocaleString('fr-FR') : 'Aujourd\'hui')}</div>
              ${order.customerEmail ? `<div style="font-size: 11.5px; color: var(--indigo-primary); font-weight: 600; margin-top: 2px;">✉ ${order.customerEmail}</div>` : ''}
            </div>
            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${order.status === 'new' ? '#FFEBEE' : order.status === 'preparing' ? '#FFF8E1' : order.status === 'ready' ? '#E8F5E9' : '#ECEFF1'}; color: ${order.status === 'new' ? '#C62828' : order.status === 'preparing' ? '#F57F17' : order.status === 'ready' ? '#2E7D32' : '#455A64'};">
              <option value="new" ${order.status === 'new' ? 'selected' : ''}>🔴 Nouvelle</option>
              <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>🟡 En préparation</option>
              <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>🟢 Prête (Retrait)</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>⚪ Terminée</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Annulée</option>
            </select>
          </div>

          <div style="background: var(--sakura-bg-soft); border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; margin-bottom: 14px;">
            <div><strong>Heure de retrait :</strong> ${order.pickupTime || 'Dès que possible'}</div>
            <div><strong>Baguettes :</strong> ${order.baguettesChoice === '0' || order.baguettesChoice === 'Sans baguette' ? 'Sans baguette' : (order.baguettesChoice && !order.baguettesChoice.includes('paire') ? (order.baguettesChoice + (parseInt(order.baguettesChoice) > 1 ? ' paires' : ' paire')) : (order.baguettesChoice || '1 paire'))}</div>
            <div><strong>Sauces :</strong> ${order.sauceChoice || 'Sauce sucrée'}</div>
            ${order.comment ? `<div style="margin-top: 4px; color: #D32F2F;"><strong>Note client :</strong> ${order.comment}</div>` : ''}
          </div>

          <div style="margin-bottom: 16px;">
            <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); display: block; margin-bottom: 8px;">Détail des plats (${order.itemCount || (order.items && order.items.length) || 1}) :</strong>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13.5px;">
              ${(order.items || []).map(item => `
                <li style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted var(--sakura-border-soft);">
                  <span>
                    <strong>${item.qty || 1}x</strong> ${item.code ? `<span style="display:inline-block; font-size:10px; font-weight:700; color:#E11D48; background:#FFF0F3; border:1px solid #FFCCD5; border-radius:4px; padding:1px 4px; margin-right:4px;">${item.code}</span>` : ''}${item.name}
                    ${item.details ? `<div style="font-size: 11px; color: #D32F2F; margin-left: 18px;">${item.details.map(d => `${d.quantity}x ${d.flavor}`).join(', ')}</div>` : ''}
                  </span>
                  <span style="font-weight: 700;">${((item.price || item.unitPrice || 0) * (item.qty || item.totalQuantity || 1)).toFixed(2).replace('.', ',')} €</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div style="margin-top: auto; padding-top: 14px; border-top: 1.5px solid var(--sakura-border);">
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: var(--indigo-dark); margin-bottom: 12px;">
              <span>Total :</span>
              <span>${(order.total || 0).toFixed(2).replace('.', ',')} €</span>
            </div>

            <div style="display: flex; gap: 8px;">
              <button onclick="window.print()" style="flex: 1; padding: 8px; font-size: 12px; font-weight: 800; background: var(--sakura-bg-soft); border: 1px solid var(--sakura-border); border-radius: var(--radius-md); color: var(--indigo-dark); cursor: pointer;">
                Imprimer ticket
              </button>
              <button onclick="deleteOrder('${order.id}')" style="padding: 8px 12px; font-size: 12px; font-weight: 700; background: #FFF0F0; border: 1px solid #FFCDD2; border-radius: var(--radius-md); color: #D32F2F; cursor: pointer;">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- RENDU DES RÉSERVATIONS DE TABLES (POSTGRESQL & LOCALSTORAGE) ----
async function syncAndGetReservations() {
  try {
    const res = await fetch('/api/reservations');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.reservations) && data.reservations.length > 0) {
        localStorage.setItem('sushilin_reservations', JSON.stringify(data.reservations));
        return data.reservations;
      }
    }
  } catch (err) {
    // Mode hors-ligne ou fallback localStorage
  }
  return JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
}

async function renderAdminReservations() {
  const container = document.getElementById('admin-res-list');
  const badgeSubtab = document.getElementById('badge-subtab-res');
  if (!container) return;

  const resList = await syncAndGetReservations();
  if (badgeSubtab) badgeSubtab.textContent = resList.length;

  if (resList.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 16px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">Aucune réservation enregistrée</p>
        <p style="font-size: 13.5px;">Les demandes faites depuis la page de réservation s'afficheront ici en direct.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
      ${resList.map(res => `
        <div style="background: #FFFFFF; border: 1.5px solid var(--sakura-border); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--sakura-border);">
            <div>
              <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 900; color: var(--indigo-dark);">${res.name}</span>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Réf : ${res.id}</div>
              ${res.email ? `<div style="font-size: 11.5px; color: var(--indigo-primary); font-weight: 600; margin-top: 2px;">✉ ${res.email}</div>` : ''}
            </div>
            <span style="background: rgba(76, 175, 80, 0.12); color: #2E7D32; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 800;">
              ${res.status === 'confirmed' ? 'Confirmée' : res.status || 'Confirmée'}
            </span>
          </div>

          <div style="font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
            <div><strong>Date :</strong> ${res.date}</div>
            <div><strong>Créneau :</strong> ${res.service}</div>
            <div><strong>Couverts :</strong> ${res.guests} personne(s)</div>
            <div><strong>Téléphone :</strong> <a href="tel:${res.phone}" style="color: var(--indigo-primary); font-weight: 700;">${res.phone}</a></div>
            ${res.notes ? `<div style="margin-top: 6px; padding: 8px 10px; background: var(--sakura-bg-soft); border-radius: var(--radius-md);"><strong>Remarques :</strong> ${res.notes}</div>` : ''}
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button onclick="deleteReservation('${res.id}')" style="padding: 6px 12px; font-size: 12px; font-weight: 700; background: #FFF0F0; border: 1px solid #FFCDD2; border-radius: var(--radius-md); color: #D32F2F; cursor: pointer;">
              Supprimer
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Actions Commandes
function updateOrderStatus(orderId, newStatus) {
  // 1. Mise à jour dans PostgreSQL via API
  fetch('/api/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: orderId, status: newStatus })
  }).catch(e => console.warn('Erreur update PostgreSQL:', e));

  // 2. Mise à jour dans localStorage
  const orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = newStatus;
    localStorage.setItem('sushilin_orders', JSON.stringify(orders));
    renderAdminOrders();
    showToast(`Statut de la commande ${orderId} mis à jour !`);
  }
}

function deleteOrder(orderId) {
  if (!confirm(`Supprimer la commande ${orderId} ?`)) return;
  fetch('/api/orders', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: orderId })
  }).catch(e => console.warn('Erreur suppression API:', e));

  let orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  orders = orders.filter(o => o.id !== orderId);
  localStorage.setItem('sushilin_orders', JSON.stringify(orders));
  renderAdminOrders();
  showToast(`Commande ${orderId} supprimée.`);
}

function deleteReservation(resId) {
  if (!confirm(`Supprimer la réservation ${resId} ?`)) return;
  fetch('/api/reservations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: resId })
  }).catch(e => console.warn('Erreur suppression API:', e));

  let resList = JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
  resList = resList.filter(r => r.id !== resId);
  localStorage.setItem('sushilin_reservations', JSON.stringify(resList));
  renderAdminReservations();
  showToast(`Réservation supprimée.`);
}

function clearAllOrders() {
  if (!confirm("Voulez-vous vraiment effacer tout l'historique des commandes et réservations de test ?")) return;
  fetch('/api/orders', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '__ALL__' })
  }).catch(() => {});

  fetch('/api/reservations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '__ALL__' })
  }).catch(() => {});

  localStorage.removeItem('sushilin_orders');
  localStorage.removeItem('sushilin_reservations');
  renderAdminOrders();
  renderAdminReservations();
  showToast("Historique de test réinitialisé !");
}

// Simuler une commande test en 1 clic
function generateTestOrder() {
  const testItems = [
    { id: 'makis-6', name: 'Maki Saumon (6 pcs)', price: 5.50, qty: 2 },
    { id: 'sushis-1', name: 'Sushi Saumon (2 pcs)', price: 4.80, qty: 1 },
    { id: 'menus-m1', name: 'Menu Yakitori 5 Brochettes', price: 14.50, qty: 1 },
    { id: 'boissons-bo2', name: 'Coca Cola 33cl', price: 3.00, qty: 2 }
  ];

  const subtotal = testItems.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const eligibleSubtotal = testItems.reduce((acc, it) => {
    const isExcluded = it.id.startsWith('desserts') || it.id.startsWith('boissons') || it.id.startsWith('vins');
    return isExcluded ? acc : acc + (it.price * it.qty);
  }, 0);
  const discount = Math.round(eligibleSubtotal * 0.10 * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;

  const now = new Date();
  const orderId = 'CMD-' + Date.now().toString().slice(-6);

  const testOrder = {
    id: orderId,
    timestamp: now.toISOString(),
    dateFormatted: now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    items: testItems,
    itemCount: testItems.reduce((acc, it) => acc + it.qty, 0),
    subtotal: subtotal,
    discount: discount,
    total: total,
    sauceChoice: '2 Sauces sucrées, 1 Salée',
    baguettesChoice: '2 paires',
    pickupTime: 'Dans 25 min (19h45)',
    comment: 'Commande test automatique pour vérification admin',
    status: 'new'
  };

  const existingOrders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  existingOrders.unshift(testOrder);
  localStorage.setItem('sushilin_orders', JSON.stringify(existingOrders));

  renderAdminOrders();
  showToast(`Commande test ${orderId} générée avec succès !`);
}

// Écouteur en direct pour actualiser le dashboard dès qu'une commande est passée dans un autre onglet
window.addEventListener('storage', (e) => {
  if (e.key === 'sushilin_orders' || e.key === 'sushilin_reservations') {
    renderAdminOrders();
    renderAdminReservations();
  }
});

// ---- TOAST NOTIFICATION ----
let adminToastTimeout = null;
function showToast(msg) {
  if (!adminToast) return;
  adminToast.textContent = msg;
  adminToast.classList.add('show');
  if (adminToastTimeout) clearTimeout(adminToastTimeout);
  adminToastTimeout = setTimeout(() => {
    adminToast.classList.remove('show');
  }, 2800);
}

// ---- INITIALIZE ----
checkAdminSession();
if (sessionStorage.getItem('sushilin_admin_logged') === 'true') {
  renderAdminOrders();
  renderAdminReservations();
}


// ---- GESTION DÉDIÉE DES RÉSERVATIONS ----
function updateAdminBadges() {
  const orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  const reservations = JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
  const ordersBadge = document.getElementById('total-orders-count');
  const resBadge = document.getElementById('total-reservations-count');
  if (ordersBadge) ordersBadge.textContent = orders.length;
  if (resBadge) resBadge.textContent = reservations.length;
}

function updateReservationStatus(resId, newStatus) {
  let resList = JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
  const idx = resList.findIndex(r => r.id === resId);
  if (idx !== -1) {
    resList[idx].status = newStatus;
    localStorage.setItem('sushilin_reservations', JSON.stringify(resList));
    renderAdminReservations();
    showToast(`Statut de la réservation ${resId} mis à jour !`);
  }
}

function generateTestReservation() {
  const now = new Date();
  const resId = 'RES-' + Date.now().toString().slice(-5);
  const dateStr = now.toISOString().split('T')[0];
  const testRes = {
    id: resId,
    timestamp: now.toISOString(),
    date: dateStr,
    service: '19h30',
    guests: '2',
    name: 'Mickaël Lin',
    phone: '06 12 34 56 78',
    email: 'mickael.lin@icloud.com',
    notes: 'Table au calme pour 2 personnes',
    status: 'confirmed'
  };

  const existingRes = JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
  existingRes.unshift(testRes);
  localStorage.setItem('sushilin_reservations', JSON.stringify(existingRes));

  renderAdminReservations();
  updateAdminBadges();
  showToast(`Réservation test ${resId} enregistrée !`);
}

function clearAllReservations() {
  if (!confirm("Voulez-vous vraiment effacer toutes les réservations ?")) return;
  localStorage.removeItem('sushilin_reservations');
  renderAdminReservations();
  updateAdminBadges();
  showToast("Historique des réservations réinitialisé !");
}
