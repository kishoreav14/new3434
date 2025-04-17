import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import CustomOrder from "../models/customOrder.js";
import APIFeatures from "../utils/ApiFeatures.js";
import twilio from "twilio";
import User from "../models/user.js";
import sendEmail from "../utils/email.js";


// Function to get all customOrders
export const getAllCustomOrders = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(CustomOrder.find(), req.query)
    .filter()
    .sort()
    .limitFields();

  const customOrders = await features.query;

  // Return the customOrders
  res.status(200).json({ customOrders });
});

// Function to get a single customOrder
export const getCustomOrder = catchAsync(async (req, res, next) => {
  const customOrderId = req.params.id;

  // Find the customOrder by id
  const customOrder = await CustomOrder.findById(customOrderId);

  // Check if the customOrder exists
  if (!customOrder) {
    return next(new AppError("CustomOrder not found", 404));
  }

  // Return the customOrder
  res.status(200).json({ customOrder });
});

// Function to create a customOrder
export const createCustomOrder = catchAsync(async (req, res, next) => {
  if (req.files.image) {
    req.body.image = req.files.image[0].filename;
  }
  if (req.files.zip) {
    req.body.zip = req.files.zip[0].filename;
  }

  req.body.user = req.user._id;
  const customOrder = await CustomOrder.create(req.body);

  const user = await User.find(req.user._id);


// Your Twilio credentials
const accountSid = process.env.TWILLIO_ID; //SID
const authToken = process.env.AUTH_TOKEN; //Auth Token
const client = twilio(accountSid, authToken);

const sendWhatsAppMessage = async () => {
  // console.log(user[0].name);

  try {
    const message = await client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio's Sandbox WhatsApp number
      to: 'whatsapp:+919600617879',   // Recipient's WhatsApp number
      body: `New order found for custom order from ${user[0].name},phone:${user[0].phone},email:${user[0].email}`,
    });
    console.log('Message sent:', message.sid);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

const sendmail = async () => {

const message = `
<h3>Dear Admin</h3>
<h3>We’re excited to inform you that a new order has been placed on your RG Embroidery Designs dashboard.<h3>
  <p>Customer Name:${user[0].name}</p>
  <p>Phone:${user[0].phone}</p> 
   <p>Email:${user[0].email}</p>
   <p>Please log in to <a href="https://dashboard.rgembroiderydesigns.com">https://dashboard.rgembroiderydesigns.com</a> to review the complete order details and proceed with the next steps.</p>
   <p>Thank You</p>`;
  try {
    await sendEmail({
      from: process.env.SMTP_USER,
      to: "rgdigitizing@gmail.com",
      subject: "New Custom Order found",
      html: message
    });
    console.log("Email Sented");
    
  } catch (err) {
    return next(new AppError('Error sending OTP. Try again later.', 500));
  }
}
 await sendmail();
 //await sendWhatsAppMessage();
  // Return the created customOrder
  res.status(201).json({ customOrder });
});

// Function to update a customOrder
export const updateCustomOrder = catchAsync(async (req, res, next) => {
  const customOrderId = req.params.id;

  if (req.files) {
    if (req.files.image) {
      req.body.image = req.files.image[0].filename;
    }
    if (req.files.zip) {
      req.body.zip = req.files.zip[0].filename;
    }
  }
  // Find the customOrder by id and update the details
  const customOrder = await CustomOrder.findByIdAndUpdate(
    customOrderId,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  // Check if the customOrder exists
  if (!customOrder) {
    return next(new AppError("CustomOrder not found", 404));
  }

  // Return the updated customOrder
  res.status(200).json({ customOrder });
});

// Function to delete a customOrder
export const deleteCustomOrder = catchAsync(async (req, res, next) => {
  const customOrderId = req.params.id;

  // Find the customOrder by id and delete it
  const customOrder = await CustomOrder.findByIdAndUpdate(
    customOrderId,
    {
      isDeleted: true,
    },
    {
      new: true,
    }
  );

  // Check if the customOrder exists
  if (!customOrder) {
    return next(new AppError("CustomOrder not found", 404));
  }

  // Return the deleted customOrder
  res.status(204).json({ customOrder });
});
