import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import ejs from "ejs";
import Transaction from "../models/transaction.js";
import CustomOrder from "../models/customOrder.js";
import Product from "../models/product.js";
import sendEmail from "../utils/email.js";
import PDFDocument from "pdfkit";

// Get the directory name of the current module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// block:start:importing-sdk
import { Juspay, APIError } from "expresscheckout-nodejs";
// block:end:importing-sdk

/**
 * Setup expresscheckout-node sdk
 */
const SANDBOX_BASE_URL = "https://smartgatewayuat.hdfcbank.com";
const PRODUCTION_BASE_URL = "https://smartgateway.hdfcbank.com";

/**
 * Read config.json file
 */
const configPath = path.join(__dirname, "../hdfc_config");
const configFilePath = path.join(configPath, "config.json");
const config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));

const publicKey = fs.readFileSync(
  path.join(configPath, config.PUBLIC_KEY_PATH)
);
const privateKey = fs.readFileSync(
  path.join(configPath, config.PRIVATE_KEY_PATH)
);
const paymentPageClientId = config.PAYMENT_PAGE_CLIENT_ID;

/*
Juspay.customLogger = Juspay.silentLogger
*/
const juspay = new Juspay({
  merchantId: config.MERCHANT_ID,
  baseUrl: PRODUCTION_BASE_URL,
  jweAuth: {
    keyId: config.KEY_UUID,
    publicKey,
    privateKey,
  },
});

// Utitlity functions
function makeError(message) {
  return {
    message: message || "Something went wrong",
  };
}

function makeJuspayResponse(successRspFromJuspay) {
  if (successRspFromJuspay == undefined) return successRspFromJuspay;
  if (successRspFromJuspay.http != undefined) delete successRspFromJuspay.http;
  return successRspFromJuspay;
}

const calculatePriceWithDiscount = (
  originalPrice,
  priceUpdateType,
  pricePercentage,
  priceValidityDate
) => {
  const currentDate = new Date();
  const validDate = new Date(priceValidityDate);

  console.log(
    originalPrice,
    priceUpdateType,
    pricePercentage,
    priceValidityDate
  );

  // If the current date is before the price validity date, apply price update
  if (currentDate < validDate) {
    // Apply escalation or discount enum: ["escalation", "reduction", "nothing"],
    if (priceUpdateType === "escalation") {
      const updatedPrice =
        originalPrice + (originalPrice * pricePercentage) / 100;
      // Apply escalation by increasing the price
      return updatedPrice;
    } else if (priceUpdateType === "reduction") {
      // Apply discount by reducing the price
      const updatedPrice =
        originalPrice - (originalPrice * pricePercentage) / 100;
      return updatedPrice;
    } else {
      return originalPrice;
    }
  }

  // If the current date is after the validity date, return the original price
  return originalPrice;
};

const calculateAmount = async (lineItems) => {
  let totalAmount = 0;

  // Loop through each line item
  for (let item of lineItems) {
    const product = await Product.findById(item.product); // Fetch product details by ID

    // If product is free, set price to 0
    const productPrice = product.isFreebie ? 0 : product.price;

    // Apply discount or escalation if applicable
    const updatedPrice = calculatePriceWithDiscount(
      productPrice,
      product.priceUpdateType,
      product.pricePercentage,
      product.priceValidityDate
    );

    // Add the updated price to the total amount (considering quantity)
    totalAmount += updatedPrice;
  }

  return totalAmount;
};

// block:start:session-function
export const initiateJuspayPayment = async (req, res) => {
  const orderId = `order_${Date.now()}`;
  const amount = req.body.totalAmount;

  if (amount <= 0) {
    return res.json(makeError("Invalid amount"));
  }
  // makes return url
  const returnUrl = `https://app.rgembroiderydesigns.com/api/payment/handleJuspayResponse`;
  // const returnUrl = `http://localhost:3000/api/payment/handleJuspayResponse`;
  const lineItems = req.body.products;

  const calculatedAmount = await calculateAmount(lineItems);

  if (calculatedAmount !== req.body.totalAmount) {
    return res
      .status(400)
      .json({ error: "Amount mismatch, potential tampering detected." });
  }

  try {
    const transaction = await Transaction.create({
      lineItems: req.body.products,
      user: req.body.userId,
      amount: req.body.totalAmount,
      hdfcOrderId: orderId,
      customOrder: req.body.customOrder || null,
      isPaid: req.body.isPaid,
      date: req.body.date,
      customerName: req.body.customerName,
      customerEmail: req.body.email,
      zipLinks: req.body.zipLinks,
    });

    if (transaction.amount !== req.body.totalAmount) {
      return res.json(makeError("Amount tampered"));
    }

    const sessionResponse = await juspay.orderSession.create({
      order_id: orderId,
      amount: transaction.amount,
      payment_page_client_id: paymentPageClientId,
      customer_id: req.body.userId,
      action: "paymentPage",
      return_url: returnUrl,
      currency: "USD",
    });

    if (req.body.customOrder && req.body.isPaid) {
      await CustomOrder.findByIdAndUpdate(req.body.customOrder, {
        isPaid: true,
      });
    }

    // removes http field from response, typically you won't send entire structure as response
    return res.json(makeJuspayResponse(sessionResponse));
  } catch (error) {
    if (error instanceof APIError) {
      // handle errors comming from juspay's api
      return res.json(makeError(error.message));
    }
    return res.json(makeError());
  }
};
// block:end:session-function

// Function to generate PDF receipt

const generatePDF = (orderDetails) => {
  const doc = new PDFDocument();
  const pdfPath = `./order_receipt_${orderDetails.orderId}.pdf`;

  // Pipe the PDF to a file
  doc.pipe(fs.createWriteStream(pdfPath));

  // Add a title
  doc.fontSize(24).text("Thank You for Your Order!", { align: "center" });

  // Add a line separator
  doc.moveDown(1);
  doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

  // Order ID and Amount
  doc
    .moveDown(1)
    .fontSize(14)
    .text(`Order ID: ${orderDetails.orderId}`, { align: "left" });

  // Add some spacing
  doc.moveDown(1);

  // Customer Info
  doc.fontSize(16).text("Customer Information", { underline: true });
  doc.moveDown(1);
  doc
    .fontSize(12)
    .text(`Name: ${orderDetails.customerName}`, { align: "left" });

  orderDetails.zipLinks.forEach((item, index) => {
    doc.text(`Zip file: ${item}`, { align: "left" });
  });

  // Add some spacing
  doc.moveDown(2);

  // Ordered Items Table
  doc.fontSize(16).text("Ordered Items", { underline: true });
  doc.moveDown(1);

  // Table Headers
  const tableTop = doc.y;
  doc.fontSize(12).text("Item", 50, tableTop);

  // Table separator
  doc
    .lineWidth(0.5)
    .moveTo(50, tableTop + 12)
    .lineTo(550, tableTop + 12)
    .stroke();

  // Add table rows for each item
  const itemHeight = 20;
  let yPosition = tableTop + 20;

  orderDetails.lineItems.forEach((item, index) => {
    doc.text(item.name, 50, yPosition); // Item name
    yPosition += itemHeight;
  });

  // Add more spacing
  doc.moveDown(2);
  doc.text(`Amount: ₹${orderDetails.amount}`, { align: "left" });
  doc.moveDown(2);

  // Add a footer message
  doc
    .fontSize(10)
    .text(
      "Thank you for shopping with us! If you have any questions, feel free to contact our support team.",
      { align: "left" }
    );
  doc.fontSize(10).text(`info@rgembroiderydesigns.com`, { align: "left" });

  // End the PDF document
  doc.end();

  return pdfPath;
};

// block:start:order-status-function
export const handleJuspayResponse = async (req, res) => {
  const orderId = req.body.order_id || req.body.orderId;

  if (orderId == undefined) {
    return res.json(makeError("order_id not present or cannot be empty"));
  }

  try {
    const statusResponse = await juspay.order.status(orderId);
    const orderStatus = statusResponse.status;

    let message = "";
    let transactionAmount = 0;
    let order = [];

    const transaction = await Transaction.findOne({ hdfcOrderId: orderId });

    if (!transaction) {
      return res.json(makeError("Transaction not found"));
    }

    // Compare the amounts
    if (statusResponse.amount !== transaction.amount) {
      return res.json(makeError("Amount mismatch detected"));
    }

    switch (orderStatus) {
      case "CHARGED":
        const transaction = await Transaction.findOneAndUpdate(
          { hdfcOrderId: orderId },
          { isPaid: true }
        );

        if (transaction.customOrder) {
          await CustomOrder.findByIdAndUpdate(transaction.customOrder, {
            isPaid: true,
          });
        }

        // Generate PDF for the order receipt
        const pdfPath = generatePDF({
          orderId,
          amount: transaction.amount,
          lineItems: transaction.lineItems,
          customerName: transaction.customerName,
          zipLinks: transaction.zipLinks,
        });

        const templatePath = path.join(
          __dirname,
          "..",
          "templates",
          "index.html"
        );
        const template = fs.readFileSync(templatePath, "utf-8");
        const emailData = {
          customerName: transaction.customerName,
          products: transaction.lineItems,
          totalAmount: transaction.amount,
          zipLinks: transaction.zipLinks,
          date: transaction.date,
          orderID: orderId,
        };
        // Render the template with the data
        const html = ejs.render(template, emailData);
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: transaction.customerEmail,
          subject: "Order Summary",
          html: html,
          attachments: [
            {
              filename: `order_receipt_${orderId}.pdf`,
              path: pdfPath,
            },
          ],
        };
        await sendEmail(mailOptions);
        transactionAmount = transaction.amount;
        order = transaction.lineItems;
        message = "order payment done successfully";
        break;
      case "PENDING":
      case "PENDING_VBV":
        message = "order payment pending";
        break;
      case "AUTHORIZATION_FAILED":
        message = "order payment authorization failed";
        break;
      case "AUTHENTICATION_FAILED":
        message = "order payment authentication failed";
        break;
      default:
        message = "order status " + orderStatus;
        break;
    }

    res.redirect(
      `https://www.rgembroiderydesigns.com/order-success/${transaction._id}`
    );
  } catch (error) {
    if (error instanceof APIError) {
      // handle errors comming from juspay's api,
      return res.json(makeError(error.message));
    }
    return res.json(makeError());
  }
};

export const handleJuspayResponsebyID = async (req, res) => {
  // const orderId = req.body.order_id || req.body.orderId;
  const orderId = req.params.id;

  if (orderId == undefined) {
    return res.json(makeError("order_id not present or cannot be empty"));
  }

  try {
    const transaction = await Transaction.findById(orderId);
    const statusResponse = await juspay.order.status(transaction.hdfcOrderId);
    const orderStatus = statusResponse.status;
    let message;
    switch (orderStatus) {
      case "CHARGED":
        message = "order payment done successfully";
        break;
      case "PENDING":
      case "PENDING_VBV":
        message = "order payment pending";
        break;
      case "AUTHORIZATION_FAILED":
        message = "order payment authorization failed";
        break;
      case "AUTHENTICATION_FAILED":
        message = "order payment authentication failed";
        break;
      default:
        message = "order status " + orderStatus;
        break;
    }

    res.status(200).json({
      status: orderStatus,
      orderDetails: transaction,
      message,
    });
  } catch (error) {
    if (error instanceof APIError) {
      // handle errors comming from juspay's api,
      return res.json(makeError(error.message));
    }
    return res.json(makeError());
  }
};


