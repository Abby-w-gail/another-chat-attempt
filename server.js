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

const upload = multer({ storage });

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
	const f = req.file;

	res.json({
		url: `/uploads/${f.filename}`,
		name: f.originalname,
		type: f.mimetype
	});
});

/* ---------------- messages ---------------- */
app.post("/send-message", async (req, res) => {
	const {
		sender,
		receiver,
		content,
		file_url,
		file_name,
		file_type
	} = req.body;

	try {
		await pool.query(
			`INSERT INTO messages
			(sender_username, receiver_username, content, file_url, file_name, file_type)
			VALUES ($1,$2,$3,$4,$5,$6)`,
			[
				sender.toLowerCase(),
				receiver.toLowerCase(),
				content || null,
				file_url || null,
				file_name || null,
				file_type || null
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
			`SELECT * FROM messages
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

/* ---------------- start ---------------- */
app.listen(3000, () => {
	console.log("server running");
});