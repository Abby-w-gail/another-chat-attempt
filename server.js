require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ---------------- db connection ---------------- */
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

/* ---------------- test db connection ---------------- */
pool.query("SELECT NOW()")
	.then(() => console.log("db connected"))
	.catch(err => console.log("db connection failed:", err));

/* ---------------- register ---------------- */
app.post("/register", async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = username.toLowerCase();
		const hashed = await bcrypt.hash(password, 10);

		await pool.query(
			`INSERT INTO users (username, password_hash)
			 VALUES ($1, $2)`,
			[user, hashed]
		);

		res.send("user created");
	} catch (err) {
		console.log("register error:", err);
		res.status(500).send(err.message);
	}
});

/* ---------------- login ---------------- */
app.post("/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = username.toLowerCase();

		const result = await pool.query(
			`SELECT * FROM users WHERE username = $1`,
			[user]
		);

		if (result.rows.length === 0) {
			return res.status(400).send("no user");
		}

		const dbUser = result.rows[0];

		const match = await bcrypt.compare(password, dbUser.password_hash);

		if (!match) {
			return res.status(400).send("wrong password");
		}

		res.json({ username: dbUser.username });
	} catch (err) {
		console.log("login error:", err);
		res.status(500).send(err.message);
	}
});

/* ---------------- send message ---------------- */
app.post("/send-message", async (req, res) => {
	const { sender, receiver, content, image_url } = req.body;

	try {
		console.log("message received:", req.body);

		await pool.query(
			`INSERT INTO messages
			 (sender_username, receiver_username, content, image_url)
			 VALUES ($1, $2, $3, $4)`,
			[
				sender.toLowerCase(),
				receiver.toLowerCase(),
				content,
				image_url || null
			]
		);

		res.send("message stored");
	} catch (err) {
		console.log("send-message error:", err);
		res.status(500).send(err.message);
	}
});

/* ---------------- get messages ---------------- */
app.post("/get-messages", async (req, res) => {
	const { user1, user2 } = req.body;

	try {
		const result = await pool.query(
			`SELECT * FROM messages
			 WHERE (sender_username = $1 AND receiver_username = $2)
			 OR (sender_username = $2 AND receiver_username = $1)
			 ORDER BY sent_at ASC`,
			[user1.toLowerCase(), user2.toLowerCase()]
		);

		res.json(result.rows);
	} catch (err) {
		console.log("get-messages error:", err);
		res.status(500).send(err.message);
	}
});

/* ---------------- start server ---------------- */
app.listen(3000, () => {
	console.log("server running on http://localhost:3000");
});