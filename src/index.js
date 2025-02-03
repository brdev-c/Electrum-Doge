import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;
import App from './App';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
