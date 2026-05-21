import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteProductById, getProducts, updateProductById } from "../../api/products";
import AdminLayout from "./AdminLayout";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_TYPE_FALLBACK = "Bearer";
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";
const FILTER_OPTIONS = ["전체", "상의", "하의", "악세사리"];
const CATEGORY_OPTIONS = ["상의", "하의", "악세사리"];
const PAGE_SIZE = 2;

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

// 인증 관련 로컬 스토리지 데이터를 초기화한다.
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("user");
}

// 숫자 가격을 원화 문자열로 표시한다.
function formatPrice(value) {
  if (typeof value !== "number") {
    return "-";
  }

  return `₩${value.toLocaleString("ko-KR")}`;
}

// 관리자 상품 목록 조회/수정/삭제를 처리하는 페이지다.
function AdminProductListPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [currentPage, setCurrentPage] = useState(1);
  const [refetchTick, setRefetchTick] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [fetchError, setFetchError] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({
    sku: "",
    name: "",
    category: "",
    price: "",
    image: "",
    description: "",
  });
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [processingProductId, setProcessingProductId] = useState(null);
  const widgetRef = useRef(null);

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

    // 현재 로그인 사용자의 관리자 권한을 확인한다.
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

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    let isMounted = true;

    // 페이지 조건에 맞는 상품 목록을 조회한다.
    async function fetchProducts() {
      try {
        setIsLoadingProducts(true);
        setFetchError("");
        const result = await getProducts({ page: currentPage, limit: PAGE_SIZE });
        if (isMounted) {
          setProducts(Array.isArray(result.data) ? result.data : []);
          setPagination(
            result.pagination || {
              page: currentPage,
              limit: PAGE_SIZE,
              totalItems: 0,
              totalPages: 1,
              hasPrevPage: false,
              hasNextPage: false,
            }
          );
        }
      } catch (error) {
        if (isMounted) {
          setFetchError(error.message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [isCheckingAuth, currentPage, refetchTick]);

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatched = selectedCategory === "전체" || product.category === selectedCategory;
      const keywordMatched =
        normalizedKeyword.length === 0 ||
        product.name?.toLowerCase().includes(normalizedKeyword) ||
        product.sku?.toLowerCase().includes(normalizedKeyword);

      return categoryMatched && keywordMatched;
    });
  }, [products, searchKeyword, selectedCategory]);

  const adminName = useMemo(
    () => currentUser?.name || currentUser?.email || "admin",
    [currentUser]
  );

  // 선택한 상품을 수정 모드로 전환한다.
  const startEdit = (product) => {
    setActionError("");
    setActionMessage("");
    setEditingProductId(product._id);
    setEditForm({
      sku: product.sku || "",
      name: product.name || "",
      category: product.category || "",
      price: product.price ?? "",
      image: product.image || "",
      description: product.description || "",
    });
  };

  // 상품 수정 모드를 종료하고 폼을 초기화한다.
  const cancelEdit = () => {
    setEditingProductId(null);
    setEditForm({
      sku: "",
      name: "",
      category: "",
      price: "",
      image: "",
      description: "",
    });
  };

  // 수정 폼 입력값을 상태에 반영한다.
  const onEditInputChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // 수정용 Cloudinary 업로드 위젯을 열고 이미지를 반영한다.
  const openCloudinaryWidgetForEdit = useCallback(() => {
    setActionError("");
    setActionMessage("");

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setActionError("Cloudinary 설정이 필요합니다. 환경변수를 확인해주세요.");
      return;
    }

    if (!window.cloudinary?.createUploadWidget) {
      setActionError("Cloudinary 위젯을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
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
          setActionError(detailedMessage);
          return;
        }

        if (result.event === "success") {
          setEditForm((prev) => ({ ...prev, image: result.info.secure_url }));
        }
      }
    );

    widgetRef.current = widget;
    widget.open();
  }, []);

  // 수정된 상품 정보를 검증 후 저장한다.
  const saveEdit = async (productId) => {
    const trimmedSku = editForm.sku.trim();
    const trimmedName = editForm.name.trim();
    const numericPrice = Number(editForm.price);

    if (!trimmedSku || !trimmedName) {
      setActionError("SKU와 상품명은 필수입니다.");
      return;
    }

    if (!CATEGORY_OPTIONS.includes(editForm.category)) {
      setActionError("카테고리를 선택해주세요.");
      return;
    }

    if (!editForm.image.trim()) {
      setActionError("이미지는 필수입니다.");
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setActionError("가격은 0 이상의 숫자여야 합니다.");
      return;
    }

    try {
      setProcessingProductId(productId);
      setActionError("");
      const updatedProduct = await updateProductById(productId, {
        sku: trimmedSku,
        name: trimmedName,
        category: editForm.category,
        price: numericPrice,
        image: editForm.image.trim(),
        description: editForm.description.trim() || null,
      });

      setProducts((prev) =>
        prev.map((product) => (product._id === productId ? { ...product, ...updatedProduct } : product))
      );
      setActionMessage("상품 정보가 수정되었습니다.");
      cancelEdit();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setProcessingProductId(null);
    }
  };

  // 확인 후 선택한 상품을 삭제한다.
  const deleteProduct = async (product) => {
    if (!product?._id) {
      setActionError("삭제할 상품 식별자(_id)를 찾을 수 없습니다.");
      return;
    }

    const shouldDelete = window.confirm(`'${product.name || product.sku}' 상품을 삭제할까요?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setProcessingProductId(product._id);
      setActionError("");
      setActionMessage("");
      await deleteProductById(product._id);
      setActionMessage("상품이 삭제되었습니다.");
      if (editingProductId === product._id) {
        cancelEdit();
      }

      if (products.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        setRefetchTick((prev) => prev + 1);
      }
    } catch (error) {
      setActionError(error.message);
    } finally {
      setProcessingProductId(null);
    }
  };

  if (isCheckingAuth) {
    return <main className="admin-loading">관리자 권한 확인 중...</main>;
  }

  return (
    <AdminLayout
      title="상품 관리"
      backPath="/admin"
      adminName={adminName}
      actions={
        <Link to="/admin/products/new" className="admin-create-btn">
          + 새 상품 등록
        </Link>
      }
    >
      <div className="admin-tabs">
          <span className="admin-tab active">상품 목록</span>
          <Link to="/admin/products/new" className="admin-tab">
            상품 등록
          </Link>
      </div>

      <section className="product-list-panel">
          <div className="product-list-toolbar">
            <input
              type="search"
              className="product-search-input"
              placeholder="상품명/sku로 검색..."
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <select
              className="product-filter-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {actionError ? <p className="product-list-feedback error">{actionError}</p> : null}
          {actionMessage ? <p className="product-list-feedback success">{actionMessage}</p> : null}

          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>이미지</th>
                  <th>상품명</th>
                  <th>카테고리</th>
                  <th>가격</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingProducts ? (
                  <tr>
                    <td colSpan={5} className="product-table-empty">
                      상품 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={5} className="product-table-empty error">
                      {fetchError}
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="product-table-empty">
                      조건에 맞는 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product._id || product.sku}>
                      <td>
                        {editingProductId === product._id ? (
                          <>
                            <img
                              src={editForm.image || "https://placehold.co/56x56?text=IMG"}
                              alt={product.name || "상품 이미지"}
                              className="product-row-image"
                            />
                            <button type="button" className="product-row-image-upload-btn" onClick={openCloudinaryWidgetForEdit}>
                              {editForm.image ? "이미지 교체" : "이미지 업로드"}
                            </button>
                          </>
                        ) : (
                          <img
                            src={product.image || "https://placehold.co/56x56?text=IMG"}
                            alt={product.name || "상품 이미지"}
                            className="product-row-image"
                          />
                        )}
                      </td>
                      <td>
                        {editingProductId === product._id ? (
                          <>
                            <input
                              className="product-row-edit-input"
                              name="name"
                              value={editForm.name}
                              onChange={onEditInputChange}
                              placeholder="상품명"
                            />
                            <input
                              className="product-row-edit-input"
                              name="sku"
                              value={editForm.sku}
                              onChange={onEditInputChange}
                              placeholder="SKU"
                            />
                            <textarea
                              className="product-row-edit-textarea"
                              name="description"
                              value={editForm.description}
                              onChange={onEditInputChange}
                              placeholder="설명 (선택)"
                              rows={3}
                            />
                          </>
                        ) : (
                          <>
                            <strong>{product.name || "-"}</strong>
                            <p>{product.sku || "-"}</p>
                            {product.description ? <p>{product.description}</p> : null}
                          </>
                        )}
                      </td>
                      <td>
                        {editingProductId === product._id ? (
                          <select
                            className="product-row-edit-select"
                            name="category"
                            value={editForm.category}
                            onChange={onEditInputChange}
                          >
                            {CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        ) : (
                          product.category || "-"
                        )}
                      </td>
                      <td>
                        {editingProductId === product._id ? (
                          <input
                            className="product-row-edit-input"
                            type="number"
                            min="0"
                            name="price"
                            value={editForm.price}
                            onChange={onEditInputChange}
                            placeholder="가격"
                          />
                        ) : (
                          formatPrice(product.price)
                        )}
                      </td>
                      <td>
                        {editingProductId === product._id ? (
                          <div className="product-row-actions product-row-edit-actions">
                            <button
                              type="button"
                              onClick={() => saveEdit(product._id)}
                              disabled={processingProductId === product._id}
                            >
                              저장
                            </button>
                            <button type="button" onClick={cancelEdit} disabled={processingProductId === product._id}>
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="product-row-actions">
                            <button
                              type="button"
                              onClick={() => startEdit(product)}
                              disabled={processingProductId === product._id}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProduct(product)}
                              disabled={processingProductId === product._id}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="product-pagination">
            <button
              type="button"
              className="product-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={isLoadingProducts || !pagination.hasPrevPage}
            >
              이전
            </button>
            <span className="product-pagination-status">
              {pagination.page} / {pagination.totalPages} 페이지 (총 {pagination.totalItems}개)
            </span>
            <button
              type="button"
              className="product-pagination-btn"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={isLoadingProducts || !pagination.hasNextPage}
            >
              다음
            </button>
          </div>
      </section>
    </AdminLayout>
  );
}

export default AdminProductListPage;
