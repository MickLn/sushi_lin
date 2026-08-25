
// ---- GESTION DES ALLERGÈNES ET PARFUMS ----
const ADMIN_MOCHI_FLAVORS = [
  'Pistache',
  'Caramel',
  'Thé vert',
  'Passion / Mangue',
  'Noix de coco',
  'Mangue',
  'Chocolat',
  'Yuzu',
  'Sésame',
  'Fraise',
  'Vanille',
  'Litchi',
  'Framboise'
];

function isMochiItem(item) {
  if (!item) return false;
  const id = (item.id || '').toLowerCase();
  const code = (item.code || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  return id === 'desserts-ds22' || id === 'd28' || code === 'd28' || code === 'ds22' || name.includes('mochi');
}

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
  maxOrdersPerSlotWeek: 5,
  maxOrdersPerSlotWeekend: 3,
  maxOrdersPerSlot: 5,
  maxReservationsPerSlot: 5,
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
    tr.className = 'admin-product-row';

    const thumbHtml = item.img
      ? `<img src="${item.img}" class="table-img-thumb" alt="${item.name}" onerror="this.outerHTML='<div class=\\'table-img-placeholder\\'></div>'">`
      : `<div class="table-img-placeholder"></div>`;

    const itemCode = item.code || (item.id ? item.id.replace(/^[a-z]+-/, '').toUpperCase() : '—');

    tr.innerHTML = `
      <td class="col-thumb">${thumbHtml}</td>
      <td class="col-code" style="text-align: center;">
        <span class="table-code-badge">${itemCode}</span>
      </td>
      <td class="col-info">
        <div class="card-mobile-top">
          <div class="card-mobile-thumb">${thumbHtml}</div>
          <div class="card-mobile-details">
            <div class="table-product-title-row">
              <span class="mobile-code-badge">${itemCode}</span>
              <span class="table-product-name">${item.name}</span>
            </div>
            <div class="table-mobile-meta">
              <span class="mobile-cat">${catLabel}</span>
              ${item.pieces ? `<span class="mobile-dot">•</span><span class="mobile-pieces">${item.pieces}</span>` : ''}
            </div>
            ${item.desc ? `<div class="table-product-desc" title="${item.desc}">${item.desc}</div>` : ''}
            ${(item.allergens && item.allergens.length > 0) ? `<div class="table-allergens-line">Allergènes : ${item.allergens.join(', ')}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="col-cat" style="text-align: center;">
        <span class="table-cat-badge">${catLabel}</span>
      </td>
      <td class="col-pieces" style="text-align: center;">
        <span class="table-pieces-text">${item.pieces || '—'}</span>
      </td>
      <td class="col-price" style="text-align: center;">
        <div class="price-input-wrap">
          <input type="number" step="0.10" min="0" value="${item.price.toFixed(2)}" onchange="handleInlinePriceChange('${item.id}', this.value)" aria-label="Prix de ${item.name}">
          <span class="price-unit">€</span>
        </div>
      </td>
      <td class="col-stock" style="text-align: center;">
        <button class="stock-toggle-btn ${item.available ? 'in-stock' : 'out-of-stock'}" onclick="toggleProductStock('${item.id}')">
          <span>${item.available ? 'En stock' : 'En rupture'}</span>
        </button>
      </td>
      <td class="col-actions" style="text-align: center;">
        <button class="btn-edit-item" onclick="openEditProductModal('${item.id}')" title="Modifier les détails">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span class="mobile-edit-label">Modifier</span>
        </button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.price-input-wrap') || e.target.closest('.stock-toggle-btn') || e.target.closest('input')) {
        return;
      }
      openEditProductModal(item.id);
    });

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
  removeProductPhoto();
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
  setProductPhotoPreview(item.img || '');
  document.getElementById('form-product-desc').value = item.desc || '';
  document.getElementById('form-product-available').checked = item.available !== false;

  // Set allergens
  const itemAllergens = getItemDefaultAllergens(item);
  document.querySelectorAll('input[name="admin-allergen"]').forEach(cb => {
    cb.checked = itemAllergens.some(a => a.toLowerCase() === cb.value.toLowerCase() || (cb.value === 'Céréales' && a.toLowerCase().includes('gluten')) || (cb.value === 'Poissons' && a.toLowerCase().includes('poisson')));
  });
  updateAdminAllergensCount();

  // Set mochi flavor stock availability
  const mochiSection = document.getElementById('admin-mochi-flavors-section');
  const mochiGrid = document.getElementById('admin-mochi-flavors-grid');
  const isMochi = isMochiItem(item);
  if (mochiSection && mochiGrid) {
    if (isMochi) {
      mochiSection.style.display = 'block';
      let unavailable = item.unavailableFlavors;
      if (!unavailable) {
        try {
          const raw = localStorage.getItem('sushilin_mochi_unavailable');
          if (raw) unavailable = JSON.parse(raw);
        } catch {}
      }
      unavailable = unavailable || [];
      mochiGrid.innerHTML = ADMIN_MOCHI_FLAVORS.map(flavor => {
        const isAvailable = !unavailable.includes(flavor);
        return `
          <label class="mochi-flavor-stock-item" style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${isAvailable ? 'var(--indigo-dark)' : 'var(--text-muted)'}; background: #FFFFFF; border: 1px solid var(--sakura-border); padding: 6px 8px; border-radius: 6px; cursor: pointer;">
            <input type="checkbox" name="admin-mochi-flavor" value="${flavor}" ${isAvailable ? 'checked' : ''} onchange="this.parentElement.style.color = this.checked ? 'var(--indigo-dark)' : 'var(--text-muted)'">
            <span>${flavor}</span>
          </label>
        `;
      }).join('');
    } else {
      mochiSection.style.display = 'none';
      mochiGrid.innerHTML = '';
    }
  }

  adminProductModal.classList.add('open');
  productModalBackdrop.classList.add('active');
}

function closeProductModal() {
  adminProductModal.classList.remove('open');
  productModalBackdrop.classList.remove('active');
}

// ---- PRODUCT PHOTO UPLOAD & PREVIEW ----
function compressAndSetImage(file) {
  if (!file) return;

  const previewImg = document.getElementById('admin-image-preview');
  const placeholder = document.getElementById('admin-image-placeholder');
  const hiddenInput = document.getElementById('form-product-img');
  const removeBtn = document.getElementById('btn-remove-photo');
  const uploadBtnText = document.getElementById('btn-upload-text');

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX_WIDTH = 600;
      const MAX_HEIGHT = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

      if (hiddenInput) hiddenInput.value = compressedDataUrl;
      if (previewImg) {
        previewImg.src = compressedDataUrl;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (uploadBtnText) uploadBtnText.textContent = 'Changer la photo';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleProductFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    compressAndSetImage(file);
  }
}

function removeProductPhoto() {
  const previewImg = document.getElementById('admin-image-preview');
  const placeholder = document.getElementById('admin-image-placeholder');
  const hiddenInput = document.getElementById('form-product-img');
  const removeBtn = document.getElementById('btn-remove-photo');
  const uploadBtnText = document.getElementById('btn-upload-text');
  const fileInput = document.getElementById('form-product-file');
  const urlInput = document.getElementById('form-product-url-input');

  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'flex';
  if (removeBtn) removeBtn.style.display = 'none';
  if (uploadBtnText) uploadBtnText.textContent = 'Choisir une photo';
}

function setProductPhotoPreview(imgSrc) {
  const previewImg = document.getElementById('admin-image-preview');
  const placeholder = document.getElementById('admin-image-placeholder');
  const hiddenInput = document.getElementById('form-product-img');
  const removeBtn = document.getElementById('btn-remove-photo');
  const uploadBtnText = document.getElementById('btn-upload-text');
  const urlInput = document.getElementById('form-product-url-input');

  if (imgSrc && imgSrc.trim()) {
    const val = imgSrc.trim();
    if (hiddenInput) hiddenInput.value = val;
    if (urlInput) urlInput.value = val.startsWith('http') ? val : '';
    if (previewImg) {
      previewImg.src = val;
      previewImg.style.display = 'block';
      previewImg.onerror = () => {
        previewImg.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
      };
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
    if (uploadBtnText) uploadBtnText.textContent = 'Changer la photo';
  } else {
    removeProductPhoto();
  }
}

function toggleImageUrlInput() {
  const container = document.getElementById('admin-url-input-container');
  if (container) {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  }
}

function handleManualUrlInput(url) {
  const hiddenInput = document.getElementById('form-product-img');
  const previewImg = document.getElementById('admin-image-preview');
  const placeholder = document.getElementById('admin-image-placeholder');
  const removeBtn = document.getElementById('btn-remove-photo');
  const uploadBtnText = document.getElementById('btn-upload-text');

  if (url && url.trim()) {
    const val = url.trim();
    if (hiddenInput) hiddenInput.value = val;
    if (previewImg) {
      previewImg.src = val;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
    if (uploadBtnText) uploadBtnText.textContent = 'Changer la photo';
  } else {
    removeProductPhoto();
  }
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
      if (isMochiItem(item)) {
        const allFlavors = ADMIN_MOCHI_FLAVORS;
        const checkedFlavors = Array.from(document.querySelectorAll('input[name="admin-mochi-flavor"]:checked')).map(cb => cb.value);
        item.unavailableFlavors = allFlavors.filter(f => !checkedFlavors.includes(f));
        localStorage.setItem('sushilin_mochi_unavailable', JSON.stringify(item.unavailableFlavors));
      }
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
  const maxOrdersWeekEl = document.getElementById('max-orders-week-input');
  if (maxOrdersWeekEl) maxOrdersWeekEl.value = ADMIN_SETTINGS.maxOrdersPerSlotWeek || ADMIN_SETTINGS.maxOrdersPerSlot || 5;
  const maxOrdersWeekendEl = document.getElementById('max-orders-weekend-input');
  if (maxOrdersWeekendEl) maxOrdersWeekendEl.value = ADMIN_SETTINGS.maxOrdersPerSlotWeekend || 3;
  const maxResEl = document.getElementById('max-reservations-slot-input');
  if (maxResEl) maxResEl.value = ADMIN_SETTINGS.maxReservationsPerSlot || 5;
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
  const maxOrdersWeekInput = document.getElementById('max-orders-week-input');
  ADMIN_SETTINGS.maxOrdersPerSlotWeek = maxOrdersWeekInput ? (parseInt(maxOrdersWeekInput.value, 10) || 5) : 5;
  const maxOrdersWeekendInput = document.getElementById('max-orders-weekend-input');
  ADMIN_SETTINGS.maxOrdersPerSlotWeekend = maxOrdersWeekendInput ? (parseInt(maxOrdersWeekendInput.value, 10) || 3) : 3;
  ADMIN_SETTINGS.maxOrdersPerSlot = ADMIN_SETTINGS.maxOrdersPerSlotWeek;
  const maxResInput = document.getElementById('max-reservations-slot-input');
  ADMIN_SETTINGS.maxReservationsPerSlot = maxResInput ? (parseInt(maxResInput.value, 10) || 5) : 5;
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
  } else if (tabName === 'stats') {
    renderStatsDashboard();
  } else if (tabName === 'reservations') {
    renderAdminReservations();
  }
}

// ==========================================================================
// STATISTIQUES & CHIFFRE D'AFFAIRES DASHBOARD MODULE
// ==========================================================================
let currentStatsPeriod = 'today';
let selectedStatsWeekOffset = 0;
let selectedStatsMonthKey = '';
let selectedStatsYear = new Date().getFullYear();

function parseOrderDate(order) {
  if (order.timestamp) {
    const d = new Date(order.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.dateFormatted) {
    const match = order.dateFormatted.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
  }
  return new Date();
}

function setStatsPeriod(period) {
  currentStatsPeriod = period;
  document.querySelectorAll('.stats-period-pills .period-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-period') === period);
  });
  renderStatsDashboard();
}

function handleStatsWeekChange(val) {
  selectedStatsWeekOffset = parseInt(val, 10) || 0;
  renderStatsDashboard();
}

function handleStatsMonthChange(val) {
  selectedStatsMonthKey = val;
  renderStatsDashboard();
}

function handleStatsYearChange(val) {
  selectedStatsYear = parseInt(val, 10) || new Date().getFullYear();
  renderStatsDashboard();
}

function updateStatsSubfilterUI(allOrders) {
  const container = document.getElementById('stats-subfilter-area');
  if (!container) return;

  const now = new Date();

  if (currentStatsPeriod === 'today') {
    const dateFormatted = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const capitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    container.innerHTML = `
      <div class="stats-subfilter-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>${capitalized}</span>
      </div>
    `;
    return;
  }

  if (currentStatsPeriod === 'week') {
    let optionsHtml = '';
    for (let i = 0; i <= 5; i++) {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMonday - (i * 7));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const monStr = mon.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const sunStr = sun.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

      let label = '';
      if (i === 0) label = `Cette semaine (${monStr} au ${sunStr})`;
      else if (i === 1) label = `Semaine dernière (${monStr} au ${sunStr})`;
      else label = `Il y a ${i} semaines (${monStr} au ${sunStr})`;

      optionsHtml += `<option value="${i}" ${i === selectedStatsWeekOffset ? 'selected' : ''}>${label}</option>`;
    }

    container.innerHTML = `
      <div class="stats-subfilter-select-group">
        <label for="stats-week-select">Semaine :</label>
        <select id="stats-week-select" class="stats-select" onchange="handleStatsWeekChange(this.value)">
          ${optionsHtml}
        </select>
      </div>
    `;
    return;
  }

  if (currentStatsPeriod === 'month') {
    const monthMap = new Map();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const capName = name.charAt(0).toUpperCase() + name.slice(1);
      monthMap.set(key, i === 0 ? `${capName} (Mois en cours)` : capName);
    }
    allOrders.forEach(o => {
      const d = parseOrderDate(o);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        const name = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        monthMap.set(key, name.charAt(0).toUpperCase() + name.slice(1));
      }
    });

    if (!selectedStatsMonthKey || !monthMap.has(selectedStatsMonthKey)) {
      selectedStatsMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    let optionsHtml = '';
    monthMap.forEach((label, key) => {
      optionsHtml += `<option value="${key}" ${key === selectedStatsMonthKey ? 'selected' : ''}>${label}</option>`;
    });

    container.innerHTML = `
      <div class="stats-subfilter-select-group">
        <label for="stats-month-select">Mois :</label>
        <select id="stats-month-select" class="stats-select" onchange="handleStatsMonthChange(this.value)">
          ${optionsHtml}
        </select>
      </div>
    `;
    return;
  }

  if (currentStatsPeriod === 'year') {
    const currentYear = now.getFullYear();
    const yearsSet = new Set([currentYear]);
    allOrders.forEach(o => {
      const d = parseOrderDate(o);
      yearsSet.add(d.getFullYear());
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    let optionsHtml = sortedYears.map(yr => {
      const isCurrent = yr === currentYear;
      const label = isCurrent ? `${yr} (Année en cours)` : `${yr}`;
      return `<option value="${yr}" ${yr === selectedStatsYear ? 'selected' : ''}>${label}</option>`;
    }).join('');

    container.innerHTML = `
      <div class="stats-subfilter-select-group">
        <label for="stats-year-select">Année :</label>
        <select id="stats-year-select" class="stats-select" onchange="handleStatsYearChange(this.value)">
          ${optionsHtml}
        </select>
      </div>
    `;
    return;
  }

  if (currentStatsPeriod === 'all') {
    container.innerHTML = `
      <div class="stats-subfilter-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>Toutes les commandes depuis le lancement</span>
      </div>
    `;
    return;
  }
}

function getFilteredOrdersForStats(allOrders) {
  const now = new Date();

  if (currentStatsPeriod === 'today') {
    return allOrders.filter(o => {
      const d = parseOrderDate(o);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    });
  }

  if (currentStatsPeriod === 'week') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMonday - (selectedStatsWeekOffset * 7));
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    return allOrders.filter(o => {
      const d = parseOrderDate(o);
      return d >= mon && d <= sun;
    });
  }

  if (currentStatsPeriod === 'month') {
    const targetKey = selectedStatsMonthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allOrders.filter(o => {
      const d = parseOrderDate(o);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === targetKey;
    });
  }

  if (currentStatsPeriod === 'year') {
    return allOrders.filter(o => {
      const d = parseOrderDate(o);
      return d.getFullYear() === selectedStatsYear;
    });
  }

  // 'all'
  return allOrders;
}

async function renderStatsDashboard() {
  const container = document.getElementById('stats-dashboard-content');
  if (!container) return;

  const allOrders = await syncAndGetOrders();
  updateStatsSubfilterUI(allOrders);

  const orders = getFilteredOrdersForStats(allOrders);
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; color: var(--text-secondary);">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--sakura-bg-soft); color: var(--sakura-vibrant); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
        </div>
        <p style="font-size: 16px; font-weight: 800; color: var(--indigo-dark); margin-bottom: 6px;">Aucune donnée de vente pour cette sélection</p>
        <p style="font-size: 13px; max-width: 420px; margin: 0 auto 16px;">Sélectionnez une autre semaine, mois ou période, ou simulez une commande de test pour visualiser les statistiques financières.</p>
        <button onclick="generateTestOrder()" style="background: var(--sakura-bg-soft); color: var(--indigo-primary); border: 1.5px solid var(--sakura-border-strong); padding: 8px 18px; border-radius: var(--radius-md); font-weight: 800; cursor: pointer; font-size: 13px;">
          + Créer une commande de test
        </button>
      </div>
    `;
    return;
  }

  // 1. KPIs
  let totalRevenue = 0;
  let totalItemsCount = 0;
  let midiRevenue = 0;
  let midiOrdersCount = 0;
  let soirRevenue = 0;
  let soirOrdersCount = 0;

  const itemsMap = new Map();
  const mochiFlavorsMap = new Map();
  const catRevenueMap = new Map();
  let saucesCount = { sucree: 0, salee: 0, none: 0 };
  let baguettesCount = { yes: 0, no: 0 };

  orders.forEach(order => {
    let orderTotal = parseFloat(order.total);
    if (isNaN(orderTotal) || orderTotal <= 0) {
      orderTotal = (order.items || []).reduce((acc, it) => acc + ((parseFloat(it.price) || 0) * (parseInt(it.qty || it.quantity) || 1)), 0);
    }
    
    // Check midi vs soir: pickupTime < 16h or timestamp hour < 16
    let isMidi = false;
    if (order.pickupTime) {
      const match = order.pickupTime.match(/(\d+)h/i);
      if (match) {
        isMidi = parseInt(match[1], 10) < 16;
      }
    } else {
      const d = parseOrderDate(order);
      isMidi = d.getHours() < 16;
    }

    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const qty = parseInt(item.qty || item.quantity || item.totalQuantity) || 1;
        const price = parseFloat(item.price || item.unitPrice) || 0;
        const lineTotal = price * qty;
        totalItemsCount += qty;

        // Items map
        const key = String(item.id || item.code || item.name);
        const existing = itemsMap.get(key) || {
          id: item.id,
          code: item.code || '',
          name: item.name || 'Plat',
          cat: item.cat || '',
          qty: 0,
          revenue: 0
        };
        existing.qty += qty;
        existing.revenue += lineTotal;
        itemsMap.set(key, existing);

        // Mochi flavors
        if (Array.isArray(item.details)) {
          item.details.forEach(d => {
            const fName = d.flavor || d.name;
            const fQty = parseInt(d.quantity) || 1;
            mochiFlavorsMap.set(fName, (mochiFlavorsMap.get(fName) || 0) + fQty);
          });
        }

        // Category breakdown
        const catKey = item.cat || 'Autre';
        catRevenueMap.set(catKey, (catRevenueMap.get(catKey) || 0) + lineTotal);
      });
    }

    totalRevenue += orderTotal;

    if (isMidi) {
      midiRevenue += orderTotal;
      midiOrdersCount++;
    } else {
      soirRevenue += orderTotal;
      soirOrdersCount++;
    }

    // Sauces & Baguettes
    const sauce = (order.sauceChoice || '').toLowerCase();
    if (sauce.includes('sucr')) saucesCount.sucree++;
    else if (sauce.includes('sal')) saucesCount.salee++;
    else saucesCount.none++;

    const bag = (order.baguettesChoice || '').toLowerCase();
    if (bag.includes('sans') || bag === '0') baguettesCount.no++;
    else baguettesCount.yes++;
  });

  const ordersCount = orders.length;
  const avgTicket = ordersCount > 0 ? (totalRevenue / ordersCount) : 0;
  const midiAvg = midiOrdersCount > 0 ? (midiRevenue / midiOrdersCount) : 0;
  const soirAvg = soirOrdersCount > 0 ? (soirRevenue / soirOrdersCount) : 0;

  const topItems = Array.from(itemsMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const topMochis = Array.from(mochiFlavorsMap.entries())
    .map(([flavor, count]) => ({ flavor, count }))
    .sort((a, b) => b.count - a.count);

  const sortedCats = Array.from(catRevenueMap.entries())
    .map(([cat, rev]) => ({ cat, rev, pct: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0 }))
    .sort((a, b) => b.rev - a.rev);

  const midiPct = totalRevenue > 0 ? Math.round((midiRevenue / totalRevenue) * 100) : 50;
  const soirPct = 100 - midiPct;

  container.innerHTML = `
    <!-- 4 KPI CARDS -->
    <div class="stats-kpi-grid">
      <div class="stats-kpi-card highlight">
        <div class="kpi-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Chiffre d'Affaires</span>
          <div class="kpi-val">${totalRevenue.toFixed(2).replace('.', ',')} <span class="kpi-currency">€</span></div>
        </div>
      </div>

      <div class="stats-kpi-card">
        <div class="kpi-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Commandes validées</span>
          <div class="kpi-val">${ordersCount}</div>
        </div>
      </div>

      <div class="stats-kpi-card">
        <div class="kpi-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Panier moyen</span>
          <div class="kpi-val">${avgTicket.toFixed(2).replace('.', ',')} <span class="kpi-currency">€</span></div>
        </div>
      </div>

      <div class="stats-kpi-card">
        <div class="kpi-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Portions & Plats vendus</span>
          <div class="kpi-val">${totalItemsCount}</div>
        </div>
      </div>
    </div>

    <!-- COMPARATIF SERVICE DU MIDI vs SERVICE DU SOIR -->
    <div class="stats-section-box mt-20">
      <div class="stats-box-head">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          <h3>Répartition des ventes : Service du Midi vs Soir</h3>
        </div>
      </div>
      
      <div class="service-split-bar-wrapper">
        <div class="service-split-bar">
          <div class="split-segment midi" style="width: ${midiPct}%;" title="Midi : ${midiPct}%">
            ${midiPct > 15 ? `<span>Midi (${midiPct}%)</span>` : ''}
          </div>
          <div class="split-segment soir" style="width: ${soirPct}%;" title="Soir : ${soirPct}%">
            ${soirPct > 15 ? `<span>Soir (${soirPct}%)</span>` : ''}
          </div>
        </div>

        <div class="service-split-details">
          <div class="service-col midi">
            <div class="service-col-title">
              <span class="service-dot"></span>
              <span>Service du Midi (12h00 - 14h30)</span>
            </div>
            <div class="service-metrics">
              <div class="service-metric-item">
                <span class="metric-label">CA Midi :</span>
                <span class="metric-val">${midiRevenue.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div class="service-metric-item">
                <span class="metric-label">Commandes :</span>
                <span class="metric-val">${midiOrdersCount}</span>
              </div>
              <div class="service-metric-item">
                <span class="metric-label">Panier moyen :</span>
                <span class="metric-val">${midiAvg.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>
          </div>

          <div class="service-col soir">
            <div class="service-col-title">
              <span class="service-dot"></span>
              <span>Service du Soir (18h30 - 22h00)</span>
            </div>
            <div class="service-metrics">
              <div class="service-metric-item">
                <span class="metric-label">CA Soir :</span>
                <span class="metric-val">${soirRevenue.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div class="service-metric-item">
                <span class="metric-label">Commandes :</span>
                <span class="metric-val">${soirOrdersCount}</span>
              </div>
              <div class="service-metric-item">
                <span class="metric-label">Panier moyen :</span>
                <span class="metric-val">${soirAvg.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2 COLUMNS: TOP 10 ITEMS + CATEGORIES & MOCHIS -->
    <div class="stats-two-cols mt-20">
      
      <!-- TOP 10 BEST SELLERS -->
      <div class="stats-section-box">
        <div class="stats-box-head">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7.5"/><path d="M14 14.66V17c0 .55.45 1 1 1h1.5"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <h3>Top 10 des Meilleurs Plats</h3>
          </div>
          <span style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">${topItems.length} plats classés</span>
        </div>

        <div class="stats-top-table-wrap">
          <table class="stats-top-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Rang</th>
                <th>Plat</th>
                <th style="text-align: center;">Ventes</th>
                <th style="text-align: right;">CA (€)</th>
                <th style="text-align: right;">Part CA</th>
              </tr>
            </thead>
            <tbody>
              ${topItems.map((item, idx) => {
                const pct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;
                return `
                  <tr>
                    <td style="text-align: center;">
                      <span class="stats-rank-badge ${idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''))}">${idx + 1}</span>
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${item.code ? `<span class="stats-code-badge">${item.code}</span>` : ''}
                        <span style="font-weight: 800; color: var(--indigo-dark);">${item.name}</span>
                      </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; color: var(--sakura-vibrant);">${item.qty}</td>
                    <td style="text-align: right; font-weight: 800; color: var(--indigo-dark);">${item.revenue.toFixed(2).replace('.', ',')} €</td>
                    <td style="text-align: right; font-weight: 700; color: var(--text-secondary);">${pct}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIGHT COLUMN: CATEGORIES + MOCHIS + CONSUMABLES -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- CATÉGORIES -->
        <div class="stats-section-box">
          <div class="stats-box-head">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <h3>Répartition par Catégorie</h3>
            </div>
          </div>

          <div class="stats-cats-list">
            ${sortedCats.map(c => `
              <div class="stats-cat-row">
                <div class="stats-cat-head">
                  <span class="cat-name">${c.cat}</span>
                  <span class="cat-rev">${c.rev.toFixed(2).replace('.', ',')} € <strong>(${c.pct}%)</strong></span>
                </div>
                <div class="stats-cat-bar-bg">
                  <div class="stats-cat-bar-fill" style="width: ${c.pct}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- TOP PARFUMS MOCHIS (SI VENTES) -->
        ${topMochis.length > 0 ? `
        <div class="stats-section-box">
          <div class="stats-box-head">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
              <h3>Ventes par Parfum de Mochis</h3>
            </div>
          </div>
          <div class="mochi-stats-grid">
            ${topMochis.map(m => `
              <div class="mochi-stat-item">
                <span class="mochi-stat-name">${m.flavor}</span>
                <span class="mochi-stat-qty">${m.count} vendus</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- CONSOMMABLES (SAUCES & BAGUETTES) -->
        <div class="stats-section-box">
          <div class="stats-box-head">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <h3>Préférences & Consommables</h3>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="background: var(--admin-bg); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
              <div style="font-size: 11.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Sauces demandées</div>
              <div style="font-size: 12.5px; font-weight: 700; color: var(--indigo-dark); line-height: 1.6;">
                <div>• Sucrée : <strong>${saucesCount.sucree}</strong></div>
                <div>• Salée : <strong>${saucesCount.salee}</strong></div>
                <div>• Sans sauce : <strong>${saucesCount.none}</strong></div>
              </div>
            </div>
            <div style="background: var(--admin-bg); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
              <div style="font-size: 11.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Baguettes</div>
              <div style="font-size: 12.5px; font-weight: 700; color: var(--indigo-dark); line-height: 1.6;">
                <div>• Avec baguettes : <strong>${baguettesCount.yes}</strong></div>
                <div>• Sans baguette : <strong style="color: var(--sakura-vibrant);">${baguettesCount.no}</strong></div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

async function exportStatsCsv() {
  const allOrders = await syncAndGetOrders();
  const orders = getFilteredOrdersForStats(allOrders);
  if (orders.length === 0) {
    showToast('Aucune commande à exporter pour cette période.');
    return;
  }

  const csvRows = [
    ['Numero Commande', 'Date', 'Heure', 'Heure Retrait', 'Nom Client', 'Telephone', 'Email', 'Service', 'Nb Articles', 'Total TTC (EUR)', 'Sauces', 'Baguettes', 'Remarques', 'Detail Plats'].join(';')
  ];

  orders.forEach(order => {
    let orderTotal = parseFloat(order.total);
    if (isNaN(orderTotal) || orderTotal <= 0) {
      orderTotal = (order.items || []).reduce((acc, it) => acc + ((parseFloat(it.price) || 0) * (parseInt(it.qty || it.quantity) || 1)), 0);
    }
    let itemsCount = 0;
    let itemsDetail = [];

    if (Array.isArray(order.items)) {
      order.items.forEach(i => {
        const q = parseInt(i.qty || i.quantity) || 1;
        const p = parseFloat(i.price || i.unitPrice) || 0;
        itemsCount += q;
        let dStr = `${q}x ${i.name}`;
        if (Array.isArray(i.details)) {
          dStr += ` (${i.details.map(d => `${d.quantity}x ${d.flavor}`).join(', ')})`;
        }
        itemsDetail.push(dStr);
      });
    }

    const d = parseOrderDate(order);
    const dateStr = d.toLocaleDateString('fr-FR');
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const isMidi = d.getHours() < 16;

    const row = [
      `"${order.id}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${order.pickupTime || ''}"`,
      `"${(order.customerName || '').replace(/"/g, '""')}"`,
      `"${(order.customerPhone || '').replace(/"/g, '""')}"`,
      `"${(order.customerEmail || '').replace(/"/g, '""')}"`,
      `"${isMidi ? 'Midi' : 'Soir'}"`,
      itemsCount,
      orderTotal.toFixed(2).replace('.', ','),
      `"${(order.sauceChoice || '').replace(/"/g, '""')}"`,
      `"${(order.baguettesChoice || '').replace(/"/g, '""')}"`,
      `"${(order.comment || '').replace(/"/g, '""')}"`,
      `"${itemsDetail.join(' | ').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(';'));
  });

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `rapport_ventes_sushilin_${currentStatsPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Rapport des ventes exporté avec succès en CSV !');
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

let currentOrdersDateFilter = 'today';
let currentOrdersCustomDate = '';

function setOrdersDateFilter(filter) {
  currentOrdersDateFilter = filter;
  ['today', 'yesterday', 'week', 'all'].forEach(f => {
    const pill = document.getElementById(`pill-orders-${f}`);
    if (pill) pill.classList.toggle('active', f === filter);
  });
  const dateInput = document.getElementById('orders-custom-date-picker');
  if (dateInput && filter !== 'custom') dateInput.value = '';
  renderAdminOrders();
}

function setOrdersCustomDate(val) {
  if (!val) return;
  currentOrdersCustomDate = val;
  currentOrdersDateFilter = 'custom';
  ['today', 'yesterday', 'week', 'all'].forEach(f => {
    const pill = document.getElementById(`pill-orders-${f}`);
    if (pill) pill.classList.remove('active');
  });
  renderAdminOrders();
}

let currentResDateFilter = 'today';
let currentResCustomDate = '';

function setResDateFilter(filter) {
  currentResDateFilter = filter;
  ['today', 'upcoming', 'week', 'all'].forEach(f => {
    const pill = document.getElementById(`pill-res-${f}`);
    if (pill) pill.classList.toggle('active', f === filter);
  });
  const dateInput = document.getElementById('res-custom-date-picker');
  if (dateInput && filter !== 'custom') dateInput.value = '';
  renderAdminReservations();
}

function setResCustomDate(val) {
  if (!val) return;
  currentResCustomDate = val;
  currentResDateFilter = 'custom';
  ['today', 'upcoming', 'week', 'all'].forEach(f => {
    const pill = document.getElementById(`pill-res-${f}`);
    if (pill) pill.classList.remove('active');
  });
  renderAdminReservations();
}

function parseReservationDate(res) {
  if (res.date) {
    if (res.date.includes('-')) {
      const parts = res.date.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const match = res.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const d = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  if (res.timestamp) {
    const d = new Date(res.timestamp);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toggleDayGroup(groupId) {
  const el = document.getElementById(groupId);
  if (el) {
    el.classList.toggle('is-open');
  }
}

function renderSingleOrderCard(order) {
  return `
    <div class="admin-order-card">
      <div class="admin-order-card-header">
        <div>
          <span class="admin-order-id">#${order.id}</span>
          <div class="admin-order-date">${order.dateFormatted || (order.timestamp ? new Date(order.timestamp).toLocaleString('fr-FR') : 'Aujourd\'hui')}</div>
        </div>
        <span class="admin-order-type-badge">A emporter</span>
      </div>

      <div class="admin-order-info-box">
        ${order.customerName ? `
        <div class="admin-info-row">
          <span class="admin-info-label">Client :</span>
          <span class="admin-info-val" style="font-weight: 800; color: var(--indigo-dark);">${order.customerName}</span>
        </div>
        ` : ''}
        ${order.customerPhone ? `
        <div class="admin-info-row">
          <span class="admin-info-label">Téléphone :</span>
          <span class="admin-info-val"><a href="tel:${order.customerPhone}" style="color: var(--sakura-vibrant); font-weight: 800; text-decoration: none;">${order.customerPhone}</a></span>
        </div>
        ` : ''}
        ${order.customerEmail ? `
        <div class="admin-info-row">
          <span class="admin-info-label">E-mail :</span>
          <span class="admin-info-val" style="font-size: 12.5px; word-break: break-all; color: var(--text-secondary);">${order.customerEmail}</span>
        </div>
        ` : ''}
        <div class="admin-info-row">
          <span class="admin-info-label">Heure de retrait :</span>
          <span class="admin-info-val admin-info-highlight">${order.pickupTime || 'Dès que possible'}</span>
        </div>
        <div class="admin-info-row admin-prefs-divider">
          <span class="admin-info-label">Baguettes :</span>
          <span class="admin-info-val">${order.baguettesChoice === '0' || order.baguettesChoice === 'Sans baguette' ? 'Sans baguette' : (order.baguettesChoice && !order.baguettesChoice.includes('paire') ? (order.baguettesChoice + (parseInt(order.baguettesChoice) > 1 ? ' paires' : ' paire')) : (order.baguettesChoice || '1 paire'))}</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Sauces :</span>
          <span class="admin-info-val">${order.sauceChoice || 'Sauce sucrée'}</span>
        </div>
        ${order.comment ? `
        <div class="admin-info-row admin-note-row">
          <span class="admin-info-label">Remarques :</span>
          <span class="admin-info-val admin-note-val">${order.comment}</span>
        </div>
        ` : ''}
      </div>

      <div class="admin-order-items-wrap">
        <div class="admin-items-title">Detail des plats (${order.itemCount || (order.items && order.items.length) || 1}) :</div>
        <div class="admin-items-list">
          ${(order.items || []).map(item => `
            <div class="admin-item-row">
              <div class="admin-item-left">
                <span class="admin-item-qty">${item.qty || 1}x</span>
                ${item.code ? `<span class="admin-item-code-tag">${item.code}</span>` : ''}
                <span class="admin-item-name">${item.name}</span>
                ${item.details ? `<div class="admin-item-details-list">${item.details.map(d => `${d.quantity}x ${d.flavor}`).join(', ')}</div>` : ''}
              </div>
              <div class="admin-item-price">${((item.price || item.unitPrice || 0) * (item.qty || item.totalQuantity || 1)).toFixed(2).replace('.', ',')} €</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="admin-order-card-footer">
        <div class="admin-order-total-row">
          <span>Total :</span>
          <span>${(order.total || 0).toFixed(2).replace('.', ',')} €</span>
        </div>

        <div class="admin-order-actions">
          <button onclick="window.print()" class="btn-order-print">
            Imprimer ticket
          </button>
          <button onclick="deleteOrder('${order.id}')" class="btn-order-delete">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSingleReservationCard(res) {
  return `
    <div class="admin-order-card">
      <div class="admin-order-card-header">
        <div>
          <span class="admin-order-id">${res.name}</span>
          <div class="admin-order-date">Réservation #${res.id}</div>
          ${res.email ? `<div class="admin-order-email">${res.email}</div>` : ''}
        </div>
        <span style="background: rgba(76, 175, 80, 0.12); color: #2E7D32; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 800;">
          ${res.status === 'confirmed' ? 'Confirmee' : res.status || 'Confirmee'}
        </span>
      </div>

      <div class="admin-order-info-box" style="margin-bottom: 16px;">
        <div class="admin-info-row">
          <span class="admin-info-label">Date :</span>
          <span class="admin-info-val" style="font-weight: 800; color: var(--indigo-dark);">${res.date}</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Creneau :</span>
          <span class="admin-info-val admin-info-highlight">${res.service}</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Couverts :</span>
          <span class="admin-info-val" style="font-weight: 800;">${res.guests} personne(s)</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Telephone :</span>
          <span class="admin-info-val"><a href="tel:${res.phone}" style="color: var(--sakura-vibrant); font-weight: 800; text-decoration: none;">${res.phone}</a></span>
        </div>
        ${res.notes ? `
        <div class="admin-info-row admin-note-row" style="margin-top: 6px;">
          <span class="admin-info-label">Remarques :</span>
          <span class="admin-info-val">${res.notes}</span>
        </div>
        ` : ''}
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--sakura-border);">
        <button onclick="deleteReservation('${res.id}')" class="btn-order-delete">
          Supprimer
        </button>
      </div>
    </div>
  `;
}

async function renderAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  const badgeNav = document.getElementById('total-orders-count');
  const badgeSubtab = document.getElementById('badge-subtab-orders');
  if (!container) return;

  const allOrders = await syncAndGetOrders();

  if (badgeNav) badgeNav.textContent = allOrders.length;
  if (badgeSubtab) badgeSubtab.textContent = allOrders.length;

  if (allOrders.length === 0) {
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

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  let filteredOrders = [];

  if (currentOrdersDateFilter === 'today') {
    filteredOrders = allOrders.filter(o => {
      const d = parseOrderDate(o);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === todayKey;
    });
  } else if (currentOrdersDateFilter === 'yesterday') {
    filteredOrders = allOrders.filter(o => {
      const d = parseOrderDate(o);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === yesterdayKey;
    });
  } else if (currentOrdersDateFilter === 'custom') {
    filteredOrders = allOrders.filter(o => {
      const d = parseOrderDate(o);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === currentOrdersCustomDate;
    });
  } else if (currentOrdersDateFilter === 'week') {
    filteredOrders = allOrders.filter(o => {
      const d = parseOrderDate(o);
      return d >= weekAgo;
    });
  } else {
    // 'all'
    filteredOrders = allOrders;
  }

  // Direct single day view for Today, Yesterday or Custom Date (No redundant banner)
  if (currentOrdersDateFilter === 'today' || currentOrdersDateFilter === 'yesterday' || currentOrdersDateFilter === 'custom') {
    if (filteredOrders.length === 0) {
      let emptyMsg = "Aucune commande enregistrée pour aujourd'hui";
      if (currentOrdersDateFilter === 'yesterday') emptyMsg = "Aucune commande enregistrée pour hier";
      else if (currentOrdersDateFilter === 'custom') emptyMsg = "Aucune commande pour la date sélectionnée";

      container.innerHTML = `
        <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 36px 20px; text-align: center; color: var(--text-secondary); margin-top: 6px;">
          <p style="font-size: 15px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">${emptyMsg}</p>
          <p style="font-size: 13px;">Sélectionnez une autre date ou cliquez sur "Simuler une commande test" pour tester l'interface.</p>
        </div>
      `;
      return;
    }

    filteredOrders.sort((a, b) => parseOrderDate(b) - parseOrderDate(a));

    container.innerHTML = `
      <div class="admin-orders-grid">
        ${filteredOrders.map(order => renderSingleOrderCard(order)).join('')}
      </div>
    `;
    return;
  }

  // Multi-day grouped view ('week' or 'all')
  const groupsMap = new Map();
  filteredOrders.forEach(order => {
    const d = parseOrderDate(order);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    let group = groupsMap.get(dateKey);
    if (!group) {
      const isToday = (dateKey === todayKey);
      const isYesterday = (dateKey === yesterdayKey);
      let label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
      
      let title = label;
      if (isToday) title = `Aujourd'hui — ${label}`;
      else if (isYesterday) title = `Hier — ${label}`;

      group = {
        dateKey,
        d,
        title,
        isToday,
        isYesterday,
        orders: [],
        totalRevenue: 0
      };
      groupsMap.set(dateKey, group);
    }

    let oTotal = parseFloat(order.total);
    if (isNaN(oTotal) || oTotal <= 0) {
      oTotal = (order.items || []).reduce((acc, it) => acc + ((parseFloat(it.price) || 0) * (parseInt(it.qty || it.quantity) || 1)), 0);
    }
    group.totalRevenue += oTotal;
    group.orders.push(order);
  });

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.d - a.d);
  const hasToday = sortedGroups.some(g => g.isToday);

  if (sortedGroups.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 36px 20px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 15px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">Aucune commande trouvée</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sortedGroups.map((group, idx) => {
    const isOpen = group.isToday || (!hasToday && idx === 0);
    const groupId = `orders-group-${group.dateKey}`;

    return `
      <div class="admin-day-group ${group.isToday ? 'is-today' : ''} ${isOpen ? 'is-open' : ''}" id="${groupId}">
        <div class="admin-day-header" onclick="toggleDayGroup('${groupId}')">
          <div class="admin-day-title-wrap">
            <div class="admin-day-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <span class="admin-day-title">${group.title}</span>
          </div>

          <div class="admin-day-meta">
            <span class="admin-day-stat-pill">${group.orders.length} commande${group.orders.length > 1 ? 's' : ''}</span>
            <span class="admin-day-stat-pill rev">${group.totalRevenue.toFixed(2).replace('.', ',')} €</span>
          </div>
        </div>

        <div class="admin-day-content">
          <div class="admin-orders-grid">
            ${group.orders.map(order => renderSingleOrderCard(order)).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
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

  const allRes = await syncAndGetReservations();
  if (badgeSubtab) badgeSubtab.textContent = allRes.length;

  if (allRes.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 16px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">Aucune réservation enregistrée</p>
        <p style="font-size: 13.5px;">Les demandes faites depuis la page de réservation s'afficheront ici en direct.</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  let filteredRes = [];

  if (currentResDateFilter === 'today') {
    filteredRes = allRes.filter(r => {
      const d = parseReservationDate(r);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === todayKey;
    });
  } else if (currentResDateFilter === 'upcoming') {
    filteredRes = allRes.filter(r => {
      const d = parseReservationDate(r);
      return d >= now;
    });
  } else if (currentResDateFilter === 'week') {
    filteredRes = allRes.filter(r => {
      const d = parseReservationDate(r);
      return d >= weekAgo;
    });
  } else if (currentResDateFilter === 'custom') {
    filteredRes = allRes.filter(r => {
      const d = parseReservationDate(r);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === currentResCustomDate;
    });
  } else {
    // 'all'
    filteredRes = allRes;
  }

  // Direct single day view for Today or Custom Date (No redundant banner)
  if (currentResDateFilter === 'today' || currentResDateFilter === 'custom') {
    if (filteredRes.length === 0) {
      let emptyMsg = "Aucune réservation enregistrée pour aujourd'hui";
      if (currentResDateFilter === 'custom') emptyMsg = "Aucune réservation pour la date sélectionnée";

      container.innerHTML = `
        <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 36px 20px; text-align: center; color: var(--text-secondary); margin-top: 6px;">
          <p style="font-size: 15px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">${emptyMsg}</p>
          <p style="font-size: 13px;">Sélectionnez "À venir" ou "Toutes les dates" pour consulter les autres réservations.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-res-grid">
        ${filteredRes.map(res => renderSingleReservationCard(res)).join('')}
      </div>
    `;
    return;
  }

  // Multi-day grouped view ('upcoming', 'week', 'all')
  const groupsMap = new Map();
  filteredRes.forEach(res => {
    const d = parseReservationDate(res);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    let group = groupsMap.get(dateKey);
    if (!group) {
      const isToday = (dateKey === todayKey);
      const isFuture = (d > now);
      const isPast = (d < now && !isToday);

      let label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1);

      let title = label;
      if (isToday) title = `Aujourd'hui — ${label}`;

      group = {
        dateKey,
        d,
        title,
        isToday,
        isFuture,
        isPast,
        reservations: [],
        totalGuests: 0
      };
      groupsMap.set(dateKey, group);
    }

    group.totalGuests += parseInt(res.guests, 10) || 1;
    group.reservations.push(res);
  });

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.d - a.d);
  const hasTodayOrFuture = sortedGroups.some(g => g.isToday || g.isFuture);

  if (sortedGroups.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px dashed var(--sakura-border); border-radius: var(--radius-lg); padding: 36px 20px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 15px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 6px;">Aucune réservation trouvée</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sortedGroups.map((group, idx) => {
    const isOpen = group.isToday || group.isFuture || (!hasTodayOrFuture && idx === 0);
    const groupId = `res-group-${group.dateKey}`;

    return `
      <div class="admin-day-group ${group.isToday ? 'is-today' : ''} ${isOpen ? 'is-open' : ''}" id="${groupId}">
        <div class="admin-day-header" onclick="toggleDayGroup('${groupId}')">
          <div class="admin-day-title-wrap">
            <div class="admin-day-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <span class="admin-day-title">${group.title}</span>
          </div>

          <div class="admin-day-meta">
            <span class="admin-day-stat-pill">${group.reservations.length} réservation${group.reservations.length > 1 ? 's' : ''}</span>
            <span class="admin-day-stat-pill rev">${group.totalGuests} couvert${group.totalGuests > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="admin-day-content">
          <div class="admin-res-grid">
            ${group.reservations.map(res => renderSingleReservationCard(res)).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
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
  renderStatsDashboard();
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
  const today = now.toISOString().slice(0, 10);
  let orderId = '1';
  try {
    const raw = localStorage.getItem('sushilin_daily_counter');
    const data = raw ? JSON.parse(raw) : null;
    let nextNum = 1;
    if (data && data.date === today && Number.isInteger(data.count)) {
      nextNum = data.count + 1;
    } else {
      const existing = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
      const todayOrders = existing.filter(o => o.timestamp && o.timestamp.slice(0, 10) === today);
      nextNum = todayOrders.length + 1;
    }
    localStorage.setItem('sushilin_daily_counter', JSON.stringify({ date: today, count: nextNum }));
    orderId = String(nextNum);
  } catch {
    orderId = '1';
  }

  const testOrder = {
    id: orderId,
    timestamp: now.toISOString(),
    dateFormatted: now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    customerName: 'Jean Dupont',
    customerPhone: '06 12 34 56 78',
    customerEmail: 'jean.dupont@test.fr',
    pickupTime: '19h30',
    sauceChoice: '2 sucrée, 1 salée',
    baguettesChoice: '2 paires',
    comment: 'Bien cuit les brochettes s\'il vous plaît',
    items: testItems,
    subtotal: subtotal,
    discount: discount,
    total: total,
    status: 'pending'
  };

  // Envoi vers l'API backend si disponible
  fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testOrder)
  }).catch(() => {});

  const existingOrders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  existingOrders.unshift(testOrder);
  localStorage.setItem('sushilin_orders', JSON.stringify(existingOrders));

  renderAdminOrders();
  renderStatsDashboard();
  showToast(`Commande test ${orderId} générée avec succès !`);
}

// Écouteur en direct pour actualiser le dashboard dès qu'une commande est passée dans un autre onglet
window.addEventListener('storage', (e) => {
  if (e.key === 'sushilin_orders' || e.key === 'sushilin_reservations') {
    renderAdminOrders();
    renderAdminReservations();
    renderStatsDashboard();
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

function getNextDailyReservationNumber() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const savedCounter = JSON.parse(localStorage.getItem('sushilin_daily_res_counter') || '{}');
    let nextNum = 1;
    if (savedCounter.date === today && typeof savedCounter.count === 'number') {
      nextNum = savedCounter.count + 1;
    } else {
      const existing = JSON.parse(localStorage.getItem('sushilin_reservations') || '[]');
      const todayRes = existing.filter(r => r.timestamp && r.timestamp.slice(0, 10) === today);
      nextNum = todayRes.length + 1;
    }
    localStorage.setItem('sushilin_daily_res_counter', JSON.stringify({ date: today, count: nextNum }));
    return String(nextNum);
  } catch {
    return '1';
  }
}

function generateTestReservation() {
  const now = new Date();
  const resId = getNextDailyReservationNumber();
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
  showToast(`Réservation test #${resId} enregistrée !`);
}

function clearAllReservations() {
  if (!confirm("Voulez-vous vraiment effacer toutes les réservations ?")) return;
  localStorage.removeItem('sushilin_reservations');
  renderAdminReservations();
  updateAdminBadges();
  showToast("Historique des réservations réinitialisé !");
}
