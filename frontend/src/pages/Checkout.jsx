import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { shopApi, errorMessage, money } from '../services/api';
import { loadRazorpay } from '../services/razorpay';
import StatePanel from '../components/StatePanel';
export default function Checkout({ user }) {
  const cart = useCart(); const navigate = useNavigate();
  const [shipping, setShipping] = useState({ fullName: user.fullName, phone: user.phone, addressLine1: '', city: '', state: '', pincode: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [phase, setPhase] = useState('');
  const [pending, setPending] = useState(null); const processing = useRef(false);
  const recoveryKey = 'shopkart-payment:' + user._id;
  const [verification, setVerification] = useState(() => { try { return JSON.parse(sessionStorage.getItem(recoveryKey)); } catch { return null; } });
  const verify = async payload => {
    setBusy(true); setPhase('Verifying payment...'); setError('');
    try {
      const { data } = await shopApi.post('/orders/verify-payment', payload);
      cart.acceptConfirmedCart(data.cart); sessionStorage.removeItem(recoveryKey); setVerification(null);
      navigate('/order-success/' + data.order._id);
    } catch (e) { setError(errorMessage(e) + ' Your cart has not been cleared. Retry verification before making another payment.'); }
    finally { processing.current = false; setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault(); if (processing.current) return; setError('');
    if (verification) { processing.current = true; return verify(verification); }
    if (!Object.values(shipping).every(v => v.trim())) return setError('All shipping fields are required. Whitespace-only input is invalid.');
    if (!/^[6-9]\d{9}$/.test(shipping.phone.trim())) return setError('Phone must be a valid 10-digit Indian mobile number.');
    if (!/^[1-9]\d{5}$/.test(shipping.pincode.trim())) return setError('Pincode must contain 6 digits.');
    processing.current = true; setBusy(true); setPhase('Preparing payment...');
    try {
      await loadRazorpay();
      let data = pending;
      if (!data) { const response = await shopApi.post('/orders/create-payment-order', { shippingAddress: shipping }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); data = response.data; setPending(data); }
      setPhase('Complete your Razorpay test payment...');
      const checkout = new window.Razorpay({
        key: data.key, amount: data.amount, currency: data.currency, order_id: data.razorpayOrderId,
        name: 'ShopKart', description: 'ShopKart Test Mode order', prefill: { name: data.order.shippingAddress.fullName, contact: data.order.shippingAddress.phone, email: user.email }, theme: { color: '#355941' },
        handler: response => {
          const payload = { shopKartOrderId: data.shopKartOrderId, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature };
          sessionStorage.setItem(recoveryKey, JSON.stringify(payload)); setVerification(payload); verify(payload);
        },
        modal: { ondismiss: () => { if (!sessionStorage.getItem(recoveryKey)) { processing.current = false; setBusy(false); setError('Payment cancelled. Your cart is unchanged. You can retry this payment.'); } } }
      });
      checkout.on('payment.failed', response => { processing.current = false; setBusy(false); setError((response.error?.description || 'Payment failed.') + ' Your cart is unchanged. Please try again.'); });
      checkout.open();
    } catch (e) { processing.current = false; setBusy(false); setError(e.response ? errorMessage(e) : e.message); }
  };
  if (cart.loading) return <main><StatePanel title="Loading checkout..." /></main>;
  if (cart.error) return <main><StatePanel title="Unable to load checkout" detail={cart.error} retry={cart.refreshCart} /></main>;
  if (!cart.cartItems.length && !verification) return <main><StatePanel title="Your cart is empty" detail="Add products before starting checkout." browse /></main>;
  const items = pending?.order.items || cart.cartItems.map(i => ({ ...i.product, quantity: i.quantity }));
  return <main><div className="page-heading"><span className="eyebrow">THE FINAL STEP</span><h1>Checkout</h1><p>Review your order and pay securely with Razorpay Test Mode.</p></div><form className="checkout-layout" onSubmit={submit} noValidate><section className="panel"><h2>Shipping Details</h2><div className="shipping-grid">{[{ key: 'fullName', label: 'Full Name', auto: 'name' }, { key: 'phone', label: 'Phone Number', auto: 'tel' }, { key: 'addressLine1', label: 'Address Line', auto: 'street-address' }, { key: 'city', label: 'City', auto: 'address-level2' }, { key: 'state', label: 'State', auto: 'address-level1' }, { key: 'pincode', label: 'Pincode', auto: 'postal-code' }].map(field => <label key={field.key} className={field.key === 'addressLine1' ? 'wide' : ''}>{field.label}<input disabled={busy || !!pending || !!verification} autoComplete={field.auto} maxLength={250} inputMode={['phone', 'pincode'].includes(field.key) ? 'numeric' : 'text'} value={shipping[field.key]} onChange={e => { setShipping({ ...shipping, [field.key]: e.target.value }); setError(""); }} /></label>)}</div><Link className="back-link" to="/cart">← Return to Cart</Link></section><aside className="order-summary"><h2>Order Summary</h2>{items.map((item, index) => <div key={item._id || index}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-total"><span>Total</span><strong>{money(pending ? pending.amount / 100 : cart.subtotal)}</strong></div><p>Test Mode only. No real money. Final prices and stock are checked on the server.</p>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={busy || Object.values(cart.pending).some(Boolean)}>{busy ? phase : verification ? 'Retry payment verification' : pending ? 'Retry Razorpay payment' : 'Place Order — Pay with Razorpay'}</button>{pending && !busy && !verification && <button type="button" className="text-button" onClick={() => { setPending(null); setError(''); }}>Edit shipping / start new attempt</button>}<p role="status" aria-live="polite">{busy ? phase : 'Cart clears after payment verification succeeds.'}</p></aside></form></main>;
}
