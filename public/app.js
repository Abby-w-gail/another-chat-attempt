let currentUser = null;
let activeChatUser = null;

/* ---------------- render login ---------------- */
function renderLogin() {
	document.getElementById("app").innerHTML = `
		<div class="center">
			<div class="card">
				<h2>something about account login</h2>

				<input id="username" placeholder="username">
				<input id="password" type="password" placeholder="password">

				<button onclick="register()">register</button>
				<button onclick="login()">login</button>
			</div>
		</div>
	`;
}

/* ---------------- render app ---------------- */
function renderApp() {
	document.getElementById("app").innerHTML = `
		<div class="topbar">
			<h2>messaged people, message people</h2>

			<div>
				<span id="status">${currentUser}</span>
			</div>
		</div>

		<div class="chatContainer">

			<div class="sidebar">
				<h3>chat with</h3>

				<input id="receiver" placeholder="username">
				<button onclick="openChat()">open chat</button>
			</div>

			<div class="chat">

				<div id="messages" class="messages"></div>

				<div class="inputRow">
					<input id="msgText" placeholder="message">
					<button onclick="sendMessage()">send</button>
				</div>

			</div>

		</div>
	`;
}

/* ---------------- init ---------------- */
window.onload = () => {
	const saved = localStorage.getItem("user");

	if (saved) {
		currentUser = saved;
		renderApp();
	} else {
		renderLogin();
	}
};

/* ---------------- register ---------------- */
async function register() {
	const username = document.getElementById("username").value;
	const password = document.getElementById("password").value;

	const res = await fetch("/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password })
	});

	alert(await res.text());
}

/* ---------------- login ---------------- */
async function login() {
	const username = document.getElementById("username").value;
	const password = document.getElementById("password").value;

	const res = await fetch("/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password })
	});

	if (res.ok) {
		const data = await res.json();

		currentUser = data.username;
		localStorage.setItem("user", currentUser);

		renderApp();
	} else {
		alert(await res.text());
	}
}

/* ---------------- logout ---------------- */
function logout() {
	localStorage.removeItem("user");
	currentUser = null;
	activeChatUser = null;

	renderLogin();
}

/* ---------------- open chat ---------------- */
function openChat() {
	const receiver = document.getElementById("receiver").value;

	if (!receiver) {
		alert("enter a username first");
		return;
	}

	activeChatUser = receiver.toLowerCase();

	const box = document.getElementById("messages");
	box.innerHTML = `<div class="message">chat opened with <b>${activeChatUser}</b></div>`;

	loadMessages();
}

/* ---------------- send message ---------------- */
async function sendMessage() {
	const content = document.getElementById("msgText").value;

	if (!activeChatUser || !content) return;

	await fetch("/send-message", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sender: currentUser,
			receiver: activeChatUser,
			content
		})
	});
	
	console.log("sent message to:", activeChatUser);

	document.getElementById("msgText").value = "";
	loadMessages();
}

/* ---------------- load messages ---------------- */
async function loadMessages() {
	if (!activeChatUser) {
		const box = document.getElementById("messages");
		box.innerHTML = `<div class="message">no chat selected :(</div>`;
		return;
	}

	const res = await fetch("/get-messages", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			user1: currentUser,
			user2: activeChatUser
		})
	});

	const data = await res.json();

	const box = document.getElementById("messages");
	box.innerHTML = "";

	// if no messages exist
	if (!data || data.length === 0) {
		box.innerHTML = `<div class="message">no messages :(</div>`;
		return;
	}

	for (let msg of data) {
		const div = document.createElement("div");
		div.className = "message";
		div.innerText = `${msg.sender_username}: ${msg.content}`;
		box.appendChild(div);
	}

	box.scrollTop = box.scrollHeight;
}

/* ---------------- auto refresh chat ---------------- */
setInterval(() => {
	if (!currentUser || !activeChatUser) return;
	loadMessages();
}, 2000);