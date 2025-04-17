import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import Product from "../models/product.js";
import APIFeatures from "../utils/ApiFeatures.js";
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import mongoose from "mongoose";


// Function to get all products
export const getAllProducts = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Product.find(), req.query).filter().sort().limitFields();

  const products = await features.query;

  // Return the products
  res.status(200).json({ products });
});

// export const getAllDesigns = catchAsync(async (req, res, next) => {

  
//   // Extract page and limit from query with defaults
//   const page = req.query.page ? parseInt(req.query.page, 10) : 1;
//   const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

//   // Get total documents count
//   const totalDocuments = await Product.countDocuments({ isDeleted: false });

//   // Calculate total pages
//   const totalPages = Math.ceil(totalDocuments / limit);

//   // Validate the requested page number
//   const currentPage = Math.min(Math.max(1, page), totalPages);

//   // Calculate the skip value
//   const skip = (currentPage - 1) * limit;

//   // Use APIFeatures for query chaining
//   const features = new APIFeatures(Product.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate(currentPage, limit);

//   // Execute the query to fetch products
//   const products = await features.query;

//   // Return the response
//   res.status(200).json({
//     status: "success",
//     totalResults: totalDocuments,
//     totalPages,
//     currentPage,
//     perPage: limit,
//     results: products.length,
//     products,
//   });
// });




export const getAllDesigns = async (req, res) => {
  const { page = 1, limit = 10, sortBy } = req.query; // Get page, limit, and sortBy from query parameters

  try {
    // Base query with isDeleted filter
    const query = {isDeleted: false, isFreebie: false };

    // Calculate the number of products to skip based on the page and limit
    const skip = (page - 1) * limit;

    // Define sorting logic based on the sortBy query parameter
    let sortOptions = {};
    switch (sortBy) {
      // case 'popularity':
      //   sortOptions = { buyersCount: 1 }; // Sort by popularity descending
      //   break;
      case 'priceLowToHigh':
        sortOptions = { price: 1 }; // Sort by price ascending
        break;
      case 'priceHighToLow':
        sortOptions = { price: -1 }; // Sort by price descending
        break;
      case 'leastRating':
        sortOptions = { ratingsAverage: 1 }; // Sort by rating ascending
        break;
      case 'averageRating':
        sortOptions = { ratingsAverage: -1 }; // Sort by rating descending
        break;
      default:
        sortOptions = { _id: -1 }; // No sorting by default
    }

    // Find products that match the query with pagination and sorting
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    // Get the total count of products in the category that are not deleted
    const totalCount = await Product.countDocuments(query);

    // If no products are found
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found in this category' });
    }

    // Return the products with pagination info and total count
    return res.status(200).json({
      totalCount,
      totalPages: Math.ceil(totalCount / limit), // Calculate total pages
      currentPage: parseInt(page),
      products,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Function to get a single product
export const getProduct = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  // Find the product by id
  const product = await Product.findById(productId);

  // Check if the product exists
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Return the product
  res.status(200).json({ product });
});
export const getProductBySlug = catchAsync(async (req, res, next) => {
  const slug = req.params.slug;

  // Find the product by slug
  const product = await Product.findOne({ slug });

  // Check if the product exists
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Return the product
  res.status(200).json({ product });
});


// Function to create a product
export const createProduct = catchAsync(async (req, res, next) => {
  // Handle main image file
  // if (req.files.image) {
  //   req.body.image = req.files.image[0].filename; // Save main image filename
  // }
  // Handle zip file
  if (req.files.zip) {
    req.body.zip = req.files.zip[0].filename; // Save zip filename
  }
  // Handle subimages
  if (req.files.subimage) {
    // Ensure subimages are saved as an array of filenames
    req.body.subimages = req.files.subimage.map((file) => file.filename);
  }
  // Create the product in the database
  const product = await Product.create(req.body);

  // Respond with the created product
  res.status(201).json({ product });
});

// Function to update a product
export const updateProduct = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  // Validate productId as a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return next(new AppError("Invalid product ID", 400));
  }

  // Retrieve the existing product
  const existingProduct = await Product.findById(productId);
  if (!existingProduct) {
    return next(new AppError("Product not found", 404));
  }
  console.log(existingProduct);
  

  // Process uploaded files if they exist
  if (req.files.subimage || req.files.zip) {
    if (req.files.zip && req.files.zip.length > 0) {
      req.body.zip = req.files.zip[0].filename;
    }

    if (req.files.subimage && req.files.subimage.length > 0) {
      const newSubimages = req.files.subimage.map((file) => file.filename);
      // Merge old and new images
      req.body.subimages = existingProduct.subimages ? [
        ...existingProduct.subimages,
        ...newSubimages
      ] : newSubimages;
      console.log("req.files",req.body.subimages);
 
    }
  } else {
    // If no new files, retain existing subimages
    req.body.subimages = existingProduct.subimages;
    console.log("without",req.body.subimages);
    
  }

  // Update the product
  const updatedProduct = await Product.findByIdAndUpdate(productId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedProduct) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Product updated successfully",
    product: updatedProduct,
  });
});



export const deleteExistingProduct = catchAsync(async (req, res, next) => {
  const { productId, imageName } = req.body.data;

  // Validate inputs
  if (!productId || !imageName) {
    return res.status(400).json({ message: 'Product ID and image name are required.' });
  }

  // Step 1: Find the product by its ID
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  // Step 2: Check if the image exists in the subimages array
  const imageIndex = product.subimages.indexOf(imageName);
  if (imageIndex === -1) {
    return res.status(404).json({ message: 'Image not found in the product.' });
  }

  // Step 3: Remove the image from the subimages array
  product.subimages.splice(imageIndex, 1);

  // Step 4: Construct the full file path for deletion
  const imagePath = path.join(process.cwd(), 'subimages', imageName); // Adjust 'uploads' directory path as needed
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath); // Delete the file
  }

  // Step 5: Save the updated product
  await product.save();

  // Send success response
  res.status(200).json({ message: 'Subimage deleted successfully.', subimages: product.subimages });
});


// Function to delete a product
export const deleteProduct = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  // Find the product by id and delete it
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      isDeleted: true,
    },
    {
      new: true,
    }
  );

  // Check if the product exists
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Return the deleted product
  res.status(204).json({ product });
});

export const bulkUpdate = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids) {
    return next(new AppError("Please provide ids", 400));
  }

  // Fetch the products by ids
  const products = await Product.find({ _id: { $in: ids } });

  // Prepare an array of update operations
  const bulkOperations = products.map((product) => {
    const newOriginalPrice = product.price; // Assuming you're setting originalPrice to the current price

    return {
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            ...req.body, // Keep the existing fields from the request body
            originalPrice: newOriginalPrice, // Set the originalPrice to the product's current price
          },
        },
      },
    };
  });

  // Perform bulkWrite to update all products in one go
  await Product.bulkWrite(bulkOperations);

  res.status(200).json({ message: "Products updated successfully" });
});

export const bulkUpdateAll = catchAsync(async (req, res, next) => {
  // Fetch all products
  const products = await Product.find({});

  // Prepare an array of update operations
  const bulkOperations = products.map((product) => {
    const newOriginalPrice = product.price; // Assuming you're setting originalPrice to the current price

    return {
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            ...req.body, // Keep the existing fields from the request body
            originalPrice: newOriginalPrice, // Set the originalPrice to the product's current price
          },
        },
      },
    };
  });



  // Perform bulkWrite to update all products in one go
  await Product.bulkWrite(bulkOperations);

  res.status(200).json({ message: "All products updated successfully" });
});

// Controller function for product search by name
export const searchProduct = catchAsync(async (req, res, next) => {
  const { name } = req.query;

  if (!name) {
    return next(new AppError("Please provide a name", 400));
  }

  // Perform case-insensitive search for products containing the name
  const products = await Product.find({
    name: { $regex: new RegExp(name, "i") },
  });

  res.status(200).json({ products });
});

export const getLatestProducts = async (req, res) => {
  try {
    // Find the last 8 products by sorting by the createdAt field in descending order
    const latestProducts = await Product.find().sort({  _id: -1 }).limit(8);

    // If no products are found
    if (latestProducts.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }
 
   // Return the last 8 products
    return res.status(200).json(latestProducts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getProductsByCategory = async (req, res) => {
  const { category } = req.params; // Get category from request parameters
  const { page = 1, limit = 10, sortBy } = req.query; // Get page, limit, and sortBy from query parameters

  try {
    // Base query with isDeleted filter
    const query = { category, isDeleted: false, isFreebie: false };

    // Calculate the number of products to skip based on the page and limit
    const skip = (page - 1) * limit;

    // Define sorting logic based on the sortBy query parameter
    let sortOptions = {};
    switch (sortBy) {
      // case 'popularity':
      //   sortOptions = { buyersCount: 1 }; // Sort by popularity descending
      //   break;
      case 'priceLowToHigh':
        sortOptions = { price: 1 }; // Sort by price ascending
        break;
      case 'priceHighToLow':
        sortOptions = { price: -1 }; // Sort by price descending
        break;
      case 'leastRating':
        sortOptions = { ratingsAverage: 1 }; // Sort by rating ascending
        break;
      case 'averageRating':
        sortOptions = { ratingsAverage: -1 }; // Sort by rating descending
        break;
      default:
        sortOptions = { _id: -1 }; // No sorting by default
    }

    // Find products that match the query with pagination and sorting
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    // Get the total count of products in the category that are not deleted
    const totalCount = await Product.countDocuments(query);

    // If no products are found
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found in this category' });
    }

    // Return the products with pagination info and total count
    return res.status(200).json({
      totalCount,
      totalPages: Math.ceil(totalCount / limit), // Calculate total pages
      currentPage: parseInt(page),
      products,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const searchProducts = async (req, res) => {
  const { queryValue, page = 1, limit = 10 } = req.query;

  try {
    // Build the query based on queryValue
    const query = {
      isDeleted: false,
      ...(queryValue && {
        $or: [
          { name: { $regex: queryValue, $options: "i" } },
          { productTags: { $regex: queryValue, $options: "i" } },
          { description: { $regex: queryValue, $options: "i" } },
          { keywords: { $regex: queryValue, $options: "i" } },
        ],
      }),
    };

    // Get the total count of matching products
    const totalProducts = await Product.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalProducts / limit);

    // Validate the page number
    const currentPage = Math.min(Math.max(1, parseInt(page, 10)), totalPages);

    // Calculate the skip value
    const skip = (currentPage - 1) * limit;

    // Fetch the products with skip and limit
    const products = await Product.find(query).skip(skip).limit(parseInt(limit, 10));

    // Return the response
    return res.status(200).json({
      status: "success",
      queryValue,
      totalProducts,
      totalPages,
      currentPage,
      products,
    });
  } catch (error) {
    console.error("Error in searchProducts:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

export const searchProductsByTag = async (req, res) => {
  const { page = 1, limit = 10, sortBy, productTags } = req.query; // Destructure productTags along with other parameters

  try {
    // Base query with isDeleted and isFreebie filters
    const query = { 
      isDeleted: false, 
      isFreebie: false,
      ...(productTags && { productTags: { $regex: productTags, $options: "i" } }), // Add productTags filter if provided
    };

    // Calculate the number of products to skip based on the page and limit
    const skip = (page - 1) * limit;

    // Define sorting logic based on the sortBy query parameter
    let sortOptions = {};
    switch (sortBy) {
      case 'priceLowToHigh':
        sortOptions = { price: 1 }; // Sort by price ascending
        break;
      case 'priceHighToLow':
        sortOptions = { price: -1 }; // Sort by price descending
        break;
      case 'leastRating':
        sortOptions = { ratingsAverage: 1 }; // Sort by rating ascending
        break;
      case 'averageRating':
        sortOptions = { ratingsAverage: -1 }; // Sort by rating descending
        break;
      default:
        sortOptions = { createdAt: -1}; // No sorting by default
    }

    // Find products that match the query with pagination and sorting
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .exec();

    // Get the total count of products in the category that are not deleted
    const totalCount = await Product.countDocuments(query);

    // If no products are found
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found in this category' });
    }

    // Return the products with pagination info and total count
    return res.status(200).json({
      totalCount,
      totalPages: Math.ceil(totalCount / limit), // Calculate total pages
      currentPage: parseInt(page, 10),
      products,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const getFreebies = async (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Destructure query parameters

  try {
    // Build the query to fetch only freebies
    const query = { isDeleted: false, isFreebie: true };

    // Get the total count of freebies
    const totalFreebies = await Product.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalFreebies / limit);

    // Validate the page number
    const currentPage = Math.min(Math.max(1, parseInt(page, 10)), totalPages);

    // Calculate the skip value for pagination
    const skip = (currentPage - 1) * limit;

    // Fetch the freebies with skip and limit
    const freebies = await Product.find(query).skip(skip).limit(parseInt(limit, 10));

    // Return the response with pagination details
    return res.status(200).json({
      status: "success",
      totalFreebies,
      totalPages,
      currentPage,
      freebies,
    });
  } catch (error) {
    console.error("Error in getFreebies:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};


export const filterProductByTag = catchAsync(async (req, res, next) => {
  const { tags, productId, categories} = req.query;

  let query = {}; // Initialize an empty filter object

  if (tags) {
      const searchTags = tags.split(',').map(tag => tag.trim());
      query.productTags = { $elemMatch: { $regex: new RegExp(searchTags.join("|"), "i") } };
  }

  if (productId) {
    query.$expr = { $regexMatch: { input: { $toString: "$_id" }, regex: productId, options: "i" } };
  }


  if (categories) {
      const searchCategories = categories.split(',').map(category => category.trim());
      query.category = { $in: searchCategories };
  }

  // Find products with pagination
  const products = await Product.find(query);

  res.status(200).json({
      products
  });
});
