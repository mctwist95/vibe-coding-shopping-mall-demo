const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";

// 로컬 스토리지의 인증 토큰으로 요청 헤더를 구성한다.
function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  const tokenType = localStorage.getItem("token_type") || TOKEN_TYPE_FALLBACK;

  return token ? { Authorization: `${tokenType} ${token}` } : {};
}

// 관리자 상품 등록 요청을 전송한다.
export async function createProduct(payload) {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "상품 등록 중 오류가 발생했습니다.");
  }

  return result;
}

// 페이지네이션 조건으로 상품 목록을 조회한다.
export async function getProducts(params = {}) {
  const page = Number.isInteger(params.page) && params.page > 0 ? params.page : 1;
  const limit = Number.isInteger(params.limit) && params.limit > 0 ? params.limit : 2;
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`);

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "상품 목록을 불러오는 중 오류가 발생했습니다.");
  }

  return {
    data: result?.data || [],
    pagination: result?.pagination || {
      page,
      limit,
      totalItems: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    },
  };
}

// 전체 상품 목록을 한 번에 조회한다.
export async function getAllProducts() {
  const response = await fetch(`${API_BASE_URL}/api/products/all`);

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "전체 상품 목록을 불러오는 중 오류가 발생했습니다.");
  }

  return result?.data || [];
}

// 상품 ID 기준으로 상품 정보를 수정한다.
export async function updateProductById(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "상품 수정 중 오류가 발생했습니다.");
  }

  return result?.data || null;
}

// 상품 ID 기준으로 상품을 삭제한다.
export async function deleteProductById(id) {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "상품 삭제 중 오류가 발생했습니다.");
  }

  return result;
}

// 상품 ID 기준으로 상세 정보를 조회한다.
export async function getProductById(id) {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`);

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.message || "상품 상세 정보를 불러오는 중 오류가 발생했습니다.");
  }

  return result?.data || null;
}
