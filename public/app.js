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
		<button onclick="openSettings()">settings</button>
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

/* SETTINGS -------------------- */

function openSettings() {
	document.getElementById("app").innerHTML += `
	<div class="center" id="settingsModal">
		<div class="card">
			<h3>profile settings</h3>

			<input type="file" id="pfpFile" accept="image/*">
			<button onclick="uploadPfp()">upload pfp</button>

			<button onclick="closeSettings()">close</button>
		</div>
	</div>
	`;
}

function closeSettings() {
	document.getElementById("settingsModal").remove();
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

	if (file && file.size > 100 * 1024 * 1024) {
		alert("file too big (max 100mb sorry :/)");
		return;
	}

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

	for (let msg of data) {
		const div = document.createElement("div");
		div.className = "message";

		const row = document.createElement("div");
		row.style.display = "flex";
		row.style.alignItems = "center";
		row.style.gap = "8px";

		if (msg.profile_pic) {
			const img = document.createElement("img");
			img.src = msg.profile_pic;
			img.style.width = "28px";
			img.style.height = "28px";
			img.style.borderRadius = "50%";
			row.appendChild(img);
		}

		const text = document.createElement("div");
		text.innerText = `${msg.sender_username}: ${msg.content || ""}`;

		row.appendChild(text);
		div.appendChild(row);

		if (msg.file_url) {
			const file = document.createElement("a");
			file.href = msg.file_url;
			file.target = "_blank";
			file.innerText = "📎 " + msg.file_name;
			div.appendChild(file);
		}

		box.appendChild(div);
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

/* pfp add */

async function uploadPfp() {
	const file = document.getElementById("pfpFile").files[0];

	if (!file) return;

	const formData = new FormData();
	formData.append("file", file);

	const res = await fetch("/upload-pfp", {
		method: "POST",
		body: formData
	});

	const data = await res.json();

	await fetch("/set-pfp", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: currentUser,
			url: data.url
		})
	});

	alert("pfp updated");
	location.reload();
}