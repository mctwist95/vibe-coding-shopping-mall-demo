import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder, getOrderPaymentReady } from "../api/orders";
import HomeNavbar from "../components/HomeNavbar";

const CART_STORAGE_KEY = "shopping_cart";
const PORTONE_MERCHANT_CODE = "imp05107206";

// 로컬 스토리지에서 장바구니 목록을 읽어온다.
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
  window.dispatchEvent(new CustomEvent("cart-updated"));
}

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

// 전체 이름을 이름/성 형태로 분리한다.
function splitName(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
}

// 금액을 원화 표시 문자열로 포맷한다.
function formatPrice(price) {
  return `₩${Number(price || 0).toLocaleString("ko-KR")}`;
}

// 포트원 결제 모듈을 Promise 형태로 호출한다.
function requestPortonePayment(paymentPayload) {
  return new Promise((resolve, reject) => {
    if (!window.IMP || typeof window.IMP.request_pay !== "function") {
      reject(new Error("포트원 결제 모듈이 준비되지 않았습니다."));
      return;
    }

    window.IMP.request_pay(paymentPayload, (response) => {
      if (response?.success) {
        resolve(response);
        return;
      }

      reject(new Error(response?.error_msg || "결제가 취소되었거나 실패했습니다."));
    });
  });
}

// 결제 정보 입력과 주문 생성을 처리하는 페이지 컴포넌트다.
function CheckoutPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [cartItems, setCartItems] = useState([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const nameParts = useMemo(() => splitName(currentUser?.name || ""), [currentUser?.name]);
  const [form, setForm] = useState({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: currentUser?.email || "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
  });

  // 로그아웃 시 인증 상태를 정리하고 홈으로 이동한다.
  const onLogout = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setCartItems(readCartItems());

    // 스토리지 변경 시 장바구니 상태를 다시 불러온다.
    function onStorage(event) {
      if (event.key === CART_STORAGE_KEY) {
        setCartItems(readCartItems());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!window.IMP || typeof window.IMP.init !== "function") {
      setErrorMessage("포트원 결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.");
      return;
    }

    window.IMP.init(PORTONE_MERCHANT_CODE);
  }, []);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems]
  );
  const tax = useMemo(() => Math.round(subtotal * 0.08), [subtotal]);
  const shipping = 0;
  const totalPrice = subtotal + tax + shipping;
  const totalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cartItems]
  );

  // 입력 필드 변경값을 결제 폼 상태에 반영한다.
  const onInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 결제 검증 후 결제 모듈 호출과 주문 생성을 수행한다.
  const placeOrder = async () => {
    if (cartItems.length === 0) {
      setErrorMessage("장바구니가 비어있습니다.");
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErrorMessage("이름과 성을 입력해주세요.");
      return;
    }
    if (!form.email.trim()) {
      setErrorMessage("이메일을 입력해주세요.");
      return;
    }
    if (!form.phone.trim()) {
      setErrorMessage("전화번호를 입력해주세요.");
      return;
    }
    if (!form.address.trim() || !form.city.trim() || !form.zipCode.trim()) {
      setErrorMessage("주소, 도시, 우편번호를 입력해주세요.");
      return;
    }

    const orderId = `ORD-${Date.now()}`;
    const merchantUid = `merchant_${orderId}_${Date.now()}`;
    const orderPayload = {
      orderId,
      customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      customerEmail: form.email.trim().toLowerCase(),
      status: "결제완료",
      totalQuantity,
      subtotal,
      tax,
      shipping,
      totalPrice,
      items: cartItems,
      orderedAt: new Date().toISOString(),
    };

    try {
      setIsPlacingOrder(true);
      setErrorMessage("");
      const paymentReady = await getOrderPaymentReady();
      if (!paymentReady?.ready) {
        setErrorMessage(paymentReady?.message || "결제 설정이 준비되지 않았습니다. 관리자에게 문의해주세요.");
        return;
      }

      const paymentResult = await requestPortonePayment({
        pg: "html5_inicis.INIpayTest",
        pay_method: "card",
        merchant_uid: merchantUid,
        name: cartItems[0]?.name ? `${cartItems[0].name} 외 ${Math.max(cartItems.length - 1, 0)}건` : "주문 결제",
        amount: totalPrice,
        buyer_email: orderPayload.customerEmail,
        buyer_name: orderPayload.customerName,
        buyer_tel: form.phone.trim(),
        buyer_addr: form.address.trim(),
        buyer_postcode: form.zipCode.trim(),
      });

      const createdOrder = await createOrder({
        ...orderPayload,
        payment: {
          impUid: paymentResult.imp_uid,
          merchantUid: paymentResult.merchant_uid,
          paidAmount: Number(paymentResult.paid_amount || totalPrice),
          status: paymentResult.status || "paid",
          payMethod: paymentResult.pay_method || null,
          pgProvider: paymentResult.pg_provider || null,
          receiptUrl: paymentResult.receipt_url || null,
          paidAt: paymentResult.paid_at ? new Date(paymentResult.paid_at * 1000).toISOString() : new Date().toISOString(),
          raw: paymentResult,
        },
      });
      writeCartItems([]);
      setCartItems([]);
      navigate(`/orders/${orderId}/complete`, {
        state: {
          order: createdOrder || orderPayload,
          orderResult: "success",
        },
      });
    } catch (error) {
      if (error?.status === 401) {
        clearAuthStorage();
        navigate("/login", { replace: true });
        return;
      }

      const failedMessage = error.message || "주문 처리 중 오류가 발생했습니다.";
      setErrorMessage(failedMessage);
      navigate(`/orders/${orderId}/complete`, {
        state: {
          order: orderPayload,
          orderResult: "failed",
          errorMessage: failedMessage,
        },
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
        <section className="checkout-empty-card">
          <h1>결제할 상품이 없습니다.</h1>
          <Link to="/cart" className="checkout-back-link">
            장바구니로 이동
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <HomeNavbar currentUser={currentUser} onLogout={onLogout} />
      <div className="checkout-shell">
        <header className="checkout-header">
          <button type="button" className="checkout-back-btn" onClick={() => navigate("/cart")}>
            ←
          </button>
          <h1>Checkout</h1>
          <span />
        </header>

        <div className="checkout-stepper">
          <span className="active">1 Shipping</span>
          <span>2 Payment</span>
          <span>3 Review</span>
        </div>

        <section className="checkout-layout">
          <div className="checkout-form-card">
            <h2>Shipping Information</h2>
            <div className="checkout-form-grid">
              <label>
                First Name
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={onInputChange}
                  placeholder="John"
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last Name
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={onInputChange}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </label>
              <label className="full">
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onInputChange}
                  placeholder="john@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="full">
                Phone Number
                <input
                  name="phone"
                  value={form.phone}
                  onChange={onInputChange}
                  placeholder="+82 10-0000-0000"
                  autoComplete="tel"
                />
              </label>
              <label className="full">
                Address
                <input
                  name="address"
                  value={form.address}
                  onChange={onInputChange}
                  placeholder="123 Main Street"
                  autoComplete="street-address"
                />
              </label>
              <label>
                City
                <input name="city" value={form.city} onChange={onInputChange} placeholder="Seoul" autoComplete="address-level2" />
              </label>
              <label>
                ZIP Code
                <input
                  name="zipCode"
                  value={form.zipCode}
                  onChange={onInputChange}
                  placeholder="10001"
                  autoComplete="postal-code"
                />
              </label>
            </div>
          </div>

          <aside className="checkout-summary-card">
            <h2>Order Summary</h2>
            <div className="checkout-summary-items">
              {cartItems.map((item, index) => (
                <article key={`${item.productId}-${item.size}-${item.color}-${index}`} className="checkout-summary-item">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.size || "-"} / {item.quantity}개
                    </p>
                    <strong>{formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                  </div>
                </article>
              ))}
            </div>

            <div className="checkout-price-lines">
              <p>
                <span>Subtotal ({totalQuantity} items)</span>
                <strong>{formatPrice(subtotal)}</strong>
              </p>
              <p>
                <span>Shipping</span>
                <strong>{shipping === 0 ? "FREE" : formatPrice(shipping)}</strong>
              </p>
              <p>
                <span>Tax</span>
                <strong>{formatPrice(tax)}</strong>
              </p>
              <p className="checkout-total-line">
                <span>Total</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </p>
            </div>

            {errorMessage ? <p className="checkout-error-message">{errorMessage}</p> : null}

            <button type="button" className="checkout-place-order-btn" onClick={placeOrder} disabled={isPlacingOrder}>
              {isPlacingOrder ? "PROCESSING..." : "PLACE ORDER"}
            </button>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default CheckoutPage;
