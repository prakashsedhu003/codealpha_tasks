/* login.js – login with Node.js backend + JWT */

document.addEventListener("DOMContentLoaded", () => {
    // If already logged in, go to homepage
    if (getUser()) {
        window.location.href = "index.html";
        return;
    }

    document
        .getElementById("loginForm")
        .addEventListener("submit", handleLogin);
});


async function handleLogin(e) {
    e.preventDefault();

    clearMessage();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    let valid = true;


    // Validate email
    if (!isValidEmail(email)) {
        setFieldError(
            "email",
            "Please enter a valid email address."
        );

        valid = false;
    } else {
        setFieldError("email", "");
    }


    // Validate password
    if (password.length < 1) {
        setFieldError(
            "password",
            "Please enter your password."
        );

        valid = false;
    } else {
        setFieldError("password", "");
    }


    if (!valid) {
        return;
    }


    const btn = document.getElementById("loginBtn");

    setButtonLoading(
        btn,
        true,
        "Logging in..."
    );


    try {
        const data = await apiRequest(
            "/login",
            {
                method: "POST",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );


        // Make sure backend returned a JWT
        if (!data || !data.token) {
            throw new Error(
                "Login succeeded, but no authentication token was received."
            );
        }


        // Save JWT using the same key used by checkout
        localStorage.setItem(
            TOKEN_KEY,
            data.token
        );


        // Save logged-in user
        const user =
            data.user ||
            data.customer ||
            {
                email
            };


        localStorage.setItem(
            USER_KEY,
            JSON.stringify(user)
        );


        showMessage(
            "success",
            "Login successful! Redirecting..."
        );


        setTimeout(() => {
            window.location.href = "index.html";
        }, 900);


    } catch (err) {

        console.error(
            "Login error:",
            err
        );

        showMessage(
            "error",
            err.message ||
            "Login failed."
        );

        setButtonLoading(
            btn,
            false
        );
    }
}