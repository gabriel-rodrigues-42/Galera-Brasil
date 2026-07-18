/** Shared chrome styles adopted by every UI component's shadow root, on top
 * of its own sheet: `this.shadowRoot!.adoptedStyleSheets = [sharedStyles, ownSheet]`.
 * See DESIGN.md §4 — panel-level components are the unit; this sheet is the
 * only place cross-component primitives (buttons, inputs, scrollbars) live. */
export const sharedStyles = new CSSStyleSheet();
sharedStyles.replaceSync(`
  * {
    box-sizing: border-box;
  }

  button {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-primary);
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    transition: filter var(--transition-fast), transform var(--transition-fast);
  }

  button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  button:disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;
    filter: none;
  }

  button.primary {
    background: var(--color-brand-primary);
    color: var(--color-bg-base);
    border: none;
  }

  input,
  textarea,
  select {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background: var(--color-bg-elevated);
    border: var(--border-ui-stroke);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2) var(--space-3);
  }

  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    padding: 0;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-elevated);
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--color-brand-primary);
    cursor: pointer;
  }

  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-elevated);
  }

  input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: none;
    border-radius: 50%;
    background: var(--color-brand-primary);
    cursor: pointer;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
  }

  .hidden {
    display: none !important;
  }
`);
