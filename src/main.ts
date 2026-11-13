import './styles.css';
import { App } from './core/App';

const container = document.querySelector<HTMLElement>('#app');

if (!container) {
  throw new Error('Application root was not found.');
}

const app = new App(container);
void app.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
