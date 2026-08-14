/**
 * main.tsx — entry point.
 *
 * Per AD-15/17/18: Vite + React 18 + React Router v7 (hash mode) +
 * Tailwind v4. The hash router preserves `file://` deploy so the
 * build output can still be opened by double-click.
 *
 * Theme is applied imperatively before React mounts so the first paint
 * shows the correct palette, not a flash of the default theme.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';
import './styles/app.css';

// DESIGN.md.typography.heading — load Fraunces once for the app
// (variable font; supports opsz 9..144 axis used at h1-display /
// h1-screen / h3-modal roles). Preconnect for faster first paint.
const frauncesLink = document.createElement('link');
frauncesLink.rel = 'stylesheet';
frauncesLink.href =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap';
document.head.appendChild(frauncesLink);

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);