import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import { ArticleDetail, Articles, Contact, NotFound, StaticPage } from './pages/Content'
import Home from './pages/Home'
import OrderSuccess from './pages/OrderSuccess'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'
import Track from './pages/Track'

// لوحة التحكم تُحمَّل عند الحاجة فقط حتى يبقى المتجر سريعًا على الهاتف
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Dashboard = lazy(() => import('./admin/Dashboard'))
const ProductsAdmin = lazy(() => import('./admin/ProductsAdmin'))
const ProductEditor = lazy(() => import('./admin/ProductEditor'))
const OrdersAdmin = lazy(() => import('./admin/OrdersAdmin'))
const ShippingAdmin = lazy(() => import('./admin/ShippingAdmin'))
const CouponsAdmin = lazy(() => import('./admin/CouponsAdmin'))
const ContentAdmin = lazy(() => import('./admin/ContentAdmin'))
const SettingsAdmin = lazy(() => import('./admin/SettingsAdmin'))

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="products/:id" element={<ProductEditor />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="shipping" element={<ShippingAdmin />} />
          <Route path="coupons" element={<CouponsAdmin />} />
          <Route path="content" element={<ContentAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Route>

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:number" element={<OrderSuccess />} />
          <Route path="track" element={<Track />} />
          <Route path="articles" element={<Articles />} />
          <Route path="articles/:slug" element={<ArticleDetail />} />
          <Route path="page/:id" element={<StaticPage />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
