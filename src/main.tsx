import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './App.css';
import './styles/scroll-fix.css'; // Fix for scrolling overflow issues

createRoot(document.getElementById("root")!).render(<App />);
