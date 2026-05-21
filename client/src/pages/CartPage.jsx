import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HomeNavbar from "../components/HomeNavbar";

const CART_STORAGE_KEY = "shopping_cart";

// 로컬 스토리지에 저장된 로그인 사용자 정보를 반환한다.
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

// 인증 관련 로컬 스토리지 값을 모두 제거한다.
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("user");
}

// 로컬 스토리지에서 장바구니 항목을 읽어온다.
function readCartItems() {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 장바구니 항목을 로컬 스토리지에 저장한다.
function writeCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-updated"));
}

// 금액을 원화 문자열로 포맷한다.
function formatPrice(price) {
  return `₩${Number(price || 0).toLocaleString("ko-KR")}`;
}

// 장바구니 목록 조회, 수량 변경, 삭제를 처리한다.
function CartPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [cartItems, setCartItems] = useState([]);
  const [message, setMessage] = useState("");

  // 로그아웃 처리 후 홈으로 이동한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setCartItems(readCartItems());

    // 스토리지 이벤트를 감지해 장바구니 상태를 동기화한다.
    function onStorage(event) {
      if (event.key === CART_STORAGE_KEY) {
        setCartItems(readCartItems());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const totalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cartItems]
  );

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems]
  );

  // 특정 장바구니 항목의 수량을 변경한다.
  const updateQuantity = (targetItem, nextQuantity) => {
    if (nextQuantity < 1) {
      return;
    }

    const nextItems = cartItems.map((item) => {
      const isTarget =
        item.productId === targetItem.productId && item.size === targetItem.size && item.color === targetItem.color;

      return isTarget ? { ...item, quantity: nextQuantity } : item;
    });

    setCartItems(nextItems);
    writeCartItems(nextItems);
  };

  // 선택한 항목을 장바구니에서 제거한다.
  const removeItem = (targetItem) => {
    const nextItems = cartItems.filter(
      (item) =>
        !(
          item.productId === targetItem.productId &&
          item.size === targetItem.size &&
          item.color === targetItem.color
        )
    );
    setCartItems(nextItems);
    writeCartItems(nextItems);
    setMessage("상품을 장바구니에서 삭제했습니다.");
  };

  // 장바구니 전체 항목을 비운다.
  const clearCart = () => {
    setCartItems([]);
    writeCartItems([]);
    setMessage("장바구니를 비웠습니다.");
  };

  return (
    <main className="cart-page">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <div className="cart-shell">
        <header className="cart-topbar">
          <button type="button" className="cart-back-btn" onClick={() => navigate(-1)}>
            ←
          </button>
          <h1>장바구니</h1>
          <Link to="/" className="cart-home-link">
            홈
          </Link>
        </header>

        <section className="cart-summary-card">
          <div>
            <strong>총 수량</strong>
            <p>{totalQuantity}개</p>
          </div>
          <div>
            <strong>총 결제금액</strong>
            <p>{formatPrice(totalPrice)}</p>
          </div>
          <button type="button" className="cart-clear-btn" onClick={clearCart} disabled={cartItems.length === 0}>
            전체 비우기
          </button>
        </section>
        <button
          type="button"
          className="cart-checkout-btn"
          onClick={() => navigate("/checkout")}
          disabled={cartItems.length === 0}
        >
          {`결제하기 (${formatPrice(totalPrice)})`}
        </button>

        {message ? <p className="cart-message">{message}</p> : null}

        {cartItems.length === 0 ? (
          <section className="cart-empty">
            <p>장바구니가 비어있습니다.</p>
            <Link to="/" className="cart-shop-btn">
              쇼핑 계속하기
            </Link>
          </section>
        ) : (
          <section className="cart-list">
            {cartItems.map((item) => (
              <article key={`${item.productId}-${item.size}-${item.color}`} className="cart-item-card">
                <img src={item.image} alt={item.name} className="cart-item-image" />
                <div className="cart-item-body">
                  <h2>{item.name}</h2>
                  <p>SKU: {item.sku || "-"}</p>
                  <p>
                    옵션: {item.size} /{" "}
                    <span className="cart-color-dot" style={{ backgroundColor: item.color }} />
                  </p>
                  <strong>{formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-qty-control">
                    <button type="button" onClick={() => updateQuantity(item, Number(item.quantity || 0) - 1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item, Number(item.quantity || 0) + 1)}>
                      +
                    </button>
                  </div>
                  <button type="button" className="cart-remove-btn" onClick={() => removeItem(item)}>
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default CartPage;
