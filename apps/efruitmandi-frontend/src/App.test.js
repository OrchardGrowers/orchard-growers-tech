import { render, screen } from '@testing-library/react';
import App from './App';

test("renders brand logo", () => {
  render(<App />);
  const logo = screen.getByAltText(/e-fruit mandi/i);
  expect(logo).toBeInTheDocument();
});
