
// ==========================================================================
// MODULE MOCHIS GLACÉS (13 PARFUMS INDIVIDUELS - CODE D28 - 2,80 €)
// ==========================================================================
const MOCHI_FLAVORS = [
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

let mochiSelection = {};
let currentMochiItem = null;

function isMochiItem(item) {
  if (!item) return false;
  const id = (item.id || '').toLowerCase();
  const code = (item.code || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  return id === 'desserts-ds22' || id === 'd28' || code === 'd28' || code === 'ds22' || name.includes('mochi');
}

function openMochiModal(item) {
  currentMochiItem = item || {
    id: 'D28',
    code: 'D28',
    name: 'Mochis glacés',
    price: 2.80,
    cat: 'desserts'
  };

  const mochiModal = document.getElementById('mochi-modal');
  const mochiOverlay = document.getElementById('mochi-overlay');
  if (!mochiModal || !mochiOverlay) {
    console.error('[Mochi] Modal or overlay element not found', { mochiModal, mochiOverlay });
    return;
  }
  mochiModal.classList.add('open');
  mochiOverlay.classList.add('active');
  mochiOverlay.classList.add('open');
  mochiOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Réinitialisation de tous les compteurs à 0 — after visibility to avoid throw hiding modal
  mochiSelection = {};
  MOCHI_FLAVORS.forEach(flavor => {
    mochiSelection[flavor] = 0;
  });

  try {
    renderMochiFlavorsList();
  } catch (e) {
    console.error('[Mochi] renderMochiFlavorsList failed', e);
  }
  try {
    updateMochiModalTotals();
  } catch (e) {
    console.error('[Mochi] updateMochiModalTotals failed', e);
  }
}

function closeMochiModal() {
  const mochiModal = document.getElementById('mochi-modal');
  const mochiOverlay = document.getElementById('mochi-overlay');
  if (mochiModal) mochiModal.classList.remove('open');
  if (mochiOverlay) {
    mochiOverlay.classList.remove('active');
    mochiOverlay.classList.remove('open');
    mochiOverlay.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
}

function getMochiUnavailableFlavors() {
  // 1. Direct dedicated storage key
  try {
    const rawDirect = localStorage.getItem('sushilin_mochi_unavailable');
    if (rawDirect) {
      const parsed = JSON.parse(rawDirect);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  // 2. From MENU_DATA items
  if (typeof MENU_DATA !== 'undefined' && Array.isArray(MENU_DATA?.items)) {
    const mochi = MENU_DATA.items.find(m => isMochiItem(m));
    if (mochi && Array.isArray(mochi.unavailableFlavors)) {
      return mochi.unavailableFlavors;
    }
  }

  // 3. From currentMochiItem
  if (currentMochiItem && Array.isArray(currentMochiItem.unavailableFlavors)) {
    return currentMochiItem.unavailableFlavors;
  }

  // 4. From sushilin_admin_menu in localStorage
  try {
    const rawAdmin = localStorage.getItem('sushilin_admin_menu');
    if (rawAdmin) {
      const parsed = JSON.parse(rawAdmin);
      const mochi = parsed.items?.find(m => isMochiItem(m));
      if (mochi && Array.isArray(mochi.unavailableFlavors)) {
        return mochi.unavailableFlavors;
      }
    }
  } catch {}

  return [];
}

function renderMochiFlavorsList() {
  const listEl = document.getElementById('mochi-flavors-list');
  if (!listEl) return;

  const unavailableFlavors = getMochiUnavailableFlavors();

  listEl.innerHTML = MOCHI_FLAVORS.map(flavor => {
    const isOutOfStock = unavailableFlavors.includes(flavor);
    const qty = isOutOfStock ? 0 : (mochiSelection[flavor] || 0);
    return `
      <div class="mochi-flavor-row ${qty > 0 ? 'has-qty' : ''} ${isOutOfStock ? 'flavor-out-of-stock' : ''}" data-flavor="${flavor}">
        <div class="mochi-flavor-left">
          <span class="mochi-flavor-name">${flavor}</span>
          ${isOutOfStock ? `<span class="mochi-out-badge">Épuisé</span>` : ''}
        </div>
        <div class="mochi-flavor-stepper">
          <button type="button" class="mochi-stepper-btn minus" onclick="updateMochiFlavorQty('${flavor.replace(/'/g, "\\'")}', -1)" ${qty === 0 || isOutOfStock ? 'disabled' : ''} aria-label="Moins de ${flavor}">−</button>
          <span class="mochi-stepper-val">${qty}</span>
          <button type="button" class="mochi-stepper-btn plus" onclick="updateMochiFlavorQty('${flavor.replace(/'/g, "\\'")}', 1)" ${isOutOfStock ? 'disabled' : ''} aria-label="Plus de ${flavor}">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateMochiFlavorQty(flavor, delta) {
  const unavailableFlavors = getMochiUnavailableFlavors();
  if (unavailableFlavors.includes(flavor)) return;

  const current = mochiSelection[flavor] || 0;
  const next = Math.max(0, current + delta);
  mochiSelection[flavor] = next;

  const row = document.querySelector(`.mochi-flavor-row[data-flavor="${flavor}"]`);
  if (row) {
    row.classList.toggle('has-qty', next > 0);
    const valEl = row.querySelector('.mochi-stepper-val');
    if (valEl) valEl.textContent = next;
    const minusBtn = row.querySelector('.mochi-stepper-btn.minus');
    if (minusBtn) minusBtn.disabled = next === 0;
  }

  updateMochiModalTotals();
}

function updateMochiModalTotals() {
  const totalItems = Object.values(mochiSelection).reduce((acc, q) => acc + q, 0);
  const unitPrice = 2.80;
  const totalPrice = totalItems * unitPrice;

  const countEl = document.getElementById('mochi-total-items');
  const priceEl = document.getElementById('mochi-total-price');
  const submitBtn = document.getElementById('mochi-modal-submit');

  if (countEl) countEl.textContent = totalItems > 1 ? `${totalItems} pièces sélectionnées` : `${totalItems} pièce sélectionnée`;
  if (priceEl) priceEl.textContent = formatEuro(totalPrice);
  if (submitBtn) {
    submitBtn.disabled = totalItems === 0;
    submitBtn.innerHTML = `<span>Ajouter au panier • ${formatEuro(totalPrice)}</span>`;
  }
}

function handleMochiAddToCart() {
  const details = [];
  let totalItems = 0;

  MOCHI_FLAVORS.forEach(flavor => {
    const quantity = mochiSelection[flavor] || 0;
    if (quantity > 0) {
      details.push({ flavor, quantity });
      totalItems += quantity;
    }
  });

  if (totalItems === 0) return;

  const unitPrice = 2.80;
  const totalPrice = totalItems * unitPrice;

  const mochiCartItem = {
    id: "D28",
    name: "Mochis glacés",
    unitPrice: unitPrice,
    totalQuantity: totalItems,
    totalPrice: totalPrice,
    details: details,
    qty: totalItems,
    price: unitPrice,
    cat: "desserts",
    img: "img/products/ds22.png"
  };

  const existingIdx = cart.findIndex(c => c.id === 'D28' || c.id === 'desserts-ds22');
  if (existingIdx > -1) {
    const existing = cart[existingIdx];
    const mergedMap = {};
    (existing.details || []).forEach(d => {
      mergedMap[d.flavor] = (mergedMap[d.flavor] || 0) + d.quantity;
    });
    details.forEach(d => {
      mergedMap[d.flavor] = (mergedMap[d.flavor] || 0) + d.quantity;
    });

    const newDetails = Object.keys(mergedMap).map(f => ({ flavor: f, quantity: mergedMap[f] }));
    const newTotalQty = newDetails.reduce((acc, d) => acc + d.quantity, 0);

    cart[existingIdx] = {
      ...existing,
      id: "D28",
      name: "Mochis glacés",
      unitPrice: 2.80,
      totalQuantity: newTotalQty,
      totalPrice: newTotalQty * 2.80,
      details: newDetails,
      qty: newTotalQty,
      price: 2.80
    };
  } else {
    cart.push(mochiCartItem);
  }

  saveCartToStorage();
  updateCartUI();
  updateCardBadgeUI('desserts-ds22');
  updateCardBadgeUI('D28');
  renderCartPanelItems();
  closeMochiModal();
  showToastNotification(`${totalItems} mochi(s) glacé(s) ajouté(s) au panier !`);
}

// ---- Helper : Éligibilité à la réduction -10% (Exclusion Desserts & Boissons/Vins) ----
function isItemDiscountEligible(item) {
  if (!item) return false;
  let cat = String(item.cat || '').toLowerCase().trim();
  let id = String(item.id || '').toLowerCase().trim();

  // Si la catégorie n'est pas directement présente sur l'objet item, on cherche dans MENU_DATA
  if (!cat && typeof MENU_DATA !== 'undefined' && MENU_DATA?.items) {
    const canonical = MENU_DATA.items.find(m => m.id === item.id || (item.name && m.name.toLowerCase() === item.name.toLowerCase()));
    if (canonical) {
      cat = String(canonical.cat || '').toLowerCase().trim();
      id = String(canonical.id || '').toLowerCase().trim();
    }
  }

  if (cat === 'desserts' || cat === 'boissons' || cat.includes('dessert') || cat.includes('boisson')) {
    return false;
  }
  if (id.startsWith('desserts') || id.startsWith('boissons') || id.startsWith('vins') || id.startsWith('champagne') || id.startsWith('d28')) {
    return false;
  }
  return true;
}

/* ==========================================================================
   SUSHI LIN II — Application Logic & Interactions
   ========================================================================== */

'use strict';

// ---- State Global ----
let MENU_DATA = null;
let cart = JSON.parse(localStorage.getItem('sushilin_cart') || '[]');
let activeCategory = null;
let modalQuantity = 1;
let currentModalItem = null;

// ---- DOM Selectors ----
const menuContainer = document.getElementById('menu-container');
const sidebarCatList = document.getElementById('sidebar-cat-list');
const mobileCatNavInner = document.getElementById('mobile-cat-nav-inner');
const headerCartCount = document.getElementById('header-cart-count');
const cartBar = document.getElementById('cart-bar');
const cartCountEl = document.getElementById('cart-count');
const cartOriginalEl = document.getElementById('cart-original');
const cartTotalEl = document.getElementById('cart-total');
const cartDrawer = document.getElementById('cart-drawer');
const cartOverlay = document.getElementById('cart-overlay');
const cartDrawerBody = document.getElementById('cart-drawer-body');
const cartClose = document.getElementById('cart-close');
const cartCta = document.getElementById('cart-cta');
const btnCartHeader = document.getElementById('btn-cart-header');
const btnCheckout = document.getElementById('btn-checkout');
const summarySubtotal = document.getElementById('summary-subtotal');
const summaryDiscount = document.getElementById('summary-discount');
const summaryTotal = document.getElementById('summary-total');

// Modals
const modalOverlay = document.getElementById('modal-overlay');
const itemModal = document.getElementById('item-modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// Auth Modal
const btnAccount = document.getElementById('btn-account');
const authModal = document.getElementById('auth-modal');
const authOverlay = document.getElementById('auth-overlay');
const authClose = document.getElementById('auth-close');

// Notifications & Form elements
const toast = document.getElementById('toast');
const loadingState = document.getElementById('loading-state');
const pickupTimeSelect = document.getElementById('pickup-time');

// ---- Helper Formatting ----
function formatEuro(number) {
  return number.toFixed(2).replace('.', ',') + ' €';
}

// Fallback SVG icon for items without photo
function getCategorySvgIcon(catId) {
  return `
    <div class="product-placeholder-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    </div>`;
}

// Helper: Convert "12h15" or "12:15" to minutes from midnight
function timeStrToMinutes(timeStr) {
  if (!timeStr) return 0;
  const cleaned = timeStr.replace(/h/i, ':');
  const [h, m] = cleaned.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Helper: Convert minutes from midnight to "12h15"
function minutesToTimeStr(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

// ---- Generate Available Pickup Slots (Clôture 30 min avant fermeture, dernier retrait 15 min avant) ----
function generatePickupTimeSlots() {
  if (!pickupTimeSelect) return;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Dimanche, 6 = Samedi
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const maxOrders = isWeekend 
    ? (typeof APP_SETTINGS.maxOrdersPerSlotWeekend === 'number' ? APP_SETTINGS.maxOrdersPerSlotWeekend : 3)
    : (typeof APP_SETTINGS.maxOrdersPerSlotWeek === 'number' ? APP_SETTINGS.maxOrdersPerSlotWeek : (APP_SETTINGS.maxOrdersPerSlot || 5));

  // Calcul du nombre de commandes par créneau pour aujourd'hui
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  } catch (e) {
    orders = [];
  }
  const todayStr = now.toLocaleDateString('fr-FR');
  const slotCounts = {};

  orders.forEach(order => {
    const isToday = !order.dateFormatted || order.dateFormatted.startsWith(todayStr);
    if (isToday && order.status !== 'cancelled' && order.pickupTime) {
      const cleanSlot = order.pickupTime.replace(/^À\s+/i, '').trim();
      slotCounts[cleanSlot] = (slotCounts[cleanSlot] || 0) + 1;
    }
  });

  pickupTimeSelect.innerHTML = '';
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Heures de service dynamiques depuis les paramètres
  const midiStartMin = timeStrToMinutes(APP_SETTINGS.midiStart || '12:00');
  const midiEndMin = timeStrToMinutes(APP_SETTINGS.midiEnd || '14:30');
  const midiCutoffMin = midiEndMin - 30; // Clôture commandes 30 min avant
  const soirStartMin = timeStrToMinutes(APP_SETTINGS.soirStart || '18:30');
  const soirEndMin = timeStrToMinutes(APP_SETTINGS.soirEnd || '22:00');
  const soirCutoffMin = soirEndMin - 30; // Clôture commandes 30 min avant

  const midiSlots = [];
  for (let m = midiStartMin; m <= midiEndMin - 15; m += 15) {
    midiSlots.push(minutesToTimeStr(m));
  }

  const soirSlots = [];
  for (let m = soirStartMin; m <= soirEndMin - 15; m += 15) {
    soirSlots.push(minutesToTimeStr(m));
  }

  const midiLabelEnd = midiSlots.length > 0 ? midiSlots[midiSlots.length - 1] : minutesToTimeStr(midiEndMin);
  const soirLabelEnd = soirSlots.length > 0 ? soirSlots[soirSlots.length - 1] : minutesToTimeStr(soirEndMin);

  // 1. Service du Midi
  const isMidiClosedForOrders = currentMinutes >= midiCutoffMin;
  const midiGroup = document.createElement('optgroup');
  midiGroup.label = isMidiClosedForOrders 
    ? `Midi (Service clôturé à ${minutesToTimeStr(midiCutoffMin)})` 
    : `Midi (${minutesToTimeStr(midiStartMin)} – ${midiLabelEnd})`;

  midiSlots.forEach(slot => {
    const slotMin = timeStrToMinutes(slot);
    const opt = document.createElement('option');
    opt.value = slot;
    const count = slotCounts[slot] || 0;

    if (isMidiClosedForOrders) {
      opt.disabled = true;
      opt.textContent = `À ${slot} (Clôturé)`;
    } else if (slotMin < currentMinutes + 15) {
      // Moins de 15 min de préparation ou heure passée
      opt.disabled = true;
      opt.textContent = `À ${slot} (Passé)`;
    } else if (count >= maxOrders) {
      opt.disabled = true;
      opt.textContent = `À ${slot} (Complet)`;
    } else {
      opt.textContent = `À ${slot}`;
    }
    midiGroup.appendChild(opt);
  });
  pickupTimeSelect.appendChild(midiGroup);

  // 2. Service du Soir
  const isSoirClosedForOrders = currentMinutes >= soirCutoffMin;
  const soirGroup = document.createElement('optgroup');
  soirGroup.label = isSoirClosedForOrders 
    ? `Soir (Service clôturé à ${minutesToTimeStr(soirCutoffMin)})` 
    : `Soir (${minutesToTimeStr(soirStartMin)} – ${soirLabelEnd})`;

  soirSlots.forEach(slot => {
    const slotMin = timeStrToMinutes(slot);
    const opt = document.createElement('option');
    opt.value = slot;
    const count = slotCounts[slot] || 0;

    if (isSoirClosedForOrders) {
      opt.disabled = true;
      opt.textContent = `À ${slot} (Clôturé)`;
    } else if (slotMin < currentMinutes + 15) {
      // Moins de 15 min de préparation ou heure passée
      opt.disabled = true;
      opt.textContent = `À ${slot} (Passé)`;
    } else if (count >= maxOrders) {
      opt.disabled = true;
      opt.textContent = `À ${slot} (Complet)`;
    } else {
      opt.textContent = `À ${slot}`;
    }
    soirGroup.appendChild(opt);
  });
  pickupTimeSelect.appendChild(soirGroup);

  // Sélectionner automatiquement le premier créneau valide et ouvert
  const availableOptions = Array.from(pickupTimeSelect.options).filter(o => !o.disabled);
  if (availableOptions.length > 0) {
    if (!pickupTimeSelect.value || pickupTimeSelect.selectedOptions[0]?.disabled) {
      availableOptions[0].selected = true;
    }
  } else {
    // Si aucun créneau n'est disponible (ex: après fermeture)
    const closedOpt = document.createElement('option');
    closedOpt.disabled = true;
    closedOpt.selected = true;
    closedOpt.textContent = `Commandes fermées pour aujourd'hui (Réouverture demain à ${minutesToTimeStr(midiStartMin)})`;
    pickupTimeSelect.appendChild(closedOpt);
  }
}

// ---- Dynamic Admin Settings ----
let APP_SETTINGS = {
  status: 'open',
  exceptionalMessage: '',
  scheduleText: '7j/7 : 12h00 – 14h30 & 18h30 – 22h00',
  midiStart: '12:00',
  midiEnd: '14:30',
  soirStart: '18:30',
  soirEnd: '22:00',
  discount: 10,
  maxOrdersPerSlotWeek: 5,
  maxOrdersPerSlotWeekend: 3,
  maxOrdersPerSlot: 5,
  phone: '01 30 79 00 88',
  whatsapp: '33130790088'
};

async function applyAdminSettings() {
  // Sync from backend API if reachable, else fallback to localStorage
  try {
    const res = await fetch('/api/settings?v=' + Date.now());
    if (res.ok) {
      const serverSettings = await res.json();
      if (serverSettings && typeof serverSettings === 'object') {
        APP_SETTINGS = { ...APP_SETTINGS, ...serverSettings };
        localStorage.setItem('sushilin_admin_settings', JSON.stringify(APP_SETTINGS));
      }
    }
  } catch (e) {
    const savedSettings = localStorage.getItem('sushilin_admin_settings');
    if (savedSettings) {
      try {
        APP_SETTINGS = { ...APP_SETTINGS, ...JSON.parse(savedSettings) };
      } catch (err) {}
    }
  }

  // Update Status in header banner
  const bannerStatusText = document.getElementById('banner-status-text');
  if (bannerStatusText) {
    if (APP_SETTINGS.status === 'closed-exceptional') {
      const formattedMsg = (APP_SETTINGS.exceptionalMessage || 'Fermeture exceptionnelle').replace(/\n/g, ' · ');
      bannerStatusText.textContent = formattedMsg;
      bannerStatusText.style.color = '#E11D48';
    } else {
      bannerStatusText.textContent = APP_SETTINGS.scheduleText || 'Ouvert 7j/7 · 12h00–14h30 & 18h30–22h00';
      bannerStatusText.style.color = '';
    }
  }

  // Update hours in info section
  const hoursInfoEl = document.getElementById('restaurant-info-hours-text');
  if (hoursInfoEl) {
    const midiS = (APP_SETTINGS.midiStart || '12:00').replace(':', 'h');
    const midiE = (APP_SETTINGS.midiEnd || '14:30').replace(':', 'h');
    const soirS = (APP_SETTINGS.soirStart || '18:30').replace(':', 'h');
    const soirE = (APP_SETTINGS.soirEnd || '22:00').replace(':', 'h');
    hoursInfoEl.innerHTML = `Midi : ${midiS} – ${midiE}<br>Soir : ${soirS} – ${soirE}`;
  }

  // Update Phone
  const phoneLabels = document.querySelectorAll('.phone-label');
  phoneLabels.forEach(el => {
    if (APP_SETTINGS.phone) el.textContent = APP_SETTINGS.phone;
  });
}

// ---- Fetch & Load Menu Data ----
async function loadMenuData() {
  try {
    await applyAdminSettings();

    // Fetch canonical menu.json first with cache-busting
    const response = await fetch('data/menu.json?v=' + Date.now());
    const freshMenu = await response.json();

    // Check if updated in Admin Panel
    const savedMenuStr = localStorage.getItem('sushilin_admin_menu');
    if (savedMenuStr) {
      try {
        const parsed = JSON.parse(savedMenuStr);
        if (parsed && Array.isArray(parsed.items)) {
          const overrideMap = new Map(parsed.items.map(i => [i.id, i]));
          const canonicalIds = new Set(freshMenu.items.map(i => i.id));

          // 1. Fusionner les modifications sur les plats existants tout en préservant les descriptions et allergènes canoniques à jour
          freshMenu.items = freshMenu.items.map(item => {
            const override = overrideMap.get(item.id);
            if (override) {
              const rawName = override.name || item.name || '';
              const cleanName = rawName.replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki');
              return {
                ...item,
                code: override.code !== undefined ? override.code : item.code,
                name: cleanName,
                price: typeof override.price === 'number' ? override.price : item.price,
                available: typeof override.available === 'boolean' ? override.available : item.available,
                pieces: override.pieces !== undefined ? override.pieces : item.pieces,
                desc: (item.desc || override.desc || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki'),
                allergens: item.allergens !== undefined ? item.allergens : (override.allergens || []),
                unavailableFlavors: Array.isArray(override.unavailableFlavors) ? override.unavailableFlavors : (item.unavailableFlavors || []),
                img: item.img || override.img,
                cat: (item.cat || override.cat || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki'),
                subcatName: (item.subcatName || override.subcatName || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki')
              };
            }
            return item;
          });

          // 2. Conserver les nouveaux plats personnalisés créés dans l'admin
          const customItems = parsed.items.filter(i => !canonicalIds.has(i.id)).map(i => ({
            ...i,
            name: (i.name || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki'),
            subcatName: (i.subcatName || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki')
          }));
          if (customItems.length > 0) {
            freshMenu.items = [...freshMenu.items, ...customItems];
          }
        }
      } catch (e) {
        console.error('Erreur fusion sushilin_admin_menu:', e);
      }
    }
    if (freshMenu && Array.isArray(freshMenu.categories)) {
      freshMenu.categories = freshMenu.categories.map(c => ({
        ...c,
        name: (c.name || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki'),
        desc: (c.desc || '').replace(/Témaki/g, 'Temaki').replace(/témaki/g, 'temaki')
      }));
    }
    MENU_DATA = freshMenu;
    localStorage.setItem('sushilin_admin_menu', JSON.stringify(MENU_DATA));

    // Charger les best-sellers officiels du mois depuis le serveur (PostgreSQL)
    try {
      const bsRes = await fetch('/api/bestsellers');
      if (bsRes.ok) {
        const bsData = await bsRes.json();
        if (Array.isArray(bsData.bestsellers)) {
          SERVER_BEST_SELLERS = bsData.bestsellers;
        }
      }
    } catch (e) {}

    loadingState?.remove();
    
    renderCategoryNavigation();
    renderProductsMenu();
    updateCartUI();
    generatePickupTimeSlots();
    initIntersectionObserver();
  } catch (error) {
    console.error('Erreur lors du chargement du menu:', error);
    if (loadingState) {
      loadingState.innerHTML = '<p style="color: #E11D48; padding: 40px;">Impossible de charger le menu. Veuillez rafraîchir.</p>';
    }
  }
}

// ---- State for Filtering (Entrées par défaut) ----
let selectedCategory = 'entrees';
let SERVER_BEST_SELLERS = [];

// Helper: Calcul des Best-Sellers (Synchronisé avec la base de données PostgreSQL / Panel Admin)
function getBestSellerItems() {
  if (!MENU_DATA || !MENU_DATA.items) return [];

  const addedIds = new Set();
  const resolved = [];

  // 1. Priorité aux meilleures ventes officielles du mois renvoyées par le serveur (PostgreSQL ou fallback local)
  if (Array.isArray(SERVER_BEST_SELLERS) && SERVER_BEST_SELLERS.length > 0) {
    SERVER_BEST_SELLERS.forEach(s => {
      const targetId = s.id || '';
      const targetCode = s.code || '';
      const targetName = s.name || '';
      const cleanSName = targetName.toLowerCase().replace(/\s*\(\d+\s*pcs?\)/gi, '').trim();

      const item = MENU_DATA.items.find(m => {
        const mLower = m.name.toLowerCase();
        if (targetId && m.id === targetId) return true;
        if (targetCode && m.code === targetCode) return true;
        if (targetName && mLower === targetName.toLowerCase()) return true;
        if (cleanSName && (mLower === cleanSName || mLower.includes(cleanSName) || cleanSName.includes(mLower))) return true;
        if ((targetId === 'sushis-1' || cleanSName.includes('sushi saumon')) && m.id === 'sushis-33') return true;
        if ((targetId === 'menus-m1' || cleanSName.includes('yakitori 5')) && m.id === 'menus-brochettes-d') return true;
        return false;
      });

      if (item && !addedIds.has(item.id)) {
        resolved.push(item);
        addedIds.add(item.id);
      }
    });
  }

  // 2. Fallback historique local si serveur non disponible
  if (resolved.length === 0) {
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
    } catch (e) {
      orders = [];
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Filtrage des commandes du mois en cours uniquement
    const monthlyOrders = orders.filter(ord => {
      let d = null;
      if (ord.timestamp) {
        d = new Date(ord.timestamp);
      } else if (ord.dateFormatted) {
        const match = ord.dateFormatted.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          d = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
        }
      }
      if (!d || isNaN(d.getTime())) return false;
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const counts = {};
    monthlyOrders.forEach(ord => {
      (ord.items || []).forEach(it => {
        const key = String(it.id || it.code || it.name);
        counts[key] = (counts[key] || 0) + (it.qty || it.quantity || 1);
      });
    });

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    sortedKeys.forEach(k => {
      const cleanK = k.toLowerCase().replace(/\s*\(\d+\s*pcs?\)/gi, '').trim();
      const item = MENU_DATA.items.find(m => {
        const mLower = m.name.toLowerCase();
        if (m.id === k || m.code === k || mLower === k.toLowerCase() || mLower === cleanK) return true;
        if (cleanK.length > 3 && (mLower.includes(cleanK) || cleanK.includes(mLower))) return true;
        if ((k === 'sushis-1' || cleanK.includes('sushi saumon')) && m.id === 'sushis-33') return true;
        if ((k === 'menus-m1' || cleanK.includes('yakitori 5')) && m.id === 'menus-brochettes-d') return true;
        return false;
      });
      if (item && !addedIds.has(item.id)) {
        resolved.push(item);
        addedIds.add(item.id);
      }
    });
  }

  // 3. Top incontournables par défaut si moins de 9 plats
  const defaultTopIds = [
    'menus-chirashi-m1', 'makis-29', 'sushis-33', 'entrees-85',
    'desserts-ds22', 'yakitori-71', 'entrees-b11', 'menus-brochettes-a',
    'menus-poisson-v', 'entrees-1', 'entrees-b3', 'entrees-2'
  ];

  defaultTopIds.forEach(idOrCode => {
    const item = MENU_DATA.items.find(m => m.id === idOrCode || m.code === idOrCode);
    if (item && !addedIds.has(item.id)) {
      resolved.push(item);
      addedIds.add(item.id);
    }
  });

  return resolved.slice(0, 9);
}

// ---- Render Category Navigation (Sidebar on Desktop & Pills on Mobile) ----
function renderCategoryNavigation() {
  if (!MENU_DATA) return;
  
  if (sidebarCatList) sidebarCatList.innerHTML = '';
  if (mobileCatNavInner) mobileCatNavInner.innerHTML = '';

  const allCount = MENU_DATA.items.length;
  const bestSellers = getBestSellerItems();

  // 1. Sidebar Option "Toute la carte"
  if (sidebarCatList) {
    const allLink = document.createElement('button');
    allLink.className = `sidebar-link ${selectedCategory === 'all' ? 'active' : ''}`;
    allLink.id = 'sidebar-link-all';
    allLink.innerHTML = `
      <span>Toute la carte</span>
      <span class="sidebar-count">${allCount}</span>
    `;
    allLink.addEventListener('click', () => selectCategoryFilter('all'));
    sidebarCatList.appendChild(allLink);

    // Sidebar Option "Les plus aimés"
    const bsLink = document.createElement('button');
    bsLink.className = `sidebar-link ${selectedCategory === 'bestsellers' ? 'active' : ''}`;
    bsLink.id = 'sidebar-link-bestsellers';
    bsLink.dataset.cat = 'bestsellers';
    bsLink.innerHTML = `
      <span style="display: flex; align-items: center; gap: 7px;">
        Les plus aimés
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="color: var(--primary);"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </span>
      <span class="sidebar-count">${bestSellers.length}</span>
    `;
    bsLink.addEventListener('click', () => selectCategoryFilter('bestsellers'));
    sidebarCatList.appendChild(bsLink);
  }

  // 2. Mobile Pill "Tous les plats" & "Les plus aimés"
  if (mobileCatNavInner) {
    const allPill = document.createElement('button');
    allPill.className = `cat-pill ${selectedCategory === 'all' ? 'active' : ''}`;
    allPill.id = 'mobile-cat-pill-all';
    allPill.textContent = 'Tous les plats';
    allPill.addEventListener('click', () => selectCategoryFilter('all'));
    mobileCatNavInner.appendChild(allPill);

    const bsPill = document.createElement('button');
    bsPill.className = `cat-pill ${selectedCategory === 'bestsellers' ? 'active' : ''}`;
    bsPill.id = 'mobile-cat-pill-bestsellers';
    bsPill.dataset.cat = 'bestsellers';
    bsPill.innerHTML = `
      <span>Les plus aimés</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="margin-left: 5px; vertical-align: -1px; color: var(--primary);"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    `;
    bsPill.addEventListener('click', () => selectCategoryFilter('bestsellers'));
    mobileCatNavInner.appendChild(bsPill);
  }

  MENU_DATA.categories.forEach((cat) => {
    const items = MENU_DATA.items.filter(item => item.cat === cat.id);
    if (!items.length) return;

    const catLabel = cat.name || cat.label || cat.id;

    // Sidebar Item
    if (sidebarCatList) {
      const link = document.createElement('button');
      link.className = `sidebar-link ${selectedCategory === cat.id ? 'active' : ''}`;
      link.id = `sidebar-link-${cat.id}`;
      link.dataset.cat = cat.id;
      link.innerHTML = `
        <span>${catLabel}</span>
        <span class="sidebar-count">${items.length}</span>
      `;
      link.addEventListener('click', () => selectCategoryFilter(cat.id));
      sidebarCatList.appendChild(link);
    }

    // Mobile Horizontal Pill
    if (mobileCatNavInner) {
      const pill = document.createElement('button');
      pill.className = `cat-pill ${selectedCategory === cat.id ? 'active' : ''}`;
      pill.id = `mobile-cat-pill-${cat.id}`;
      pill.dataset.cat = cat.id;
      pill.textContent = catLabel;
      pill.addEventListener('click', () => selectCategoryFilter(cat.id));
      mobileCatNavInner.appendChild(pill);
    }
  });

  const catScrollContainer = document.querySelector('.categories-scroll');
  if (catScrollContainer && !catScrollContainer.dataset.listenerAttached) {
    catScrollContainer.dataset.listenerAttached = 'true';
    catScrollContainer.addEventListener('scroll', () => {
      catScrollContainer.classList.toggle('has-left-scroll', catScrollContainer.scrollLeft > 12);
    }, { passive: true });
  }
}

function selectCategoryFilter(catId, shouldScroll = true) {
  selectedCategory = catId;

  // Update active classes
  document.querySelectorAll('.sidebar-link').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.cat === catId) || (catId === 'all' && btn.id === 'sidebar-link-all'));
  });

  document.querySelectorAll('.cat-pill').forEach(pill => {
    const isActive = (pill.dataset.cat === catId) || (catId === 'all' && pill.id === 'mobile-cat-pill-all');
    pill.classList.toggle('active', isActive);
    if (isActive) {
      if (catId === 'all') {
        const scrollContainer = document.querySelector('.categories-scroll');
        if (scrollContainer) scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  renderProductsMenu();

  if (shouldScroll) {
    // Laisser le DOM se construire puis faire le scroll précis sur le titre de la catégorie
    requestAnimationFrame(() => {
      scrollToCategoryTitle(catId);
    });
  }
}

function scrollToCategoryTitle(catId) {
  const targetSection = (catId && catId !== 'all')
    ? document.getElementById(`cat-section-${catId}`)
    : document.querySelector('.cat-section');

  if (targetSection) {
    const titleEl = targetSection.querySelector('.cat-section-title') || targetSection;
    const headerEl = document.getElementById('header');
    const mobileNavEl = document.getElementById('mobile-categories-nav');

    const isMobile = window.innerWidth <= 960;
    
    if (isMobile) {
      // Sur mobile : prise en compte du bandeau (-10%), du header et des onglets pour caler le titre parfaitement
      const bannerEl = document.getElementById('top-banner');
      const bannerH = (bannerEl && (bannerEl.classList.contains('visible') || window.scrollY > 10 || isMobile)) ? bannerEl.offsetHeight : 42;
      const headerH = headerEl ? headerEl.offsetHeight : 64;
      const mobileNavH = mobileNavEl ? mobileNavEl.offsetHeight : 48;
      const totalOffset = headerH + bannerH + mobileNavH + 16;
      const targetY = titleEl.getBoundingClientRect().top + window.scrollY - totalOffset;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    } else {
      // Sur desktop : version d'origine intacte
      const headerH = headerEl ? headerEl.offsetHeight : 70;
      const bannerEl = document.getElementById('top-banner');
      const bannerH = (bannerEl && (bannerEl.classList.contains('visible') || window.scrollY > 100)) ? bannerEl.offsetHeight : 36;
      const targetY = titleEl.getBoundingClientRect().top + window.scrollY - (headerH + bannerH + 16);
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }
}

// ---- Render Products Menu (Filtered View by Category + Subcategories Accordions) ----
function renderProductsMenu() {
  if (!MENU_DATA || !menuContainer) return;
  menuContainer.innerHTML = '';

  if (selectedCategory === 'bestsellers') {
    const bestSellers = getBestSellerItems();
    const section = document.createElement('section');
    section.className = 'cat-section';
    section.id = 'cat-section-bestsellers';
    section.dataset.cat = 'bestsellers';

    const catHeader = document.createElement('div');
    catHeader.className = 'cat-section-header';
    catHeader.innerHTML = `
      <div>
        <h2 class="cat-section-title">Les plus aimés</h2>
        <p class="cat-section-desc">Les plats les plus choisis par nos clients</p>
      </div>
      <span class="cat-section-count">${bestSellers.length} plats</span>
    `;
    section.appendChild(catHeader);

    const grid = document.createElement('div');
    grid.className = 'products-grid';
    grid.id = 'grid-bestsellers';
    bestSellers.forEach(item => {
      grid.appendChild(createProductCard(item));
    });
    section.appendChild(grid);
    menuContainer.appendChild(section);
    return;
  }

  const categoriesToRender = selectedCategory === 'all'
    ? MENU_DATA.categories
    : MENU_DATA.categories.filter(c => c.id === selectedCategory);

  categoriesToRender.forEach(cat => {
    const items = MENU_DATA.items.filter(item => item.cat === cat.id);
    if (!items.length) return;

    const catLabel = cat.name || cat.label || cat.id;

    const section = document.createElement('section');
    section.className = 'cat-section';
    section.id = `cat-section-${cat.id}`;
    section.dataset.cat = cat.id;

    // Header principal de la catégorie
    const catHeader = document.createElement('div');
    catHeader.className = 'cat-section-header';
    catHeader.innerHTML = `
      <div>
        <h2 class="cat-section-title">${catLabel}</h2>
      </div>
      <span class="cat-section-count">${items.length} plat${items.length > 1 ? 's' : ''}</span>
    `;
    section.appendChild(catHeader);

    // Regroupement par sous-catégories ('desserts' et 'sushis' affichés en direct sans sous-catégories)
    const subcatMap = new Map();
    items.forEach(item => {
      const skey = (cat.id === 'desserts' || cat.id === 'sushis') ? `${cat.id}-default` : (item.subcat || `${cat.id}-default`);
      const sname = (cat.id === 'desserts' || cat.id === 'sushis') ? catLabel : (item.subcatName || catLabel);
      if (!subcatMap.has(skey)) {
        subcatMap.set(skey, { name: sname, items: [] });
      }
      subcatMap.get(skey).items.push(item);
    });

    const subcatEntries = Array.from(subcatMap.entries());

    if (subcatEntries.length <= 1) {
      // 1 seule sous-catégorie : affichage direct de la grille
      const grid = document.createElement('div');
      grid.className = 'products-grid';
      grid.id = `grid-${cat.id}`;
      items.forEach(item => {
        grid.appendChild(createProductCard(item));
      });
      section.appendChild(grid);
    } else {
      // Plusieurs sous-catégories : 1ère ouverte par défaut, les suivantes en menus déroulants
      subcatEntries.forEach(([skey, subData], subIndex) => {
        if (subIndex === 0) {
          // 1ère sous-catégorie (Ouverte directement sans déroulant)
          const firstBlock = document.createElement('div');
          firstBlock.className = 'subcat-group subcat-first-open';
          firstBlock.innerHTML = `
            <div class="subcat-header-static">
              <h3 class="subcat-name">${subData.name}</h3>
              <span class="subcat-badge">${subData.items.length} plats</span>
            </div>
            <div class="products-grid" id="grid-${cat.id}-${skey}"></div>
          `;
          section.appendChild(firstBlock);

          const grid = firstBlock.querySelector(`#grid-${cat.id}-${skey}`);
          subData.items.forEach(item => {
            grid.appendChild(createProductCard(item));
          });
        } else {
          // Sous-catégories suivantes (Menu déroulant / Accordéon fermé par défaut)
          const accGroup = document.createElement('div');
          accGroup.className = 'subcat-group subcat-accordion-group';
          accGroup.id = `subcat-acc-${cat.id}-${skey}`;

          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'subcat-accordion-toggle';
          toggleBtn.type = 'button';
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.innerHTML = `
            <div class="subcat-toggle-left">
              <span class="subcat-bullet"></span>
              <span class="subcat-name">${subData.name}</span>
              <span class="subcat-badge">${subData.items.length} plats</span>
            </div>
            <div class="subcat-toggle-right">
              <span class="subcat-state-text">Afficher</span>
              <div class="subcat-chevron-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          `;

          const bodyEl = document.createElement('div');
          bodyEl.className = 'subcat-accordion-body';
          bodyEl.style.display = 'none';

          const grid = document.createElement('div');
          grid.className = 'products-grid';
          grid.id = `grid-${cat.id}-${skey}`;
          subData.items.forEach(item => {
            grid.appendChild(createProductCard(item));
          });
          bodyEl.appendChild(grid);

          // Click to expand / collapse
          toggleBtn.addEventListener('click', () => {
            const isCurrentlyOpen = bodyEl.style.display !== 'none';
            const stateText = toggleBtn.querySelector('.subcat-state-text');
            if (isCurrentlyOpen) {
              bodyEl.style.display = 'none';
              toggleBtn.classList.remove('open');
              toggleBtn.setAttribute('aria-expanded', 'false');
              if (stateText) stateText.textContent = 'Afficher';
            } else {
              bodyEl.style.display = 'block';
              toggleBtn.classList.add('open');
              toggleBtn.setAttribute('aria-expanded', 'true');
              if (stateText) stateText.textContent = 'Masquer';
            }
          });

          accGroup.appendChild(toggleBtn);
          accGroup.appendChild(bodyEl);
          section.appendChild(accGroup);
        }
      });
    }

    menuContainer.appendChild(section);
  });
}

// ---- Allergen Helper ----
function getItemAllergens(item) {
  if (Array.isArray(item.allergens)) {
    return item.allergens;
  }
  const text = (item.name + ' ' + (item.desc || '') + ' ' + item.cat).toLowerCase();
  const allergens = [];

  if (text.includes('saumon') || text.includes('thon') || text.includes('daurade') || text.includes('bar') || text.includes('maquereau') || text.includes('sashimi') || text.includes('chirashi') || text.includes('sushi') || text.includes('poisson')) {
    allergens.push('Poisson');
  }
  if (text.includes('crevette') || text.includes('ebi') || text.includes('tempura')) {
    allergens.push('Crustacés');
  }
  if (text.includes('poulpe') || text.includes('calamar') || text.includes('takoyaki') || text.includes('jacques')) {
    allergens.push('Mollusques');
  }
  if (text.includes('sesame') || text.includes('sésame') || text.includes('california') || text.includes('wakame') || text.includes('yakitori') || text.includes('brochette')) {
    allergens.push('Sésame');
  }
  if (text.includes('soja') || text.includes('miso') || text.includes('edamame') || text.includes('tofu')) {
    allergens.push('Soja');
  }
  if (text.includes('cheese') || text.includes('fromage') || text.includes('lait')) {
    allergens.push('Lait / Lactose');
  }
  if (text.includes('omelette') || text.includes('tamago') || text.includes('egg') || text.includes('mayo') || text.includes('nem')) {
    allergens.push('Œufs');
  }
  if (text.includes('ravioli') || text.includes('gyoza') || text.includes('nem') || text.includes('tempura') || text.includes('biere') || text.includes('bière') || text.includes('futo')) {
    allergens.push('Gluten');
  }

  return allergens;
}

// ---- Create Single Product Card ----
function createProductCard(item) {
  const card = document.createElement('article');
  card.className = `product-card ${item.available ? '' : 'unavailable'}`;
  card.id = `product-card-${item.id}`;

  const isEligible = isItemDiscountEligible(item);
  const discountVal = isEligible ? item.price * 0.10 : 0;
  const takeawayPrice = item.price - discountVal;
  const cartItem = cart.find(c => c.id === item.id);
  const currentQty = cartItem ? cartItem.qty : 0;
  const allergens = getItemAllergens(item);

  const mediaHtml = item.img
    ? `<img class="product-image" src="${item.img}" alt="${item.name}" loading="lazy" decoding="async" onerror="if(!this.dataset.retried){this.dataset.retried='1'; const p=this.getAttribute('src'); const f=p.split('/').pop(); this.src='img/products/'+(f[0]===f[0].toUpperCase()?f.toLowerCase():f.toUpperCase());}else{this.style.display='none';}">`
    : getCategorySvgIcon(item.cat);

  const allergensCardHtml = allergens.length > 0
    ? `<span class="product-allergens-tag" title="Allergènes : ${allergens.join(', ')}">Allergènes : ${allergens.join(', ')}</span>`
    : '';

  card.innerHTML = `
    <div class="product-media">
      ${mediaHtml}
      ${item.code ? `<span class="product-code-badge">${item.code}</span>` : ''}
      ${item.pieces ? `<span class="product-pieces-badge">${item.pieces}</span>` : ''}
      ${currentQty > 0 ? `<div class="product-cart-qty" id="badge-${item.id}">${currentQty}</div>` : ''}
    </div>
    <div class="product-content">
      <h3 class="product-name">${item.name}</h3>
      <p class="product-desc">${item.desc || '&nbsp;'}</p>
      ${allergensCardHtml}
      <div class="product-bottom-row">
        <div class="product-pricing">
          <span class="price-main">${formatEuro(item.price)}</span>
          ${isEligible ? `<span class="price-takeaway">→ ${formatEuro(takeawayPrice)} emporter</span>` : ''}
        </div>
        <button class="btn-add-item" id="add-btn-${item.id}" aria-label="Ajouter ${item.name} au panier">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Click card to open modal details or mochi flavor selector
  card.addEventListener('click', (e) => {
    if (isMochiItem(item)) {
      e.stopPropagation();
      openMochiModal(item);
      return;
    }
    if (e.target.closest('.btn-add-item')) {
      e.stopPropagation();
      const addBtn = e.target.closest('.btn-add-item');
      addItemToCart(item, 1, addBtn);
      return;
    }
    openProductModal(item);
  });

  return card;
}

// ---- Micro-Animation Fly To Cart ----
function animateFlyToCart(sourceEl, imgSrc) {
  if (cartDrawer && cartDrawer.classList.contains('open')) {
    return;
  }
  if (!sourceEl) {
    triggerCartBadgeBump();
    return;
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    triggerCartBadgeBump();
    return;
  }

  const sourceRect = sourceEl.getBoundingClientRect();
  if (sourceRect.width === 0 && sourceRect.height === 0) {
    triggerCartBadgeBump();
    return;
  }

  const isMobile = window.innerWidth <= 960;
  const headerCartBtn = document.getElementById('btn-cart-header');
  const mobileCartBar = document.getElementById('cart-bar');

  let targetEl = headerCartBtn;
  if (isMobile && mobileCartBar && mobileCartBar.classList.contains('visible')) {
    targetEl = mobileCartBar;
  } else if (!targetEl) {
    targetEl = mobileCartBar;
  }

  const targetRect = (targetEl && targetEl.offsetParent !== null)
    ? targetEl.getBoundingClientRect()
    : {
        left: window.innerWidth - 60,
        top: 24,
        width: 36,
        height: 36
      };

  const startX = sourceRect.left + sourceRect.width / 2 - 21;
  const startY = sourceRect.top + sourceRect.height / 2 - 21;
  const endX = targetRect.left + targetRect.width / 2 - 21;
  const endY = targetRect.top + targetRect.height / 2 - 21;

  const flyer = document.createElement('div');
  flyer.className = 'cart-flying-particle';
  flyer.style.left = `${startX}px`;
  flyer.style.top = `${startY}px`;

  if (imgSrc) {
    flyer.innerHTML = `<img src="${imgSrc}" alt="" onerror="this.remove()">`;
  } else {
    flyer.innerHTML = `<div class="flying-sakura-dot"></div>`;
  }

  document.body.appendChild(flyer);

  // Force reflow
  void flyer.offsetWidth;

  flyer.style.transform = `translate3d(${endX - startX}px, ${endY - startY}px, 0) scale(0.28)`;
  flyer.style.opacity = '0.08';

  setTimeout(() => {
    flyer.remove();
    triggerCartBadgeBump();
  }, 1150);
}

function triggerCartBadgeBump() {
  // Only subtle bump on header cart icon, never touch the mobile bottom bar to prevent movement/teleportation
  const headerBtn = document.getElementById('btn-cart-header');
  const headerCount = document.getElementById('header-cart-count');

  [headerBtn, headerCount].forEach(el => {
    if (el) {
      el.classList.remove('cart-bump-anim');
      void el.offsetWidth;
      el.classList.add('cart-bump-anim');
      setTimeout(() => el.classList.remove('cart-bump-anim'), 360);
    }
  });
}

// ---- Cart Operations ----
function addItemToCart(item, quantity = 1, sourceElement = null) {
  const existingIndex = cart.findIndex(c => c.id === item.id);
  if (existingIndex > -1) {
    cart[existingIndex].qty += quantity;
  } else {
    cart.push({
      id: item.id,
      code: item.code || '',
      name: item.name,
      price: item.price,
      cat: item.cat,
      img: item.img || '',
      qty: quantity
    });
  }

  saveCartToStorage();
  updateCartUI();
  updateCardBadgeUI(item.id);
  renderCartPanelItems();
  animateFlyToCart(sourceElement, item.img);
  showToastNotification(`« ${item.name} » ajouté au panier !`);
}

function updateCartQuantity(itemId, delta) {
  const itemIndex = cart.findIndex(c => c.id === itemId);
  if (itemIndex === -1) return;

  cart[itemIndex].qty += delta;
  if (cart[itemIndex].qty <= 0) {
    cart.splice(itemIndex, 1);
  }

  saveCartToStorage();
  updateCartUI();
  updateCardBadgeUI(itemId);
  renderCartPanelItems();
}

function saveCartToStorage() {
  localStorage.setItem('sushilin_cart', JSON.stringify(cart));
}

function calculateCartTotals() {
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const eligibleSubtotal = cart.reduce((acc, item) => {
    return isItemDiscountEligible(item) ? acc + (item.price * item.qty) : acc;
  }, 0);
  const discount = Math.round(eligibleSubtotal * 0.10 * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const totalItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
  return { subtotal, eligibleSubtotal, discount, total, totalItemsCount };
}

function updateCartUI() {
  const { subtotal, discount, total, totalItemsCount } = calculateCartTotals();

  // Header Cart Badge
  if (headerCartCount) {
    headerCartCount.textContent = totalItemsCount;
    headerCartCount.style.display = totalItemsCount > 0 ? 'flex' : 'none';
  }

  // Floating Mobile Cart Bar
  if (cartBar) {
    if (totalItemsCount > 0) {
      cartCountEl.textContent = `${totalItemsCount} article${totalItemsCount > 1 ? 's' : ''}`;
      cartOriginalEl.textContent = formatEuro(subtotal);
      cartTotalEl.textContent = formatEuro(total);
    }
    updateCartBarVisibility();
  }

  // Drawer Footer Totals & Checkout Button Status
  if (summarySubtotal) summarySubtotal.textContent = formatEuro(subtotal);
  if (summaryDiscount) summaryDiscount.textContent = `–${formatEuro(discount)}`;
  if (summaryTotal) summaryTotal.textContent = formatEuro(total);
  
  if (btnCheckout) {
    if (APP_SETTINGS.status === 'closed-exceptional') {
      btnCheckout.disabled = true;
      btnCheckout.classList.add('disabled-closed');
      btnCheckout.innerHTML = '<span>Restaurant fermé</span>';
      btnCheckout.title = (APP_SETTINGS.exceptionalMessage || 'Le restaurant est exceptionnellement fermé.').replace(/\n/g, ' ');
    } else {
      btnCheckout.classList.remove('disabled-closed');
      btnCheckout.disabled = totalItemsCount === 0;
      btnCheckout.innerHTML = '<span>Valider la commande</span>';
      btnCheckout.title = '';
    }
  }

  // Synchronise tous les badges des cartes produits immédiatement
  updateAllCardBadgesUI();
}

// Synchronisation globale et infaillible de toutes les pastilles de quantité sur les cartes
function updateAllCardBadgesUI() {
  document.querySelectorAll('.product-cart-qty').forEach(badge => {
    const card = badge.closest('.product-card');
    if (!card) {
      badge.remove();
      return;
    }
    const cardId = card.id.replace('product-card-', '');
    const cartItem = cart.find(c => c.id === cardId);
    if (!cartItem || cartItem.qty <= 0) {
      badge.remove();
    } else {
      badge.textContent = cartItem.qty;
    }
  });

  cart.forEach(item => {
    if (item.qty > 0) {
      updateCardBadgeUI(item.id);
    }
  });
}

// Visibilité de la barre panier flottante : STRICTEMENT dans le fond rose de la carte/menu
function updateCartBarVisibility() {
  const totalItemsCount = cart.reduce((acc, c) => acc + c.qty, 0);
  const appLayout = document.querySelector('.app-layout');
  if (!cartBar) return;

  if (totalItemsCount === 0 || !appLayout) {
    cartBar.classList.remove('visible');
    if (btnScrollTop) btnScrollTop.classList.remove('has-cart-bar');
    return;
  }

  const rect = appLayout.getBoundingClientRect();
  // S'arrête STRICTEMENT dans le fond rose de la section Menu (ne dépasse jamais sur les sections suivantes)
  const isPastHero = rect.top < window.innerHeight * 0.75;
  const isInsidePinkZone = rect.bottom > (window.innerHeight - 10);

  const isCartBarVisible = isPastHero && isInsidePinkZone;
  cartBar.classList.toggle('visible', isCartBarVisible);
  if (btnScrollTop) {
    btnScrollTop.classList.toggle('has-cart-bar', isCartBarVisible);
  }
}

function updateCardBadgeUI(itemId) {
  const card = document.getElementById(`product-card-${itemId}`);
  if (!card) return;

  const cartItem = cart.find(c => c.id === itemId);
  const qty = cartItem ? cartItem.qty : 0;
  let badge = card.querySelector('.product-cart-qty');

  if (qty > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'product-cart-qty';
      badge.id = `badge-${itemId}`;
      const media = card.querySelector('.product-media');
      if (media) media.appendChild(badge);
    }
    badge.textContent = qty;
  } else if (badge) {
    badge.remove();
  }
}

// ---- Cart Drawer Rendering ----
function renderCartPanelItems() {
  if (!cartDrawerBody) return;

  if (cart.length === 0) {
    cartDrawerBody.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <p>Votre panier est actuellement vide.<br>Sélectionnez vos sushis préférés !</p>
      </div>`;
    return;
  }

  cartDrawerBody.innerHTML = '';
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'cart-items-list';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    let detailsHtml = '';
    if (Array.isArray(item.details) && item.details.length > 0) {
      const flavorStr = item.details.map(d => `${d.quantity}× ${d.flavor}`).join(', ');
      detailsHtml = `<div class="cart-item-flavors-detail" style="font-size: 11.5px; color: var(--sakura-vibrant); font-weight: 600; margin-top: 2px;">${flavorStr}</div>`;
    }

    row.innerHTML = `
      <div class="cart-item-details">
        <div class="cart-item-title">${item.name}</div>
        ${detailsHtml}
        <div class="cart-item-price-calc">${formatEuro(item.price * item.qty)}</div>
      </div>
      <div class="cart-item-stepper">
        <button class="stepper-btn minus" aria-label="Diminuer" data-id="${item.id}">−</button>
        <span class="stepper-value">${item.qty}</span>
        <button class="stepper-btn plus" aria-label="Augmenter" data-id="${item.id}">+</button>
      </div>
    `;

    row.querySelector('.minus').addEventListener('click', () => updateCartQuantity(item.id, -1));
    row.querySelector('.plus').addEventListener('click', () => {
      if (isMochiItem(item)) {
        openMochiModal(item);
      } else {
        updateCartQuantity(item.id, 1);
      }
    });

    itemsContainer.appendChild(row);
  });

  cartDrawerBody.appendChild(itemsContainer);

  // Inject Smart Cross-Selling Suggestions (Compact, No Emojis, Responsive)
  const crossSellEl = renderCartCrossSelling();
  if (crossSellEl) {
    cartDrawerBody.appendChild(crossSellEl);
  }
}

// ---- Smart Cross-Selling Logic ----
function renderCartCrossSelling() {
  if (!MENU_DATA || !MENU_DATA.items || cart.length === 0) return null;

  const cartItemIds = new Set(cart.map(c => String(c.id || c.code)));
  const cartItemNames = new Set(cart.map(c => (c.name || '').toLowerCase()));
  const hasDrinks = cart.some(c => c.cat === 'boissons' || (c.id && (c.id.startsWith('bo') || c.id.startsWith('bi') || c.id.startsWith('vr') || c.id.startsWith('vb'))));
  const hasDesserts = cart.some(c => c.cat === 'desserts' || isMochiItem(c) || (c.id && c.id.startsWith('ds')));
  const hasStarters = cart.some(c => c.cat === 'entrees' || ['1', '2', '3', '4', '5', '85'].includes(String(c.code || c.id)));

  const candidatePool = [
    // Boissons
    { id: 'boissons-bi1', code: 'BI1', name: 'Bière Asahi (33cl)', price: 3.80, img: 'img/products/bi1.png', type: 'drink' },
    { id: 'boissons-bo2', code: 'BO2', name: 'Ramune japonaise', price: 3.50, img: 'img/products/bo2.png', type: 'drink' },
    { id: 'boissons-bo10', code: 'BO10', name: 'Thé vert japonais', price: 3.50, img: 'img/products/bo10.png', type: 'drink' },
    { id: 'boissons-bo1', code: 'BO1', name: 'Coca-Cola (33cl)', price: 2.50, img: 'img/products/bo1.png', type: 'drink' },
    // Entrées / Accompagnements
    { id: 'entrees-85', code: '85', name: 'Raviolis grillés (Gyoza)', price: 6.00, img: 'img/products/85.png', type: 'starter' },
    { id: 'entrees-1', code: '1', name: 'Salade de choux', price: 3.00, img: 'img/products/1.png', type: 'starter' },
    { id: 'entrees-2', code: '2', name: 'Soupe Miso', price: 2.50, img: 'img/products/2.png', type: 'starter' },
    { id: 'entrees-5', code: '5', name: 'Edamame', price: 4.00, img: 'img/products/5.png', type: 'starter' },
    // Desserts
    { id: 'desserts-ds22', code: 'D28', name: 'Mochis glacés', price: 2.80, img: 'img/products/ds22.png', type: 'dessert' },
    { id: 'desserts-ds6', code: 'DS6', name: 'Gâteau Dorayaki', price: 4.50, img: 'img/products/ds6.png', type: 'dessert' }
  ];

  // Exclusion stricte des articles déjà présents dans le panier
  const eligible = candidatePool.filter(c => {
    const canonical = MENU_DATA.items.find(m => m.id === c.id || m.code === c.code || m.name.toLowerCase() === c.name.toLowerCase());
    const idToCheck = canonical ? canonical.id : c.id;
    const codeToCheck = canonical ? canonical.code : c.code;
    return !cartItemIds.has(String(idToCheck)) && !cartItemIds.has(String(codeToCheck)) && !cartItemNames.has(c.name.toLowerCase());
  });

  if (eligible.length === 0) return null;

  const prioritized = [];
  if (!hasDrinks) {
    const drink = eligible.find(e => e.type === 'drink');
    if (drink) prioritized.push(drink);
  }
  if (!hasStarters) {
    const starter = eligible.find(e => e.type === 'starter');
    if (starter) prioritized.push(starter);
  }
  if (!hasDesserts) {
    const dessert = eligible.find(e => e.type === 'dessert');
    if (dessert) prioritized.push(dessert);
  }

  eligible.forEach(e => {
    if (prioritized.length < 4 && !prioritized.includes(e)) {
      prioritized.push(e);
    }
  });

  if (prioritized.length === 0) return null;

  const box = document.createElement('div');
  box.className = 'cart-cross-selling-box';
  box.innerHTML = `
    <div class="cross-selling-header">
      <span>Pour accompagner votre repas</span>
    </div>
    <div class="cross-selling-chips-track"></div>
  `;

  const track = box.querySelector('.cross-selling-chips-track');
  track.addEventListener('scroll', () => {
    track.classList.toggle('has-left-scroll', track.scrollLeft > 6);
  }, { passive: true });
  prioritized.forEach(cand => {
    const canonical = MENU_DATA.items.find(m => m.id === cand.id || m.code === cand.code || m.name.toLowerCase() === cand.name.toLowerCase()) || cand;
    const chip = document.createElement('div');
    chip.className = 'cross-chip';
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', `Ajouter ${canonical.name}`);
    chip.innerHTML = `
      <img src="${canonical.img || 'img/products/nophoto.png'}" class="cross-chip-img" alt="${canonical.name}" loading="lazy" onerror="this.src='img/products/nophoto.png'">
      <div class="cross-chip-info">
        <span class="cross-chip-name">${canonical.name}</span>
        <span class="cross-chip-price">${formatEuro(canonical.price)}</span>
      </div>
      <button type="button" class="cross-chip-add-btn" aria-label="Ajouter ${canonical.name}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    `;

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isMochiItem(canonical)) {
        openMochiModal(canonical);
      } else {
        const chipBtn = chip.querySelector('.cross-chip-add-btn') || chip;
        addItemToCart(canonical, 1, chipBtn);
      }
    });

    track.appendChild(chip);
  });

  return box;
}

function openCartPanel() {
  if (toast && toast.classList.contains('show')) {
    toast.classList.remove('show');
    if (toastTimeout) clearTimeout(toastTimeout);
  }
  generatePickupTimeSlots();
  renderCartPanelItems();
  const user = getLoggedUser();
  const cartNameGroup = document.getElementById('cart-name-group');
  const cartEmailGroup = document.getElementById('cart-email-group');
  if (cartNameGroup) {
    cartNameGroup.style.display = user ? 'none' : 'block';
  }
  if (cartEmailGroup) {
    cartEmailGroup.style.display = user ? 'none' : 'block';
  }
  cartDrawer?.classList.add('open');
  cartOverlay?.classList.add('active');
  cartOverlay?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCartPanel() {
  cartDrawer?.classList.remove('open');
  cartOverlay?.classList.remove('active');
  cartOverlay?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ---- Product Modal Details ----
function openProductModal(item) {
  if (isMochiItem(item)) {
    openMochiModal(item);
    return;
  }
  currentModalItem = item;
  modalQuantity = 1;

  const isEligible = isItemDiscountEligible(item);
  const takeawayPrice = isEligible ? item.price * 0.90 : item.price;
  const mediaHtml = item.img
    ? `<img src="${item.img}" alt="${item.name}" loading="lazy">`
    : getCategorySvgIcon(item.cat);

  const topCodeEl = document.getElementById('modal-top-code');
  if (topCodeEl) {
    topCodeEl.innerHTML = item.code
      ? `<span class="product-code-badge" style="position:static; font-size:12px; font-weight:800; padding:3px 9px;">${item.code}</span>`
      : '';
  }

  const allergens = getItemAllergens(item);
  const allergensModalHtml = allergens.length > 0
    ? `<div class="modal-allergens-box">
         <strong>Allergènes&nbsp;:</strong> <span>${allergens.join(', ')}</span>
       </div>`
    : '';

  modalBody.innerHTML = `
    <div class="modal-media-box">${mediaHtml}</div>
    <h2 class="modal-product-title">${item.name}</h2>
    ${item.desc ? `<p class="modal-product-desc">${item.desc}</p>` : ''}
    ${allergensModalHtml}
    <div class="product-pricing">
      <span class="price-main">${formatEuro(item.price)}</span>
      ${isEligible ? `<span class="price-takeaway">→ ${formatEuro(takeawayPrice)} à emporter (–10%)</span>` : ''}
    </div>
    
    <div class="modal-action-row">
      <div class="modal-qty-box">
        <button id="modal-qty-minus" aria-label="Moins">−</button>
        <span id="modal-qty-val">1</span>
        <button id="modal-qty-plus" aria-label="Plus">+</button>
      </div>
      <button class="btn-modal-submit" id="btn-modal-add">
        Ajouter
      </button>
    </div>
  `;

  document.getElementById('modal-qty-minus').addEventListener('click', () => {
    if (modalQuantity > 1) {
      modalQuantity--;
      updateModalQuantityDisplay(item);
    }
  });

  document.getElementById('modal-qty-plus').addEventListener('click', () => {
    if (modalQuantity < 30) {
      modalQuantity++;
      updateModalQuantityDisplay(item);
    }
  });

  document.getElementById('btn-modal-add').addEventListener('click', () => {
    const btnModal = document.getElementById('btn-modal-add');
    addItemToCart(item, modalQuantity, btnModal);
    closeProductModal();
    closeMochiModal();
  });

  itemModal?.classList.add('open');
  modalOverlay?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateModalQuantityDisplay(item) {
  const valEl = document.getElementById('modal-qty-val');
  const btnEl = document.getElementById('btn-modal-add');
  if (valEl) valEl.textContent = modalQuantity;
  if (btnEl) btnEl.textContent = 'Ajouter';
}

function closeProductModal() {
  itemModal?.classList.remove('open');
  modalOverlay?.classList.remove('active');
  document.body.style.overflow = '';
  currentModalItem = null;
}

// ---- COMPTE CLIENT & AUTHENTIFICATION ----
const TEST_CLIENT_ACCOUNT = {
  name: 'Mickaël Lin',
  phone: '06 12 34 56 78',
  email: 'client@test.fr',
  password: '123456',
  address: "3 Rue Gabriel Péri, 78340 Saint-Cyr-l'École"
};

function getLoggedUser() {
  try {
    const saved = localStorage.getItem('sushilin_logged_user');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function openAuthModal() {
  updateUserAccountUI();
  authModal?.classList.add('open');
  authOverlay?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  authModal?.classList.remove('open');
  authOverlay?.classList.remove('active');
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');

  if (tab === 'login') {
    tabLogin?.classList.add('active');
    tabReg?.classList.remove('active');
    if (formLogin) formLogin.style.display = 'flex';
    if (formReg) formReg.style.display = 'none';
  } else {
    tabLogin?.classList.remove('active');
    tabReg?.classList.add('active');
    if (formLogin) formLogin.style.display = 'none';
    if (formReg) formReg.style.display = 'flex';
  }
}

// Connexion rapide avec le compte de test
function loginWithTestAccount() {
  localStorage.setItem('sushilin_logged_user', JSON.stringify(TEST_CLIENT_ACCOUNT));
  updateUserAccountUI();
  showToastNotification('Connecté avec le compte test Mickaël Lin !');
}

function handleAuthSubmit(event, mode) {
  event.preventDefault();
  if (mode === 'login') {
    const phoneOrEmail = document.getElementById('login-phone')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    const registeredUsers = JSON.parse(localStorage.getItem('sushilin_registered_users') || '[]');
    let foundUser = registeredUsers.find(u => (u.phone === phoneOrEmail || u.email === phoneOrEmail) && u.password === password);

    // Permettre aussi les identifiants du compte test par défaut
    if (!foundUser && (phoneOrEmail === 'client@test.fr' || phoneOrEmail === '0612345678' || phoneOrEmail === '06 12 34 56 78') && password === '123456') {
      foundUser = TEST_CLIENT_ACCOUNT;
    }

    if (foundUser) {
      localStorage.setItem('sushilin_logged_user', JSON.stringify(foundUser));
      updateUserAccountUI();
      showToastNotification(`Bienvenue ${foundUser.name} !`);
    } else {
      alert('Identifiants incorrects. Astuce : utilisez le bouton "Compte test" pour vous connecter en 1 clic.');
      return;
    }
  } else {
    const name = document.getElementById('reg-name')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;

    const newUser = { name, phone, email, password };
    const registeredUsers = JSON.parse(localStorage.getItem('sushilin_registered_users') || '[]');
    registeredUsers.push(newUser);
    localStorage.setItem('sushilin_registered_users', JSON.stringify(registeredUsers));
    localStorage.setItem('sushilin_logged_user', JSON.stringify(newUser));

    updateUserAccountUI();
    showToastNotification(`Compte créé avec succès ! Bienvenue ${name}`);
  }
}

function handleUserLogout() {
  localStorage.removeItem('sushilin_logged_user');
  updateUserAccountUI();
  showToastNotification('Vous êtes déconnecté.');
}

function updateUserAccountUI() {
  const user = getLoggedUser();
  const guestView = document.getElementById('auth-guest-view');
  const loggedView = document.getElementById('auth-logged-view');
  const btnAccountEl = document.getElementById('btn-account');
  const loggedName = document.getElementById('logged-user-name');
  const loggedContact = document.getElementById('logged-user-contact');

  const cartEmailGroup = document.getElementById('cart-email-group');
  const cartPhoneGroup = document.getElementById('cart-phone-group');
  const orderEmailInput = document.getElementById('order-customer-email');
  const orderPhoneInput = document.getElementById('order-customer-phone');

  if (user) {
    if (orderEmailInput) orderEmailInput.value = user.email || '';
    if (orderPhoneInput) orderPhoneInput.value = user.phone || '';

    // Masquer les champs téléphone et e-mail dans le panier car ils sont déjà enregistrés dans le compte
    if (cartEmailGroup) cartEmailGroup.style.display = 'none';
    if (cartPhoneGroup) cartPhoneGroup.style.display = 'none';

    if (guestView) guestView.style.display = 'none';
    if (loggedView) loggedView.style.display = 'block';
    if (loggedName) loggedName.textContent = user.name;
    if (loggedContact) loggedContact.textContent = user.email || user.contact || '';
    if (btnAccountEl) {
      btnAccountEl.innerHTML = `
        <span class="user-logged-btn-content">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="user-logged-name">${user.name.split(' ')[0]}</span>
        </span>
      `;
      btnAccountEl.classList.add('logged-in');
    }

    renderUserOrdersHistory();
  } else {
    // Réafficher les champs téléphone et e-mail pour les commandes invités
    if (cartEmailGroup) cartEmailGroup.style.display = 'block';
    if (cartPhoneGroup) cartPhoneGroup.style.display = 'block';

    if (guestView) guestView.style.display = 'block';
    if (loggedView) loggedView.style.display = 'none';

    if (btnAccountEl) {
      btnAccountEl.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="account-label">Compte</span>
      `;
      btnAccountEl.classList.remove('logged-in');
    }
  }
}

function renderUserOrdersHistory() {
  const container = document.getElementById('logged-user-orders');
  if (!container) return;

  const orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px 16px; background: var(--sakura-bg-soft); border-radius: var(--radius-md); border: 1px dashed var(--sakura-border);">
        <p style="font-size: 13.5px; font-weight: 700; color: var(--indigo-dark); margin-bottom: 4px;">Aucune commande récente</p>
        <p style="font-size: 12px; color: var(--text-secondary);">Vos commandes à emporter apparaîtront ici pour recommander en 1 clic.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const itemsList = ord.items || [];
    const itemsCount = ord.itemCount || itemsList.reduce((s, i) => s + (i.qty || 1), 0);
    const totalFormatted = formatEuro(ord.total || 0);

    return `
      <div class="user-order-card" onclick="toggleOrderDetails(this)">
        <div class="user-order-summary">
          <div class="user-order-summary-left">
            <div style="font-size: 13.5px; color: var(--indigo-dark); display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <strong style="font-weight: 800; font-family: var(--font-heading); font-size: 15px; color: var(--indigo-dark);">${ord.id}</strong>
              <span style="font-weight: 500; font-size: 12.5px; color: var(--text-secondary);">${ord.dateFormatted || ''}</span>
            </div>
            <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 3px;">
              ${itemsCount} article(s) · <span style="font-weight: 800; color: var(--indigo-dark);">${totalFormatted}</span>
            </div>
          </div>
          <div class="user-order-summary-right">
            <button type="button" class="btn-reorder-icon" onclick="event.stopPropagation(); reorderPreviousItems('${ord.id}')" title="Recommander cette commande" aria-label="Recommander cette commande">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 9H3.5V3.5"/>
                <path d="M3.5 9A9 9 0 1 1 6 18.5"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="user-order-details">
          <div class="user-order-items-list">
            ${itemsList.map(i => `
              <div class="user-order-item-row">
                <span class="user-order-item-qty">${i.qty || i.totalQuantity || 1}x</span>
                <span class="user-order-item-name">${i.code ? `[${i.code}] ` : ''}${i.name}</span>
                <span class="user-order-item-price">${formatEuro((i.price || 0) * (i.qty || i.totalQuantity || 1))}</span>
              </div>
            `).join('')}
          </div>
          ${(ord.sauceChoice || ord.baguettesChoice) ? `
            <div class="user-order-meta-info">
              ${ord.sauceChoice ? `<span>Sauce : <strong>${ord.sauceChoice}</strong></span>` : ''}
              ${(ord.sauceChoice && ord.baguettesChoice) ? ' · ' : ''}
              ${ord.baguettesChoice ? `<span>Baguettes : <strong>${ord.baguettesChoice}</strong></span>` : ''}
            </div>
          ` : ''}
          <button type="button" class="btn-reorder-full" onclick="event.stopPropagation(); reorderPreviousItems('${ord.id}')">
            <span>Commander à nouveau</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleOrderDetails(cardEl) {
  cardEl.classList.toggle('expanded');
}

function reorderPreviousItems(orderId) {
  const orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  const found = orders.find(o => o.id === orderId);
  if (!found || !found.items) return;

  found.items.forEach(item => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      existing.qty += (item.qty || item.totalQuantity || 1);
    } else {
      cart.push({ ...item });
    }
  });

  updateCartUI();
  closeAuthModal();
  openCartPanel();
  showToastNotification(`Articles de la commande ${orderId} ajoutés à votre panier !`);
}

// Numérotation journalière des commandes (1, 2, 3...) réinitialisée chaque jour
function getNextDailyOrderNumber() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const savedCounter = JSON.parse(localStorage.getItem('sushilin_daily_counter') || '{}');
    let nextNum = 1;
    if (savedCounter.date === today && typeof savedCounter.count === 'number') {
      nextNum = savedCounter.count + 1;
    }
    localStorage.setItem('sushilin_daily_counter', JSON.stringify({ date: today, count: nextNum }));
    return String(nextNum);
  } catch {
    return '1';
  }
}

// ---- Validation de commande (Enregistrement en local pour le Panel Admin & Envoi Resend) ----
function handleOrderCheckout() {
  if (APP_SETTINGS.status === 'closed-exceptional') {
    const msg = APP_SETTINGS.exceptionalMessage || "Le restaurant est actuellement exceptionnellement fermé. Les commandes en ligne sont temporairement désactivées.\nMerci de votre compréhension.";
    alert(msg);
    return;
  }

  if (cart.length === 0) return;

  const { subtotal, discount, total } = calculateCartTotals();
  const sauceChoice = document.getElementById('sauce-choice')?.value || 'Sauce sucrée';
  const baguettesSelect = document.getElementById('baguettes-choice');
  const baguettesChoice = baguettesSelect ? (baguettesSelect.options[baguettesSelect.selectedIndex]?.text || baguettesSelect.value) : '1 paire';
  const pickupTime = document.getElementById('pickup-time')?.value || '12h00';
  const comment = document.getElementById('comment-order')?.value.trim() || '';
  
  const loggedUser = getLoggedUser();
  const nameInput = document.getElementById('order-customer-name');
  const phoneInput = document.getElementById('order-customer-phone');
  const emailInput = document.getElementById('order-customer-email');

  const customerName = loggedUser?.name || nameInput?.value.trim() || '';
  const customerPhone = loggedUser?.phone || phoneInput?.value.trim() || '';
  const customerEmail = loggedUser?.email || loggedUser?.contact || emailInput?.value.trim() || '';

  if (!customerName) {
    alert('Veuillez renseigner votre nom et prénom.');
    nameInput?.focus();
    return;
  }
  if (!customerPhone) {
    alert('Veuillez renseigner votre numéro de téléphone afin que nous puissions vous contacter pour votre commande.');
    phoneInput?.focus();
    return;
  }
  if (!customerEmail) {
    alert('Veuillez renseigner votre adresse e-mail pour recevoir la confirmation de votre commande.');
    emailInput?.focus();
    return;
  }

  // Vérification de la disponibilité du créneau et des heures limites de commande
  const nowForCheck = new Date();
  const currentMinutes = nowForCheck.getHours() * 60 + nowForCheck.getMinutes();
  const slotMin = timeStrToMinutes(pickupTime);
  const midiEndMin = timeStrToMinutes(APP_SETTINGS.midiEnd || '14:30');
  const midiCutoffMin = midiEndMin - 30; // 14h00
  const soirEndMin = timeStrToMinutes(APP_SETTINGS.soirEnd || '22:00');
  const soirCutoffMin = soirEndMin - 30; // 21h30
  const soirStartMin = timeStrToMinutes(APP_SETTINGS.soirStart || '18:30');

  const isLunchSlot = slotMin < soirStartMin;

  if (isLunchSlot && currentMinutes >= midiCutoffMin) {
    alert('Les commandes pour le service du midi sont clôturées depuis 14h00. Veuillez sélectionner un créneau pour le service du soir.');
    generatePickupTimeSlots();
    return;
  }
  if (!isLunchSlot && currentMinutes >= soirCutoffMin) {
    alert('Les commandes en ligne pour ce soir sont clôturées (clôture à 21h30). Réouverture demain dès 12h00.');
    generatePickupTimeSlots();
    return;
  }
  if (slotMin < currentMinutes + 15) {
    alert('Ce créneau horaire n\'est plus disponible. Veuillez choisir un autre horaire.');
    generatePickupTimeSlots();
    return;
  }

  // 1. Numérotation journalière réinitialisée à 1 chaque jour (1, 2, 3...)
  const orderId = getNextDailyOrderNumber();
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const orderData = {
    id: orderId,
    timestamp: now.toISOString(),
    dateFormatted: dateFormatted,
    customerName: customerName,
    customerPhone: customerPhone,
    customerEmail: customerEmail,
    items: cart.map(item => {
      const canonicalItem = MENU_DATA?.items?.find(m => m.id === item.id || (item.name && m.name.toLowerCase() === item.name.toLowerCase()));
      const resolvedCode = item.code || canonicalItem?.code || (item.id === 'D28' || item.id === 'desserts-ds22' ? 'D28' : '');
      return {
        id: item.id,
        code: resolvedCode,
        name: item.name,
        price: item.price,
        qty: item.qty,
        image: item.image || item.img || canonicalItem?.img || '',
        details: item.details || null,
        unitPrice: item.unitPrice || item.price,
        totalQuantity: item.totalQuantity || item.qty,
        totalPrice: item.totalPrice || (item.price * item.qty)
      };
    }),
    itemCount: cart.reduce((acc, c) => acc + c.qty, 0),
    subtotal: subtotal,
    discount: discount,
    total: total,
    sauceChoice: sauceChoice,
    baguettesChoice: baguettesChoice,
    pickupTime: pickupTime,
    comment: comment,
    status: 'new' // 'new', 'preparing', 'ready', 'completed'
  };

  try {
    const existingOrders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
    existingOrders.unshift(orderData);
    localStorage.setItem('sushilin_orders', JSON.stringify(existingOrders));
  } catch (err) {
    console.error('Erreur enregistrement commande locale:', err);
  }

  // 2. Envoi de l'e-mail de confirmation via Resend
  fetch('/api/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toEmail: customerEmail, order: orderData })
  })
  .then(res => res.json())
  .then(resData => {
    if (resData.success) {
      showToastNotification(`Commande ${orderId} validée ! E-mail envoyé avec succès.`);
    } else {
      console.warn('E-mail non envoyé:', resData);
      showToastNotification(`Commande ${orderId} validée et transmise en cuisine !`);
    }
  })
  .catch(err => {
    console.warn('Serveur e-mail local:', err);
    showToastNotification(`Commande ${orderId} validée et transmise en cuisine !`);
  });

  // 3. Finalisation de la commande (Vidage panier & UI)
  closeCartPanel();
  cart = [];
  saveCartToStorage();
  updateCartUI();
  MENU_DATA?.items.forEach(item => updateCardBadgeUI(item.id));
}

// ---- Intersection Observer for Category Highlighting ----
function initIntersectionObserver() {
  const sections = document.querySelectorAll('.cat-section');
  if (!sections.length) return;

  const headerHeight = document.querySelector('.header')?.offsetHeight || 72;
  const offset = headerHeight + 30;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const catId = entry.target.dataset.cat;
        setActiveCategoryTab(catId);
      }
    });
  }, {
    rootMargin: `-${offset}px 0px -65% 0px`,
    threshold: 0
  });

  sections.forEach(s => observer.observe(s));
}

function setActiveCategoryTab(catId) {
  if (activeCategory === catId) return;
  activeCategory = catId;

  // 1. Update Sidebar Links (Desktop)
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.cat === catId);
  });
  const activeSidebarLink = document.getElementById(`sidebar-link-${catId}`);
  activeSidebarLink?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // 2. Update Mobile Pills (Mobile)
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.cat === catId);
  });
  const activeMobilePill = document.getElementById(`mobile-cat-pill-${catId}`);
  if (catId === 'all') {
    const scrollContainer = document.querySelector('.categories-scroll');
    if (scrollContainer) scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
  } else {
    activeMobilePill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ---- Toast Notification ----
let toastTimeout = null;
function showToastNotification(message) {
  if (!toast) return;
  // Ne pas afficher de notification toast si le tiroir du panier est déjà ouvert
  if (cartDrawer && cartDrawer.classList.contains('open')) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
const showToast = showToastNotification;

// ---- Event Listeners ----
btnCartHeader?.addEventListener('click', openCartPanel);
cartCta?.addEventListener('click', openCartPanel);
cartClose?.addEventListener('click', closeCartPanel);
cartOverlay?.addEventListener('click', closeCartPanel);

modalClose?.addEventListener('click', closeProductModal);
modalOverlay?.addEventListener('click', closeProductModal);

btnAccount?.addEventListener('click', openAuthModal);
authClose?.addEventListener('click', closeAuthModal);
btnCheckout?.addEventListener('click', handleOrderCheckout);

// Toggle Options de commande dans le panier (Mobile)
const toggleOrderOptionsBtn = document.getElementById('toggle-order-options');
const orderCustomizationContent = document.getElementById('order-customization-content');

toggleOrderOptionsBtn?.addEventListener('click', () => {
  const isCollapsed = orderCustomizationContent?.classList.toggle('is-collapsed');
  toggleOrderOptionsBtn.classList.toggle('is-collapsed', isCollapsed);
  toggleOrderOptionsBtn.setAttribute('aria-expanded', !isCollapsed);
});

// Escape key to close any modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeProductModal();
    closeMochiModal();
    closeCartPanel();
    closeAuthModal();
  }
});

// Admin Button
document.getElementById('footer-admin-btn')?.addEventListener('click', () => {
  window.location.href = 'admin.html';
});

// ---- Header & Banner Scroll Reveal (apparaissent beaucoup plus tôt au défilement) ----
(function initHeaderScrollReveal() {
  const header = document.getElementById('header');
  const banner = document.getElementById('top-banner');
  const heroSection = document.getElementById('hero-section');
  if (!heroSection) return;

  function updateVisibility() {
    // Apparaît dès qu'on commence à défiler (scroll > 60px) pour une transition immédiate et sans coupure
    const isPastHeroStart = window.scrollY > 60 || heroSection.getBoundingClientRect().bottom <= window.innerHeight * 0.85;
    if (isPastHeroStart) {
      header?.classList.add('visible');
      banner?.classList.add('visible');
      const bannerH = banner ? banner.offsetHeight : 36;
      if (header) header.style.top = bannerH + 'px';
    } else {
      header?.classList.remove('visible');
      banner?.classList.remove('visible');
    }
  }

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility, { passive: true });
})();

// Détection continue du défilement pour la barre panier dans la section carte
window.addEventListener('scroll', updateCartBarVisibility, { passive: true });

// ---- Bouton Vider le Panier ----
document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
  if (cart.length === 0) return;
  if (confirm('Voulez-vous vraiment vider tout le panier ?')) {
    cart = [];
    localStorage.removeItem('sushilin_cart');
    updateCartUI();
    renderCartPanelItems();
    showToast('Votre panier a été vidé');
  }
});

// ---- Bouton Scroll to Top (Remonte au début du Menu / Catégories et non au Hero) ----
const btnScrollTop = document.getElementById('btn-scroll-top');
if (btnScrollTop) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btnScrollTop.classList.add('visible');
    } else {
      btnScrollTop.classList.remove('visible');
    }

    // Détection immédiate du footer pour baisser l'opacité
    const footerEl = document.getElementById('footer-site') || document.querySelector('.footer');
    if (footerEl) {
      const footerRect = footerEl.getBoundingClientRect();
      // Dès que le haut du footer entre dans l'écran
      const isOverFooter = footerRect.top < (window.innerHeight - 20);
      btnScrollTop.classList.toggle('in-footer', isOverFooter);
    }
  }, { passive: true });

  btnScrollTop.addEventListener('click', () => {
    scrollToCategoryTitle(selectedCategory || 'all');
  });
}

// ---- Formulaire de Réservation de Table ----
const resForm = document.getElementById('reservation-form');
if (resForm) {
  const dateInput = document.getElementById('res-date');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
  }

  resForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('res-date')?.value;
    const service = document.getElementById('res-service')?.value;
    const guests = document.getElementById('res-guests')?.value;
    const name = document.getElementById('res-name')?.value;
    const phone = document.getElementById('res-phone')?.value;

    showToast(`Table réservée pour ${name} (${guests} pers.) le ${date} !`);
    resForm.reset();
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
  });
}

// ---- Détection & Pop-up Restaurant Fermé ----
function getRestaurantCurrentStatus() {
  if (APP_SETTINGS.status === 'closed-exceptional') {
    return {
      isOpen: false,
      isExceptional: true,
      message: APP_SETTINGS.exceptionalMessage || 'Le restaurant est actuellement exceptionnellement fermé.'
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const lunchStart = timeStrToMinutes(APP_SETTINGS.midiStart || '12:00');
  const lunchEnd = timeStrToMinutes(APP_SETTINGS.midiEnd || '14:30');
  const dinnerStart = timeStrToMinutes(APP_SETTINGS.soirStart || '18:30');
  const dinnerEnd = timeStrToMinutes(APP_SETTINGS.soirEnd || '22:00');

  const isLunch = currentMinutes >= lunchStart && currentMinutes <= lunchEnd;
  const isDinner = currentMinutes >= dinnerStart && currentMinutes <= dinnerEnd;

  if (isLunch || isDinner) {
    return { isOpen: true, message: 'Le restaurant est actuellement ouvert.' };
  } else {
    let nextService = '';
    if (currentMinutes < lunchStart) {
      nextService = `Ouverture à ${minutesToTimeStr(lunchStart)} pour le service du midi.`;
    } else if (currentMinutes < dinnerStart) {
      nextService = `Ouverture à ${minutesToTimeStr(dinnerStart)} pour le service du soir.`;
    } else {
      nextService = `Réouverture demain à ${minutesToTimeStr(lunchStart)}.`;
    }
    return {
      isOpen: false,
      isExceptional: false,
      message: `Le restaurant est actuellement fermé en dehors des heures de service. ${nextService} Vous pouvez préparer votre commande à emporter ou réserver votre table !`
    };
  }
}

function checkClosurePopup() {
  const backdrop = document.getElementById('closure-modal-backdrop');
  const msgEl = document.getElementById('closure-modal-msg');
  const dismissBtn = document.getElementById('closure-btn-dismiss');
  if (!backdrop) return;

  // La pop-up s'affiche STRICTEMENT UNIQUEMENT sur le bouton "Fermeture exceptionnelle"
  if (APP_SETTINGS.status === 'closed-exceptional') {
    if (msgEl) {
      const rawMsg = APP_SETTINGS.exceptionalMessage || "Le restaurant est exceptionnellement fermé.\nMerci de votre compréhension.";
      msgEl.innerHTML = rawMsg.replace(/\n/g, '<br>');
    }
    backdrop.classList.add('active');
    backdrop.setAttribute('aria-hidden', 'false');

    const closePopup = () => {
      backdrop.classList.remove('active');
      backdrop.setAttribute('aria-hidden', 'true');
    };

    if (dismissBtn) dismissBtn.onclick = closePopup;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closePopup();
    };
  } else {
    // Si "Ouvert normalement", aucune pop-up n'est affichée
    backdrop.classList.remove('active');
    backdrop.setAttribute('aria-hidden', 'true');
  }
}

// ---- Hero CTA : Filtre exclusivement sur les Entrées et défile au titre ----
document.getElementById('hero-order-cta')?.addEventListener('click', (e) => {
  e.preventDefault();
  selectCategoryFilter('entrees', true);
});

// ---- Hero CTA : Infos & horaires (Défilement fluide parfaitement calé en haut sous le header) ----
document.querySelectorAll('a[href="#restaurant-info"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById('restaurant-info');
    if (target) {
      const headerOffset = window.innerWidth <= 768 ? 100 : 120;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// ---- Initialization ----
loadMenuData();
updateUserAccountUI();
setTimeout(checkClosurePopup, 500);


// ---- MODAL MENTIONS LÉGALES & RGPD & CGV & COOKIES (CONFORME LOIS FRANÇAISES) ----
function openLegalModal(type) {
  const backdrop = document.getElementById('legal-modal-backdrop');
  const title = document.getElementById('legal-modal-title');
  const content = document.getElementById('legal-modal-content');
  if (!backdrop || !title || !content) return;

  if (type === 'mentions') {
    title.textContent = 'Mentions Légales';
    content.innerHTML = `
      <h4>1. Éditeur du site</h4>
      <p>Le présent site internet accessible à l'adresse <strong>sushilin2.fr</strong> est édité et exploité par la société :</p>
      <p><strong>Dénomination sociale :</strong> SUSHI LIN II (SARL)</p>
      <p><strong>Nom commercial & Enseigne :</strong> SUSHI LIN</p>
      <p><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p>
      <p><strong>Siège social :</strong> 32 Rue des Dames, 78340 Les Clayes-sous-Bois, France</p>
      <p><strong>Numéro SIREN :</strong> 507 609 873</p>
      <p><strong>Numéro SIRET (siège) :</strong> 507 609 873 00017</p>
      <p><strong>RCS :</strong> Immatriculée au Registre du Commerce et des Sociétés de Versailles sous le numéro 507 609 873</p>
      <p><strong>Code APE / NAF :</strong> 56.10A (Restauration traditionnelle)</p>
      <p><strong>Numéro de TVA intracommunautaire :</strong> FR53507609873</p>
      <p><strong>Téléphone :</strong> <a href="tel:0130790088" style="color: var(--sakura-vibrant); font-weight: 700;">01 30 79 00 88</a></p>
      <p><strong>Directeur de la publication :</strong> La gérance de SUSHI LIN II</p>

      <h4>2. Hébergement du site</h4>
      <p>Le site est hébergé par la société :<br>
      <strong>LWS (Ligne Web Services SAS)</strong><br>
      2 Rue Jules Ferry, 88190 Golbey, France<br>
      Téléphone : 01 77 62 30 03<br>
      Site internet : <a href="https://www.lws.fr" target="_blank" rel="noopener noreferrer" style="color: var(--sakura-vibrant);">https://www.lws.fr</a></p>

      <h4>3. Propriété intellectuelle</h4>
      <p>L’ensemble des éléments constituant le présent site (structure générale, textes, photographies, photographies des plats, logos, marques, recettes, graphismes, icônes et codes sources) est la propriété exclusive de la société <strong>SUSHI LIN II</strong> ou fait l'objet d'une autorisation d'utilisation.</p>
      <p>Conformément aux articles L.111-1 et suivants du Code de la propriété intellectuelle, toute reproduction, représentation, diffusion ou utilisation totale ou partielle de ces éléments sans autorisation écrite préalable est strictement interdite et constitue une contrefaçon sanctionnée par la loi.</p>

      <h4>4. Droit applicable et juridiction compétente</h4>
      <p>Les présentes mentions légales sont soumises au droit français. En cas de litige relatif à l’utilisation du site et à défaut d'accord amiable, compétence expresse est attribuée aux tribunaux compétents du ressort de Versailles.</p>
    `;
  } else if (type === 'rgpd') {
    title.textContent = 'Politique de Confidentialité & RGPD';
    content.innerHTML = `
      <h4>1. Responsable du traitement des données</h4>
      <p>Le responsable du traitement des données à caractère personnel est la société <strong>SUSHI LIN II (SARL)</strong>, située au 32 Rue des Dames, 78340 Les Clayes-sous-Bois (Téléphone : 01 30 79 00 88).</p>

      <h4>2. Données personnelles collectées & Finalités</h4>
      <p>Dans le cadre de l'utilisation de nos services de commande à emporter (Click & Collect) et de réservation de tables, nous collectons les données suivantes :</p>
      <ul>
        <li><strong>Identité et coordonnées :</strong> Nom, prénom, numéro de téléphone, adresse e-mail.</li>
        <li><strong>Détails des commandes et réservations :</strong> Plats commandés, date et heure de retrait souhaitée, nombre de couverts, préférences et remarques particulières.</li>
      </ul>
      <p>Ces données sont strictement nécessaires aux finalités suivantes :</p>
      <ul>
        <li>Préparation, suivi et validation de vos commandes de restauration à emporter (base légale : exécution du contrat - Art. 6.1.b du RGPD) ;</li>
        <li>Gestion et confirmation de vos réservations de tables (base légale : exécution du contrat / intérêt légitime - Art. 6.1.b/f du RGPD) ;</li>
        <li>Gestion des obligations légales et comptables de facturation (base légale : obligation légale - Art. 6.1.c du RGPD).</li>
      </ul>
      <p><strong>Engagement :</strong> Aucune donnée personnelle n'est vendue, louée ou cédée à des fins de prospection publicitaire ou à des régies tierces.</p>

      <h4>3. Durée de conservation des données</h4>
      <p>Les données nécessaires à la gestion de la relation client sont conservées pour une durée de <strong>3 ans</strong> à compter du dernier contact avec l'établissement.</p>
      <p>Les données liées aux factures et pièces comptables sont conservées pendant <strong>10 ans</strong> conformément à l'article L.123-22 du Code de commerce.</p>

      <h4>4. Sécurité des données</h4>
      <p>Nous mettons en œuvre toutes les mesures techniques et organisationnelles appropriées (chiffrement TLS/HTTPS, accès restreint et authentifié aux outils de gestion) afin de préserver la sécurité et la confidentialité de vos données et d'empêcher tout accès non autorisé.</p>

      <h4>5. Vos droits conformément au RGPD</h4>
      <p>Conformément au Règlement Général sur la Protection des Données (Règlement UE 2016/679) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès (Art. 15 RGPD)</strong> et de <strong>rectification (Art. 16 RGPD)</strong> de vos données ;</li>
        <li><strong>Droit à l'effacement (Art. 17 RGPD)</strong> (« droit à l'oubli ») ;</li>
        <li><strong>Droit à la limitation du traitement (Art. 18 RGPD)</strong> et <strong>droit d'opposition (Art. 21 RGPD)</strong> ;</li>
        <li><strong>Droit à la portabilité (Art. 20 RGPD)</strong> de vos données.</li>
      </ul>
      <p>Pour exercer ces droits, vous pouvez contacter directement le restaurant par téléphone au <strong>01 30 79 00 88</strong> ou sur place au 32 Rue des Dames, 78340 Les Clayes-sous-Bois.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous disposez du droit d'introduire une réclamation auprès de l'autorité de contrôle française : la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés - 3 Place de Fontenoy, 75007 Paris - <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style="color: var(--sakura-vibrant);">www.cnil.fr</a>).</p>
    `;
  } else if (type === 'cgv') {
    title.textContent = 'Conditions Générales de Vente (CGV)';
    content.innerHTML = `
      <h4>1. Champ d'application</h4>
      <p>Les présentes Conditions Générales de Vente (CGV) s'appliquent à l'ensemble des commandes de repas et produits passées sur le site <strong>sushilin2.fr</strong> pour un retrait sur place (Click & Collect) ainsi qu'aux consommations sur place au restaurant <strong>SUSHI LIN</strong> (32 Rue des Dames, 78340 Les Clayes-sous-Bois).</p>

      <h4>2. Produits & Fraîcheur</h4>
      <p>Tous les plats proposés (sushis, makis, sashimis, yakitoris, chirashis et spécialités chaudes) sont préparés artisanalement le jour même avec des ingrédients frais rigoureusement sélectionnés afin de garantir une fraîcheur et une qualité optimales.</p>
      <p>Les informations relatives aux 14 allergènes majeurs (Règlement UE n° 1169/2011 INCO) sont consultables en détail sur la fiche descriptive de chaque plat et à disposition sur place au restaurant.</p>

      <h4>3. Commandes & Retrait (Click & Collect)</h4>
      <p>Le client sélectionne ses articles, choisit son heure de retrait parmi les créneaux disponibles et valide sa commande. Un récapitulatif détaillé avec numéro de commande et confirmation par e-mail est transmis. Les commandes sont à retirer à l'adresse du restaurant à l'horaire convenu.</p>

      <h4>4. Tarifs et Moyens de paiement</h4>
      <p>Les prix des produits sont indiqués en euros (€) Toutes Taxes Comprises (TTC) au taux de TVA légal en vigueur en France.</p>
      <p>Une remise de 10% sur la vente à emporter est appliquée automatiquement sur les plats éligibles de la carte (hors desserts, boissons et alcools).</p>
      <p>Le paiement s'effectue au comptoir lors du retrait de la commande ou à table :</p>
      <ul>
        <li>Carte Bancaire (CB, Visa, Mastercard, American Express) ;</li>
        <li>Paiement mobile sans contact (Apple Pay, Google Pay) ;</li>
        <li>Titres-restaurant (cartes dématérialisées et tickets papier) ;</li>
        <li>Espèces en euros.</li>
      </ul>

      <h4>5. Exclusion du droit de rétractation</h4>
      <p>Conformément aux dispositions de l'article <strong>L.221-28 4° du Code de la consommation</strong>, le droit de rétractation de 14 jours ne peut être exercé pour les contrats portant sur la fourniture de biens susceptibles de se détériorer ou de se périmer rapidement (denrées alimentaires fraîches préparées le jour même).</p>
      <p>En conséquence, toute commande validée est ferme et définitive.</p>

      <h4>6. Réclamations & Médiation de la consommation</h4>
      <p>En cas de réclamation, le client est invité à s'adresser en priorité à l'établissement par téléphone au <strong>01 30 79 00 88</strong> ou sur place.</p>
      <p>Conformément aux articles L.612-1 et suivants du Code de la consommation, le client a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable de tout litige non résolu :</p>
      <p><strong>Médiateur de la consommation :</strong><br>
      <strong>AME Conso (Association des Médiateurs Européens)</strong><br>
      197 Boulevard Saint-Germain, 75007 Paris<br>
      Saisine en ligne : <a href="https://www.mediationconso-ame.com" target="_blank" rel="noopener noreferrer" style="color: var(--sakura-vibrant);">https://www.mediationconso-ame.com</a></p>
    `;
  } else if (type === 'cookies') {
    title.textContent = 'Politique relative aux Cookies';
    content.innerHTML = `
      <h4>1. Qu'est-ce qu'un cookie ?</h4>
      <p>Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette ou smartphone) lors de la visite d'un site web, permettant de mémoriser temporairement des informations utiles à votre navigation.</p>

      <h4>2. Cookies utilisés sur Sushi Lin</h4>
      <p>Notre site internet utilise exclusivement des <strong>cookies et traceurs techniques essentiels</strong>, strictement nécessaires au bon fonctionnement du service :</p>
      <ul>
        <li><strong>Cookie de panier et commande :</strong> Mémorisation des articles sélectionnés dans votre panier et du récapitulatif de commande ;</li>
        <li><strong>Cookie de session :</strong> Maintien de l'état de votre visite et sécurisation des requêtes ;</li>
        <li><strong>Affichage cartographique :</strong> Chargement interactif de la carte Google Maps pour vous guider jusqu'au restaurant.</li>
      </ul>
      <p><strong>Exemption de consentement préalable :</strong> Conformément aux lignes directrices de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés), ces traceurs purement techniques sont exemptés de l'obligation de recueil préalable du consentement car ils sont indispensables à la fourniture du service expressément demandé par l'internaute.</p>

      <h4>3. Absence de traceurs publicitaires</h4>
      <p>Sushi Lin n'utilise <strong>aucun cookie publicitaire, aucun traceur de profilage commercial ni aucun pixel de suivi tiers</strong> revendant vos données de navigation.</p>
    `;
  }

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeLegalModal() {
  const backdrop = document.getElementById('legal-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
}

// Observer pour baisser l'opacité du bouton Scroll to Top lorsqu'il est dans la zone du footer
const footerSiteEl = document.getElementById('footer-site') || document.querySelector('.footer');
if (footerSiteEl && btnScrollTop && 'IntersectionObserver' in window) {
  const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      btnScrollTop.classList.toggle('in-footer', entry.isIntersecting);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  footerObserver.observe(footerSiteEl);
}

// Mochis modal listeners
document.getElementById('mochi-modal-close')?.addEventListener('click', closeMochiModal);
document.getElementById('mochi-overlay')?.addEventListener('click', closeMochiModal);
document.getElementById('mochi-modal-submit')?.addEventListener('click', handleMochiAddToCart);

// Formatage automatique du numéro de téléphone par paires (chiffres uniquement)
['reg-phone', 'order-customer-phone'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      let digits = el.value.replace(/\D/g, '');
      if (digits.length > 10) digits = digits.slice(0, 10);
      const parts = [];
      for (let i = 0; i < digits.length; i += 2) {
        parts.push(digits.slice(i, i + 2));
      }
      el.value = parts.join(' ');
    });

    el.addEventListener('keydown', (e) => {
      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
        return;
      }
      if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
  }
});
