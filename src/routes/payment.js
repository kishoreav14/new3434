import express from "express";
import checkout from "../controllers/payment.js";
import { protect } from "../controllers/user.js";
import { initiateJuspayPayment, handleJuspayResponse,handleJuspayResponsebyID } from "../controllers/hdfc_checkout.js";
const paymentRouter = express.Router();

// Payment routes
paymentRouter.route("/checkout-session").post(protect, checkout);
paymentRouter.route("/initiateJuspayPayment").post(initiateJuspayPayment);
paymentRouter.route("/handleJuspayResponse").post(handleJuspayResponse);
paymentRouter.route("/handleJuspayResponsebyID/:id").get(handleJuspayResponsebyID)

export default paymentRouter;
