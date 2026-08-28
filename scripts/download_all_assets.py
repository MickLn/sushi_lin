#!/usr/bin/env python3
"""
Scrapes and downloads ALL 235+ product images & 24 category images from ecommande.fr
and constructs the complete menu.json with 100% local images and full product catalog.
"""

import os
import re
import json
import ssl
import urllib.request
import time

BASE_URL = "https://ecommande.fr"
LISTE_URL = "https://ecommande.fr/frontend/SUSHILIN78340/pc_menu_liste.php?lang=fr"
ACCUEIL_URL = "https://ecommande.fr/frontend/SUSHILIN78340/pc_menu_accueil.php?lang=fr"

OUTPUT_DIR = "/Users/mickln_/Desktop/KEVIN"
PRODUCTS_IMG_DIR = os.path.join(OUTPUT_DIR, "img", "products")
CATEGORIES_IMG_DIR = os.path.join(OUTPUT_DIR, "img", "categories")
MENU_JSON_PATH = os.path.join(OUTPUT_DIR, "data", "menu.json")

os.makedirs(PRODUCTS_IMG_DIR, exist_ok=True)
os.makedirs(CATEGORIES_IMG_DIR, exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "data"), exist_ok=True)

# SSL context unverified to bypass certificate issues on mac
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def fetch_url(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def download_file(remote_url, local_path):
    if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
        return True
    try:
        req = urllib.request.Request(remote_url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = resp.read()
            if len(data) > 200:
                with open(local_path, 'wb') as f:
                    f.write(data)
                return True
    except Exception as e:
        print(f"Error downloading {remote_url}: {e}")
    return False

print("1. Fetching live pages...")
html_liste = fetch_url(LISTE_URL)
html_accueil = fetch_url(ACCUEIL_URL)

# 2. Extract Category Banner Images
print("\n2. Downloading Category Banner Images...")
cat_img_urls = re.findall(r'src=\"(/image/SUSHILIN78340/accueil/[^\"]+\.jpg)\"', html_accueil)
for rurl in set(cat_img_urls):
    filename = os.path.basename(rurl).lower()
    full_remote = BASE_URL + rurl
    local_p = os.path.join(CATEGORIES_IMG_DIR, filename)
    if download_file(full_remote, local_p):
        print(f"  [OK] Category: {filename}")

# Category Name Translation & Metadata
CAT_META = {
    "ENTREE": {"id": "entrees", "name": "Entrées & Salades", "desc": "Soupes, salades fraîches, nems, gyoza et raviolis japonais"},
    "MAKI": {"id": "makis", "name": "Makis & Futo Maki", "desc": "Rouleaux traditionnels d'algue nori garnie de riz vinaigré"},
    "SUSHI": {"id": "sushis", "name": "Sushis & Nigiri", "desc": "Fines tranches de poisson frais sur riz vinaigré façonné à la main"},
    "SAUMON-ROLL": {"id": "saumon-rolls", "name": "Saumon Rolls", "desc": "Rouleaux généreusement enrobés de saumon frais d'Écosse"},
    "EGG-MAKI": {"id": "egg-maki", "name": "Egg Makis", "desc": "Rouleaux enveloppés d'une fine omelette japonaise dorée"},
    "NEIGE-MAKI": {"id": "neige-maki", "name": "Neige Makis", "desc": "Makis délicatement saupoudrés de fromage ou sésame blanc"},
    "PRINTEMPS-MAKI": {"id": "printemps-maki", "name": "Printemps Makis", "desc": "Feuille de riz translucide garnie de menthe fraîche et légumes croquants"},
    "TEMAKI": {"id": "temaki", "name": "Temakis", "desc": "Cônes d'algue croustillante préparés minute"},
    "SASHIMI": {"id": "sashimi", "name": "Sashimis", "desc": "Découpes nobles de poissons crus de qualité supérieure"},
    "YAKITORI": {"id": "yakitori", "name": "Brochettes Yakitori", "desc": "Brochettes japonaises grillées à la flamme et laquées de sauce tare"},
    "MAKI-SPECIAL": {"id": "maki-special", "name": "Makis Spéciaux", "desc": "Créations signature du chef avec garnitures généreuses"},
    "MENU-BROCHETTE": {"id": "menus-brochettes", "name": "Menus Brochettes", "desc": "Assortiments de brochettes grillées servis avec soupe, salade et riz"},
    "MENU-CHIRASHI": {"id": "menus-chirashi", "name": "Menus Chirashi", "desc": "Généreux bols de riz vinaigré surmontés de poissons frais variés"},
    "MENU-ENFANT": {"id": "menus-enfant", "name": "Menu Enfant", "desc": "Formule adaptée pour les plus petits"},
    "MENU-MIXTE": {"id": "menus-mixtes", "name": "Menus Mixtes", "desc": "Compositions équilibrées de sushis, makis et brochettes"},
    "MENU-POISSON": {"id": "menus-poisson", "name": "Menus Poisson", "desc": "Grands assortiments de sushis, sashimis et makis pour amateurs de poisson"},
    "MENU-GRAND": {"id": "menus-grands", "name": "Grands Menus & Bateaux", "desc": "Plateaux dégustation géants pour 2 à 4 personnes"},
    "PLAT-CHAUD": {"id": "plats-chauds", "name": "Plats Chauds & Nouilles", "desc": "Riz sauté japonais, nouilles udon et yakisoba"},
    "BOISSONS": {"id": "boissons", "name": "Boissons & Softs", "desc": "Thés japonais, sodas, bières Asahi/Kirin et jus"},
    "VIN-ROUGE": {"id": "vins-rouges", "name": "Vins Rouges", "desc": "Sélection de vins rouges pour accompagner vos plats"},
    "VIN-ROSE": {"id": "vins-roses", "name": "Vins Rosés", "desc": "Vins rosés frais et fruités"},
    "VIN-BLANC": {"id": "vins-blancs", "name": "Vins Blancs", "desc": "Vins blancs minéraux parfaits avec le poisson cru"},
    "CHAMPAGNE": {"id": "champagne", "name": "Champagnes", "desc": "Champagnes pour célébrer vos grandes occasions"},
    "DESSERTS": {"id": "desserts", "name": "Desserts Japonais", "desc": "Mochis glacés, perles de coco, dorayaki et fruits frais"}
}

# 3. Parse Subcategories & Products
print("\n3. Parsing Subcategories & Products from liste page...")
parts = re.split(r'<div id=\"([^\"]+)\" class=\"sub_category\">', html_liste)

categories_list = []
items_list = []
seen_product_ids = set()

# Clean Name Helper
def format_product_name(raw_name, raw_alt, code):
    name = raw_name.strip() if raw_name.strip() else raw_alt.strip()
    
    # Remove leading code if present
    name = re.sub(r'^[A-Z0-9_-]+\s*[-:.]\s*', '', name)
    
    # Remove piece count suffix for clean Title
    name = re.sub(r'\s*(?:X\s*\d+|\d+\s*pi[èe]ces?|\(.*\))\s*$', '', name, flags=re.IGNORECASE).strip()
    
    # Capitalize nicely
    words = name.split()
    clean_words = []
    for w in words:
        if w.upper() in ['X6', 'X8', 'X2', 'X4', 'X12', 'X18', 'X24', 'CL', '75CL', '33CL', '50CL']:
            clean_words.append(w.upper())
        elif len(w) <= 2 and w.lower() in ['de', 'du', 'la', 'le', 'au', 'en', 'et']:
            clean_words.append(w.lower())
        else:
            clean_words.append(w.capitalize())
            
    res = " ".join(clean_words)
    return res if res else (raw_alt.capitalize() if raw_alt else f"Produit {code}")

for i in range(1, len(parts), 2):
    raw_cat = parts[i].strip()
    content = parts[i+1]
    
    meta = CAT_META.get(raw_cat, {
        "id": raw_cat.lower().replace('_', '-'),
        "name": raw_cat.replace('-', ' ').title(),
        "desc": ""
    })
    
    cat_id = meta["id"]
    
    # Check if category already added
    if not any(c['id'] == cat_id for c in categories_list):
        categories_list.append({
            "id": cat_id,
            "name": meta["name"],
            "desc": meta["desc"],
            "banner": f"img/categories/{raw_cat.lower()}.jpg" if os.path.exists(os.path.join(CATEGORIES_IMG_DIR, f"{raw_cat.lower()}.jpg")) else ""
        })
    
    # Find all products in content
    prod_pattern = re.compile(
        r'<div[^>]*class=\"[^\"]*produit[^\"]*\"[^>]*id=\"([^\"]+)\"[^>]*data-product-value=\"([^\"]+)\"[^>]*>.*?'
        r'<img[^>]+src=\"([^\"]+)\"[^>]*alt=\"([^\"]*)\".*?'
        r'<div class=\"produit-description\">([^<]*)</div>',
        re.DOTALL | re.IGNORECASE
    )
    
    prods = prod_pattern.findall(content)
    
    for p_code, p_price_raw, p_img, p_alt, p_desc in prods:
        code_str = p_code.strip()
        
        # Clean price
        price_num = float(p_price_raw.replace('€', '').replace(',', '.').strip())
        
        # Pieces extraction
        pieces = ""
        m_pcs = re.search(r'(\d+)\s*(?:pi[èe]ces?|pcs?|pces?|pièce|\bX\s*(\d+)|\bx\s*(\d+))', p_desc + ' ' + p_alt, re.IGNORECASE)
        if m_pcs:
            vals = [v for v in m_pcs.groups() if v]
            if vals:
                pieces = f"{vals[0]} pièces"
        elif 'X6' in p_desc.upper(): pieces = "6 pièces"
        elif 'X8' in p_desc.upper(): pieces = "8 pièces"
        elif 'X2' in p_desc.upper(): pieces = "2 pièces"
        elif 'X4' in p_desc.upper(): pieces = "4 pièces"
        elif 'X10' in p_desc.upper(): pieces = "10 pièces"
        elif 'X1' in p_desc.upper(): pieces = "1 pièce"
        elif '75CL' in p_desc.upper() or '75 CL' in p_desc.upper(): pieces = "75 cl"
        elif '33CL' in p_desc.upper() or '33 CL' in p_desc.upper(): pieces = "33 cl"
        elif '50CL' in p_desc.upper() or '50 CL' in p_desc.upper(): pieces = "50 cl"
        elif '25CL' in p_desc.upper() or '25 CL' in p_desc.upper(): pieces = "25 cl"
        
        # Download product image
        img_filename = os.path.basename(p_img).lower()
        local_img_path = os.path.join(PRODUCTS_IMG_DIR, img_filename)
        remote_img_url = BASE_URL + p_img
        
        has_local_img = download_file(remote_img_url, local_img_path)
        
        # Unique item ID
        item_id = f"{cat_id}-{code_str.lower()}"
        if item_id in seen_product_ids:
            item_id = f"{item_id}-{len(seen_product_ids)}"
        seen_product_ids.add(item_id)
        
        clean_name = format_product_name(p_desc, p_alt, code_str)
        
        # Composition description
        item_desc = ""
        if p_alt.strip() and p_alt.strip().upper() != p_desc.strip().upper():
            item_desc = p_alt.strip()
        
        items_list.append({
            "id": item_id,
            "code": code_str,
            "cat": cat_id,
            "name": clean_name,
            "pieces": pieces,
            "price": price_num,
            "img": f"img/products/{img_filename}" if os.path.exists(local_img_path) else "",
            "desc": item_desc,
            "available": True
        })

print(f"\n4. Successfully extracted {len(items_list)} products across {len(categories_list)} categories!")

# Save to menu.json
menu_data = {
    "restaurant": {
        "name": "SUSHI LIN II",
        "tagline": "Cuisine Japonaise Traditionnelle & Vente à Emporter",
        "phone": "01 30 79 00 88",
        "phone_formatted": "01 30 79 00 88",
        "address": "13 Rue Jacques Duclos, 78340 Les Clayes-sous-Bois",
        "hours": {
            "lunch": "12h00 – 14h30",
            "dinner": "18h30 – 22h00",
            "days": "Ouvert 7j/7"
        },
        "takeaway_discount": 10
    },
    "categories": categories_list,
    "items": items_list
}

with open(MENU_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(menu_data, f, ensure_ascii=False, indent=2)

print(f"5. Saved full menu to: {MENU_JSON_PATH}")
print(f"   Total items: {len(items_list)}")
print(f"   Total categories: {len(categories_list)}")

# Downloaded files count in img/products
prod_files = os.listdir(PRODUCTS_IMG_DIR)
print(f"   Local product images downloaded: {len(prod_files)}")
