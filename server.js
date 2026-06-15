const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

app.post("/register", (req, res) => {
  console.log(req.body);
  res.send("ok");
});

app.listen(3000, () => {
  console.log("running on http://localhost:3000");
});