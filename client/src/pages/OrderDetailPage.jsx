import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import HomeNavbar from "../components/HomeNavbar";
import { getOrderById } from "../api/orders";

// 로컬 스토리지에서 캐시된 사용자 정보를 읽어온다.
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

// 금액을 원화 표시 문자열로 변환한다.
function formatPrice(price) {
  return `₩${Number(price || 0).toLocaleString("ko-KR")}`;
}

// 날짜 값을 한국어 로캘 문자열로 포맷한다.
function formatDate(value) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return "-";
  }
}

// 단일 주문의 상세 정보를 조회하고 표시한다.
function OrderDetailPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

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

    // 주문 ID로 상세 주문 정보를 가져온다.
    async function fetchOrderDetail() {
      try {
        const data = await getOrderById(orderId);
        if (isMounted) {
          setOrder(data);
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

        if (error?.status === 404) {
          setOrder(null);
          return;
        }

        setFetchError(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrderDetail();
    return () => {
      isMounted = false;
    };
  }, [navigate, orderId]);

  if (isLoading) {
    return (
      <main className="order-detail-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-detail-shell">
          <h1>주문 정보를 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="order-detail-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-detail-shell">
          <h1>{fetchError}</h1>
          <Link to="/orders" className="order-detail-back-link">
            주문내역으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="order-detail-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-detail-shell">
          <h1>주문 정보를 찾을 수 없습니다.</h1>
          <Link to="/orders" className="order-detail-back-link">
            주문내역으로 이동
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="order-detail-page">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <section className="order-detail-shell">
        <header className="order-detail-topbar">
          <button type="button" className="order-detail-back-btn" onClick={() => navigate(-1)}>
            ← 이전
          </button>
          <h1>{order.orderId}</h1>
          <Link to="/orders" className="order-detail-back-link">
            주문목록
          </Link>
        </header>

        <div className="order-detail-summary">
          <p>주문자: {order.customerName || "-"}</p>
          <p>이메일: {order.customerEmail || "-"}</p>
          <p>주문일시: {formatDate(order.orderedAt)}</p>
          <p>상태: {order.status || "결제완료"}</p>
          <p>총 수량: {order.totalQuantity || 0}개</p>
          <p>결제금액: {formatPrice(order.totalPrice)}</p>
        </div>

        <div className="order-detail-items">
          {order.items?.map((item) => (
            <article key={`${item.productId}-${item.size}-${item.color}`} className="order-detail-item-card">
              <img src={item.image} alt={item.name} />
              <div>
                <h2>{item.name}</h2>
                <p>SKU: {item.sku || "-"}</p>
                <p>옵션: {item.size} / {item.quantity}개</p>
              </div>
              <strong>{formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default OrderDetailPage;
