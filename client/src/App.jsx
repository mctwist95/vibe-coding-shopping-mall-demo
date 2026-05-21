import { Route, Routes } from "react-router-dom";
import "./App.css";
import AdminPage from "./pages/admin/AdminPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminProductListPage from "./pages/admin/AdminProductListPage";
import AdminProductCreatePage from "./pages/admin/AdminProductCreatePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrderCompletePage from "./pages/OrderCompletePage";
import OrdersPage from "./pages/OrdersPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import SignupPage from "./pages/SignupPage";

// 애플리케이션 라우트를 구성하는 최상위 컴포넌트다.
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId" element={<OrderDetailPage />} />
      <Route path="/orders/:orderId/complete" element={<OrderCompletePage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/products" element={<AdminProductListPage />} />
      <Route path="/admin/products/new" element={<AdminProductCreatePage />} />
      <Route path="/admin/orders" element={<AdminOrdersPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
  );
}

export default App;
