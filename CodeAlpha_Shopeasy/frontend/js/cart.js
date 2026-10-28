/* cart.js – shopping cart page (data lives in localStorage) */

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  document.getElementById("clearCart").addEventListener("click", () => {
    if (confirm("Remove all items from your cart?")) {
      clearCartStorage();
      renderCart();
    }
  });
});

function renderCart() {
  const content = document.getElementById("cart-content");
  const clearBtn = document.getElementById("clearCart");
  const cart = getCart();

  if (cart.length === 0) {
    clearBtn.hidden = true;
    content.innerHTML = `
      <div class="empty-state">
        <h3>Your bag is empty</h3>
        <p class="muted">Looks like you haven't added anything yet.</p>
        <a href="products.html" class="btn">Browse accessories</a>
      </div>`;
    return;
  }

  clearBtn.hidden = false;
  const itemCount = cart.reduce((n, i) => n + i.quantity, 0);

  content.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">${cart.map(cartItemHTML).join("")}</div>
      <aside class="card summary-card">
        <h3>Bag Summary</h3>
        <div class="summary-row"><span>Items</span><span>${itemCount}</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatPrice(cartTotal(cart))}</span></div>
        <a href="checkout.html" class="btn btn-block">Proceed to Checkout</a>
      </aside>
    </div>`;
}

function cartItemHTML(item) {
  return `
    <div class="cart-item" data-id="${escapeHTML(item.id)}">
      <img src="${escapeHTML(resolveImage(item.image))}" alt="${escapeHTML(item.name)}"
           onerror="this.onerror=null;this.src=PLACEHOLDER_IMG;" />
      <div class="cart-item-info">
        <h3>${escapeHTML(item.name)}</h3>
        <div class="muted">${formatPrice(item.price)} each</div>
        <button class="remove-link" data-action="remove">Remove</button>
      </div>
      <div class="qty-control">
        <button data-action="dec" aria-label="Decrease quantity">−</button>
        <input type="number" value="${item.quantity}" min="1" max="${item.stock || ""}" data-action="set" />
        <button data-action="inc" aria-label="Increase quantity">+</button>
      </div>
      <div class="item-subtotal">${formatPrice(item.price * item.quantity)}</div>
    </div>`;
}

function updateQuantity(id, newQty) {
  const cart = getCart();
  const item = cart.find((i) => String(i.id) === String(id));
  if (!item) return;

  if (newQty < 1) newQty = 1;
  if (item.stock && newQty > item.stock) {
    newQty = item.stock;
    showMessage("error", `Only ${item.stock} unit(s) available for "${item.name}".`);
  } else {
    clearMessage();
  }
  item.quantity = newQty;
  saveCart(cart);
  renderCart();
}

function removeItem(id) {
  saveCart(getCart().filter((i) => String(i.id) !== String(id)));
  showMessage("info", "Item removed from your bag.");
  renderCart();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  const row = e.target.closest(".cart-item");
  if (!btn || !row || btn.tagName === "INPUT") return;

  const id = row.dataset.id;
  const item = getCart().find((i) => String(i.id) === String(id));
  if (!item) return;

  if (btn.dataset.action === "inc") updateQuantity(id, item.quantity + 1);
  if (btn.dataset.action === "dec") updateQuantity(id, item.quantity - 1);
  if (btn.dataset.action === "remove") removeItem(id);
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "set") return;
  const row = e.target.closest(".cart-item");
  updateQuantity(row.dataset.id, parseInt(e.target.value, 10) || 1);
});
