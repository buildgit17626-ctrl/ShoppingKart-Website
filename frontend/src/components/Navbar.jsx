import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/api';
import { useCart } from '../context/CartContext';
export default function Navbar({ user, setUser, wishlistCount }) {
  const { totalUnits } = useCart(); const navigate = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const logout = async () => { setBusy(true); setError(''); try { await api.post('/logout'); setUser(null); navigate('/login'); } catch (e) { if (e.response?.status === 401) { setUser(null); navigate('/login'); } else setError(errorMessage(e)); } finally { setBusy(false); } };
  return <><div className="announcement">A considered collection. An everyday kind of joy.</div><nav className="navbar"><Link to={user ? '/products' : '/login'} className="nav-brand"><span className="brand-symbol">s</span>shopkart<span className="brand-dot">.</span></Link><div className="nav-links">{user ? <><NavLink to="/home">Home</NavLink><NavLink to="/products">Products</NavLink><NavLink to="/wishlist">Wishlist ({wishlistCount})</NavLink><NavLink to="/cart">Cart ({totalUnits})</NavLink><NavLink to="/orders">Orders</NavLink><button className="text-button" disabled={busy} onClick={logout}>{busy ? 'Logging out...' : 'Logout'}</button></> : <><NavLink to="/products">Explore</NavLink><NavLink to="/login">Login</NavLink><Link className="button" to="/register">Create Account</Link></>}</div></nav>{error && <p role="alert" className="error banner">{error}</p>}</>;
}
