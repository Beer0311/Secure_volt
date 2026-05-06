require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./db");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing");
}

connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("dev"));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/data", require("./routes/data"));

app.get("/", (req, res) => {
  res.send("Secure Vault API Running");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(5001, () => console.log("Server running on port 5001"));