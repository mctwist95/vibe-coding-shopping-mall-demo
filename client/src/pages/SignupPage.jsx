import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser } from "../api/users";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";

const INITIAL_FORM_STATE = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  agreeTerms: false,
  agreePrivacy: false,
  agreeMarketing: false,
};

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

// 회원가입 입력과 계정 생성을 처리하는 페이지다.
function SignupPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSignupCompleted, setIsSignupCompleted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM_STATE);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedTokenType = localStorage.getItem("token_type");
    const tokenType = storedTokenType === "Bearer" ? storedTokenType : TOKEN_TYPE_FALLBACK;
    const cachedUser = getStoredUser();

    if (!token) {
      setIsAuthChecking(false);
      return;
    }

    if (cachedUser) {
      navigate("/", { replace: true });
      return;
    }

    const controller = new AbortController();

    // 토큰이 유효한 경우 기존 로그인 상태를 확인한다.
    async function checkMyProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: {
            Authorization: `${tokenType} ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          clearAuthStorage();
          return;
        }

        if (response.ok) {
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        // Keep auth state on transient/network errors.
      } finally {
        setIsAuthChecking(false);
      }
    }

    checkMyProfile();
    return () => controller.abort();
  }, [navigate]);

  const isAllAgree = useMemo(() => {
    return form.agreeTerms && form.agreePrivacy && form.agreeMarketing;
  }, [form.agreeTerms, form.agreePrivacy, form.agreeMarketing]);

  // 텍스트 입력값을 회원가입 폼 상태에 반영한다.
  const onInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 개별 약관 동의 체크 상태를 반영한다.
  const onCheckboxChange = (event) => {
    const { name, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  // 전체 동의 체크에 맞춰 모든 약관 동의 상태를 변경한다.
  const onAllAgreeChange = (event) => {
    const { checked } = event.target;
    setForm((prev) => ({
      ...prev,
      agreeTerms: checked,
      agreePrivacy: checked,
      agreeMarketing: checked,
    }));
  };

  // 회원가입 폼을 초기 상태로 되돌린다.
  const resetFormState = () => {
    setForm(INITIAL_FORM_STATE);
  };

  // 입력값 검증 후 회원가입 요청을 전송한다.
  const onSubmitSignup = async (event) => {
    event.preventDefault();
    setSubmitMessage("");
    setSubmitError("");

    if (!form.name.trim()) {
      setSubmitError("이름을 입력해주세요.");
      return;
    }

    if (!form.email.trim()) {
      setSubmitError("이메일을 입력해주세요.");
      return;
    }

    if (!form.password.trim()) {
      setSubmitError("비밀번호를 입력해주세요.");
      return;
    }

    if (form.password.length < 8) {
      setSubmitError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setSubmitError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!form.agreeTerms || !form.agreePrivacy) {
      setSubmitError("필수 약관에 동의해주세요.");
      return;
    }

    const payload = {
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
      password: form.password,
    };

    try {
      setIsSubmitting(true);
      await createUser(payload);

      setSubmitMessage("회원가입이 완료되었습니다.");
      setIsSignupCompleted(true);
      resetFormState();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthChecking) {
    return null;
  }

  return (
    <main className="signup-page">
      <section className="signup-card">
        <button type="button" className="back-link" onClick={() => navigate("/")}>
          ← 메인으로
        </button>
        <h1>회원가입</h1>
        <p className="subtitle">새로운 계정을 만들어 쇼핑을 시작하세요</p>

        {isSignupCompleted ? (
          <section className="signup-complete-section">
            <p className="message success">회원가입을 환영합니다. CIDER에서 즐거운 쇼핑 되세요!</p>
            <button type="button" className="primary-btn submit-btn" onClick={() => navigate("/login")}>
              로그인 페이지로 이동
            </button>
          </section>
        ) : (
          <form className="signup-form" onSubmit={onSubmitSignup}>
            <label>
              이름
              <input name="name" value={form.name} onChange={onInputChange} placeholder="이름" required />
            </label>

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
              <small>8자 이상 입력해주세요.</small>
            </label>

            <label>
              비밀번호 확인
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={onInputChange}
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </label>

            <div className="agreement-box">
              <label className="check-row all">
                <input type="checkbox" checked={isAllAgree} onChange={onAllAgreeChange} />
                전체 동의
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={form.agreeTerms}
                  onChange={onCheckboxChange}
                />
                이용약관 동의 (필수)
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="agreePrivacy"
                  checked={form.agreePrivacy}
                  onChange={onCheckboxChange}
                />
                개인정보처리방침 동의 (필수)
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="agreeMarketing"
                  checked={form.agreeMarketing}
                  onChange={onCheckboxChange}
                />
                마케팅 정보 수신 동의 (선택)
              </label>
            </div>

            {submitError ? <p className="message error">{submitError}</p> : null}
            {submitMessage ? <p className="message success">{submitMessage}</p> : null}

            <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
              {isSubmitting ? "가입 처리중..." : "회원가입"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default SignupPage;
