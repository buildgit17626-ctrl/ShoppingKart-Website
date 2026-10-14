import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { money, shopApi, errorMessage } from '../services/api';
export default function ProductCard({ product, saved = false, onWishlistChanged }) {
  const { addToCart, pending, cartItems } = useCart();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const quantity = cartItems.find(i => i.product._id === product._id)?.quantity || 0;
  const wishlist = async () => {
    setSaving(true); setError('');
    try { await shopApi.request({ method: saved ? 'DELETE' : 'POST', url: '/wishlist/' + product._id }); await onWishlistChanged?.(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return <article className="product-card">
    <div className="product-visual"><Link to={'/products/' + product._id}><img src={product.image} alt={product.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/product-placeholder.svg'; }} /></Link><button className={'heart ' + (saved ? 'saved' : '')} onClick={wishlist} disabled={saving} aria-label={saved ? 'Remove from Wishlist' : 'Add to Wishlist'}>{saving ? '…' : saved ? '♥' : '♡'}</button></div>
    <div className="product-body"><span className="eyebrow">{product.category}</span><Link to={'/products/' + product._id}><h3>{product.name}</h3></Link><div className="price-row"><strong>{money(product.price)}</strong><span className={product.stock ? 'stock' : 'sold-out'}>{product.stock ? product.stock + ' units left' : 'Out of stock'}</span></div>
      <div className="card-actions"><Link className="button secondary" to={'/products/' + product._id}>View Details</Link><button disabled={pending[product._id] || quantity >= product.stock} onClick={async () => { setNotice(''); if (await addToCart(product._id)) setNotice('Added to cart'); }}>{pending[product._id] ? 'Adding...' : quantity ? 'Add Another' : 'Add to Cart'}</button></div>
      <button className="text-button wishlist-action" disabled={saving} onClick={wishlist}>{saving ? 'Saving...' : saved ? '♥ Remove from Wishlist' : '♡ Add to Wishlist'}</button>
      {notice && <p role="status" className="success-text">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    </div>
  </article>;
}
