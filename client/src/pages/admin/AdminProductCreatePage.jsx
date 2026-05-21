import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProduct } from "../../api/products";
import AdminLayout from "./AdminLayout";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";
const CATEGORY_OPTIONS = ["상의", "하의", "악세사리"];

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

// 인증 관련 로컬 스토리지 데이터를 제거한다.
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("user");
}

const INITIAL_FORM = {
  sku: "",
  name: "",
  price: "",
  category: "",
  image: "",
  description: "",
};

// 관리자 상품 등록 폼을 제공하는 페이지 컴포넌트다.
function AdminProductCreatePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedTokenType = localStorage.getItem("token_type");
    const tokenType = storedTokenType === "Bearer" ? storedTokenType : TOKEN_TYPE_FALLBACK;
    const cachedUser = getStoredUser();

    if (cachedUser?.user_type === "admin") {
      setCurrentUser(cachedUser);
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    // 로그인 사용자에게 관리자 권한이 있는지 확인한다.
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

  const adminName = useMemo(
    () => currentUser?.name || currentUser?.email || "관리자",
    [currentUser]
  );

  const widgetRef = useRef(null);

  // Cloudinary 업로드 위젯을 열어 상품 이미지를 선택한다.
  const openCloudinaryWidget = useCallback(() => {
    setSubmitError("");

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setSubmitError("Cloudinary 설정이 필요합니다. 환경변수를 확인해주세요.");
      return;
    }

    if (!window.cloudinary?.createUploadWidget) {
      setSubmitError("Cloudinary 위젯 스크립트를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }

    if (widgetRef.current) {
      widgetRef.current.open();
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ["local", "url", "camera"],
        multiple: false,
        maxFiles: 1,
        cropping: true,
        croppingAspectRatio: 1,
        resourceType: "image",
      },
      (error, result) => {
        if (error) {
          const detailedMessage =
            error?.statusText || error?.message || error?.error?.message || "이미지 업로드 중 오류가 발생했습니다.";
          setSubmitError(detailedMessage);
          return;
        }
        if (result.event === "success") {
          const secureUrl = result.info.secure_url;
          setForm((prev) => ({ ...prev, image: secureUrl }));
        }
      }
    );

    widgetRef.current = widget;
    widget.open();
  }, []);

  // 등록 폼 입력값을 상태에 반영한다.
  const onInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 입력값을 검증한 뒤 상품 등록 API를 호출한다.
  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    if (!form.sku.trim() || !form.name.trim() || !form.image.trim()) {
      setSubmitError("sku, 상품명, 이미지는 필수입니다.");
      return;
    }

    const numericPrice = Number(form.price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setSubmitError("상품가격은 0 이상의 숫자여야 합니다.");
      return;
    }

    if (!CATEGORY_OPTIONS.includes(form.category)) {
      setSubmitError("카테고리를 선택해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        price: numericPrice,
        category: form.category,
        image: form.image.trim(),
        description: form.description.trim() || null,
      });

      setSubmitMessage("상품이 등록되었습니다.");
      setForm(INITIAL_FORM);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return <main className="admin-loading">관리자 권한 확인 중...</main>;
  }

  return (
    <AdminLayout
      title="상품 관리"
      backPath="/admin/products"
      adminName={adminName}
      actions={
        <button type="button" className="admin-create-btn" disabled>
          + 새 상품 등록
        </button>
      }
    >
      <div className="admin-tabs">
          <Link to="/admin/products" className="admin-tab">
            상품 목록
          </Link>
          <span className="admin-tab active">상품 등록</span>
      </div>

      <section className="product-form-panel">
          <h1>새 상품 등록</h1>
          <form className="product-form-grid" onSubmit={onSubmit}>
            <label>
              SKU
              <input name="sku" value={form.sku} onChange={onInputChange} placeholder="상품 SKU를 입력하세요" />
            </label>

            <label>
              상품명
              <input
                name="name"
                value={form.name}
                onChange={onInputChange}
                placeholder="상품명을 입력하세요"
              />
            </label>

            <label>
              상품 가격
              <input
                type="number"
                min="0"
                name="price"
                value={form.price}
                onChange={onInputChange}
                placeholder="0"
              />
            </label>

            <label>
              카테고리
              <select name="category" value={form.category} onChange={onInputChange}>
                <option value="">카테고리 선택</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-span-2 image-upload-section">
              <span className="image-upload-label">메인 이미지</span>
              <div className="image-upload-area">
                {form.image ? (
                  <div className="image-preview-wrapper">
                    <img src={form.image} alt="상품 미리보기" className="image-preview" />
                    <button
                      type="button"
                      className="image-remove-btn"
                      onClick={() => setForm((prev) => ({ ...prev, image: "" }))}
                    >
                      ✕ 삭제
                    </button>
                  </div>
                ) : (
                  <button type="button" className="image-upload-btn" onClick={openCloudinaryWidget}>
                    <span className="upload-icon">📷</span>
                    <span>이미지 업로드</span>
                    <small>클릭하여 이미지를 선택하세요</small>
                  </button>
                )}
              </div>
              {form.image && (
                <button type="button" className="image-change-btn" onClick={openCloudinaryWidget}>
                  이미지 변경
                </button>
              )}
            </div>

            <label className="form-span-2">
              상품 설명 (선택)
              <textarea
                name="description"
                value={form.description}
                onChange={onInputChange}
                placeholder="상품에 대한 자세한 설명을 입력하세요"
                rows={5}
              />
            </label>

            {submitError ? <p className="message error form-span-2">{submitError}</p> : null}
            {submitMessage ? <p className="message success form-span-2">{submitMessage}</p> : null}

            <div className="form-actions form-span-2">
              <button type="button" className="ghost-btn" onClick={() => navigate("/admin/products")}>
                취소
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting ? "등록 중..." : "상품 등록"}
              </button>
            </div>
          </form>
      </section>
    </AdminLayout>
  );
}

export default AdminProductCreatePage;
