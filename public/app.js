let currentUser = null;
let activeChatUser = null;

/* ---------------- init ---------------- */
window.onload = () => {
	const saved = localStorage.getItem("user");

	if (saved) {
		currentUser = saved;
		renderApp();
		loadQuickDials();
	} else {
		renderLogin();
	}
};

/* ---------------- login ---------------- */
function renderLogin() {
	document.getElementById("app").innerHTML = `
	<div class="center">
		<div class="card">
			<h2>login</h2>

			<input id="username">
			<input id="password" type="password">

			<button onclick="login()">login</button>
			<button onclick="register()">register</button>
		</div>
	</div>`;
}

/* ---------------- app ---------------- */
function renderApp() {
	document.getElementById("app").innerHTML = `
	<div class="topbar">
		<h2>chat</h2>
		<span>${currentUser}</span>
	</div>

	<div class="chatContainer">

		<div class="sidebar">
			<h3>users</h3>

			<input id="receiver">
			<button onclick="openChat()">open chat</button>
			<button onclick="addQuickDial()">add quickdial</button>
		</div>

		<div class="chat">
			<div id="messages" class="messages"></div>

			<div class="inputRow">
				<input type="file" id="fileInput">
				<input id="msgText">
				<button onclick="sendMessage()">send</button>
			</div>
		</div>

		<div class="quickdial">
			<h3>keep yo real ones on quick dial</h3>
			<div id="quickList"></div>
		</div>

	</div>`;
}

/* ---------------- chat ---------------- */
function openChat() {
	activeChatUser = receiver.value.toLowerCase();
	loadMessages();
}

/* ---------------- send ---------------- */
async function sendMessage() {
	if (!activeChatUser) return;

	let fileData = null;
	const file = fileInput.files[0];

	if (file) {
		const fd = new FormData();
		fd.append("file", file);

		const r = await fetch("/upload-file", { method: "POST", body: fd });
		fileData = await r.json();
	}

	await fetch("/send-message", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sender: currentUser,
			receiver: activeChatUser,
			content: msgText.value,
			file_url: fileData?.url,
			file_name: fileData?.name,
			file_type: fileData?.type
		})
	});

	msgText.value = "";
	fileInput.value = "";
	loadMessages();
}

/* ---------------- load ---------------- */
async function loadMessages() {
	if (!activeChatUser) return;

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

	for (let m of data) {
		const d = document.createElement("div");
		d.className = "message";

		if (m.content)
			d.innerHTML += `<div>${m.sender_username}: ${m.content}</div>`;

		if (m.file_url)
			d.innerHTML += `<a href="${m.file_url}" target="_blank">📎 ${m.file_name}</a>`;

		box.appendChild(d);
	}
}

/* ---------------- quick ---------------- */
async function loadQuickDials() {
	const res = await fetch("/get-quickdials", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ user: currentUser })
	});

	const data = await res.json();

	const box = document.getElementById("quickList");
	box.innerHTML = "";

	for (let q of data) {
		const d = document.createElement("div");

		d.innerHTML = `
			<span onclick="openQuick('${q.target_user}')">${q.target_user}</span>
			<button onclick="removeQuick('${q.target_user}')">x</button>
		`;

		box.appendChild(d);
	}
}

function openQuick(u) {
	receiver.value = u;
	openChat();
}

async function removeQuick(t) {
	await fetch("/remove-quickdial", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ user: currentUser, target: t })
	});

	loadQuickDials();
}

function addQuickDial() {
	fetch("/add-quickdial", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ user: currentUser, target: receiver.value })
	});

	loadQuickDials();
}