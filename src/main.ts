import './styles.css';
import { App } from './core/App';
import { startWithErrorBoundary } from './core/startup';

const container = document.querySelector<HTMLElement>('#app');

if (!container) {
  throw new Error('Application root was not found.');
}

const app = new App(container);
void startWithErrorBoundary(
  () => app.start(),
  (error) => app.showInitializationError(error),
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
