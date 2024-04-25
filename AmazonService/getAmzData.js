const puppeteer = require("puppeteer");

async function getProductData(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const data = await page.evaluate(() => {
    const title = document.querySelector("#productTitle").innerText;
    let price;

    try {
      // Extracting price from the HTML structure
      priceSymbol = document.querySelector(".a-price-symbol").innerText;
      priceWhole = document.querySelector(".a-price-whole").innerText;
      priceWhole = priceWhole.replace(/\n/g, "");
      price = `${priceSymbol}${priceWhole}`;
    } catch (error) {
      let price = null; // or some default value
      console.error("Error occurred while extracting price:", error.message);
    }
    let description;
    try {
      description = document.querySelector("#productDescription").innerText;
    } catch (error) {
      description = null; // or some default value
    }

    const imageElements = document.querySelectorAll(
      "#altImages .a-button-text img"
    );

    const imageUrls = [];
    imageElements.forEach((img) => {
      // Get the original image URL
      let originalUrl = img.getAttribute("src");
      // Remove the numbers or content after "_SS" until "_"
      originalUrl = originalUrl.replace(/(\._S).*\./, '.');
      // Do not push the URL if it contains ".png" or "play"
      if (!originalUrl.includes(".png") && !originalUrl.includes("play")) {
        imageUrls.push(originalUrl);
      }
    });

    return {
      title,
      price,
      description,
      imageUrls,
      addToCart,
    };
  });

  const ASIN = url.split("/dp/")[1].split("/")[0];
  const addToCart = `https://www.amazon.in/gp/aws/cart/add.html?ASIN.1=${ASIN}&&Quantity.1=1`;

  console.log(ASIN);
  await browser.close();
  data.addToCart = addToCart;
  data.buyNow = url;
  return data;
}

module.exports = {
  getProductData,
};

// async function getProductData(url) {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(url);

//     try {
//         await page.waitForSelector('#productTitle', { timeout: 5000 });
//         // await page.waitForSelector('#productDescription', { timeout: 5000 });
//         await page.waitForSelector('.a-unordered-list li', { timeout: 5000 });

//         const data = await page.evaluate(() => {
//             const title = document.querySelector('#productTitle').innerText;
//             // const description = document.querySelector('#productDescription').innerText;
//             const listItems = document.querySelectorAll('.a-unordered-list li');

//             const imageUrls = [];

//             listItems.forEach(li => {
//                 const img = li.querySelector('.imgTagWrapper img');
//                 if (img) {
//                     imageUrls.push(img.getAttribute('src'));
//                 }
//             });

//             return {
//                 title,
//                 // description,
//                 imageUrls
//             };
//         });

//         return data;
//     } catch (error) {
//         console.error('Error retrieving product data:', error);
//         return null;
//     } finally {
//         await browser.close();
//     }
// }

// const productUrl = 'https://www.amazon.in/boAt-Rockerz-255-Pro-Earphones/dp/B08TV2P1N8/ref=sr_1_1?_encoding=UTF8&content-id=amzn1.sym.f927ceda-07df-4927-9db9-ada8ff77174f&dib=eyJ2IjoiMSJ9.V6MNwpISQh-6-eHWBmP-H4OLINsr9A4tt-cMvsnba-3WGxj0kjYRrk2w_mijH-c5xvhPCCnWt_Gqznu_EF6_aiC4c9td4skkNQF3XDxnVMw5ua16t5DbYxEkMXzITtEizzW2IXlQfr7s4sOxwoSbMNWNdGz8xL0kOJ_pVnT7MR0265RnyRWftQ7t9upVj4qQw_9CbdaSZCiTBO-4FgHgRJ7ciABSkKrv97G3ZWloj4aRqUBwWUHS-dFJdZA_uSE9SdmL23v_3dcIwnaDSLe9d2CXNXI0oQDXarEGR32MX_k.bi97hlL3z3E4VMrMvVHxr9S6op4A--h2A_3R_p5sP7c&dib_tag=se&pd_rd_r=22fd4558-e997-40af-9643-c2c18d9e07a3&pd_rd_w=anPeL&pd_rd_wg=0lFBV&pf_rd_p=f927ceda-07df-4927-9db9-ada8ff77174f&pf_rd_r=80PC72PM8AQFYAV6PKCS&qid=1713176131&refinements=p_n_condition-type%3A8609960031%2Cp_n_format_browse-bin%3A30678584031%2Cp_89%3ABoult%7CJBL%7CSony%7CZEBRONICS%7CboAt&s=electronics&sr=1-1&th=1';

// getProductData(productUrl)
//     .then(data => console.log(data))
//     .catch(error => console.error('Error retrieving product data:', error));
