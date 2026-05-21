import { Link, useNavigate } from "react-router-dom";

// 관리자 페이지 공통 상단 바와 컨텐츠 래퍼를 렌더링한다.
function AdminLayout({
  variant = "subpage",
  title = "",
  backPath = "/admin",
  adminName = "관리자",
  greetingSuffix = "님",
  actions = null,
  children,
}) {
  const navigate = useNavigate();

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-left">
            {variant === "dashboard" ? (
              <>
                <Link to="/" className="admin-brand">
                  CIDER
                </Link>
                <span className="admin-chip">ADMIN</span>
              </>
            ) : (
              <>
                <button type="button" className="admin-back-icon-btn" onClick={() => navigate(backPath)}>
                  ←
                </button>
                <span className="admin-page-title">{title}</span>
              </>
            )}
          </div>
          <div className="admin-right">
            <span className="admin-greeting">
              {adminName}
              {greetingSuffix}
            </span>
            {actions}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export default AdminLayout;
