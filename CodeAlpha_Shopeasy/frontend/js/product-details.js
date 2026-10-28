/* product-details.js – loads one product using ?id=... in the URL */

let currentProduct = null;

document.addEventListener("DOMContentLoaded", loadProductDetails);

async function loadProductDetails() {
  const container = document.getElementById("product-details");
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    showMessage("error", "No product selected.");
    return;
  }

  container.innerHTML = loaderHTML("Loading product...");

  try {
    currentProduct = await fetchProduct(id);
    if (!currentProduct) throw new Error("Product not found.");
    renderDetails(container);
  } catch (err) {
    container.innerHTML = "";
    showMessage("error", err.message);
  }
}

/* Try GET /products/:id first; fall back to finding it in GET /products */
async function fetchProduct(id) {
  try {
    const data = await apiRequest(`/products/${encodeURIComponent(id)}`);
    const raw = Array.isArray(data) ? data[0] : data && (data.product || data.data || data);
    if (raw && typeof raw === "object" && Object.keys(raw).length) return normalizeProduct(raw);
  } catch (_) {
    /* fall through to the list endpoint */
  }
  const list = extractList(await apiRequest("/products")).map(normalizeProduct);
  return list.find((p) => String(p.id) === String(id)) || null;
}

function renderDetails(container) {
  const p = currentProduct;
  const s = stockInfo(p.stock);
  document.title = `ShopEasy – ${p.name}`;

  container.innerHTML = `
    <div class="details">
      <div class="details-gallery">
        <img class="details-img" src="${escapeHTML(resolveImage(p.image))}" alt="${escapeHTML(p.name)}"
             onerror="this.onerror=null;this.src=PLACEHOLDER_IMG;" />
      </div>
      <div class="details-info">
        <span class="eyebrow">${escapeHTML(GENDER_LABELS[p.gender])} · ${escapeHTML(p.type)}</span>
        <h1>${escapeHTML(p.name)}</h1>
        <div class="gold-rule"></div>
        <div class="price">${formatPrice(p.price)}</div>
        <p class="details-desc">${escapeHTML(p.description)}</p>
        <div class="stock ${s.cls}">${s.text}</div>

        <div class="qty-row">
          <strong>Quantity</strong>
          <div class="qty-control">
            <button type="button" id="qtyMinus" aria-label="Decrease">−</button>
            <input type="number" id="qtyInput" value="1" min="1" max="${p.stock}" />
            <button type="button" id="qtyPlus" aria-label="Increase">+</button>
          </div>
        </div>

        <button class="btn btn-lg btn-block" id="addBtn" ${p.stock <= 0 ? "disabled" : ""}>Add to Cart</button>
      </div>
    </div>`;

  const input = document.getElementById("qtyInput");
  const clamp = () => {
    let v = parseInt(input.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (p.stock > 0 && v > p.stock) v = p.stock;
    input.value = v;
    return v;
  };

  document.getElementById("qtyMinus").addEventListener("click", () => { input.value = Number(input.value) - 1; clamp(); });
  document.getElementById("qtyPlus").addEventListener("click", () => { input.value = Number(input.value) + 1; clamp(); });
  input.addEventListener("change", clamp);

  document.getElementById("addBtn").addEventListener("click", () => {
    const result = addToCart(p, clamp());
    showMessage(result.ok ? "success" : "error", result.message);
  });
}
