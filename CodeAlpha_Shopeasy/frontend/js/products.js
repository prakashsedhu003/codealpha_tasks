/* products.js – used by index.html (featured) and products.html (full list with gender tabs) */

let allProducts = [];
let activeGender = "all"; // "all" | "men" | "women"

const GENDER_TITLES = { all: "All Accessories", men: "Men's Accessories", women: "Women's Accessories" };

document.addEventListener("DOMContentLoaded", loadProducts);

async function loadProducts() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  const limit = Number(grid.dataset.limit) || 0;

  // Read ?gender=men or ?gender=women from the URL (products page only)
  if (document.getElementById("genderTabs")) {
    const fromUrl = new URLSearchParams(window.location.search).get("gender");
    if (fromUrl === "men" || fromUrl === "women") activeGender = fromUrl;
  }

  grid.innerHTML = loaderHTML("Loading accessories...");
  clearMessage();

  try {
    const data = await apiRequest("/products");
    allProducts = extractList(data).map(normalizeProduct);

    setupFilters();
    syncGenderUI();
    renderProducts(limit);
  } catch (err) {
    grid.innerHTML = "";
    showMessage("error", err.message);
    grid.insertAdjacentHTML(
      "afterend",
      `<div class="center" id="retryBox"><button class="btn btn-outline" id="retryBtn">Try again</button></div>`
    );
    document.getElementById("retryBtn").addEventListener("click", () => {
      document.getElementById("retryBox").remove();
      loadProducts();
    });
  }
}

/* A unisex item appears under both Men and Women */
function matchesGender(p, gender) {
  return gender === "all" || p.gender === gender || p.gender === "unisex";
}

function setupFilters() {
  const search = document.getElementById("searchInput");
  const category = document.getElementById("categoryFilter");
  const tabs = document.getElementById("genderTabs");

  if (category) {
    buildCategoryOptions();
    category.addEventListener("change", () => renderProducts());
  }
  if (search) search.addEventListener("input", () => renderProducts());

  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".gender-tab");
      if (!tab) return;
      activeGender = tab.dataset.gender;

      // keep the URL in sync so the page can be refreshed or shared
      const url = activeGender === "all" ? "products.html" : `products.html?gender=${activeGender}`;
      window.history.replaceState(null, "", url);

      buildCategoryOptions();
      syncGenderUI();
      renderProducts();
    });
  }
}

/* The type dropdown only lists types that exist for the selected gender */
function buildCategoryOptions() {
  const category = document.getElementById("categoryFilter");
  if (!category) return;

  const previous = category.value;
  const types = [
    ...new Set(allProducts.filter((p) => matchesGender(p, activeGender)).map((p) => p.type)),
  ].sort();

  category.innerHTML =
    `<option value="">All types</option>` +
    types.map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");

  if (types.includes(previous)) category.value = previous;
}

/* Updates tab highlight, counts, page title and nav highlight */
function syncGenderUI() {
  const tabs = document.getElementById("genderTabs");
  if (!tabs) return;

  tabs.querySelectorAll(".gender-tab").forEach((tab) => {
    const g = tab.dataset.gender;
    tab.classList.toggle("active", g === activeGender);
    const count = allProducts.filter((p) => matchesGender(p, g)).length;
    tab.querySelector(".count").textContent = `(${count})`;
  });

  const title = document.getElementById("pageTitle");
  if (title) title.textContent = GENDER_TITLES[activeGender];

  document.querySelectorAll("#navLinks a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href.startsWith("products.html")) return;
    const g = new URLSearchParams(href.split("?")[1] || "").get("gender") || "all";
    a.classList.toggle("active", g === activeGender);
  });
}

function renderProducts(limit = 0) {
  const grid = document.getElementById("product-grid");
  const search = document.getElementById("searchInput");
  const category = document.getElementById("categoryFilter");

  const term = search ? search.value.trim().toLowerCase() : "";
  const type = category ? category.value : "";
  const gender = document.getElementById("genderTabs") ? activeGender : "all";

  let list = allProducts.filter((p) => {
    const matchesText = !term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term);
    const matchesType = !type || p.type === type;
    return matchesText && matchesType && matchesGender(p, gender);
  });

  if (limit) list = list.slice(0, limit);

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>No accessories found</h3><p class="muted">Try a different search, type or tab.</p></div>`;
    return;
  }

  grid.innerHTML = list.map(productCardHTML).join("");
}

function productCardHTML(p) {
  const s = stockInfo(p.stock);
  const link = `product-details.html?id=${encodeURIComponent(p.id)}`;
  const genderLabel = GENDER_LABELS[p.gender];
  return `
    <article class="product-card">
      <a class="product-media" href="${link}">
        <img src="${escapeHTML(resolveImage(p.image))}" alt="${escapeHTML(p.name)}"
             loading="lazy" onerror="this.onerror=null;this.src=PLACEHOLDER_IMG;" />
        <span class="tag">${escapeHTML(genderLabel)} · ${escapeHTML(p.type)}</span>
      </a>
      <div class="product-body">
        <h3><a href="${link}">${escapeHTML(p.name)}</a></h3>
        <p class="product-desc">${escapeHTML(p.description)}</p>
        <div class="product-foot">
          <span class="price">${formatPrice(p.price)}</span>
          <span class="stock ${s.cls}">${s.text}</span>
        </div>
        <div class="card-actions">
          <a class="btn btn-outline" href="${link}">View Details</a>
          <button class="btn" data-add="${escapeHTML(p.id)}" ${p.stock <= 0 ? "disabled" : ""}>Add to Cart</button>
        </div>
      </div>
    </article>`;
}

/* One click listener handles every "Add to Cart" button */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const product = allProducts.find((p) => String(p.id) === btn.dataset.add);
  if (!product) return;
  const result = addToCart(product, 1);
  showMessage(result.ok ? "success" : "error", result.message);
});
