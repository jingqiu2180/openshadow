import { createRoot } from 'react-dom/client';
import App from './react/App';

const el = document.getElementById('react-root');
if (el) {
  console.info('[rem-launch] renderer-entry');
  createRoot(el).render(<App />);
  console.info('[rem-launch] root-mounted');
} else {
  console.error('[rem-launch] react-root missing');
}
