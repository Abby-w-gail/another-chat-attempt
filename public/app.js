let currentUser = null;
let activeChatUser = null;

let activeGroupId = null;

/* ---------------- init ---------------- */
window.onload = () => {
	const saved = localStorage.getItem("user");

	if (saved) {
		currentUser = saved;
		renderApp();
		loadQuickDials();
		loadGroups();
	} else {
		renderLogin();
	}
};

/* ---------------- login screen ---------------- */
function renderLogin() {
	document.getElementById("app").innerHTML = `
	<div class="center">
		<div class="card">
			<h2>login</h2>

			<input id="username" placeholder="username">
			<input id="password" type="password" placeholder="password">

			<button onclick="login()">login</button>
			<button onclick="register()">register</button>
		</div>
	</div>`;
}

/* ---------------- main app ---------------- */
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
	
			<input id="receiver" placeholder="username">
			<button onclick="openChat()">open chat</button>
			<button onclick="addQuickDial()">add quickdial</button>
			<button onclick="openGroupCreator()">create group</button>
		</div>

		<div class="chat">
			<div id="messages" class="messages"></div>

			<div class="inputRow">
				<input type="file" id="fileInput">
				<input id="msgText" placeholder="message">
				<button onclick="sendMessage()">send</button>
			</div>
		</div>

		<div class="quickdial">
			<h3>groups</h3>
			<div id="groupList"></div>
			<h3>get yo real ones on quick dial</h3>
			<div id="quickList"></div>
		</div>

	</div>`;
}

/* ---------------- settings ---------------- */
function openSettings() {
	document.body.insertAdjacentHTML("beforeend", `
	<div class="center" id="settingsModal">
		<div class="card">
			<h3>profile settings</h3>

			<input type="file" id="pfpFile" accept="image/*">
			<button onclick="uploadPfp()">upload pfp</button>

			<button onclick="closeSettings()">close</button>
		</div>
	</div>
	`);
}

function closeSettings() {
	document.getElementById("settingsModal")?.remove();
}

/* --------------- group creator ----------------------- */

function openGroupCreator() {
	document.body.insertAdjacentHTML("beforeend", `
	<div class="center" id="groupModal">
		<div class="card">

			<h3>create group</h3>

			<input id="groupName" placeholder="group name">

			<div id="memberList">
				<input placeholder="member 1">
				<input placeholder="member 2">
			</div>

			<button onclick="addMemberInput()">+ add member</button>
			<button onclick="submitGroup()">create</button>
			<button onclick="document.getElementById('groupModal').remove()">close</button>

		</div>
	</div>
	`);
}

function addMemberInput() {
	const box = document.getElementById("memberList");

	if (box.children.length >= 10) {
		alert("max 10 members");
		return;
	}

	const input = document.createElement("input");
	input.placeholder = `member ${box.children.length + 1}`;
	box.appendChild(input);
}

async function submitGroup() {
	const name = document.getElementById("groupName").value;
	const inputs = document.querySelectorAll("#memberList input");

	const members = [];

	for (let i = 0; i < inputs.length; i++) {
		if (inputs[i].value.trim()) {
			members.push(inputs[i].value.toLowerCase());
		}
	}

	if (!name || members.length === 0) return;

	await fetch("/create-group", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			members,
			owner: currentUser
		})
	});

	document.getElementById("groupModal").remove();
	loadQuickDials();
}

/* ----------------- load groups-------------------  */

async function loadGroups() {
	const res = await fetch("/get-groups", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ user: currentUser })
	});

	const data = await res.json();

	console.log("loading groups for:", currentUser);
	console.log("groups response:", data);

	const box = document.getElementById("groupList");

	if (!box) {
		console.log("groupList element missing in DOM");
		return;
	}

	box.innerHTML = "";

	for (let g of data) {
		const div = document.createElement("div");
		div.className = "quick-item";

		const span = document.createElement("span");
		span.innerText = g.group_name;
		span.style.cursor = "pointer";

		span.onclick = () => {
			openGroup(g.id, g.group_name);
		};

		const btn = document.createElement("button");
		btn.innerText = "x";
		btn.onclick = async () => {
			await fetch("/leave-group", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user: currentUser,
					group_id: g.id
				})
			});

			loadGroups();
		};

		div.appendChild(span);
		div.appendChild(btn);
		box.appendChild(div);
	}
}



function openGroup(id, name) {
	activeChatUser = null;
	activeGroupId = id;

	loadMessages();
}

/* ---------------- auth ---------------- */
async function register() {
	const username = document.getElementById("username").value;
	const password = document.getElementById("password").value;

	await fetch("/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password })
	});

	alert("user created");
}

async function login() {
	const username = document.getElementById("username").value;
	const password = document.getElementById("password").value;

	const res = await fetch("/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password })
	});

	if (!res.ok) {
		alert(await res.text());
		return;
	}

	const data = await res.json();

	currentUser = data.username;
	localStorage.setItem("user", currentUser);

	renderApp();
	loadQuickDials();
}

/* ---------------- chat open ---------------- */
function openChat() {
	const receiver = document.getElementById("receiver").value;
	if (!receiver) return;

	activeGroupId = null;
	activeChatUser = receiver.toLowerCase();

	loadMessages();
}

/* ---------------- send message ---------------- */
async function sendMessage() {
	const content = document.getElementById("msgText").value;
	const fileInputEl = document.getElementById("fileInput");

	let fileData = null;
	const file = fileInputEl.files[0];
	
	if (file && file.size > 100 * 1024 * 1024) {
		alert("file too big (max 100mb)");
		return;
	}

	if (file) {
		const fd = new FormData();
		fd.append("file", file);

		const r = await fetch("/upload-file", {
			method: "POST",
			body: fd
		});

		fileData = await r.json();
	}

	// GROUP MESSAGE
	if (activeGroupId) {
		await fetch("/send-group-message", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group_id: activeGroupId,
				sender: currentUser,
				content,
				file_url: fileData?.url,
				file_name: fileData?.name,
				file_type: fileData?.type
			})
		});
	}

	// FRIEND MESSAGE
	else if (activeChatUser) {
		await fetch("/send-message", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sender: currentUser,
				receiver: activeChatUser,
				content,
				file_url: fileData?.url,
				file_name: fileData?.name
			})
		});
	}

	document.getElementById("msgText").value = "";
	fileInputEl.value = "";

	loadMessages();
}

/* ---------------- load messages ---------------- */
async function loadMessages() {
	if (!activeChatUser && !activeGroupId) return;

	let url;
	let body;

	// decide dm vs group
	if (activeGroupId) {
		url = "/get-group-messages";
		body = { group_id: activeGroupId };
	} else {
		url = "/get-messages";
		body = {
			user1: currentUser,
			user2: activeChatUser
		};
	}

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	const data = await res.json();

	const box = document.getElementById("messages");
	box.innerHTML = "";

	if (!data || data.length === 0) {
		box.innerHTML = `<div class="message">no messages :(</div>`;
		return;
	}

	for (let msg of data) {
		const div = document.createElement("div");
		div.className = "message";

		// row (pfp + text)
		const row = document.createElement("div");
		row.style.display = "flex";
		row.style.alignItems = "center";
		row.style.gap = "8px";

		// profile picture (ONLY for DMs usually)
		if (msg.profile_pic) {
			const img = document.createElement("img");
			img.src = msg.profile_pic;
			img.style.width = "28px";
			img.style.height = "28px";
			img.style.borderRadius = "50%";
			row.appendChild(img);
		}

				// sender name (important for groups)
		const sender = msg.sender_username || "unknown";

		/* -------- DATE -------- */
		let formattedDate = "";

		if (msg.sent_at) {
			const date = new Date(String(msg.sent_at).replace(" ", "T"));

			if (!isNaN(date.getTime())) {
				const yyyy = date.getFullYear();
				const mm = String(date.getMonth() + 1).padStart(2, "0");
				const dd = String(date.getDate()).padStart(2, "0");

				const hh = String(date.getHours()).padStart(2, "0");
				const min = String(date.getMinutes()).padStart(2, "0");

				formattedDate = `${yyyy}/${mm}/${dd} ${hh}:${min}`;
			}
		}

		/* -------- TEXT LINE -------- */
		const line = document.createElement("div");

		const senderSpan = document.createElement("span");
		senderSpan.innerText = sender + " - ";

		const dateSpan = document.createElement("span");
		dateSpan.innerText = formattedDate + " ";
		dateSpan.style.fontSize = "12px";
		dateSpan.style.color = "gray";

		const msgSpan = document.createElement("span");
		msgSpan.innerText = ": " + (msg.content || "");

		line.appendChild(senderSpan);
		line.appendChild(dateSpan);
		line.appendChild(msgSpan);

		row.appendChild(line);
		div.appendChild(row);

		// file handling
		if (msg.file_url) {
			const isImage =
				msg.file_type?.startsWith("image/") ||
				msg.file_url?.match(/\.(png|jpg|jpeg|gif|webp)$/i);

			if (isImage) {
				const img = document.createElement("img");
				img.src = msg.file_url;

				// auto scale (clean chat behavior)
				img.style.maxWidth = "250px";
				img.style.maxHeight = "250px";
				img.style.width = "auto";
				img.style.height = "auto";
				img.style.borderRadius = "10px";
				img.style.marginTop = "6px";
				img.style.display = "block";

				div.appendChild(img);
			} else {
				const file = document.createElement("a");
				file.href = msg.file_url;
				file.target = "_blank";
				file.innerText = "📎 " + msg.file_name;

				file.style.display = "inline-block";
				file.style.marginTop = "6px";

				div.appendChild(file);
			}
		}

		box.appendChild(div);
	}

	box.scrollTop = box.scrollHeight;
}

/* ---------------- quickdials ---------------- */
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
			<span onclick="openQuick(\`${q.target_user}\`)">
				${q.target_user}
			</span>
			<button onclick="removeQuick('${q.target_user}')">x</button>
		`;

		box.appendChild(d);
	}
}

function openQuick(user) {
	document.getElementById("receiver").value = user;
	openChat();
}

async function removeQuick(target) {
	await fetch("/remove-quickdial", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			user: currentUser,
			target
		})
	});

	loadQuickDials();
}

async function addQuickDial() {
	const target = document.getElementById("receiver").value;

	if (!target) return;

	await fetch("/add-quickdial", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			user: currentUser,
			target
		})
	});

	loadQuickDials();
}

/* ---------------- profile pic ---------------- */
async function uploadPfp() {
	const file = document.getElementById("pfpFile").files[0];
	if (!file) return;

	const fd = new FormData();
	fd.append("file", file);

	const res = await fetch("/upload-pfp", {
		method: "POST",
		body: fd
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

/* */

setInterval(() => {
	if (!currentUser) return;

	// DM chat open
	if (activeChatUser) {
		loadMessages();
	}

	// group chat open
	else if (activeGroupId) {
		loadMessages();
	}
}, 1500);