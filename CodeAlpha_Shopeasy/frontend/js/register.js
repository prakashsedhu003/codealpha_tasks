/* register.js – calls POST http://localhost:3000/api/register */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("registerForm").addEventListener("submit", handleRegister);
});

async function handleRegister(e) {
  e.preventDefault();
  clearMessage();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  let valid = true;
  const check = (id, condition, message) => {
    setFieldError(id, condition ? "" : message);
    if (!condition) valid = false;
  };

  check("name", name.length >= 2, "Please enter your name.");
  check("email", isValidEmail(email), "Please enter a valid email address.");
  check("password", password.length >= 6, "Password must be at least 6 characters.");
  check("confirmPassword", confirmPassword === password && confirmPassword !== "", "Passwords do not match.");
  if (!valid) return;

  const btn = document.getElementById("registerBtn");
  setButtonLoading(btn, true, "Creating account...");

  try {
    // confirmPassword is only for frontend validation, so it is not sent
    await apiRequest("/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    showMessage("success", "Registration successful! Redirecting to login...");
    document.getElementById("registerForm").reset();
    setTimeout(() => (window.location.href = "login.html"), 1200);
  } catch (err) {
    showMessage("error", err.message);
    setButtonLoading(btn, false);
  }
}
