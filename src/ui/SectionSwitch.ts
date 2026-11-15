/** Accessible toggle-button state for a recessed scene instrument. */
export class SectionSwitch {
  readonly element = document.createElement('button');

  constructor(
    private readonly onChange: (enabled: boolean) => void,
    options = {
      label: 'Projection',
    },
  ) {
    this.element.className = 'section-switch';
    this.element.type = 'button';
    this.element.setAttribute('aria-pressed', 'false');
    this.element.setAttribute('aria-label', options.label);
    this.element.textContent = options.label;
    this.element.addEventListener('click', () => {
      const enabled = this.element.getAttribute('aria-pressed') !== 'true';
      this.setEnabled(enabled);
    });
  }

  setEnabled(enabled: boolean): void {
    this.element.setAttribute('aria-pressed', String(enabled));
    this.onChange(enabled);
  }

  dispose(): void {
    this.element.remove();
  }
}
