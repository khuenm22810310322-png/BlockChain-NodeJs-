require("dotenv").config();
const express = require("express");
const cors = require("cors");
const priceRoute = require("./routes/priceRoute");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Price API is running"));
app.use("/api/price", priceRoute);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`Server listening on port ${PORT}`);
	});
}

module.exports = app;
