import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import HomeNavbar from "../components/HomeNavbar";

const INITIAL_FORM_STATE = {
  email: "",
  password: "",
};

// 로그인 입력과 인증 요청을 처리하는 페이지 컴포넌트다.
function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  // 입력 필드 값을 로그인 폼 상태에 반영한다.
  const onInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 로그인 요청을 전송하고 결과에 따라 이동한다.
  const onSubmitLogin = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    if (!form.email.trim()) {
      setSubmitError("이메일을 입력해주세요.");
      return;
    }

    if (!form.password.trim()) {
      setSubmitError("비밀번호를 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      localStorage.setItem("access_token", result.data.access_token);
      localStorage.setItem("token_type", result.data.token_type);
      localStorage.setItem("user", JSON.stringify(result.data.user));

      setForm(INITIAL_FORM_STATE);
      if (result.data.user?.user_type === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="cider-home-page">
      <div className="cider-shell">
        <HomeNavbar currentUser={null} onLogout={() => {}} hideLoginButton />
        <section className="auth-shell-content">
          <section className="signup-card login-card">
            <button type="button" className="back-link" onClick={() => navigate("/")}>
              ← 메인으로
            </button>
            <h1>로그인</h1>
            <p className="subtitle">이메일과 비밀번호를 입력해주세요</p>

            <form className="signup-form" onSubmit={onSubmitLogin}>
              <label>
                이메일
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onInputChange}
                  placeholder="your@email.com"
                  required
                />
              </label>

              <label>
                비밀번호
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onInputChange}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </label>

              {submitError ? <p className="message error">{submitError}</p> : null}
              {submitMessage ? <p className="message success">{submitMessage}</p> : null}

              <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "로그인 처리중..." : "로그인"}
              </button>
            </form>

            <p className="auth-switch-text">
              아직 회원이 아니신가요? <Link to="/signup">회원가입</Link>
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
