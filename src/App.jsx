import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards'
import Adjustments from './pages/adjustments/Adjustments'
import ForgotPassword from './pages/auth/ForgotPassword'
import Login from './pages/auth/Login'
import ResetPassword from './pages/auth/ResetPassword'
import Signup from './pages/auth/Signup'
import VerifyOtp from './pages/auth/VerifyOtp'
import Categories from './pages/categories/Categories'
import Dashboard from './pages/dashboard/Dashboard'
import Deliveries from './pages/deliveries/Deliveries'
import MoveHistory from './pages/move-history/MoveHistory'
import NotFound from './pages/NotFound'
import ProductDetail from './pages/products/ProductDetail'
import Products from './pages/products/Products'
import Profile from './pages/profile/Profile'
import Receipts from './pages/receipts/Receipts'
import Settings from './pages/settings/Settings'
import Transfers from './pages/transfers/Transfers'
import WarehouseDetail from './pages/warehouses/WarehouseDetail'
import Warehouses from './pages/warehouses/Warehouses'

const publicPages = [
  ['/login', Login],
  ['/signup', Signup],
  ['/forgot-password', ForgotPassword],
  ['/verify-otp', VerifyOtp],
  ['/reset-password', ResetPassword],
]

export default function App() {
  return (
    <Routes>
      {publicPages.map(([path, Page]) => (
        <Route
          key={path}
          path={path}
          element={
            <PublicOnlyRoute>
              <Page />
            </PublicOnlyRoute>
          }
        />
      ))}

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="categories" element={<Categories />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="warehouses/:id" element={<WarehouseDetail />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="adjustments" element={<Adjustments />} />
        <Route path="move-history" element={<MoveHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
