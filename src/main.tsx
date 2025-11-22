import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; // 👈 1. 新增这一行
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* 👇 2. 用 HashRouter 包裹 App，这样 GitHub Pages 才能识别路径 */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);