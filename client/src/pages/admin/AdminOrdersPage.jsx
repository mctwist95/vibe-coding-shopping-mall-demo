import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminOrders, updateAdminOrderStatus } from "../../api/orders";
import AdminLayout from "./AdminLayout";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";
const STATUS_TABS = [
  { label: "전체", value: "전체" },
  { label: "처리중", value: "결제완료" },
  { label: "배송중", value: "배송중" },
  { label: "완료", value: "배송완료" },
];

// 로컬 스토리지에서 사용자 캐시 정보를 읽는다.
function getStoredUser() {
  const rawUser = localStorage.getItem("user");
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

// 인증 관련 로컬 스토리지 값을 제거한다.
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("user");
}

// 금액을 원화 문자열로 변환한다.
function formatPrice(price) {
  return `₩${Number(price || 0).toLocaleString("ko-KR")}`;
}

// 날짜 값을 YYYY-MM-DD 형식 문자열로 변환한다.
function formatDate(value) {
  try {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  } catch {
    return "-";
  }
}

// 주문 상태값을 화면 라벨로 변환한다.
function statusLabel(status) {
  if (status === "결제완료") {
    return "처리중";
  }
  if (status === "배송완료") {
    return "완료";
  }
  return status || "처리중";
}

// 관리자 주문 관리 목록을 조회하고 상태 변경 작업을 처리한다.
function AdminOrdersPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("전체");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [processingOrderId, setProcessingOrderId] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedTokenType = localStorage.getItem("token_type");
    const tokenType = storedTokenType === "Bearer" ? storedTokenType : TOKEN_TYPE_FALLBACK;
    const cachedUser = getStoredUser();

    if (cachedUser?.user_type === "admin") {
      setCurrentUser(cachedUser);
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    // 관리자 권한을 검증한다.
    async function checkAdminAuth() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: {
            Authorization: `${tokenType} ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          clearAuthStorage();
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          navigate("/", { replace: true });
          return;
        }

        const result = await response.json();
        const user = result.data || null;
        if (!user || user.user_type !== "admin") {
          navigate("/", { replace: true });
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        navigate("/", { replace: true });
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAdminAuth();
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setFetchError("");

    // 필터 조건으로 관리자 주문 목록을 조회한다.
    async function fetchAdminOrders() {
      try {
        const result = await getAdminOrders({
          status: selectedStatus,
          search: searchKeyword.trim(),
        });
        if (isMounted) {
          setOrders(result.data);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        if (error?.status === 401) {
          clearAuthStorage();
          navigate("/login", { replace: true });
          return;
        }
        setFetchError(error.message || "주문 목록을 불러오지 못했습니다.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAdminOrders();
    return () => {
      isMounted = false;
    };
  }, [isCheckingAuth, navigate, searchKeyword, selectedStatus]);

  // 검색 입력값을 실제 조회 키워드로 반영한다.
  const applySearch = () => {
    setSearchKeyword(searchInput);
  };

  // 주문 상태를 변경하고 목록에 반영한다.
  const changeOrderStatus = async (orderId, nextStatus) => {
    try {
      setProcessingOrderId(orderId);
      const updated = await updateAdminOrderStatus(orderId, nextStatus);
      setOrders((prevOrders) =>
        prevOrders
          .map((order) => (order.orderId === orderId ? { ...order, ...updated } : order))
          .filter((order) => selectedStatus === "전체" || order.status === selectedStatus)
      );
    } catch (error) {
      if (error?.status === 401) {
        clearAuthStorage();
        navigate("/login", { replace: true });
        return;
      }
      alert(error.message || "주문 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setProcessingOrderId("");
    }
  };

  const adminName = useMemo(() => currentUser?.name || currentUser?.email || "관리자", [currentUser]);

  if (isCheckingAuth) {
    return <main className="admin-loading">관리자 권한 확인 중...</main>;
  }

  return (
    <AdminLayout
      title="주문 관리"
      backPath="/admin"
      adminName={adminName}
      actions={
        <Link to="/" className="admin-back-btn">
          쇼핑몰로 돌아가기
        </Link>
      }
    >
      <section className="admin-orders-toolbar">
          <div className="admin-orders-search-wrap">
            <input
              type="search"
              className="admin-orders-search-input"
              placeholder="주문번호 또는 고객명으로 검색..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applySearch();
                }
              }}
            />
            <button type="button" className="admin-orders-filter-btn" onClick={applySearch}>
              필터
            </button>
          </div>
          <div className="admin-orders-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={`admin-orders-tab ${selectedStatus === tab.value ? "active" : ""}`}
                onClick={() => setSelectedStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
      </section>

      {isLoading ? (
        <section className="orders-empty">
          <p>주문 목록을 불러오는 중입니다.</p>
        </section>
      ) : fetchError ? (
        <section className="orders-empty">
          <p>{fetchError}</p>
        </section>
      ) : orders.length === 0 ? (
        <section className="orders-empty">
          <p>조회된 주문이 없습니다.</p>
        </section>
      ) : (
        <section className="admin-orders-list">
          {orders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const customerPhone = order.shipping?.phone || order.payment?.raw?.buyer_tel || "-";
            const shippingAddress = order.shipping?.address || order.payment?.raw?.buyer_addr || "-";
            return (
              <article key={order.orderId} className="admin-orders-card">
                <div className="admin-orders-card-head">
                  <div>
                    <strong>{order.orderId}</strong>
                    <p>
                      {order.customerName || "-"} · {formatDate(order.orderedAt)}
                    </p>
                  </div>
                  <div className="admin-orders-status-area">
                    <span className={`admin-orders-status-chip ${order.status === "배송중" ? "shipping" : ""}`}>
                      {statusLabel(order.status)}
                    </span>
                    <strong>{formatPrice(order.totalPrice)}</strong>
                    <Link to={`/orders/${order.orderId}`} className="admin-orders-detail-btn">
                      상세보기
                    </Link>
                  </div>
                </div>

                <div className="admin-orders-card-body">
                  <div>
                    <small>고객 정보</small>
                    <p>{order.customerEmail || "-"}</p>
                    <p>{customerPhone}</p>
                  </div>
                  <div>
                    <small>주문 상품</small>
                    <p>{items.length}개 상품</p>
                  </div>
                  <div>
                    <small>배송 주소</small>
                    <p>{shippingAddress}</p>
                  </div>
                </div>

                <div className="admin-orders-card-actions">
                  <button
                    type="button"
                    className="admin-orders-action-btn primary"
                    disabled={processingOrderId === order.orderId || order.status !== "결제완료"}
                    onClick={() => changeOrderStatus(order.orderId, "배송중")}
                  >
                    배송 시작
                  </button>
                  <button
                    type="button"
                    className="admin-orders-action-btn"
                    disabled={processingOrderId === order.orderId || ["배송완료", "주문취소"].includes(order.status)}
                    onClick={() => changeOrderStatus(order.orderId, "주문취소")}
                  >
                    주문 취소
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AdminLayout>
  );
}

export default AdminOrdersPage;
