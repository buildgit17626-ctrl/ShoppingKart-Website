import React, { useEffect, useState } from 'react';
import { shopApi, errorMessage } from '../services/api';
import ProductCard from '../components/ProductCard';
import StatePanel from '../components/StatePanel';
import { useCart } from '../context/CartContext';
export default function Wishlist({ onWishlistChanged }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const { error: cartError } = useCart();
  const load = async () => { setLoading(true); setError(''); try { const { data } = await shopApi.get('/wishlist'); setItems(data.wishlist); onWishlistChanged(data.count); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <main><div className="page-heading"><span className="eyebrow">SAVED FOR ANOTHER DAY</span><h1>My Wishlist</h1><p>{items.length} products saved. Your favourites, all in one place.</p></div>{cartError && <p className="error banner" role="alert">{cartError}</p>}{loading ? <StatePanel title="Loading your wishlist..." /> : error ? <StatePanel title="Unable to load wishlist" detail={error} retry={load} /> : !items.length ? <StatePanel title="Your wishlist is empty ♡" detail="Save products you love and find them here later." browse /> : <div className="product-grid">{items.map(p => <ProductCard key={p._id} product={p} saved onWishlistChanged={load} />)}</div>}</main>;
}
