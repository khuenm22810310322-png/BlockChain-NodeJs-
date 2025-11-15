const mongoose = require("mongoose");
require("dotenv").config();
const MONGODB_URI = process.env.MONGODB_URI;

// Connect using Mongoose 8 defaults (deprecated options removed)
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.on("connected", () => {
	console.log("Connected to DB");
});

db.on("error", (err) => {
	console.log("Connection Error:", err);
});

db.on("disconnected", () => {
	console.log("Disconnected from DB");
});

module.exports = db;
