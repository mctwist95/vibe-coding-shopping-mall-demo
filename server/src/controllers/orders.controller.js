const { ObjectId } = require("mongodb");
const { getDatabase } = require("../config/db");
const { ORDERS_COLLECTION, ORDER_STATUS } = require("../models/order.model");

const PORTONE_API_BASE_URL = "https://api.iamport.kr";
const PORTONE_API_KEY = process.env.PORTONE_API_KEY || "";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || "";
const PORTONE_PLACEHOLDER_PREFIX = "your-portone-";

// 인증 정보의 사용자 ID를 ObjectId로 변환한다.
function toUserObjectId(req) {
  const userId = req.auth?.sub;
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  return new ObjectId(userId);
}

// 문자열 입력값이 비어있지 않은지 확인한다.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// 정규식 특수문자를 이스케이프해 안전한 검색 패턴을 만든다.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 0 이상의 유효한 숫자인지 검사한다.
function isValidNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// 포트원 API 자격정보가 실제 값으로 설정되어 있는지 확인한다.
function hasValidPortoneCredentials() {
  if (!PORTONE_API_KEY || !PORTONE_API_SECRET) {
    return false;
  }

  const key = PORTONE_API_KEY.trim().toLowerCase();
  const secret = PORTONE_API_SECRET.trim().toLowerCase();
  return !key.startsWith(PORTONE_PLACEHOLDER_PREFIX) && !secret.startsWith(PORTONE_PLACEHOLDER_PREFIX);
}

// 소수점 오차를 줄이기 위해 금액을 센트 단위 정수로 변환한다.
function toMinorUnit(value) {
  return Math.round(Number(value || 0) * 100);
}

// 결제 상태가 성공 상태인지 확인한다.
function isPaidStatus(status) {
  return ["paid", "success", "결제완료"].includes(String(status || "").toLowerCase());
}

// 주문 상태 값이 허용 목록에 포함되는지 확인한다.
function isValidStatus(status) {
  return ORDER_STATUS.includes(status);
}

// 날짜 입력값을 Date 객체로 변환하고 실패 시 null을 반환한다.
function toValidDateOrNull(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

// 주문 아이템 배열을 저장 가능한 형태로 정규화한다.
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items.map((item) => ({
    productId: isNonEmptyString(item?.productId) ? item.productId.trim() : null,
    sku: isNonEmptyString(item?.sku) ? item.sku.trim() : null,
    name: isNonEmptyString(item?.name) ? item.name.trim() : "",
    image: isNonEmptyString(item?.image) ? item.image.trim() : null,
    price: Number(item?.price || 0),
    category: isNonEmptyString(item?.category) ? item.category.trim() : null,
    size: isNonEmptyString(item?.size) ? item.size.trim() : null,
    color: isNonEmptyString(item?.color) ? item.color.trim() : null,
    quantity: Number(item?.quantity || 0),
  }));
}

// 아이템 목록으로부터 총 수량과 총 금액을 계산한다.
function calculateTotalsFromItems(items) {
  return items.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return {
        totalQuantity: acc.totalQuantity + quantity,
        totalPrice: acc.totalPrice + quantity * price,
      };
    },
    { totalQuantity: 0, totalPrice: 0 }
  );
}

// 결제 정보를 정규화하고 기본 필수값을 검사한다.
function normalizePayment(payment) {
  if (!payment || typeof payment !== "object") {
    return null;
  }

  const impUid = isNonEmptyString(payment.impUid) ? payment.impUid.trim() : null;
  const merchantUid = isNonEmptyString(payment.merchantUid) ? payment.merchantUid.trim() : "";
  const paidAmount = Number(payment.paidAmount);
  const status = isNonEmptyString(payment.status) ? payment.status.trim().toLowerCase() : "";

  if (!merchantUid || !isValidNonNegativeNumber(paidAmount) || !status) {
    return null;
  }

  return {
    impUid,
    merchantUid,
    paidAmount,
    status,
    payMethod: isNonEmptyString(payment.payMethod) ? payment.payMethod.trim() : null,
    pgProvider: isNonEmptyString(payment.pgProvider) ? payment.pgProvider.trim() : null,
    receiptUrl: isNonEmptyString(payment.receiptUrl) ? payment.receiptUrl.trim() : null,
    paidAt: toValidDateOrNull(payment.paidAt),
    raw: payment.raw ?? null,
  };
}

// 주문 데이터와 결제 정보의 정합성을 검증한다.
function validatePaymentAgainstOrder({
  payment,
  orderId,
  totalQuantity,
  totalPrice,
  subtotal,
  tax,
  shipping,
  normalizedItems,
}) {
  if (!payment) {
    return "payment info is required.";
  }

  if (!["paid", "success", "결제완료"].includes(payment.status)) {
    return "payment status must be a paid state.";
  }

  const calculated = calculateTotalsFromItems(normalizedItems);
  if (calculated.totalQuantity !== totalQuantity) {
    return "totalQuantity does not match item quantities.";
  }

  const normalizedSubtotal = isValidNonNegativeNumber(subtotal) ? subtotal : calculated.totalPrice;
  const normalizedTax = isValidNonNegativeNumber(tax) ? tax : 0;
  const normalizedShipping = isValidNonNegativeNumber(shipping) ? shipping : 0;
  const expectedTotalPrice = normalizedSubtotal + normalizedTax + normalizedShipping;

  if (toMinorUnit(calculated.totalPrice) !== toMinorUnit(normalizedSubtotal)) {
    return "subtotal does not match item prices.";
  }

  if (toMinorUnit(expectedTotalPrice) !== toMinorUnit(totalPrice)) {
    return "totalPrice does not match subtotal/tax/shipping.";
  }

  if (toMinorUnit(payment.paidAmount) !== toMinorUnit(totalPrice)) {
    return "payment amount does not match totalPrice.";
  }

  if (!payment.merchantUid.includes(orderId)) {
    return "merchantUid must include orderId for traceability.";
  }

  return null;
}

// 포트원 액세스 토큰을 발급받는다.
async function getPortoneAccessToken() {
  if (!hasValidPortoneCredentials()) {
    return {
      ok: false,
      statusCode: 500,
      message: "PortOne API credentials are not configured.",
    };
  }

  if (typeof fetch !== "function") {
    return {
      ok: false,
      statusCode: 500,
      message: "Global fetch is not available in this Node.js runtime.",
    };
  }

  const response = await fetch(`${PORTONE_API_BASE_URL}/users/getToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imp_key: PORTONE_API_KEY,
      imp_secret: PORTONE_API_SECRET,
    }),
  });

  const result = await response.json().catch(() => null);
  const accessToken = result?.response?.access_token;
  if (!response.ok || result?.code !== 0 || !accessToken) {
    return {
      ok: false,
      statusCode: 502,
      message: "Failed to issue PortOne access token.",
    };
  }

  return {
    ok: true,
    accessToken,
  };
}

// 결제 시작 전 포트원 서버 검증 준비 상태를 반환한다.
async function getPaymentReadyStatus(req, res) {
  try {
    if (!hasValidPortoneCredentials()) {
      return res.status(200).json({
        ok: true,
        data: {
          ready: false,
          message: "결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.",
        },
      });
    }

    const tokenResult = await getPortoneAccessToken();
    if (!tokenResult.ok) {
      return res.status(200).json({
        ok: true,
        data: {
          ready: false,
          message: "포트원 인증에 실패했습니다. API 키/시크릿을 다시 확인해주세요.",
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        ready: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to check payment readiness.",
      error: error.message,
    });
  }
}

// imp_uid로 포트원 결제 단건을 조회한다.
async function getPortonePaymentByImpUid(impUid, accessToken) {
  const maxAttempts = 3;
  const retryDelayMs = 700;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${PORTONE_API_BASE_URL}/payments/${encodeURIComponent(impUid)}`, {
      method: "GET",
      headers: {
        Authorization: accessToken,
      },
    });

    const result = await response.json().catch(() => null);
    const payment = result?.response;
    if (response.ok && result?.code === 0 && payment) {
      return {
        ok: true,
        payment,
      };
    }

    const isNotFoundMessage = String(result?.message || "").includes("존재하지 않는 결제정보");
    if (attempt < maxAttempts && (response.status === 404 || isNotFoundMessage)) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }

    return {
      ok: false,
      notFound: response.status === 404 || isNotFoundMessage,
      statusCode: 502,
      message: result?.message || "Failed to fetch PortOne payment data.",
    };
  }

  return {
    ok: false,
    statusCode: 502,
    message: "Failed to fetch PortOne payment data.",
  };
}

// merchant_uid로 포트원 결제 단건을 조회한다.
async function getPortonePaymentByMerchantUid(merchantUid, accessToken) {
  const maxAttempts = 3;
  const retryDelayMs = 700;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${PORTONE_API_BASE_URL}/payments/find/${encodeURIComponent(merchantUid)}`, {
      method: "GET",
      headers: {
        Authorization: accessToken,
      },
    });

    const result = await response.json().catch(() => null);
    const payment = result?.response;
    if (response.ok && result?.code === 0 && payment) {
      return {
        ok: true,
        payment,
      };
    }

    const isNotFoundMessage = String(result?.message || "").includes("존재하지 않는 결제정보");
    if (attempt < maxAttempts && (response.status === 404 || isNotFoundMessage)) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }

    return {
      ok: false,
      notFound: response.status === 404 || isNotFoundMessage,
      statusCode: 502,
      message: result?.message || "Failed to fetch PortOne payment data.",
    };
  }

  return {
    ok: false,
    statusCode: 502,
    message: "Failed to fetch PortOne payment data.",
  };
}

// 포트원 결제 조회값과 주문 요청값의 정합성을 검증한다.
async function verifyPaymentWithPortone({ payment, totalPrice, orderId }) {
  const tokenResult = await getPortoneAccessToken();
  if (!tokenResult.ok) {
    return tokenResult;
  }

  let paymentResult = null;
  if (payment.impUid) {
    paymentResult = await getPortonePaymentByImpUid(payment.impUid, tokenResult.accessToken);
  }

  if (!paymentResult || !paymentResult.ok) {
    const fallbackByMerchantUid = await getPortonePaymentByMerchantUid(payment.merchantUid, tokenResult.accessToken);
    if (!fallbackByMerchantUid.ok) {
      return fallbackByMerchantUid;
    }
    paymentResult = fallbackByMerchantUid;
  }

  const portonePayment = paymentResult.payment;
  const portoneStatus = String(portonePayment.status || "").toLowerCase();
  const portoneAmount = Number(portonePayment.amount || 0);
  const portoneMerchantUid = String(portonePayment.merchant_uid || "");

  if (!isPaidStatus(portoneStatus)) {
    return {
      ok: false,
      statusCode: 400,
      message: "PortOne payment status is not paid.",
    };
  }

  if (toMinorUnit(portoneAmount) !== toMinorUnit(totalPrice)) {
    return {
      ok: false,
      statusCode: 400,
      message: "PortOne payment amount does not match totalPrice.",
    };
  }

  if (portoneMerchantUid !== payment.merchantUid) {
    return {
      ok: false,
      statusCode: 400,
      message: "merchantUid does not match PortOne payment data.",
    };
  }

  if (!portoneMerchantUid.includes(orderId)) {
    return {
      ok: false,
      statusCode: 400,
      message: "PortOne merchantUid must include orderId.",
    };
  }

  return {
    ok: true,
    payment: {
      ...payment,
      paidAmount: portoneAmount,
      status: portoneStatus,
      payMethod: portonePayment.pay_method || payment.payMethod || null,
      pgProvider: portonePayment.pg_provider || payment.pgProvider || null,
      receiptUrl: portonePayment.receipt_url || payment.receiptUrl || null,
      paidAt: Number.isFinite(portonePayment.paid_at)
        ? new Date(Number(portonePayment.paid_at) * 1000)
        : payment.paidAt,
      raw: portonePayment,
    },
  };
}

// 신규 주문을 검증 후 생성한다.
async function createOrder(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { orderId, customerName, customerEmail, status, totalQuantity, totalPrice, subtotal, tax, shipping, items, orderedAt, payment } = req.body;
    const normalizedItems = normalizeItems(items);

    if (!isNonEmptyString(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "orderId is required.",
      });
    }

    if (!normalizedItems) {
      return res.status(400).json({
        ok: false,
        message: "items must be a non-empty array.",
      });
    }

    if (!isValidNonNegativeNumber(totalQuantity) || !isValidNonNegativeNumber(totalPrice)) {
      return res.status(400).json({
        ok: false,
        message: "totalQuantity and totalPrice must be non-negative numbers.",
      });
    }

    const normalizedOrderId = orderId.trim();
    const normalizedPayment = normalizePayment(payment);
    const paymentValidationMessage = validatePaymentAgainstOrder({
      payment: normalizedPayment,
      orderId: normalizedOrderId,
      totalQuantity,
      totalPrice,
      subtotal,
      tax,
      shipping,
      normalizedItems,
    });
    if (paymentValidationMessage) {
      return res.status(400).json({
        ok: false,
        message: paymentValidationMessage,
      });
    }

    const normalizedStatus = status ?? "결제완료";
    if (!isValidStatus(normalizedStatus)) {
      return res.status(400).json({
        ok: false,
        message: `status must be one of: ${ORDER_STATUS.join(", ")}`,
      });
    }

    const normalizedOrderedAt = toValidDateOrNull(orderedAt) || new Date();
    const now = new Date();
    const db = getDatabase();
    const orders = db.collection(ORDERS_COLLECTION);

    const duplicatedOrder = await orders.findOne({ orderId: normalizedOrderId });
    if (duplicatedOrder) {
      return res.status(409).json({
        ok: false,
        message: "A order with this orderId already exists.",
      });
    }

    const verifiedPaymentResult = await verifyPaymentWithPortone({
      payment: normalizedPayment,
      totalPrice,
      orderId: normalizedOrderId,
    });
    if (!verifiedPaymentResult.ok) {
      return res.status(verifiedPaymentResult.statusCode || 400).json({
        ok: false,
        message: verifiedPaymentResult.message,
      });
    }

    const orderDocument = {
      orderId: normalizedOrderId,
      userId,
      customerName: isNonEmptyString(customerName) ? customerName.trim() : null,
      customerEmail: isNonEmptyString(customerEmail) ? customerEmail.trim().toLowerCase() : null,
      status: normalizedStatus,
      totalQuantity,
      totalPrice,
      subtotal: isValidNonNegativeNumber(subtotal) ? subtotal : calculateTotalsFromItems(normalizedItems).totalPrice,
      tax: isValidNonNegativeNumber(tax) ? tax : 0,
      shipping: isValidNonNegativeNumber(shipping) ? shipping : 0,
      items: normalizedItems,
      payment: verifiedPaymentResult.payment,
      orderedAt: normalizedOrderedAt,
      createdAt: now,
      updatedAt: now,
    };

    const result = await orders.insertOne(orderDocument);

    return res.status(201).json({
      ok: true,
      data: {
        _id: result.insertedId,
        ...orderDocument,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A order with this orderId already exists.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to create order.",
      error: error.message,
    });
  }
}

// 조건과 페이지네이션을 반영해 주문 목록을 조회한다.
async function getOrders(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { status, period = "all" } = req.query;
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const skip = (page - 1) * limit;

    const query = { userId };
    if (isNonEmptyString(status) && status !== "전체") {
      if (!isValidStatus(status)) {
        return res.status(400).json({
          ok: false,
          message: `status must be one of: 전체, ${ORDER_STATUS.join(", ")}`,
        });
      }
      query.status = status;
    }

    if (period !== "all") {
      const dayCount = Number.parseInt(String(period).replace("d", ""), 10);
      if (Number.isNaN(dayCount) || dayCount <= 0) {
        return res.status(400).json({
          ok: false,
          message: "period must be one of: all, 7d, 30d, 90d.",
        });
      }

      const thresholdDate = new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000);
      query.orderedAt = { $gte: thresholdDate };
    }

    const db = getDatabase();
    const collection = db.collection(ORDERS_COLLECTION);
    const [orders, totalItems] = await Promise.all([
      collection.find(query).sort({ orderedAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      ok: true,
      data: orders,
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
      message: "Failed to fetch orders.",
      error: error.message,
    });
  }
}

// 관리자가 전체 주문 목록을 조회한다.
async function getAdminOrders(req, res) {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    const skip = (page - 1) * limit;
    const { status = "전체", search = "" } = req.query;

    const query = {};
    if (isNonEmptyString(status) && status !== "전체") {
      if (!isValidStatus(status)) {
        return res.status(400).json({
          ok: false,
          message: `status must be one of: 전체, ${ORDER_STATUS.join(", ")}`,
        });
      }
      query.status = status;
    }

    if (isNonEmptyString(search)) {
      const keyword = escapeRegex(search.trim());
      query.$or = [
        { orderId: { $regex: keyword, $options: "i" } },
        { customerName: { $regex: keyword, $options: "i" } },
        { customerEmail: { $regex: keyword, $options: "i" } },
      ];
    }

    const db = getDatabase();
    const collection = db.collection(ORDERS_COLLECTION);
    const [orders, totalItems] = await Promise.all([
      collection.find(query).sort({ orderedAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      ok: true,
      data: orders,
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
      message: "Failed to fetch admin orders.",
      error: error.message,
    });
  }
}

// 주문 번호 기준으로 단일 주문을 조회한다.
async function getOrderById(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { orderId } = req.params;
    if (!isNonEmptyString(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "orderId is required.",
      });
    }

    const db = getDatabase();
    const order = await db.collection(ORDERS_COLLECTION).findOne({ userId, orderId: orderId.trim() });
    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch order.",
      error: error.message,
    });
  }
}

// 주문 번호 기준으로 주문 정보를 부분 수정한다.
async function updateOrder(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { orderId } = req.params;
    if (!isNonEmptyString(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "orderId is required.",
      });
    }

    const updates = {};

    if (req.body.status !== undefined) {
      if (!isValidStatus(req.body.status)) {
        return res.status(400).json({
          ok: false,
          message: `status must be one of: ${ORDER_STATUS.join(", ")}`,
        });
      }
      updates.status = req.body.status;
    }

    if (req.body.customerName !== undefined) {
      updates.customerName = isNonEmptyString(req.body.customerName) ? req.body.customerName.trim() : null;
    }

    if (req.body.customerEmail !== undefined) {
      updates.customerEmail = isNonEmptyString(req.body.customerEmail) ? req.body.customerEmail.trim().toLowerCase() : null;
    }

    if (req.body.totalQuantity !== undefined) {
      if (!isValidNonNegativeNumber(req.body.totalQuantity)) {
        return res.status(400).json({
          ok: false,
          message: "totalQuantity must be a non-negative number.",
        });
      }
      updates.totalQuantity = req.body.totalQuantity;
    }

    if (req.body.totalPrice !== undefined) {
      if (!isValidNonNegativeNumber(req.body.totalPrice)) {
        return res.status(400).json({
          ok: false,
          message: "totalPrice must be a non-negative number.",
        });
      }
      updates.totalPrice = req.body.totalPrice;
    }

    if (req.body.items !== undefined) {
      const normalizedItems = normalizeItems(req.body.items);
      if (!normalizedItems) {
        return res.status(400).json({
          ok: false,
          message: "items must be a non-empty array.",
        });
      }
      updates.items = normalizedItems;
    }

    if (req.body.orderedAt !== undefined) {
      const normalizedOrderedAt = toValidDateOrNull(req.body.orderedAt);
      if (!normalizedOrderedAt) {
        return res.status(400).json({
          ok: false,
          message: "orderedAt must be a valid datetime.",
        });
      }
      updates.orderedAt = normalizedOrderedAt;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No valid fields provided for update.",
      });
    }

    updates.updatedAt = new Date();

    const db = getDatabase();
    const orders = db.collection(ORDERS_COLLECTION);
    const updateResult = await orders.updateOne({ userId, orderId: orderId.trim() }, { $set: updates });
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Order not found.",
      });
    }

    const updatedOrder = await orders.findOne({ userId, orderId: orderId.trim() });
    return res.status(200).json({
      ok: true,
      data: updatedOrder,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to update order.",
      error: error.message,
    });
  }
}

// 관리자가 주문 상태를 변경한다.
async function updateAdminOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    if (!isNonEmptyString(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "orderId is required.",
      });
    }

    const { status } = req.body;
    if (!isValidStatus(status)) {
      return res.status(400).json({
        ok: false,
        message: `status must be one of: ${ORDER_STATUS.join(", ")}`,
      });
    }

    const db = getDatabase();
    const orders = db.collection(ORDERS_COLLECTION);
    const updateResult = await orders.updateOne({ orderId: orderId.trim() }, { $set: { status, updatedAt: new Date() } });
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Order not found.",
      });
    }

    const updatedOrder = await orders.findOne({ orderId: orderId.trim() });
    return res.status(200).json({
      ok: true,
      data: updatedOrder,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to update admin order status.",
      error: error.message,
    });
  }
}

// 주문 번호 기준으로 주문 데이터를 삭제한다.
async function deleteOrder(req, res) {
  try {
    const userId = toUserObjectId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Invalid auth payload.",
      });
    }

    const { orderId } = req.params;
    if (!isNonEmptyString(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "orderId is required.",
      });
    }

    const db = getDatabase();
    const result = await db.collection(ORDERS_COLLECTION).deleteOne({ userId, orderId: orderId.trim() });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Order deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to delete order.",
      error: error.message,
    });
  }
}

module.exports = {
  createOrder,
  getPaymentReadyStatus,
  getOrders,
  getAdminOrders,
  getOrderById,
  updateOrder,
  updateAdminOrderStatus,
  deleteOrder,
};
