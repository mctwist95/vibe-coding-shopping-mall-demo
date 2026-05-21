const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";

// 로컬 스토리지의 인증 토큰으로 주문 API 헤더를 만든다.
function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  const tokenType = localStorage.getItem("token_type") || TOKEN_TYPE_FALLBACK;
  return token ? { Authorization: `${tokenType} ${token}` } : {};
}

// 주문 API 공통 응답을 파싱하고 오류를 표준화한다.
async function parseResponse(response) {
  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const error = new Error(result?.message || "주문 API 요청 중 오류가 발생했습니다.");
    error.status = response.status;
    throw error;
  }

  return result;
}

// 조건에 맞는 주문 목록과 페이지 정보를 조회한다.
export async function getOrders(params = {}) {
  const query = new URLSearchParams();

  if (params.status) {
    query.set("status", params.status);
  }
  if (params.period) {
    query.set("period", params.period);
  }
  if (Number.isInteger(params.page) && params.page > 0) {
    query.set("page", String(params.page));
  }
  if (Number.isInteger(params.limit) && params.limit > 0) {
    query.set("limit", String(params.limit));
  }

  const response = await fetch(`${API_BASE_URL}/api/orders?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await parseResponse(response);
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    pagination: result?.pagination || null,
  };
}

// 관리자가 전체 주문 목록을 조회한다.
export async function getAdminOrders(params = {}) {
  const query = new URLSearchParams();

  if (params.status) {
    query.set("status", params.status);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (Number.isInteger(params.page) && params.page > 0) {
    query.set("page", String(params.page));
  }
  if (Number.isInteger(params.limit) && params.limit > 0) {
    query.set("limit", String(params.limit));
  }

  const response = await fetch(`${API_BASE_URL}/api/orders/admin?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await parseResponse(response);
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    pagination: result?.pagination || null,
  };
}

// 주문 번호로 주문 상세를 조회한다.
export async function getOrderById(orderId) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await parseResponse(response);
  return result?.data || null;
}

// 새로운 주문 데이터를 생성한다.
export async function createOrder(payload) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const result = await parseResponse(response);
  return result?.data || null;
}

// 결제 진행 전 서버의 포트원 검증 준비 상태를 확인한다.
export async function getOrderPaymentReady() {
  const response = await fetch(`${API_BASE_URL}/api/orders/payment/ready`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await parseResponse(response);
  return result?.data || { ready: false };
}

// 주문 번호로 주문 정보를 수정한다.
export async function updateOrderById(orderId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const result = await parseResponse(response);
  return result?.data || null;
}

// 관리자가 주문 상태를 변경한다.
export async function updateAdminOrderStatus(orderId, status) {
  const response = await fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });

  const result = await parseResponse(response);
  return result?.data || null;
}

// 주문 번호로 주문을 삭제한다.
export async function deleteOrderById(orderId) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });

  return parseResponse(response);
}
