require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* ---------------- db ---------------- */
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

/* ---------------- upload ---------------- */
const storage = multer.diskStorage({
	destination: "uploads/",
	filename: (req, file, cb) => {
		cb(null, Date.now() + "-" + file.originalname);
	}
});

const upload = multer({
	storage,
	limits: {
		fileSize: 200 * 1024 * 1024 // 200mb
	}
});

const imageUpload = multer({
	storage,
	limits: {
		fileSize: 50 * 1024 * 1024 // 50mb
	},
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith("image/")) {
			return cb(new Error("only images allowed"));
		}
		cb(null, true);
	}
});

/* ---------------- auth ---------------- */
app.post("/register", async (req, res) => {
	const { username, password } = req.body;

	try {
		const hashed = await bcrypt.hash(password, 10);

		await pool.query(
			"INSERT INTO users (username, password_hash) VALUES ($1, $2)",
			[username.toLowerCase(), hashed]
		);

		res.send("ok");
	} catch (e) {
		console.log(e);
		res.status(500).send("error");
	}
});

app.post("/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		const result = await pool.query(
			"SELECT * FROM users WHERE username = $1",
			[username.toLowerCase()]
		);

		if (result.rows.length === 0) return res.status(400).send("no user");

		const user = result.rows[0];

		const ok = await bcrypt.compare(password, user.password_hash);
		if (!ok) return res.status(400).send("wrong password");

		res.json({ username: user.username });
	} catch (e) {
		console.log(e);
		res.status(500).send("login error");
	}
});

/* ---------------- file upload ---------------- */
app.post("/upload-file", upload.single("file"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).send("no file");
		}

		res.json({
			url: `/uploads/${req.file.filename}`,
			name: req.file.originalname,
			type: req.file.mimetype
		});
	} catch (err) {
		console.log(err);
		res.status(500).send("upload error");
	}
});
/* ---------------- messages ---------------- */
app.post("/send-message", async (req, res) => {
	const {
		sender,
		receiver,
		content,
		file_url,
		file_name,
		file_type,
		image_data
	} = req.body;

	try {
		await pool.query(
			`INSERT INTO messages
			(sender_username, receiver_username, content, file_url, file_name, file_type, image_data)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			[
				sender.toLowerCase(),
				receiver.toLowerCase(),
				content || null,
				file_url || null,
				file_name || null,
				file_type || null,
				image_data || null
			]
		);

		res.send("ok");
	} catch (e) {
		console.log(e);
		res.status(500).send("error");
	}
});

app.post("/get-messages", async (req, res) => {
	const { user1, user2 } = req.body;

	try {
		const result = await pool.query(
			`SELECT messages.*, users.profile_pic
			FROM messages
			LEFT JOIN users ON users.username = messages.sender_username
			WHERE (sender_username=$1 AND receiver_username=$2)
			OR (sender_username=$2 AND receiver_username=$1)
			ORDER BY id ASC`,
			[user1.toLowerCase(), user2.toLowerCase()]		
		);

		res.json(result.rows);
	} catch (e) {
		console.log(e);
		res.status(500).send("error");
	}
});

/* ---------------- quickdials ---------------- */
app.post("/add-quickdial", async (req, res) => {
	const { user, target } = req.body;

	await pool.query(
		"INSERT INTO quickdials (user_owner, target_user) VALUES ($1,$2)",
		[user.toLowerCase(), target.toLowerCase()]
	);

	res.send("ok");
});

app.post("/get-quickdials", async (req, res) => {
	const { user } = req.body;

	const result = await pool.query(
		"SELECT target_user FROM quickdials WHERE user_owner=$1",
		[user.toLowerCase()]
	);

	res.json(result.rows);
});

app.post("/remove-quickdial", async (req, res) => {
	const { user, target } = req.body;

	await pool.query(
		"DELETE FROM quickdials WHERE user_owner=$1 AND target_user=$2",
		[user.toLowerCase(), target.toLowerCase()]
	);

	res.send("ok");
});

/* profile picture */

app.post("/upload-pfp", imageUpload.single("file"), async (req, res) => {
	try {
		const file = req.file;

		res.json({
			url: `/uploads/${file.filename}`
		});
	} catch (err) {
		console.log(err);
		res.status(500).send("upload error");
	}
});

app.post("/set-pfp", async (req, res) => {
	const { username, url } = req.body;

	try {
		await pool.query(
			"UPDATE users SET profile_pic=$1 WHERE username=$2",
			[url, username.toLowerCase()]
		);

		res.send("ok");
	} catch (err) {
		console.log(err);
		res.status(500).send("error");
	}
});

/* ---------------- group ---------------- */

app.post("/create-group", async (req, res) => {
	const { name, members, owner } = req.body;

	const result = await pool.query(
		"INSERT INTO groups (group_name) VALUES ($1) RETURNING id",
		[name]
	);

	const groupId = result.rows[0].id;

	const allMembers = [...new Set([owner, ...members])];

	for (let user of allMembers) {
		await pool.query(
			"INSERT INTO group_members (group_id, username) VALUES ($1,$2)",
			[groupId, user.toLowerCase()]
		);
	}

	res.send("ok");
});

app.post("/get-groups", async (req, res) => {
	const { user } = req.body;

	const result = await pool.query(`
		SELECT g.id, g.group_name
		FROM groups g
		JOIN group_members m ON g.id = m.group_id
		WHERE m.username = $1
	`, [user.toLowerCase()]);

	res.json(result.rows);
});

app.post("/leave-group", async (req, res) => {
	const { group_id, user } = req.body;

	await pool.query(
		"DELETE FROM group_members WHERE group_id=$1 AND username=$2",
		[group_id, user.toLowerCase()]
	);

	// delete group if empty
	const check = await pool.query(
		"SELECT * FROM group_members WHERE group_id=$1",
		[group_id]
	);

	if (check.rows.length === 0) {
		await pool.query("DELETE FROM groups WHERE id=$1", [group_id]);
	}

	res.send("ok");
});

app.post("/send-group-message", async (req, res) => {
	const {
		group_id,
		sender,
		content,
		file_url,
		file_name,
		image_data
	} = req.body;

	try {
		await pool.query(
			`INSERT INTO group_messages
			(group_id, sender_username, content, file_url, file_name, image_data)
			VALUES ($1,$2,$3,$4,$5,$6)`,
			[
				group_id,
				sender.toLowerCase(),
				content || null,
				file_url || null,
				file_name || null,
				image_data || null
			]
		);

		res.send("ok");
	} catch (e) {
		console.log(e);
		res.status(500).send("error");
	}
});

app.post("/get-group-messages", async (req, res) => {
	const { group_id } = req.body;

	try {
		const result = await pool.query(
			`SELECT gm.*, u.profile_pic
			FROM group_messages gm
			LEFT JOIN users u ON u.username = gm.sender_username
			WHERE gm.group_id = $1
			ORDER BY gm.id ASC`,
			[group_id]
		);

		res.json(result.rows);
	} catch (err) {
		console.log(err);
		res.status(500).send("error");
	}
});


/* ---------------- start ---------------- */
app.listen(3000, () => {
	console.log("server running");
});
