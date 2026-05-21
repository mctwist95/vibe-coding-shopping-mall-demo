const { ObjectId } = require("mongodb");
const { getDatabase } = require("../config/db");
const {
  PRODUCTS_COLLECTION,
  PRODUCT_CATEGORIES,
  buildProductDocument,
} = require("../models/product.model");

// 문자열 입력값이 비어있지 않은지 검사한다.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// 카테고리 값이 허용 목록에 포함되는지 확인한다.
function isValidCategory(value) {
  return PRODUCT_CATEGORIES.includes(value);
}

// 가격 값이 0 이상의 유효한 숫자인지 확인한다.
function isValidPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// 상품 생성 요청을 검증하고 저장한다.
async function createProduct(req, res) {
  try {
    const { sku, name, price, category, image, description } = req.body;

    if (!isNonEmptyString(sku) || !isNonEmptyString(name) || !isNonEmptyString(image)) {
      return res.status(400).json({
        ok: false,
        message: "sku, name, and image are required.",
      });
    }

    if (!isValidPrice(price)) {
      return res.status(400).json({
        ok: false,
        message: "price must be a valid number greater than or equal to 0.",
      });
    }

    if (!isValidCategory(category)) {
      return res.status(400).json({
        ok: false,
        message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
      });
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({
        ok: false,
        message: "description must be a string or null.",
      });
    }

    const db = getDatabase();
    const productDocument = buildProductDocument(req.body);
    const result = await db.collection(PRODUCTS_COLLECTION).insertOne(productDocument);

    return res.status(201).json({
      ok: true,
      data: {
        _id: result.insertedId,
        ...productDocument,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A product with this sku already exists.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to create product.",
      error: error.message,
    });
  }
}

// 페이지네이션 조건으로 상품 목록을 조회한다.
async function getProducts(req, res) {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 2;
    const skip = (page - 1) * limit;

    const db = getDatabase();
    const collection = db.collection(PRODUCTS_COLLECTION);
    const [products, totalItems] = await Promise.all([
      collection.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({}),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      ok: true,
      data: products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch products.",
      error: error.message,
    });
  }
}

// 전체 상품 목록을 제한 없이 조회한다.
async function getAllProducts(req, res) {
  try {
    const db = getDatabase();
    const products = await db.collection(PRODUCTS_COLLECTION).find({}).sort({ createdAt: -1 }).toArray();

    return res.status(200).json({
      ok: true,
      data: products,
      totalItems: products.length,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch all products.",
      error: error.message,
    });
  }
}

// 상품 ID로 단일 상품 상세를 조회한다.
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid product id format.",
      });
    }

    const db = getDatabase();
    const product = await db.collection(PRODUCTS_COLLECTION).findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({
        ok: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch product.",
      error: error.message,
    });
  }
}

// 상품 ID 기준으로 상품 정보를 부분 수정한다.
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid product id format.",
      });
    }

    const updates = {};

    if (req.body.sku !== undefined) {
      if (!isNonEmptyString(req.body.sku)) {
        return res.status(400).json({
          ok: false,
          message: "sku must be a non-empty string.",
        });
      }
      updates.sku = req.body.sku.trim();
    }

    if (req.body.name !== undefined) {
      if (!isNonEmptyString(req.body.name)) {
        return res.status(400).json({
          ok: false,
          message: "name must be a non-empty string.",
        });
      }
      updates.name = req.body.name.trim();
    }

    if (req.body.price !== undefined) {
      if (!isValidPrice(req.body.price)) {
        return res.status(400).json({
          ok: false,
          message: "price must be a valid number greater than or equal to 0.",
        });
      }
      updates.price = req.body.price;
    }

    if (req.body.category !== undefined) {
      if (!isValidCategory(req.body.category)) {
        return res.status(400).json({
          ok: false,
          message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
        });
      }
      updates.category = req.body.category;
    }

    if (req.body.image !== undefined) {
      if (!isNonEmptyString(req.body.image)) {
        return res.status(400).json({
          ok: false,
          message: "image must be a non-empty string.",
        });
      }
      updates.image = req.body.image.trim();
    }

    if (req.body.description !== undefined) {
      if (req.body.description !== null && typeof req.body.description !== "string") {
        return res.status(400).json({
          ok: false,
          message: "description must be a string or null.",
        });
      }
      updates.description = req.body.description;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No valid fields provided for update.",
      });
    }

    updates.updatedAt = new Date();

    const db = getDatabase();
    const products = db.collection(PRODUCTS_COLLECTION);
    const updateResult = await products.updateOne({ _id: new ObjectId(id) }, { $set: updates });

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Product not found.",
      });
    }

    const updatedProduct = await products.findOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      ok: true,
      data: updatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A product with this sku already exists.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to update product.",
      error: error.message,
    });
  }
}

// 상품 ID 기준으로 상품을 삭제한다.
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid product id format.",
      });
    }

    const db = getDatabase();
    const result = await db.collection(PRODUCTS_COLLECTION).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to delete product.",
      error: error.message,
    });
  }
}

module.exports = {
  createProduct,
  getProducts,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
