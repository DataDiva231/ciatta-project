import React from 'react';
import { createRoot } from 'react-dom/client';
import Member from './Member';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from member/index.html');
createRoot(el).render(
  <React.StrictMode>
    <Member />
  </React.StrictMode>
);
