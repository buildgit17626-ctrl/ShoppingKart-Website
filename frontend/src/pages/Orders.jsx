import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { shopApi, money, errorMessage } from '../services/api';
import StatePanel from '../components/StatePanel';
export default function Orders() {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const { data } = await shopApi.get('/orders'); setOrders(data.orders); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <main><div className="page-heading"><span className="eyebrow">YOUR PURCHASE JOURNEY</span><h1>My Orders</h1><p>Purchase-time prices and delivery details, saved for you.</p></div>{loading ? <StatePanel title="Loading your orders..." /> : error ? <StatePanel title="Unable to load orders" detail={error} retry={load} /> : !orders.length ? <StatePanel title="You have not placed any orders yet." browse /> : <div className="orders-grid">{orders.map(order => <article className="panel order-card" key={order._id}><div className="order-header"><h2>Order #{order._id.slice(-8)}</h2><span className={'status-badge status-' + order.paymentStatus.toLowerCase()}>{order.status.replaceAll('_', ' ')}</span></div><p>{new Date(order.createdAt).toLocaleDateString('en-IN')} · Payment: {order.paymentStatus}</p>{order.items.map((item, index) => <div className="order-line" key={index}><span>{item.name} × {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div>)}<div className="order-line"><strong>Total</strong><strong>{money(order.totalAmount)}</strong></div><Link className="button secondary" to={'/orders/' + order._id}>View Details</Link></article>)}</div>}</main>;
}
