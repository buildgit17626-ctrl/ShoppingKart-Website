import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi, errorMessage } from '../services/api';
import ProductCard from '../components/ProductCard';
import StatePanel from '../components/StatePanel';
import { useCart } from '../context/CartContext';
export default function Products({ onWishlistChanged }) {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Electronics', 'Fashion', 'Books', 'Home']);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const { error: cartError } = useCart();
  const refreshWishlist = async () => { const { data } = await shopApi.get('/wishlist'); setSaved(data.wishlist.map(p => p._id)); onWishlistChanged(data.count); };
  useEffect(() => { refreshWishlist().catch(e => setError(errorMessage(e))); shopApi.get('/products').then(({ data }) => setCategories([...new Set(['Electronics', 'Fashion', 'Books', 'Home', ...data.products.map(p => p.category)])])).catch(() => {}); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try { const { data } = await shopApi.get('/products', { params: Object.fromEntries(params), signal: controller.signal }); setProducts(data.products); }
      catch (e) { if (e.code !== 'ERR_CANCELED') setError(errorMessage(e)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [params, revision]);
  const change = (key, value) => setParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); return next; });
  return <main><section className="hero"><div><span className="eyebrow">THE SHOPKART EDIT</span><h1>Good finds.<br /><em>Everyday essentials.</em></h1><p>Discover your next favourite. Save it for later, or make it yours.</p></div><div className="hero-art" aria-hidden="true"><span>SK</span><small>CURATED FOR YOUR EVERYDAY</small></div></section>
    <div className="section-heading"><div><span className="eyebrow">EXPLORE THE COLLECTION</span><h2>Find something you love</h2></div><span>{products.length} products</span></div>
    <div className="filters"><label className="search-field"><span>Search</span><input aria-label="Search products" placeholder="Search products..." value={params.get('search') || ''} onChange={e => change('search', e.target.value)} /></label><label>Category<select aria-label="Category" value={params.get('category') || ''} onChange={e => change('category', e.target.value)}><option value="">All Categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Sort by<select aria-label="Sort by" value={params.get('sort') || ''} onChange={e => change('sort', e.target.value)}><option value="">Newest arrivals</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label><button className="secondary" onClick={() => setParams({})}>Reset</button></div>
    {cartError && <p role="alert" className="error banner">{cartError}</p>}
    {loading ? <StatePanel title="Loading products..." /> : error ? <StatePanel title="Unable to load products" detail={error} retry={() => setRevision(r => r + 1)} /> : !products.length ? <StatePanel title="No products found" detail="Try a different search or category." retry={() => setParams({})} /> : <div className="product-grid">{products.map(p => <ProductCard key={p._id} product={p} saved={saved.includes(p._id)} onWishlistChanged={refreshWishlist} />)}</div>}
  </main>;
}
