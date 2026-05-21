const { ObjectId } = require("mongodb");
const { randomUUID } = require("crypto");
const { getDatabase } = require("../config/db");
const { CARTS_COLLECTION } = require("../models/cart.model");

// 인증 정보의 사용자 ID를 ObjectId로 변환한다.
function toUserObjectId(req) {
  const userId = req.auth?.sub;
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  return new ObjectId(userId);
}

// 문자열 입력값이 비어있지 않은지 검사한다.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// 가격 값이 0 이상의 유효한 숫자인지 확인한다.
function isValidPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// 수량 값이 1 이상의 정수인지 검사한다.
function isValidQuantity(value) {
  return Number.isInteger(value) && value > 0;
}

// 기본 구조를 가진 빈 장바구니 객체를 생성한다.
function createEmptyCart(userId) {
  const now = new Date();
  return {
    userId,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

// 현재 사용자의 장바구니를 조회한다.
async function getCart(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const db = getDatabase();
    const cart = await db.collection(CARTS_COLLECTION).findOne({ userId });

    return res.status(200).json({
      ok: true,
      data: cart || createEmptyCart(userId),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch cart.",
      error: error.message,
    });
  }
}

// 장바구니에 새 상품을 추가하거나 중복 항목 수량을 합산한다.
async function addCartItem(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { productId, sku, name, image, price, category, size, color, quantity } = req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(image) || !isValidPrice(price)) {
      return res.status(400).json({
        ok: false,
        message: "name, image, and valid price are required.",
      });
    }

    const normalizedQuantity = quantity === undefined ? 1 : quantity;
    if (!isValidQuantity(normalizedQuantity)) {
      return res.status(400).json({
        ok: false,
        message: "quantity must be a positive integer.",
      });
    }

    if (productId !== undefined && productId !== null && !ObjectId.isValid(productId)) {
      return res.status(400).json({
        ok: false,
        message: "productId must be a valid ObjectId.",
      });
    }

    const now = new Date();
    const newItem = {
      itemId: randomUUID(),
      productId: productId ? new ObjectId(productId) : null,
      sku: isNonEmptyString(sku) ? sku.trim() : null,
      name: name.trim(),
      image: image.trim(),
      price,
      category: isNonEmptyString(category) ? category.trim() : null,
      size: isNonEmptyString(size) ? size.trim() : null,
      color: isNonEmptyString(color) ? color.trim() : null,
      quantity: normalizedQuantity,
      addedAt: now,
      updatedAt: now,
    };

    const db = getDatabase();
    const carts = db.collection(CARTS_COLLECTION);
    const existing = await carts.findOne({ userId });

    if (!existing) {
      const cart = {
        userId,
        items: [newItem],
        createdAt: now,
        updatedAt: now,
      };
      await carts.insertOne(cart);
      return res.status(201).json({
        ok: true,
        data: cart,
      });
    }

    const duplicatedIndex = existing.items.findIndex((item) => {
      const sameProduct = String(item.productId || "") === String(newItem.productId || "");
      const sameSize = (item.size || null) === (newItem.size || null);
      const sameColor = (item.color || null) === (newItem.color || null);
      return sameProduct && sameSize && sameColor;
    });

    if (duplicatedIndex >= 0) {
      existing.items[duplicatedIndex].quantity += normalizedQuantity;
      existing.items[duplicatedIndex].updatedAt = now;
    } else {
      existing.items.push(newItem);
    }
    existing.updatedAt = now;

    await carts.updateOne({ _id: existing._id }, { $set: { items: existing.items, updatedAt: existing.updatedAt } });

    return res.status(200).json({
      ok: true,
      data: existing,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to add item to cart.",
      error: error.message,
    });
  }
}

// 장바구니 항목의 수량/옵션을 수정한다.
async function updateCartItem(req, res) {
  try {
    const userId = toUserObjectId(req);
    const { itemId } = req.params;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    if (!isNonEmptyString(itemId)) {
      return res.status(400).json({
        ok: false,
        message: "itemId is required.",
      });
    }

    const db = getDatabase();
    const carts = db.collection(CARTS_COLLECTION);
    const cart = await carts.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        ok: false,
        message: "Cart not found.",
      });
    }

    const targetIndex = cart.items.findIndex((item) => item.itemId === itemId);
    if (targetIndex < 0) {
      return res.status(404).json({
        ok: false,
        message: "Cart item not found.",
      });
    }

    const targetItem = cart.items[targetIndex];
    const { quantity, size, color } = req.body;

    if (quantity !== undefined) {
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({
          ok: false,
          message: "quantity must be a positive integer.",
        });
      }
      targetItem.quantity = quantity;
    }

    if (size !== undefined) {
      targetItem.size = size === null ? null : isNonEmptyString(size) ? size.trim() : null;
    }

    if (color !== undefined) {
      targetItem.color = color === null ? null : isNonEmptyString(color) ? color.trim() : null;
    }

    targetItem.updatedAt = new Date();
    cart.updatedAt = new Date();

    await carts.updateOne({ _id: cart._id }, { $set: { items: cart.items, updatedAt: cart.updatedAt } });

    return res.status(200).json({
      ok: true,
      data: cart,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to update cart item.",
      error: error.message,
    });
  }
}

// 장바구니에서 지정한 항목을 제거한다.
async function removeCartItem(req, res) {
  try {
    const userId = toUserObjectId(req);
    const { itemId } = req.params;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const db = getDatabase();
    const carts = db.collection(CARTS_COLLECTION);
    const cart = await carts.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        ok: false,
        message: "Cart not found.",
      });
    }

    const nextItems = cart.items.filter((item) => item.itemId !== itemId);
    if (nextItems.length === cart.items.length) {
      return res.status(404).json({
        ok: false,
        message: "Cart item not found.",
      });
    }

    cart.items = nextItems;
    cart.updatedAt = new Date();
    await carts.updateOne({ _id: cart._id }, { $set: { items: cart.items, updatedAt: cart.updatedAt } });

    return res.status(200).json({
      ok: true,
      data: cart,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to remove cart item.",
      error: error.message,
    });
  }
}

// 현재 사용자의 장바구니를 비운다.
async function clearCart(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const db = getDatabase();
    const carts = db.collection(CARTS_COLLECTION);
    const now = new Date();
    const result = await carts.updateOne({ userId }, { $set: { items: [], updatedAt: now } });

    if (result.matchedCount === 0) {
      return res.status(200).json({
        ok: true,
        data: createEmptyCart(userId),
      });
    }

    const cart = await carts.findOne({ userId });
    return res.status(200).json({
      ok: true,
      data: cart,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to clear cart.",
      error: error.message,
    });
  }
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
};
