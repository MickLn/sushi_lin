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

// ---- Generate Available Pickup Slots (Dès l'ouverture et jusqu'à 15 min avant fermeture) ----
function generatePickupTimeSlots() {
  if (!pickupTimeSelect) return;
  pickupTimeSelect.innerHTML = '<option value="Dès que possible (~20 min)">Dès que possible (~20 min)</option>';
  
  const midiSlots = [
    '12h00', '12h15', '12h30', '12h45',
    '13h00', '13h15', '13h30', '13h45',
    '14h00', '14h15'
  ];

  const soirSlots = [
    '18h30', '18h45',
    '19h00', '19h15', '19h30', '19h45',
    '20h00', '20h15', '20h30', '20h45',
    '21h00', '21h15', '21h30', '21h45'
  ];

  const midiGroup = document.createElement('optgroup');
  midiGroup.label = 'Midi (12h00 – 14h15)';
  midiSlots.forEach(slot => {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = `À ${slot}`;
    midiGroup.appendChild(opt);
  });
  pickupTimeSelect.appendChild(midiGroup);

  const soirGroup = document.createElement('optgroup');
  soirGroup.label = 'Soir (18h30 – 21h45)';
  soirSlots.forEach(slot => {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = `À ${slot}`;
    soirGroup.appendChild(opt);
  });
  pickupTimeSelect.appendChild(soirGroup);
}

// ---- Dynamic Admin Settings ----
let APP_SETTINGS = {
  status: 'open',
  exceptionalMessage: '',
  scheduleText: 'Ouvert 7j/7 · 12h00–14h30 & 18h30–22h00',
  discount: 10,
  phone: '01 30 79 00 88',
  whatsapp: '33130790088'
};

function applyAdminSettings() {
  const savedSettings = localStorage.getItem('sushilin_admin_settings');
  if (savedSettings) {
    try {
      APP_SETTINGS = { ...APP_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (e) {}
  }

  // Update Status in banner
  const bannerStatusText = document.getElementById('banner-status-text');
  if (bannerStatusText) {
    if (APP_SETTINGS.status === 'closed-exceptional') {
      bannerStatusText.textContent = APP_SETTINGS.exceptionalMessage || 'Fermeture exceptionnelle';
      bannerStatusText.style.color = '#E11D48';
    } else {
      bannerStatusText.textContent = APP_SETTINGS.scheduleText || 'Ouvert 7j/7 · 12h00–14h30 & 18h30–22h00';
    }
  }

  // Update Phone
  const phoneLabel = document.querySelector('.phone-label');
  if (phoneLabel && APP_SETTINGS.phone) phoneLabel.textContent = APP_SETTINGS.phone;
}

// ---- Fetch & Load Menu Data ----
async function loadMenuData() {
  try {
    applyAdminSettings();

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

          // 1. Fusionner les modifications sur les plats existants
          freshMenu.items = freshMenu.items.map(item => {
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
                img: item.img || override.img,
                cat: override.cat || item.cat
              };
            }
            return item;
          });

          // 2. Conserver les nouveaux plats personnalisés créés dans l'admin
          const customItems = parsed.items.filter(i => !canonicalIds.has(i.id));
          if (customItems.length > 0) {
            freshMenu.items = [...freshMenu.items, ...customItems];
          }
        }
      } catch (e) {
        console.error('Erreur fusion sushilin_admin_menu:', e);
      }
    }
    MENU_DATA = freshMenu;
    localStorage.setItem('sushilin_admin_menu', JSON.stringify(MENU_DATA));

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

// ---- Render Category Navigation (Sidebar on Desktop & Pills on Mobile) ----
function renderCategoryNavigation() {
  if (!MENU_DATA) return;
  
  if (sidebarCatList) sidebarCatList.innerHTML = '';
  if (mobileCatNavInner) mobileCatNavInner.innerHTML = '';

  const allCount = MENU_DATA.items.length;

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
  }

  // 2. Mobile Pill "Tous les plats"
  if (mobileCatNavInner) {
    const allPill = document.createElement('button');
    allPill.className = `cat-pill ${selectedCategory === 'all' ? 'active' : ''}`;
    allPill.id = 'mobile-cat-pill-all';
    allPill.textContent = 'Tous les plats';
    allPill.addEventListener('click', () => selectCategoryFilter('all'));
    mobileCatNavInner.appendChild(allPill);
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
      <h2 class="cat-section-title">${catLabel}</h2>
      <span class="cat-section-count">${items.length} plat${items.length > 1 ? 's' : ''}</span>
    `;
    section.appendChild(catHeader);

    // Regroupement par sous-catégories
    const subcatMap = new Map();
    items.forEach(item => {
      const skey = item.subcat || `${cat.id}-default`;
      const sname = item.subcatName || catLabel;
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

  const discountVal = item.price * 0.10;
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
      ${item.desc ? `<p class="product-desc">${item.desc}</p>` : ''}
      ${allergensCardHtml}
      <div class="product-bottom-row">
        <div class="product-pricing">
          <span class="price-main">${formatEuro(item.price)}</span>
          <span class="price-takeaway">→ ${formatEuro(takeawayPrice)} emporter</span>
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

  // Click card to open modal details
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-item')) {
      e.stopPropagation();
      addItemToCart(item);
      return;
    }
    openProductModal(item);
  });

  return card;
}

// ---- Cart Operations ----
function addItemToCart(item, quantity = 1) {
  const existingIndex = cart.findIndex(c => c.id === item.id);
  if (existingIndex > -1) {
    cart[existingIndex].qty += quantity;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      cat: item.cat,
      qty: quantity
    });
  }

  saveCartToStorage();
  updateCartUI();
  updateCardBadgeUI(item.id);
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
  const discount = subtotal * 0.10;
  const total = subtotal - discount;
  const totalItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
  return { subtotal, discount, total, totalItemsCount };
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

  // Drawer Footer Totals
  if (summarySubtotal) summarySubtotal.textContent = formatEuro(subtotal);
  if (summaryDiscount) summaryDiscount.textContent = `–${formatEuro(discount)}`;
  if (summaryTotal) summaryTotal.textContent = formatEuro(total);
  if (btnCheckout) btnCheckout.disabled = totalItemsCount === 0;

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
  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-details">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-price-calc">${formatEuro(item.price)} × ${item.qty} = <strong>${formatEuro(item.price * item.qty)}</strong></div>
      </div>
      <div class="cart-item-stepper">
        <button class="stepper-btn minus" aria-label="Diminuer" data-id="${item.id}">−</button>
        <span class="stepper-value">${item.qty}</span>
        <button class="stepper-btn plus" aria-label="Augmenter" data-id="${item.id}">+</button>
      </div>
    `;

    row.querySelector('.minus').addEventListener('click', () => updateCartQuantity(item.id, -1));
    row.querySelector('.plus').addEventListener('click', () => updateCartQuantity(item.id, 1));

    cartDrawerBody.appendChild(row);
  });
}

function openCartPanel() {
  renderCartPanelItems();
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
  currentModalItem = item;
  modalQuantity = 1;

  const takeawayPrice = item.price * 0.90;
  const mediaHtml = item.img
    ? `<img src="${item.img}" alt="${item.name}" loading="lazy">`
    : getCategorySvgIcon(item.cat);

  const allergens = getItemAllergens(item);
  const allergensModalHtml = allergens.length > 0
    ? `<div class="modal-allergens-box">
         <strong>Allergènes :</strong> <span>${allergens.join(', ')}</span>
       </div>`
    : '';

  modalBody.innerHTML = `
    <div class="modal-media-box">${mediaHtml}</div>
    <h2 class="modal-product-title">${item.name}</h2>
    ${item.desc ? `<p class="modal-product-desc">${item.desc}</p>` : ''}
    ${allergensModalHtml}
    <div class="product-pricing">
      <span class="price-main">${formatEuro(item.price)}</span>
      <span class="price-takeaway">→ ${formatEuro(takeawayPrice)} à emporter (–10%)</span>
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
    addItemToCart(item, modalQuantity);
    closeProductModal();
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

  if (user) {
    if (guestView) guestView.style.display = 'none';
    if (loggedView) loggedView.style.display = 'block';
    if (loggedName) loggedName.textContent = user.name;
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

  container.innerHTML = orders.map(ord => `
    <div class="user-order-card">
      <div>
        <strong style="font-size: 14px; color: var(--indigo-dark); display: block; font-family: var(--font-heading);">${ord.id} · ${(ord.total || 0).toFixed(2).replace('.', ',')} €</strong>
        <span style="font-size: 12px; color: var(--text-secondary); display: block; margin-top: 2px;">
          ${ord.dateFormatted || ''} · <span style="font-weight: 700; color: var(--indigo-primary);">${ord.itemCount || ord.items.length} plat${(ord.itemCount || ord.items.length) > 1 ? 's' : ''}</span>
        </span>
      </div>
      <button type="button" class="btn-reorder" onclick="reorderPastOrder('${ord.id}')">
        Recommander
      </button>
    </div>
  `).join('');
}

function reorderPastOrder(orderId) {
  const orders = JSON.parse(localStorage.getItem('sushilin_orders') || '[]');
  const ord = orders.find(o => o.id === orderId);
  if (!ord) return;

  cart = [...ord.items];
  saveCartToStorage();
  updateCartUI();
  MENU_DATA?.items.forEach(item => updateCardBadgeUI(item.id));
  closeAuthModal();
  openCartPanel();
  showToastNotification('Articles réajoutés à votre panier !');
}

// ---- Validation de commande (Enregistrement en local pour le Panel Admin & Envoi Resend) ----
function handleOrderCheckout() {
  if (cart.length === 0) return;
  const { subtotal, discount, total } = calculateCartTotals();
  const sauceChoice = document.getElementById('sauce-choice')?.value || 'Sauce sucrée';
  const baguettesChoice = document.getElementById('baguettes-choice')?.value || '1 paire';
  const pickupTime = document.getElementById('pickup-time')?.value || 'Dès que possible';
  const comment = document.getElementById('comment-order')?.value.trim() || '';
  const customerEmail = document.getElementById('order-customer-email')?.value.trim() || '';

  // 1. Sauvegarde dans le panneau d'administration (localStorage)
  const orderId = 'CMD-' + Date.now().toString().slice(-6);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const orderData = {
    id: orderId,
    timestamp: now.toISOString(),
    dateFormatted: dateFormatted,
    customerEmail: customerEmail,
    items: cart.map(item => ({
      id: item.id,
      code: item.code || '',
      name: item.name,
      price: item.price,
      qty: item.qty,
      image: item.image || ''
    })),
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
      showToastNotification(`🍣 Commande ${orderId} validée ! E-mail envoyé avec succès.`);
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
authOverlay?.addEventListener('click', closeAuthModal);

btnCheckout?.addEventListener('click', handleOrderCheckout);

// Escape key to close any modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeProductModal();
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

  const lunchStart = 12 * 60;        // 12h00
  const lunchEnd = 14 * 60 + 30;     // 14h30
  const dinnerStart = 18 * 60 + 30;  // 18h30
  const dinnerEnd = 22 * 60;         // 22h00

  const isLunch = currentMinutes >= lunchStart && currentMinutes <= lunchEnd;
  const isDinner = currentMinutes >= dinnerStart && currentMinutes <= dinnerEnd;

  if (isLunch || isDinner) {
    return { isOpen: true, message: 'Le restaurant est actuellement ouvert.' };
  } else {
    let nextService = '';
    if (currentMinutes < lunchStart) {
      nextService = 'Ouverture à 12h00 pour le service du midi.';
    } else if (currentMinutes < dinnerStart) {
      nextService = 'Ouverture à 18h30 pour le service du soir.';
    } else {
      nextService = 'Réouverture demain à 12h00.';
    }
    return {
      isOpen: false,
      isExceptional: false,
      message: `Le restaurant est actuellement fermé en dehors des heures de service. ${nextService} Vous pouvez préparer votre commande à emporter ou réserver votre table !`
    };
  }
}

function checkClosurePopup() {
  const statusInfo = getRestaurantCurrentStatus();
  if (!statusInfo.isOpen) {
    const backdrop = document.getElementById('closure-modal-backdrop');
    const msgEl = document.getElementById('closure-modal-msg');
    const dismissBtn = document.getElementById('closure-btn-dismiss');

    if (backdrop) {
      if (msgEl) msgEl.textContent = statusInfo.message;
      backdrop.classList.add('active');
      backdrop.setAttribute('aria-hidden', 'false');

      const closePopup = () => {
        backdrop.classList.remove('active');
        backdrop.setAttribute('aria-hidden', 'true');
      };

      dismissBtn?.addEventListener('click', closePopup);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closePopup();
      });
    }
  }
}

// ---- Hero CTA : Filtre exclusivement sur les Entrées et défile au titre ----
document.getElementById('hero-order-cta')?.addEventListener('click', (e) => {
  e.preventDefault();
  selectCategoryFilter('entrees', true);
});

// ---- Initialization ----
loadMenuData();
updateUserAccountUI();
setTimeout(checkClosurePopup, 500);


// ---- MODAL MENTIONS LÉGALES & RGPD & CGV (CONFORME SUSHI LIN) ----
function openLegalModal(type) {
  const backdrop = document.getElementById('legal-modal-backdrop');
  const title = document.getElementById('legal-modal-title');
  const content = document.getElementById('legal-modal-content');
  if (!backdrop || !title || !content) return;

  if (type === 'mentions') {
    title.textContent = 'Mentions Légales';
    content.innerHTML = `
      <h4>1. Éditeur du site & Établissement</h4>
      <p>Le présent site internet est exploité sous le nom commercial :</p>
      <p><strong>Raison commerciale :</strong> SUSHI LIN (SUSHI LIN II)</p>
      <p><strong>Adresse de l'établissement :</strong> 32 Rue des Dames, 78340 Les Clayes-sous-Bois, France</p>
      <p><strong>Téléphone direct :</strong> <a href="tel:0130452848" style="color: var(--sakura-vibrant); font-weight: 700;">01 30 45 28 48</a></p>
      <p><strong>Activité :</strong> Restauration japonaise traditionnelle sur place, vente à emporter et service traiteur.</p>

      <h4>2. Hébergement</h4>
      <p>Le site est hébergé par :<br>
      <strong>LWS (Ligne Web Services)</strong><br>
      2 Rue Jules Ferry, 88190 Golbey, France<br>
      Site web : <a href="https://www.lws.fr" target="_blank" rel="noopener noreferrer" style="color: var(--sakura-vibrant);">https://www.lws.fr</a></p>

      <h4>3. Propriété intellectuelle</h4>
      <p>L’ensemble du contenu présent sur ce site (textes, graphismes, photographies, logos, icônes, logiciels et mise en page) est la propriété exclusive de <strong>SUSHI LIN</strong>, sauf mention contraire.</p>
      <p>Toute reproduction, distribution, modification, adaptation ou publication, même partielle, est strictement interdite sans l’autorisation écrite préalable de SUSHI LIN.</p>

      <h4>4. Responsabilité</h4>
      <p>SUSHI LIN met tout en œuvre pour assurer la fiabilité et l’exactitude des informations publiées (prix, disponibilité, horaires), mais ne saurait être tenue responsable d’éventuelles omissions ou d'erreurs indépendantes de sa volonté.</p>
    `;
  } else if (type === 'rgpd') {
    title.textContent = 'Politique de Confidentialité & Cookies (RGPD)';
    content.innerHTML = `
      <h4>1. Responsable du traitement des données</h4>
      <p>Le responsable du traitement des données personnelles est l'établissement <strong>SUSHI LIN</strong>, situé au 32 Rue des Dames, 78340 Les Clayes-sous-Bois.</p>

      <h4>2. Données collectées & Finalités</h4>
      <p>Les informations collectées via notre module de commande à emporter et de réservation de tables (nom, prénom, numéro de téléphone, adresse e-mail) sont strictement nécessaires à l'exécution de la prestation de restauration :</p>
      <ul>
        <li>Préparation et suivi des commandes à emporter ;</li>
        <li>Confirmation et gestion des réservations de tables ;</li>
        <li>Communication directe avec le client en cas d'indisponibilité ou d'ajustement.</li>
      </ul>
      <p><strong>Aucune donnée n'est vendue, cédée ou transmise à des tiers à des fins publicitaires.</strong></p>

      <h4>3. Durée de conservation</h4>
      <p>Les données relatives aux commandes et réservations sont conservées pour la durée strictement nécessaire au traitement de la demande et à la gestion de la relation client, dans le respect des délais légaux de prescription.</p>

      <h4>4. Vos droits (RGPD)</h4>
      <p>Conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d'accès et de rectification de vos données ;</li>
        <li>Droit à l'effacement (« droit à l'oubli ») ;</li>
        <li>Droit à la limitation du traitement et d'opposition.</li>
      </ul>
      <p>Pour exercer ces droits, vous pouvez contacter directement le restaurant par téléphone au <strong>01 30 45 28 48</strong> ou sur place.</p>

      <h4>5. Politique relative aux Cookies</h4>
      <p>Notre site utilise exclusivement des <strong>cookies techniques de session</strong> strictement indispensables à la navigation et à la mémorisation de votre panier d'achat. Ces cookies ne requièrent pas de consentement préalable conformément aux recommandations de la CNIL.</p>
      <p>L'affichage interactif de la carte repose sur <strong>Google Maps Platform</strong>. Aucun traceur publicitaire ou de profilage n'est déposé sur votre terminal.</p>
    `;
  } else if (type === 'cgv') {
    title.textContent = 'Conditions Générales de Vente (CGV)';
    content.innerHTML = `
      <h4>1. Commandes & Préparation à la minute</h4>
      <p>Tous les plats (sushis, makis, sashimis, yakitoris et spécialités chaudes) sont préparés artisanalement à la commande pour garantir une fraîcheur optimale. En cas de forte affluence, un délai indicatif de préparation vous est communiqué lors de la validation.</p>

      <h4>2. Tarifs et Moyens de paiement</h4>
      <p>Les prix affichés sur notre carte sont exprimés en euros (€) Toutes Taxes Comprises (TTC). Le règlement de votre commande s'effectue au comptoir lors du retrait ou à table :</p>
      <ul>
        <li>Carte Bancaire (Visa, Mastercard, American Express) ;</li>
        <li>Paiement sans contact (Apple Pay, Google Pay) ;</li>
        <li>Titres-restaurant (cartes et tickets) ;</li>
        <li>Espèces en euros.</li>
      </ul>

      <h4>3. Absence de droit de rétractation</h4>
      <p>Conformément aux dispositions de l'article <strong>L.221-28 4° du Code de la consommation</strong>, le droit de rétractation ne peut être exercé pour les contrats de fourniture de denrées alimentaires périssables préparées à la commande.</p>

      <h4>4. Réclamations & Service client</h4>
      <p>Pour toute question ou réclamation concernant une commande ou une réservation, notre équipe se tient à votre entière disposition au restaurant ou par téléphone au <strong>01 30 45 28 48</strong>.</p>
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
