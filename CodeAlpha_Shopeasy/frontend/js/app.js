/* ============================================================
   app.js – shared helpers used by every page
   ============================================================ */

const API_BASE = "https://shopeasy-xrjq.onrender.com/api";
const CART_KEY = "shopeasy_cart";
const USER_KEY = "shopeasy_user";
const TOKEN_KEY = "shopeasy_token";

const GENDER_LABELS = { men: "Men", women: "Women", unisex: "Unisex" };

// Inline placeholder used when a product has no image or it fails to load
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
      '<rect width="100%" height="100%" fill="#e5e7eb"/>' +
      '<text x="50%" y="50%" fill="#9ca3af" font-family="Arial" font-size="22" ' +
      'text-anchor="middle" dominant-baseline="middle">No image</text></svg>'
  );

/* ---------------- API ---------------- */

async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error("Cannot reach the server. Please check that the backend is running.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    /* response had no JSON body */
  }

  if (!response.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return data;
}

/* The API might return an array, or an object wrapping the array. Handle both. */
function extractList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.products)) return data.products;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.rows)) return data.rows;
  return [];
}

/* Work out whether an accessory is for men, women or both.
   1) Uses a GENDER field if the API sends one
   2) Otherwise reads the CATEGORY / NAME text (e.g. "Men's Watches")
   3) Anything unclear is treated as "unisex" and shows under both */
function detectGender(raw, category, name) {
  const explicit = String(raw.GENDER ?? raw.gender ?? "").toLowerCase().trim();
  if (explicit) {
    if (/^(w|f)/.test(explicit)) return "women";
    if (/^m/.test(explicit)) return "men";
    return "unisex";
  }

  const text = `${category} ${name}`.toLowerCase();
  if (/\bunisex\b/.test(text)) return "unisex";

  const isWomen = /\b(women|woman|womens|ladies|lady|female|girls?)\b/.test(text);
  const isMen = /\b(men|man|mens|gents|gentlemen|male|boys?)\b/.test(text);

  if (isWomen && !isMen) return "women";
  if (isMen && !isWomen) return "men";
  return "unisex";
}

/* "Men's Watches" -> "Watches" so the type filter stays clean */
function accessoryType(category) {
  const cleaned = String(category)
    .replace(/\b(women|woman|womens|ladies|lady|female|men|man|mens|gents|gentlemen|male|boys?|girls?|unisex)(['’]?s)?\b/gi, "")
    .replace(/^[\s\-–|\/,&'’]+|[\s\-–|\/,&'’]+$/g, "")
    .replace(/\s{2,}/g, " ");
  return cleaned || "Accessories";
}

/* Accept UPPERCASE or lowercase keys and return one consistent shape */
function normalizeProduct(p) {
  const get = (key) => (p[key] !== undefined ? p[key] : p[key.toLowerCase()]);
  const category = get("CATEGORY") || "Accessories";
  const name = get("NAME") || "Unnamed product";
  return {
    id: get("PRODUCT_ID") ?? p.id,
    name,
    description: get("DESCRIPTION") || "",
    price: Number(get("PRICE")) || 0,
    image: get("IMAGE") || "",
    category,
    stock: Number(get("STOCK")) || 0,
    gender: detectGender(p, category, name),
    type: accessoryType(category),
  };
}

/* ---------------- Formatting / safety ---------------- */

function formatPrice(value) {
  return "₹" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function resolveImage(image) {
  if (!image) return PLACEHOLDER_IMG;
  if (/^(https?:|data:|\/)/i.test(image)) return image;
  return `images/${image}`; // file name stored in the local images/ folder
}

function stockInfo(stock) {
  if (stock <= 0) return { cls: "out", text: "Out of stock" };
  if (stock <= 5) return { cls: "low", text: `Only ${stock} left` };
  return { cls: "in", text: `In stock (${stock})` };
}

/* ---------------- Messages / loading ---------------- */

function showMessage(type, text, containerId = "message") {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = `<div class="alert ${type}">${escapeHTML(text)}</div>`;
  if (type === "success") {
    setTimeout(() => {
      if (box.firstChild && box.firstChild.classList.contains("success")) box.innerHTML = "";
    }, 4000);
  }
}

function clearMessage(containerId = "message") {
  const box = document.getElementById(containerId);
  if (box) box.innerHTML = "";
}

function loaderHTML(text = "Loading...") {
  return `<div class="loader-wrap"><div class="spinner"></div><span>${escapeHTML(text)}</span></div>`;
}

function setButtonLoading(button, isLoading, loadingText = "Please wait...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="spinner-sm"></span>${escapeHTML(loadingText)}`;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

/* ---------------- Cart (localStorage) ---------------- */

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(cart) ? cart : [];
  } catch (_) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function clearCartStorage() {
  localStorage.removeItem(CART_KEY);
  updateCartCount();
}

function cartTotal(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  badge.textContent = getCart().reduce((n, item) => n + item.quantity, 0);
}

/* product must be a normalized product object */
function addToCart(product, quantity = 1) {
  if (product.stock <= 0) return { ok: false, message: "This product is out of stock." };

  const cart = getCart();
  const existing = cart.find((item) => String(item.id) === String(product.id));
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + quantity;

  if (newQty > product.stock) {
    return { ok: false, message: `Only ${product.stock} unit(s) available for "${product.name}".` };
  }

  if (existing) {
    existing.quantity = newQty;
    existing.stock = product.stock;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: product.stock,
      quantity,
    });
  }
  saveCart(cart);
  return { ok: true, message: `"${product.name}" added to your cart.` };
}

/* ---------------- Auth state ---------------- */

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (_) {
    return null;
  }
}

function logout() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "index.html";
}

function renderAuthLinks() {
  const box = document.getElementById("authLinks");
  const user = getUser();
  if (!box || !user) return;
  const name = user.name || user.NAME || user.email || "Customer";
  box.innerHTML = `
    <span class="user-name">Hi, ${escapeHTML(name)}</span>
    <button class="btn btn-outline btn-sm" id="logoutBtn">Logout</button>`;
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

/* ---------------- Mobile nav ---------------- */

function setupNavToggle() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));
}

/* ---------------- Validation helpers ---------------- */

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);
  if (error) error.textContent = message || "";
  if (input && input.closest(".form-group")) {
    input.closest(".form-group").classList.toggle("invalid", Boolean(message));
  }
}

/* ---------------- Init ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  renderAuthLinks();
  setupNavToggle();
});
