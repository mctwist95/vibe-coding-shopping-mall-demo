import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HomeNavbar from "../components/HomeNavbar";
import { getOrders, updateOrderById } from "../api/orders";

const STATUS_TABS = [
  { label: "전체", value: "전체" },
  { label: "처리중", value: "결제완료" },
  { label: "배송중", value: "배송중" },
  { label: "완료", value: "배송완료" },
  { label: "취소", value: "주문취소" },
];

// 인증 관련 로컬 스토리지 값을 제거한다.
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("user");
}

// 로컬 스토리지에서 사용자 캐시 정보를 읽어온다.
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

// 금액을 원화 문자열로 포맷한다.
function formatPrice(price) {
  return `₩${Number(price || 0).toLocaleString("ko-KR")}`;
}

// 날짜 값을 한국어 로캘 문자열로 변환한다.
function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return "-";
  }
}

// 주문 상태를 배지 라벨로 변환한다.
function getStatusLabel(status) {
  if (status === "결제완료") {
    return "처리중";
  }
  if (status === "배송완료") {
    return "완료";
  }
  if (status === "주문취소") {
    return "주문취소";
  }
  return status || "처리중";
}

// 주문 목록을 조건별로 조회하고 표시한다.
function OrdersPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [allOrders, setAllOrders] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [isCancellingOrderId, setIsCancellingOrderId] = useState("");

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  // 로그아웃 시 인증 상태를 정리하고 홈으로 이동한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setFetchError("");

    // 필터 조건에 맞는 주문 목록을 서버에서 조회한다.
    async function fetchOrders() {
      try {
        const result = await getOrders({
          status: "전체",
          period: "all",
        });

        if (isMounted) {
          setAllOrders(result.data);
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

        setFetchError(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const statusCounts = useMemo(() => {
    return allOrders.reduce(
      (acc, order) => {
        const status = order?.status || "결제완료";
        acc.전체 += 1;
        if (status === "결제완료") {
          acc.결제완료 += 1;
        } else if (status === "배송중") {
          acc.배송중 += 1;
        } else if (status === "배송완료") {
          acc.배송완료 += 1;
        } else if (status === "주문취소") {
          acc.주문취소 += 1;
        }
        return acc;
      },
      { 전체: 0, 결제완료: 0, 배송중: 0, 배송완료: 0, 주문취소: 0 }
    );
  }, [allOrders]);

  const orders = useMemo(() => {
    if (selectedStatus === "전체") {
      return allOrders;
    }
    return allOrders.filter((order) => order.status === selectedStatus);
  }, [allOrders, selectedStatus]);

  // 주문 상태를 주문취소로 변경한다.
  const cancelOrder = async (orderId) => {
    const shouldCancel = window.confirm("이 주문을 취소할까요?");
    if (!shouldCancel) {
      return;
    }

    try {
      setIsCancellingOrderId(orderId);
      await updateOrderById(orderId, { status: "주문취소" });

      setAllOrders((prevOrders) =>
        prevOrders
          .map((order) => (order.orderId === orderId ? { ...order, status: "주문취소" } : order))
      );
    } catch (error) {
      if (error?.status === 401) {
        clearAuthStorage();
        navigate("/login", { replace: true });
        return;
      }

      alert(error.message || "주문 취소 중 오류가 발생했습니다.");
    } finally {
      setIsCancellingOrderId("");
    }
  };

  return (
    <main className="orders-page modern">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <section className="orders-shell modern">
        <header className="orders-title-header">
          <h1>주문 내역</h1>
        </header>

        <section className="orders-status-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`orders-status-tab ${selectedStatus === tab.value ? "active" : ""}`}
              onClick={() => setSelectedStatus(tab.value)}
            >
              {tab.label} ({statusCounts[tab.value] ?? 0})
            </button>
          ))}
        </section>

        {isLoading ? (
          <section className="orders-empty">
            <p>주문 내역을 불러오는 중입니다.</p>
          </section>
        ) : fetchError ? (
          <section className="orders-empty">
            <p>{fetchError}</p>
          </section>
        ) : orders.length === 0 ? (
          <section className="orders-empty">
            <p>주문 내역이 없습니다.</p>
            <Link to="/" className="orders-home-link">
              쇼핑하러 가기
            </Link>
          </section>
        ) : (
          <section className="orders-modern-list">
            {orders.map((order) => {
              const items = Array.isArray(order.items) ? order.items : [];
              const statusLabel = getStatusLabel(order.status);
              const statusMessage =
                statusLabel === "주문취소"
                  ? "주문이 취소되었습니다. 환불 상태는 결제수단별 처리 시간을 확인해주세요."
                  : statusLabel === "배송중"
                  ? "배송 처리 중입니다. 배송 시작 시 추적 번호를 안내드릴게요."
                  : statusLabel === "완료"
                  ? "배송이 완료된 주문입니다. 자세한 내용은 주문 상세에서 확인할 수 있습니다."
                  : "주문이 정상 처리되었습니다. 자세한 내용은 주문 상세에서 확인할 수 있습니다.";
              return (
                <article key={order.orderId} className="orders-modern-card">
                  <div className="orders-modern-head">
                    <div>
                      <strong>주문 #{order.orderId}</strong>
                      <p>주문일: {formatDate(order.orderedAt)}</p>
                    </div>
                    <div className="orders-modern-head-right">
                      <span
                        className={`orders-modern-status ${statusLabel === "배송중" ? "shipping" : ""} ${
                          statusLabel === "주문취소" ? "cancelled" : ""
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <strong>{formatPrice(order.totalPrice)}</strong>
                    </div>
                  </div>

                  <div className="orders-modern-items">
                    {items.map((item, index) => (
                      <article key={`${item.productId}-${item.size}-${item.color}-${index}`} className="orders-modern-item">
                        <img src={item.image} alt={item.name} />
                        <div>
                          <h3>{item.name}</h3>
                          <p>
                            사이즈: {item.size || "-"} · 색상: {item.color || "-"}
                          </p>
                          <p>수량: {item.quantity}</p>
                          <strong>{formatPrice(item.price)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="orders-modern-footer">
                    <p>{statusMessage}</p>
                    <div className="orders-modern-actions">
                      <Link to={`/orders/${order.orderId}`} className="order-detail-link">
                        상세보기
                      </Link>
                      {statusLabel !== "주문취소" ? (
                        <button
                          type="button"
                          className="order-cancel-btn"
                          onClick={() => cancelOrder(order.orderId)}
                          disabled={isCancellingOrderId === order.orderId}
                        >
                          {isCancellingOrderId === order.orderId ? "취소 처리중..." : "주문취소"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}

export default OrdersPage;
