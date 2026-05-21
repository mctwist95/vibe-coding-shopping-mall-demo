import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HomeNavbar from "../components/HomeNavbar";
import { getAllProducts } from "../api/products";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";
const CART_STORAGE_KEY = "shopping_cart";

const HERO_ITEMS = [
  { className: "hero-main", label: "SUMMER COLLECTION", title: "ALL NEW IN" },
  { className: "hero-mid", label: "REMIAN HAZE" },
  { className: "hero-sub", label: "THE DRESS" },
  { className: "hero-light", label: "TREND EDIT" },
];

const PROMO_ITEMS = ["NEW TOPS", "BEST BOTTOM", "OUTER", "ACC"];

const FOOTER_COLUMNS = [
  { title: "기업", rows: ["브랜드 스토리", "채용"] },
  { title: "도움말", rows: ["주문/배송", "교환/환불"] },
  { title: "고객센터", rows: ["평일 10:00 - 18:00", "support@cider.demo"] },
];

// 로컬 스토리지에 저장된 사용자 정보를 읽어온다.
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

// 홈 화면 렌더링과 사용자/상품 데이터를 관리한다.
function HomePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [products, setProducts] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  // 인증 및 장바구니 관련 로컬 데이터를 초기화한다.
  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    localStorage.removeItem("user");
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const cachedUser = getStoredUser();
    const tokenType = localStorage.getItem("token_type") || TOKEN_TYPE_FALLBACK;

    if (cachedUser) {
      setCurrentUser(cachedUser);
    }

    if (!token) {
      setCurrentUser(null);
      setIsAuthResolved(true);
      return;
    }

    const controller = new AbortController();

    // 토큰으로 현재 사용자 프로필을 조회한다.
    async function fetchMyProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: {
            Authorization: `${tokenType} ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          setCurrentUser(null);
          clearAuthStorage();
          return;
        }

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        setCurrentUser(result.data || null);
        localStorage.setItem("user", JSON.stringify(result.data || null));
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
      } finally {
        setIsAuthResolved(true);
      }
    }

    fetchMyProfile();
    return () => controller.abort();
  }, [clearAuthStorage]);

  useEffect(() => {
    let isMounted = true;

    // 홈 화면에 표시할 전체 상품 목록을 불러온다.
    async function fetchAllProducts() {
      try {
        setIsProductsLoading(true);
        setProductsError("");
        const data = await getAllProducts();

        if (!isMounted) {
          return;
        }

        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setProductsError(error.message);
      } finally {
        if (isMounted) {
          setIsProductsLoading(false);
        }
      }
    }

    fetchAllProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // 로그아웃 시 상태와 저장소를 정리하고 홈으로 이동한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [clearAuthStorage, navigate]);

  return (
    <main className="cider-home-page">
      <div className="cider-shell home-wide-shell">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />

        {!isAuthResolved ? <p className="auth-loading">인증 확인 중...</p> : null}

        <section className="hero-stack">
          {HERO_ITEMS.map((item) => (
            <article key={item.className} className={`hero-card ${item.className}`}>
              <div className="hero-label">{item.label}</div>
              {item.title ? <h1>{item.title}</h1> : null}
            </article>
          ))}
        </section>

        <section className="promo-grid">
          {PROMO_ITEMS.map((item) => (
            <div key={item} className="promo-tile">
              {item}
            </div>
          ))}
        </section>

        <section className="home-products-section">
          <div className="home-products-header">
            <h2>전체 상품</h2>
            <span>{products.length}개</span>
          </div>
          {isProductsLoading ? <p className="home-products-message">상품을 불러오는 중...</p> : null}
          {!isProductsLoading && productsError ? <p className="home-products-message error">{productsError}</p> : null}
          {!isProductsLoading && !productsError ? (
            <div className="home-products-grid">
              {products.map((product) => (
                <article
                  key={product._id || product.sku}
                  className="home-product-card clickable"
                  onClick={() => navigate(`/products/${product._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/products/${product._id}`);
                    }
                  }}
                >
                  <img src={product.image} alt={product.name} className="home-product-image" />
                  <h3>{product.name}</h3>
                  <p>{product.category}</p>
                  <strong>₩{Number(product.price || 0).toLocaleString("ko-KR")}</strong>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <footer className="cider-footer">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              {column.rows.map((row) => (
                <p key={row}>{row}</p>
              ))}
            </div>
          ))}
        </footer>
      </div>
    </main>
  );
}

export default HomePage;
