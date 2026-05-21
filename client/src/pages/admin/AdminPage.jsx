import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";

// 로컬 스토리지에서 캐시된 사용자 정보를 읽는다.
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

const STAT_CARDS = [
  { title: "주문", value: "1,234", change: "+12% from last month" },
  { title: "상품", value: "156", change: "+3% from last month" },
  { title: "고객", value: "2,345", change: "+8% from last month" },
  { title: "매출", value: "$45,678", change: "+15% from last month" },
];

const QUICK_ACTIONS = ["새 상품 등록", "주문 관리", "매출 분석", "고객 관리"];

const RECENT_ORDERS = [
  { orderNo: "ORD-001234", customer: "김민수", date: "2024-12-30", amount: "$219" },
  { orderNo: "ORD-001233", customer: "이지연", date: "2024-12-29", amount: "$156" },
  { orderNo: "ORD-001232", customer: "박서준", date: "2024-12-28", amount: "$84" },
];

const MANAGEMENT_SECTIONS = [
  {
    key: "products",
    title: "상품 관리",
    description: "상품 추가, 수정, 삭제 및 재고를 관리합니다.",
    icon: "📦",
    buttonText: "상품 관리 열기",
    onClickPath: "/admin/products",
  },
  {
    key: "orders",
    title: "주문 관리",
    description: "주문 조회, 상태 변경, 배송 처리를 관리합니다.",
    icon: "🛒",
    buttonText: "주문 관리 열기",
    onClickPath: "/admin/orders",
  },
];

// 관리자 대시보드 화면과 권한 검증을 담당한다.
function AdminPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedTokenType = localStorage.getItem("token_type");
    const tokenType = storedTokenType === "Bearer" ? storedTokenType : TOKEN_TYPE_FALLBACK;
    const cachedUser = getStoredUser();

    if (cachedUser?.user_type === "admin") {
      setCurrentUser(cachedUser);
      setIsAuthorized(true);
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    // 현재 사용자의 관리자 권한을 서버에서 확인한다.
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
          if (!cachedUser || cachedUser.user_type !== "admin") {
            navigate("/", { replace: true });
          }
          return;
        }

        const result = await response.json();
        const user = result.data || null;

        if (!user || user.user_type !== "admin") {
          navigate("/", { replace: true });
          return;
        }

        setCurrentUser(user);
        setIsAuthorized(true);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        if (!cachedUser || cachedUser.user_type !== "admin") {
          navigate("/", { replace: true });
        }
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAdminAuth();
    return () => controller.abort();
  }, [navigate]);

  const displayName = useMemo(
    () => currentUser?.name || currentUser?.email || "관리자",
    [currentUser]
  );

  if (isCheckingAuth) {
    return <main className="admin-loading">관리자 권한 확인 중...</main>;
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <AdminLayout
      variant="dashboard"
      adminName={displayName}
      greetingSuffix="님 환영합니다"
      actions={
        <>
          <Link to="/admin/products/new" className="admin-create-btn">
            + 새 상품 등록
          </Link>
          <Link to="/" className="admin-back-btn">
            쇼핑몰로 돌아가기
          </Link>
        </>
      }
    >
      <section className="admin-title-wrap">
          <h1>관리자 대시보드</h1>
          <p>CIDER 쇼핑몰 관리 시스템에 오신 것을 환영합니다.</p>
      </section>

      <section className="admin-stats-grid">
        {STAT_CARDS.map((card) => (
          <article key={card.title} className="admin-stat-card">
            <h3>{card.title}</h3>
            <strong>{card.value}</strong>
            <p>{card.change}</p>
          </article>
        ))}
      </section>

      <section className="admin-content-grid">
        <article className="admin-panel">
          <h2>빠른 작업</h2>
          <div className="admin-action-list">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={action}
                type="button"
                className={`admin-action-btn ${idx === 0 ? "primary" : ""}`}
                onClick={
                  idx === 0
                    ? () => navigate("/admin/products/new")
                    : idx === 1
                    ? () => navigate("/admin/orders")
                    : undefined
                }
              >
                {idx === 0 ? "+" : "•"} {action}
              </button>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <h2>최근 주문</h2>
          <div className="admin-order-list">
            {RECENT_ORDERS.map((order) => (
              <div key={order.orderNo} className="admin-order-row">
                <div>
                  <strong>{order.orderNo}</strong>
                  <p>{order.customer}</p>
                  <small>{order.date}</small>
                </div>
                <span>{order.amount}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-management-grid">
        {MANAGEMENT_SECTIONS.map((section) => (
          <article key={section.key} className="admin-management-card">
            <span className="admin-management-icon" aria-hidden="true">
              {section.icon}
            </span>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
            <button type="button" className="admin-management-btn" onClick={() => navigate(section.onClickPath)}>
              {section.buttonText}
            </button>
          </article>
        ))}
      </section>
    </AdminLayout>
  );
}

export default AdminPage;
