import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('should render without crashing', () => {
    expect(() => {
      render(<App />);
    }).not.toThrow();
  });

  it('should be defined', () => {
    expect(App).toBeDefined();
  });
});
