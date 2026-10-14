import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import api, { shopApi, errorMessage } from './services/api';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import StatePanel from './components/StatePanel';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Wishlist from './pages/Wishlist';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
function Protected({ user, children }) { const location = useLocation(); return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />; }
export default function App() {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [wishlistCount, setWishlistCount] = useState(0);
  const clearUser = useCallback(() => setUser(null), []);
  const restore = async () => { setLoading(true); setError(''); try { const { data } = await api.get('/me'); setUser(data); } catch (e) { if (e.response?.status === 401) setUser(null); else setError(errorMessage(e)); } finally { setLoading(false); } };
  useEffect(() => { restore(); }, []);
  useEffect(() => {
    const interceptor = shopApi.interceptors.response.use(r => r, e => { if (e.response?.status === 401 && !e.config.url.includes('/login')) setUser(null); return Promise.reject(e); });
    return () => shopApi.interceptors.response.eject(interceptor);
  }, []);
  useEffect(() => { let active = true; setWishlistCount(0); if (user) shopApi.get('/wishlist').then(({ data }) => { if (active) setWishlistCount(data.count); }).catch(() => {}); return () => { active = false; }; }, [user?._id]);
  if (loading) return <StatePanel title="Loading your ShopKart session..." />;
  if (error) return <StatePanel title="Unable to connect to ShopKart" detail={error} retry={restore} />;
  const protectedPage = page => <Protected user={user}>{page}</Protected>;
  return <CartProvider user={user} onUnauthorized={clearUser}><Navbar user={user} setUser={setUser} wishlistCount={wishlistCount} /><Routes>
    <Route path="/" element={<Navigate to={user ? '/products' : '/login'} replace />} />
    <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login setUser={setUser} />} />
    <Route path="/register" element={user ? <Navigate to="/home" replace /> : <Register />} />
    <Route path="/home" element={protectedPage(<Home user={user} />)} />
    <Route path="/products" element={protectedPage(<Products onWishlistChanged={setWishlistCount} />)} />
    <Route path="/products/:id" element={protectedPage(<ProductDetails onWishlistChanged={setWishlistCount} />)} />
    <Route path="/wishlist" element={protectedPage(<Wishlist onWishlistChanged={setWishlistCount} />)} />
    <Route path="/cart" element={protectedPage(<Cart />)} />
    <Route path="/checkout" element={protectedPage(<Checkout user={user} />)} />
    <Route path="/orders" element={protectedPage(<Orders />)} />
    <Route path="/orders/:id" element={protectedPage(<OrderDetails />)} />
    <Route path="/order-success/:id" element={protectedPage(<OrderDetails success />)} />
    <Route path="*" element={<main><StatePanel title="Page not found" browse /></main>} />
  </Routes><footer><LinkBrand /> <span>Thoughtfully picked. Simply shopped.</span><span>ShopKart · MERN Lab 01–06</span></footer></CartProvider>;
}
function LinkBrand() { return <strong>shopkart.</strong>; }
