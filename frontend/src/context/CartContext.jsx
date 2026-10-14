import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { shopApi, errorMessage } from '../services/api';
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
export function CartProvider({ user, onUnauthorized, children }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const locks = useRef(new Set());
  const applyError = e => { setError(errorMessage(e)); if (e.response?.status === 401) onUnauthorized(); };
  const refreshCart = () => {
    const current = generation.current;
    setLoading(true); setError('');
    const operation = queue.current.then(async () => {
      if (current !== generation.current) return;
      try { const { data } = await shopApi.get('/cart'); if (current === generation.current) setCartItems(data.cart); }
      catch (e) { if (current === generation.current) applyError(e); }
      finally { if (current === generation.current) setLoading(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  useEffect(() => {
    generation.current++; setCartItems([]); setError(''); setPending({}); locks.current.clear();
    if (user) refreshCart(); else setLoading(false);
    return () => { generation.current++; };
  }, [user?._id]);
  const mutate = (method, id, body) => {
    if (locks.current.has(id)) return Promise.resolve(false);
    locks.current.add(id); setPending(p => ({ ...p, [id]: true })); setError('');
    const current = generation.current;
    // Serialize mutations so older responses cannot overwrite newer cart state.
    const operation = queue.current.then(async () => {
      if (current !== generation.current) return false;
      try {
        const { data } = await shopApi.request({ method, url: '/cart/' + id, data: body });
        if (current === generation.current) setCartItems(data.cart);
        return true;
      } catch (e) { if (current === generation.current) applyError(e); return false; }
      finally { if (current === generation.current) { locks.current.delete(id); setPending(p => ({ ...p, [id]: false })); } }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  const acceptConfirmedCart = items => {
    generation.current++; locks.current.clear(); setPending({}); setLoading(false); setError(''); setCartItems(items);
  };
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
  return <CartContext.Provider value={{ cartItems, loading, error, pending, totalUnits, subtotal, refreshCart, acceptConfirmedCart,
    addToCart: id => mutate('POST', id), removeFromCart: id => mutate('DELETE', id), updateQuantity: (id, quantity) => mutate('PATCH', id, { quantity }) }}>{children}</CartContext.Provider>;
}
