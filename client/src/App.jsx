import { BrowserRouter, Outlet, Route, Routes, useParams } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import RequireAuth from './components/RequireAuth';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AuthPage from './pages/AuthPage';
import MyOrdersPage from './pages/MyOrdersPage';
import AccountPage from './pages/AccountPage';
import OrderPage from './pages/OrderPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminInventory from './pages/admin/AdminInventory';

// Header + page + footer around every shop page
function ShopLayout() {
  return (
    <div className="shop-shell">
      <Header />
      <main className="shop-main"><Outlet /></main>
      <Footer />
    </div>
  );
}

// A new ProductPage for every product, so its state (chosen size, photo…) starts fresh
function ProductRoute() {
  const { slug } = useParams();
  return <ProductPage key={slug} />;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<ShopLayout />}>
              <Route index element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:slug" element={<ProductRoute />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/login" element={<AuthPage mode="login" key="login" />} />
              <Route path="/register" element={<AuthPage mode="register" key="register" />} />
              <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
              <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
              <Route path="/orders" element={<RequireAuth><MyOrdersPage /></RequireAuth>} />
              <Route path="/orders/:id" element={<RequireAuth><OrderPage /></RequireAuth>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/new" element={<AdminProductForm key="new" />} />
              <Route path="products/:id/edit" element={<AdminProductForm key="edit" />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="customers" element={<AdminCustomers />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
