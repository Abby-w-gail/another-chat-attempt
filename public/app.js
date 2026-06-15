function register() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });
}