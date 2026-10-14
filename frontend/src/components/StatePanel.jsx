import React from 'react';
import { Link } from 'react-router-dom';
export default function StatePanel({ title, detail, retry, browse = false }) {
  return <div className="state-panel" role="status"><span className="state-icon">◇</span><h2>{title}</h2>{detail && <p>{detail}</p>}{retry && <button onClick={retry}>Try Again</button>}{browse && <Link className="button" to="/products">Browse Products</Link>}</div>;
}
