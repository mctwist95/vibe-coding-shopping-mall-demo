import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProductById } from "../api/products";
import HomeNavbar from "../components/HomeNavbar";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"];
const COLOR_OPTIONS = ["#5B8DFF", "#111111", "#A5D8FF"];
const CART_STORAGE_KEY = "shopping_cart";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";

// 로컬 스토리지에서 저장된 사용자 정보를 읽는다.
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

// 로컬 스토리지의 장바구니 목록을 반환한다.
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

// 장바구니 목록을 로컬 스토리지에 저장한다.
function writeCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

// 상품 상세 조회와 장바구니 담기 동작을 처리한다.
function ProductDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [currentUser, setCurrentUser] = useState(null);
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [quantity, setQuantity] = useState(1);
  const [cartMessage, setCartMessage] = useState("");
  const [cartMessageType, setCartMessageType] = useState("success");

  // 인증 및 장바구니 관련 로컬 저장값을 초기화한다.
  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    localStorage.removeItem("user");
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const tokenType = localStorage.getItem("token_type") || TOKEN_TYPE_FALLBACK;
    const cachedUser = getStoredUser();

    if (cachedUser) {
      setCurrentUser(cachedUser);
    }

    if (!token) {
      setCurrentUser(null);
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
      }
    }

    fetchMyProfile();
    return () => controller.abort();
  }, [clearAuthStorage]);

  // 로그아웃 시 저장소와 사용자 상태를 정리한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [clearAuthStorage, navigate]);

  useEffect(() => {
    let isMounted = true;

    // URL 파라미터 ID로 상품 상세를 불러온다.
    async function fetchProductDetail() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const data = await getProductById(id);

        if (!isMounted) {
          return;
        }

        setProduct(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProductDetail();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const basePrice = Number(product?.price || 0);
  const originalPrice = useMemo(() => Math.round(basePrice * 1.34), [basePrice]);
  const totalPrice = useMemo(() => basePrice * quantity, [basePrice, quantity]);

  // 선택 옵션 기준으로 장바구니에 상품을 추가한다.
  const onAddToBag = () => {
    if (!product?._id) {
      setCartMessageType("error");
      setCartMessage("장바구니에 담을 수 없는 상품입니다.");
      return;
    }

    const nextItem = {
      productId: product._id,
      sku: product.sku,
      name: product.name,
      image: product.image,
      price: basePrice,
      category: product.category,
      size: selectedSize,
      color: selectedColor,
      quantity,
      addedAt: new Date().toISOString(),
    };

    const currentItems = readCartItems();
    const duplicatedIndex = currentItems.findIndex(
      (item) => item.productId === nextItem.productId && item.size === nextItem.size && item.color === nextItem.color
    );

    if (duplicatedIndex >= 0) {
      const updatedItems = [...currentItems];
      updatedItems[duplicatedIndex] = {
        ...updatedItems[duplicatedIndex],
        quantity: Number(updatedItems[duplicatedIndex].quantity || 0) + quantity,
      };
      writeCartItems(updatedItems);
    } else {
      writeCartItems([...currentItems, nextItem]);
    }

    setCartMessageType("success");
    setCartMessage("장바구니에 상품을 담았습니다.");
  };

  if (isLoading) {
    return <main className="product-detail-loading">상품 정보를 불러오는 중...</main>;
  }

  if (errorMessage) {
    return (
      <main className="product-detail-loading error">
        <p>{errorMessage}</p>
        <button type="button" className="product-detail-back-btn" onClick={() => navigate(-1)}>
          이전으로
        </button>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-loading error">
        <p>상품 정보를 찾을 수 없습니다.</p>
        <button type="button" className="product-detail-back-btn" onClick={() => navigate(-1)}>
          이전으로
        </button>
      </main>
    );
  }

  return (
    <main className="product-detail-page">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <header className="product-detail-topbar">
        <button type="button" className="product-detail-icon-btn" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1>{product.name}</h1>
        <div className="product-detail-top-actions">
          <button type="button" className="product-detail-icon-btn" aria-label="share">
            ↗
          </button>
          <button type="button" className="product-detail-icon-btn" aria-label="wishlist">
            ♡
          </button>
        </div>
      </header>

      <section className="product-detail-layout">
        <div className="product-detail-image-wrap">
          <img src={product.image} alt={product.name} className="product-detail-image" />
        </div>

        <div className="product-detail-info">
          <div className="product-detail-badges">
            <span className="badge new">NEW</span>
            <span className="badge sale">SALE</span>
          </div>

          <h2>{product.name}</h2>
          <p className="product-detail-rating">⭐ 4.8 (124 reviews)</p>

          <div className="product-detail-price-row">
            <strong>₩{basePrice.toLocaleString("ko-KR")}</strong>
            <del>₩{originalPrice.toLocaleString("ko-KR")}</del>
            <span className="discount-chip">26% OFF</span>
          </div>

          <div className="detail-option-block">
            <h3>Size</h3>
            <div className="size-selector">
              {SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`size-btn ${selectedSize === size ? "active" : ""}`}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="detail-option-block">
            <h3>Color</h3>
            <div className="color-selector">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${selectedColor === color ? "active" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`color-${color}`}
                />
              ))}
            </div>
          </div>

          <div className="detail-option-block">
            <h3>Quantity</h3>
            <div className="quantity-row">
              <div className="qty-control">
                <button type="button" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}>
                  -
                </button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((prev) => prev + 1)}>
                  +
                </button>
              </div>
              <small>Only 5 left in stock</small>
            </div>
          </div>

          <button type="button" className="detail-primary-btn" onClick={onAddToBag}>
            ADD TO BAG - ₩{totalPrice.toLocaleString("ko-KR")}
          </button>
          {cartMessage ? <p className={`product-detail-cart-message ${cartMessageType}`}>{cartMessage}</p> : null}
          {cartMessageType === "success" && cartMessage ? (
            <button type="button" className="detail-secondary-btn" onClick={() => navigate("/cart")}>
              GO TO CART
            </button>
          ) : null}
          <button type="button" className="detail-secondary-btn">
            ADD TO WISHLIST
          </button>

          {product.description ? <p className="product-detail-description">{product.description}</p> : null}
        </div>
      </section>
    </main>
  );
}

export default ProductDetailPage;
