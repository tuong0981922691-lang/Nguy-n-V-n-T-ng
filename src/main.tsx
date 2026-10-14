import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const mountNode = document.getElementById('firebase-auth-mount') || document.getElementById('root');
if (mountNode) {
  createRoot(mountNode).render(<App />);
}
