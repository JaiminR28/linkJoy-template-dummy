const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

let { data } = require("./data/data");

if (process.env.NODE_ENV !== "development") {
	dotenv.config({ path: "./config.env" });
}

const app = express();

app.set("view engine", "ejs");
app.set("views", "resources/views");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

//~ ////////////////////////////////////////////////////
//~ ROUTES
//~ ////////////////////////////////////////////////////

app.get("/", (req, res) => {
	data = Object.assign(data, { currentUrl: req.url });
	res.render("page-builder", data);
});

app.listen(5001, () => {
	console.log("App is running at port 5001");
});
