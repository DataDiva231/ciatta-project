import React from 'react';
import { createRoot } from 'react-dom/client';
import Briefs from './Briefs';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from briefs/index.html');
createRoot(el).render(
  <React.StrictMode>
    <Briefs />
  </React.StrictMode>
);
