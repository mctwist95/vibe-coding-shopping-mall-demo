import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const CART_STORAGE_KEY = "shopping_cart";

// 로컬 스토리지 장바구니의 총 수량을 계산한다.
function getCartItemCount() {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return 0;
    }

    return parsed.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

// 사용자 상태에 따라 상단 네비게이션을 렌더링한다.
function HomeNavbar({ currentUser, onLogout, hideLoginButton = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const menuRef = useRef(null);
  const displayName = useMemo(
    () => currentUser?.name || currentUser?.email || "사용자",
    [currentUser]
  );
  const isAdmin = currentUser?.user_type === "admin";

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    // 메뉴 외부 클릭 시 사용자 메뉴를 닫는다.
    function onDocumentClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [isMenuOpen]);

  useEffect(() => {
    setCartItemCount(getCartItemCount());

    // 다른 탭의 장바구니 변경 이벤트를 반영한다.
    function onStorage(event) {
      if (event.key === CART_STORAGE_KEY) {
        setCartItemCount(getCartItemCount());
      }
    }

    // 창 포커스 복귀 시 장바구니 수량을 갱신한다.
    function onFocus() {
      setCartItemCount(getCartItemCount());
    }

    // 같은 탭에서 장바구니가 바뀌는 경우를 반영한다.
    function onCartUpdated() {
      setCartItemCount(getCartItemCount());
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("cart-updated", onCartUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("cart-updated", onCartUpdated);
    };
  }, [currentUser]);

  // 로그아웃 처리 전 메뉴 상태를 정리한다.
  const handleLogout = () => {
    setIsMenuOpen(false);
    onLogout();
  };

  return (
    <header className="cider-nav">
      <Link to="/" className="cider-brand-link">
        <span className="cider-brand">CIDER</span>
      </Link>
      <div className="cider-nav-right">
        <Link to="/orders" className="cart-nav-btn">
          ORDERS
        </Link>
        {currentUser ? (
          <>
            {isAdmin ? (
              <Link to="/admin" className="admin-nav-btn">
                ADMIN
              </Link>
            ) : null}
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <span>{displayName}님 환영합니다</span>
                <span className="menu-caret">{isMenuOpen ? "▲" : "▼"}</span>
              </button>
              {isMenuOpen ? (
                <div className="user-menu-dropdown" role="menu">
                  <Link to="/orders" className="user-menu-item" onClick={() => setIsMenuOpen(false)}>
                    내 주문 목록
                  </Link>
                  <button type="button" className="user-menu-item" onClick={handleLogout}>
                    로그아웃
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : !hideLoginButton ? (
          <Link to="/login" className="login-nav-btn">
            로그인
          </Link>
        ) : null}
        <Link to="/cart" className="cart-icon-link" aria-label="장바구니">
          <span className="cart-icon">🛒</span>
          <span className="cart-count-badge">{cartItemCount}</span>
        </Link>
      </div>
    </header>
  );
}

export default HomeNavbar;
