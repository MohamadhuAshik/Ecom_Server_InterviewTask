const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const productModel = require("../Model/productModel");


function processUploadedFiles(files) {
  if (!files) return [];
  const list = Array.isArray(files)
    ? files
    : typeof files === "object"
      ? Object.values(files).flat()
      : [files];

  const results = [];
  const uploadDir = path.join(__dirname, "../uploads");
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production" && !fs.existsSync(uploadDir)
  );

  for (const file of list) {
    if (!file) continue;

    // Already a filename on disk
    if (file.filename) {
      results.push(`/uploads/${file.filename}`);
      continue;
    }

    // In-memory buffer from multer.memoryStorage()
    if (file.buffer) {
      const mime = file.mimetype || "image/jpeg";
      let diskSavedPath = null;

      if (!isServerless) {
        try {
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const rawExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
          const baseName = path
            .basename(file.originalname || "image", rawExt)
            .replace(/[^a-zA-Z0-9-_]/g, "_")
            .slice(0, 40);
          const uniqueName = `${baseName || "product"}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${rawExt}`;
          const fullPath = path.join(uploadDir, uniqueName);
          fs.writeFileSync(fullPath, file.buffer);
          diskSavedPath = `/uploads/${uniqueName}`;
        } catch (err) {
          // If disk is read-only (EROFS) or unwriteable, fall back to base64
          console.warn("Disk write unavailable (read-only EROFS), storing image as base64:", err.message);
          diskSavedPath = null;
        }
      }

      if (diskSavedPath) {
        results.push(diskSavedPath);
      } else {
        const base64Str = `data:${mime};base64,${file.buffer.toString("base64")}`;
        results.push(base64Str);
      }
    }
  }

  return results;
}

const addProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      originalPrice,
      category,
      badge,
      rating,
      reviews,
      description,
      image,
      colors,
      inStock,
      featured,
    } = req.body;

    if (!name || price === undefined || !category || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, price, category, and description",
      });
    }

    // Process files from memory or disk safely without EROFS errors
    let uploadedImages = processUploadedFiles(req.files || (req.file ? [req.file] : []));


    if (image) {
      if (Array.isArray(image)) {
        uploadedImages = [...uploadedImages, ...image];
      } else if (typeof image === "string" && image.trim() !== "") {
        try {
          const parsed = JSON.parse(image);
          if (Array.isArray(parsed)) {
            uploadedImages = [...uploadedImages, ...parsed];
          } else {
            uploadedImages.push(image.trim());
          }
        } catch {
          uploadedImages.push(image.trim());
        }
      }
    }


    let parsedColors = [];
    if (colors) {
      if (Array.isArray(colors)) {
        parsedColors = colors;
      } else if (typeof colors === "string") {
        try {
          parsedColors = JSON.parse(colors);
        } catch {
          parsedColors = [];
        }
      }
    }

    const newProduct = await productModel.create({
      name: name.trim(),
      price: Number(price),
      originalPrice: originalPrice !== undefined ? Number(originalPrice) : 0,
      category: category.trim().toLowerCase(),
      badge: badge ? badge.trim() : "",
      rating: rating !== undefined ? Number(rating) : 0,
      reviews: reviews !== undefined ? Number(reviews) : 0,
      description: description.trim(),
      image: uploadedImages,
      colors: parsedColors,
      inStock: inStock !== undefined ? (inStock === true || inStock === "true") : true,
      featured: featured !== undefined ? (featured === true || featured === "true") : false,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Add Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating product",
      error: error.message,
    });
  }
};


const getProducts = async (req, res) => {
  try {
    const { category, featured, inStock, search, sort, page, limit } = req.query;

    const filter = {};

    if (category && category.toLowerCase().trim() !== "all") {
      filter.category = category.toLowerCase().trim();
    }

    if (featured !== undefined && featured !== "") {
      filter.featured = featured === "true";
    }

    if (inStock !== undefined && inStock !== "") {
      filter.inStock = inStock === "true";
    }

    if (search && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { category: { $regex: search.trim(), $options: "i" } },
      ];
    }

    let sortOption = { createdAt: -1 }; // default: latest first
    if (sort === "price-asc" || sort === "price-low") {
      sortOption = { price: 1 };
    } else if (sort === "price-desc" || sort === "price-high") {
      sortOption = { price: -1 };
    } else if (sort === "rating") {
      sortOption = { rating: -1 };
    } else if (sort === "featured") {
      sortOption = { featured: -1, createdAt: -1 };
    }

    const totalProducts = await productModel.countDocuments(filter);

    let query = productModel.find(filter).sort(sortOption);

    // Apply pagination if page or limit is requested
    const isPaginated = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 10;
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    if (isPaginated) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const products = await query;

    return res.status(200).json({
      success: true,
      count: products.length,
      totalProducts,
      totalPages: isPaginated ? totalPages : 1,
      currentPage: isPaginated ? pageNum : 1,
      limit: isPaginated ? limitNum : totalProducts,
      products,
    });
  } catch (error) {
    console.error("Get Products Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching products",
      error: error.message,
    });
  }
};


const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await productModel.findById(id);
    }

    if (!product) {
      // Check if numeric or legacy id matches
      const query = [];
      if (!isNaN(Number(id))) {
        query.push({ id: Number(id) });
      }
      if (query.length > 0) {
        product = await productModel.findOne({ $or: query });
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get Product By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching product",
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let deletedProduct = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      deletedProduct = await productModel.findByIdAndDelete(id);
    }

    if (!deletedProduct) {
      if (!isNaN(Number(id))) {
        deletedProduct = await productModel.findOneAndDelete({ id: Number(id) });
      }
    }

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product "${deletedProduct.name}" deleted successfully`,
      deletedProduct,
    });
  } catch (error) {
    console.error("Delete Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting product",
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let product = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await productModel.findById(id);
    }
    if (!product && !isNaN(Number(id))) {
      product = await productModel.findOne({ id: Number(id) });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      name,
      price,
      originalPrice,
      category,
      badge,
      rating,
      reviews,
      description,
      image,
      colors,
      inStock,
      featured,
      existingImages,
    } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (price !== undefined) product.price = Number(price);
    if (originalPrice !== undefined) {
      product.originalPrice = originalPrice ? Number(originalPrice) : 0;
    }
    if (category !== undefined) product.category = category.trim().toLowerCase();
    if (badge !== undefined) product.badge = badge.trim();
    if (rating !== undefined) product.rating = Number(rating);
    if (reviews !== undefined) product.reviews = Number(reviews);
    if (description !== undefined) product.description = description.trim();
    if (inStock !== undefined) {
      product.inStock = inStock === true || inStock === "true";
    }
    if (featured !== undefined) {
      product.featured = featured === true || featured === "true";
    }

    // Colors parsing
    if (colors !== undefined) {
      if (typeof colors === "string") {
        try {
          product.colors = JSON.parse(colors);
        } catch {
          product.colors = [];
        }
      } else if (Array.isArray(colors)) {
        product.colors = colors;
      }
    }

    // Images handling
    let updatedImages = [];

    // Keep existing images preserved from client
    if (existingImages) {
      if (Array.isArray(existingImages)) {
        updatedImages.push(...existingImages);
      } else if (typeof existingImages === "string") {
        try {
          const parsed = JSON.parse(existingImages);
          if (Array.isArray(parsed)) updatedImages.push(...parsed);
          else updatedImages.push(existingImages);
        } catch {
          updatedImages.push(existingImages);
        }
      }
    } else if (image === undefined && !req.files && !req.file) {
      updatedImages = product.image || [];
    }

    // Newly uploaded files via Multer (memory or disk)
    const newProcessedFiles = processUploadedFiles(req.files || (req.file ? [req.file] : []));
    if (newProcessedFiles.length > 0) {
      updatedImages.push(...newProcessedFiles);
    }

    // Additional URL strings
    if (image) {
      if (Array.isArray(image)) {
        updatedImages.push(...image);
      } else if (typeof image === "string" && image.trim() !== "") {
        try {
          const parsed = JSON.parse(image);
          if (Array.isArray(parsed)) updatedImages.push(...parsed);
          else updatedImages.push(image.trim());
        } catch {
          updatedImages.push(image.trim());
        }
      }
    }

    if (updatedImages.length > 0 || image !== undefined || req.files || req.file) {
      product.image = updatedImages;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product "${product.name}" updated successfully`,
      product,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating product",
      error: error.message,
    });
  }
};

module.exports = {
  addProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
};
