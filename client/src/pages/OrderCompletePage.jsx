import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getOrderById } from "../api/orders";
import HomeNavbar from "../components/HomeNavbar";

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

// 주문 날짜를 읽기 쉬운 형식으로 변환한다.
function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

// 주문 완료 화면에서 주문 정보를 조회해 보여준다.
function OrderCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const initialOrder = location.state?.order || null;
  const initialResult = location.state?.orderResult || "success";
  const initialErrorMessage = location.state?.errorMessage || "";
  const [order, setOrder] = useState(initialOrder);
  const [orderResult, setOrderResult] = useState(initialResult);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(!initialOrder && initialResult !== "failed");
  const [fetchError, setFetchError] = useState("");

  // 로그아웃 시 인증 상태를 정리하고 홈으로 이동한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (initialOrder || initialResult === "failed" || !orderId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setFetchError("");

    // 주문 ID로 완료된 주문 정보를 조회한다.
    async function fetchOrder() {
      try {
        const fetchedOrder = await getOrderById(orderId);
        if (isMounted) {
          setOrder(fetchedOrder);
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
          setOrderResult("failed");
          setErrorMessage("주문 정보를 찾을 수 없습니다.");
          return;
        }

        setFetchError(error.message || "주문 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [initialOrder, navigate, orderId]);

  if (isLoading) {
    return (
      <main className="order-complete-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-complete-card">
          <h1>주문 정보를 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="order-complete-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-complete-card">
          <h1>{fetchError}</h1>
          <Link to="/orders" className="order-complete-cart-btn">
            주문내역 보기
          </Link>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="order-complete-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="order-complete-card">
          <h1>{orderResult === "failed" ? "주문 처리에 실패했습니다." : "주문 정보를 찾을 수 없습니다."}</h1>
          {errorMessage ? <p>{errorMessage}</p> : null}
          <button type="button" className="order-complete-home-btn" onClick={() => navigate("/")}>
            홈으로 이동
          </button>
        </section>
      </main>
    );
  }

  const isSuccess = orderResult !== "failed";
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const titleText = isSuccess ? "주문이 성공적으로 완료되었습니다!" : "주문 처리에 실패했습니다.";
  const descriptionText = isSuccess
    ? "주문해 주셔서 감사합니다. 주문 확인 이메일을 곧 보내드릴게요."
    : errorMessage || "결제 또는 주문 생성 중 오류가 발생했습니다. 다시 시도해주세요.";

  return (
    <main className="order-complete-page">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <section className="order-complete-card">
        <p className="order-confirmation-label">Order Confirmation</p>
        <div className={`order-complete-icon ${isSuccess ? "success" : "failed"}`}>{isSuccess ? "✓" : "!"}</div>
        <h1>{titleText}</h1>
        <p className="order-confirmation-desc">{descriptionText}</p>

        <div className="order-confirmation-panel">
          <div className="order-confirmation-meta">
            <div>
              <small>주문 번호</small>
              <strong>{order.orderId}</strong>
            </div>
            <div>
              <small>주문 날짜</small>
              <strong>{formatDate(order.orderedAt)}</strong>
            </div>
          </div>

          <div className="order-items">
            {orderItems.map((item, index) => (
              <article key={`${item.productId}-${item.size}-${item.color}-${index}`} className="order-item-row">
                <img src={item.image} alt={item.name} />
                <div>
                  <h2>{item.name}</h2>
                  <p>
                    사이즈: {item.size || "-"} / 수량: {item.quantity}
                  </p>
                </div>
                <strong>{formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
              </article>
            ))}
          </div>

          <p className="order-confirmation-total">
            주문 금액
            <strong>{formatPrice(order.totalPrice)}</strong>
          </p>
        </div>

        <div className="order-complete-actions">
          <Link to="/orders" className="order-complete-cart-btn">주문 목록 보기</Link>
          <Link to="/" className="order-complete-home-btn">
            쇼핑 계속하기
          </Link>
          <Link to="/cart" className="order-complete-cart-btn">
            장바구니 보기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default OrderCompletePage;
