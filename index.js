const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const vCard = require("vcards-js");
let { data } = require("./data/data");
let { UrlShortnerdata } = require("./data/urlShortnerData");
const fs = require("fs");
const session = require("express-session");
const puppeteer = require("puppeteer");
const { getProductData } = require("./AmazonService/getAmzData");

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

const HOUR = 1000 * 60 * 60 * 2;

const {
  SESS_SEC = "shh/this/is/SECRET",
  SESS_LIFETIME = HOUR,
  SESS_NAME = "sid",
} = process.env;

app.use(
  session({
    name: SESS_NAME,
    resave: false,
    secret: SESS_SEC,
    saveUninitialized: false,
    cookie: {
      maxAge: HOUR,
      secure: false,
      sameSite: true,
    },
  })
);

app.use("/vcard", express.static(path.join(__dirname, "public/vendor")));

//~ ////////////////////////////////////////////////////
//~ 					ROUTES
//~ ////////////////////////////////////////////////////

const downloadVcard = async (req, res, next) => {
  try {
    const data = req.body;
    console.log("body..", req.body);
    const vcard = vCard();

    vcard.firstName = data.first_name;
    console.log(vcard.firstName);
    vcard.lastName = data.last_name;
    vcard.organization = data.company;
    vcard.title = data.job_title;
    vcard.note = data.availability;

    data.email = JSON.parse(data.email);
    data.phone = JSON.parse(data.phone);
    console.log(data.email);

    vcard.email = data.email.map((email) => email.address).join(", ");
    vcard.cellPhone = data.phone.map((phone) => phone.number).join(", ");
    console.log(vcard.email);

    const address = JSON.parse(data.address);
    vcard.homeAddress.street = address.street;
    console.log(vcard.homeAddress.street);
    vcard.homeAddress.city = address.city;
    vcard.homeAddress.stateProvince = address.state;
    console.log(vcard.homeAddress.stateProvince);
    vcard.homeAddress.postalCode = address.zip;
    vcard.homeAddress.countryRegion = address.country;

    // send the vCard in the response
    console.log(`./public/vendor/${data.first_name}${data.last_name}.vcf`);
    vcard.saveToFile(`./public/vendor/${data.first_name}${data.last_name}.vcf`);
    res.set("Content-Type", "text/html");
    res.send(vcard.getFormattedString());
    const folderPath = path.join(__dirname, `public/vendor`);
    const filePath = path.join(
      folderPath,
      `${data.first_name}${data.last_name}.vcf`
    );

    setTimeout(() => {
      fs.unlinkSync(filePath);
    }, 500);
  } catch (err) {
    console.log(err);
    // res.status(500).send({ error: err.message });
  }
};

app.post("/download-vcard", downloadVcard);

app.get("/", (req, res) => {
  data = Object.assign(data, { currentUrl: req.url });
  res.render("page-builder", data);
});

app.get("/url-shortner", (req, res) => {
  res.render("url-retargeting", UrlShortnerdata);
});

app.get("/url-form", (req, res) => {
  res.render("amazon-url-form");
});

app.post("/add-data", async (req, res) => {
  const { url } = req.body;

  const data = await getProductData(url);

  req.session.product = data;

  res.redirect("/amazon-product");
});

app.get("/amazon-product", async (req, res) => {
  const product = req.session.product;

  res.render("amazon-procuct-page", { product: product });
});

app.listen(5001, () => {
  console.log("App is running at port 5001");
});
