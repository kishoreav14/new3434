import express from "express";
import {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProduct,
  getProductBySlug,
  bulkUpdate,
  deleteExistingProduct,
  bulkUpdateAll,
  getProductsByCategory,
  searchProducts,
  getLatestProducts,
  getFreebies,
  searchProductsByTag,
  getAllDesigns,
  filterProductByTag
} from "./../controllers/product.js";
import { uploadImageAndZipOptional } from "../utils/multerConfig.js";
import { protect, restrictTo } from "./../controllers/user.js";

// Create a new router instance
const productRouter = express.Router();

// CRUD routes - Protected
productRouter
  .route("/")
  .get(getAllProducts)
  .post(protect, restrictTo("admin"), uploadImageAndZipOptional, createProduct);

productRouter.get('/category/:category', getProductsByCategory);
productRouter.get('/tag', searchProductsByTag);
productRouter.get('/alldesigns', getAllDesigns);


productRouter.get('/freebie', getFreebies);


// Route for searching products with multiple filters (meta search)
productRouter.get('/filter', searchProducts);

// Route for getting the latest product
productRouter.get('/latest', getLatestProducts);
// Search product
productRouter.route("/search").get(searchProduct);

// Slug routes
productRouter.route("/slug/:slug").get(getProductBySlug);

productRouter.route("/bulkUpdate").patch(protect, restrictTo("admin"), bulkUpdate);
productRouter.route("/bulkUpdateAll").patch(protect, restrictTo("admin"), bulkUpdateAll);

productRouter.route("/filterProducts").get(filterProductByTag);

productRouter.route("/deleteSubimage").post(deleteExistingProduct);

productRouter
  .route("/:id")
  .get(getProduct)
  .patch(protect, restrictTo("admin"), uploadImageAndZipOptional, updateProduct)
  .delete(protect, restrictTo("admin"), deleteProduct);

// Export the router
export default productRouter;