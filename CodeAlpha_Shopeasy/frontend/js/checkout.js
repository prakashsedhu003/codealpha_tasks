const ORDER_ENDPOINT = "/orders";

document.addEventListener("DOMContentLoaded", () => {
    const cart = getCart();

    if (cart.length === 0) {
        document.getElementById("checkoutLayout").innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <h3>Your bag is empty</h3>
                <p class="muted">Add some accessories before checking out.</p>
                <a href="products.html" class="btn">Browse accessories</a>
            </div>
        `;
        return;
    }

    renderOrderSummary(cart);
    prefillFromUser();

    document
        .getElementById("checkoutForm")
        .addEventListener("submit", placeOrder);
});

function renderOrderSummary(cart) {
    document.getElementById("orderSummary").innerHTML =
        cart.map(item => `
            <div class="summary-row">
                <span>${escapeHTML(item.name)} × ${item.quantity}</span>
                <span>${formatPrice(item.price * item.quantity)}</span>
            </div>
        `).join("") +
        `
        <div class="summary-row total">
            <span>Total</span>
            <span>${formatPrice(cartTotal(cart))}</span>
        </div>
        `;
}

function prefillFromUser() {
    const user = getUser();

    if (!user) return;

    if (user.name) {
        document.getElementById("name").value = user.name;
    }

    if (user.email) {
        document.getElementById("email").value = user.email;
    }
}

function validateCheckout(values) {
    let valid = true;

    const check = (id, condition, message) => {
        setFieldError(id, condition ? "" : message);

        if (!condition) {
            valid = false;
        }
    };

    check(
        "name",
        values.name.length >= 2,
        "Please enter your full name."
    );

    check(
        "email",
        isValidEmail(values.email),
        "Please enter a valid email address."
    );

    check(
        "phone",
        /^\+?[0-9\s-]{7,15}$/.test(values.phone),
        "Please enter a valid phone number."
    );

    check(
        "address",
        values.address.length >= 5,
        "Please enter your address."
    );

    check(
        "city",
        values.city.length >= 2,
        "Please enter your city."
    );

    check(
        "state",
        values.state.length >= 2,
        "Please enter your state."
    );

    check(
        "postalCode",
        /^[A-Za-z0-9\s-]{4,10}$/.test(values.postalCode),
        "Please enter a valid postal code."
    );

    return valid;
}

async function placeOrder(event) {
    event.preventDefault();

    clearMessage();

    const values = {};

    [
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "postalCode"
    ].forEach(id => {
        values[id] = document
            .getElementById(id)
            .value
            .trim();
    });

    if (!validateCheckout(values)) {
        showMessage(
            "error",
            "Please fix the highlighted fields."
        );
        return;
    }

    const cart = getCart();

    const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        address: values.address,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,

        items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        })),

        total: cartTotal(cart)
    };

    const button = document.getElementById("placeOrderBtn");

    setButtonLoading(
        button,
        true,
        "Placing order..."
    );

    try {
        /*
         * IMPORTANT:
         * apiRequest() automatically reads:
         *
         * shopeasy_token
         *
         * and sends it as:
         *
         * Authorization: Bearer <token>
         */
        const result = await apiRequest(
            ORDER_ENDPOINT,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        clearCartStorage();

        const orderId =
            result &&
            (
                result.orderId ||
                result.ORDER_ID ||
                result.id
            );

        document.getElementById("checkoutLayout").innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <h3>Order placed successfully</h3>

                <p class="muted">
                    Thank you, ${escapeHTML(values.name)}.
                    ${
                        orderId
                            ? `Your order number is <strong>${escapeHTML(String(orderId))}</strong>.`
                            : ""
                    }
                </p>

                <a href="products.html" class="btn">
                    Continue shopping
                </a>
            </div>
        `;

        showMessage(
            "success",
            "Your order has been placed."
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Order error:", error);

        showMessage(
            "error",
            error.message
        );

        setButtonLoading(
            button,
            false
        );
    }
}