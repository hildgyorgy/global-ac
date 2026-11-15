/** Small keyboard-accessible brass instrument lever. */
export class SectionSwitch {
  readonly element = document.createElement('button');

  constructor(private readonly onChange: (enabled: boolean) => void, options = {
    label: 'Metszetnézet', off: 'Glóbusz', on: 'Metszet',
  }) {
    this.element.className = 'section-switch';
    this.element.type = 'button';
    this.element.setAttribute('role', 'switch');
    this.element.setAttribute('aria-checked', 'false');
    this.element.setAttribute('aria-label', options.label);
    this.element.innerHTML = `
      <span class="switch-label globe-label">${options.off}</span>
      <span class="lever-housing" aria-hidden="true"><span class="lever-arm"></span></span>
      <span class="switch-label section-label">${options.on}</span>`;
    this.element.addEventListener('click', () => {
      const enabled = this.element.getAttribute('aria-checked') !== 'true';
      this.setEnabled(enabled);
    });
  }

  setEnabled(enabled: boolean): void {
    this.element.setAttribute('aria-checked', String(enabled));
    this.onChange(enabled);
  }

  dispose(): void {
    this.element.remove();
  }
}
