import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi, errorMessage, money } from '../services/api';
import { useCart } from '../context/CartContext';
import StatePanel from '../components/StatePanel';
export default function ProductDetails({ onWishlistChanged }) {
  const { id } = useParams(); const [product, setProduct] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');
  const { addToCart, pending, cartItems, error: cartError } = useCart();
  const load = async () => { setLoading(true); setError(''); try { const [p, w] = await Promise.all([shopApi.get('/products/' + id), shopApi.get('/wishlist')]); setProduct(p.data.product); setSaved(w.data.wishlist.some(p => p._id === id)); onWishlistChanged(w.data.count); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [id]);
  if (loading) return <main><StatePanel title="Loading product..." /></main>;
  if (!product) return <main><StatePanel title="Unable to load product" detail={error} retry={load} browse /></main>;
  const quantity = cartItems.find(i => i.product._id === id)?.quantity || 0;
  const toggle = async () => { setSaving(true); setError(''); try { await shopApi.request({ method: saved ? 'DELETE' : 'POST', url: '/wishlist/' + id }); setSaved(!saved); const { data } = await shopApi.get('/wishlist'); onWishlistChanged(data.count); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } };
  return <main><Link className="back-link" to="/products">← Back to products</Link><section className="detail-layout"><div className="detail-image"><img src={product.image} alt={product.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/product-placeholder.svg'; }} /></div><div className="detail-copy"><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="detail-price">{money(product.price)}</p><p>{product.description}</p><p className={product.stock ? 'stock' : 'sold-out'}>{product.stock ? product.stock + ' units in stock' : 'Out of stock'}</p><button disabled={pending[id] || quantity >= product.stock} onClick={async () => { if (await addToCart(id)) setNotice('Added to cart'); }}>{pending[id] ? 'Adding...' : quantity ? 'Add Another' : 'Add to Cart'}</button><button className="secondary" disabled={saving} onClick={toggle}>{saving ? 'Saving...' : saved ? '♥ Remove from Wishlist' : '♡ Add to Wishlist'}</button>{notice && <p role="status" className="success-text">{notice}</p>}{(error || cartError) && <p role="alert" className="error">{error || cartError}</p>}</div></section></main>;
}
