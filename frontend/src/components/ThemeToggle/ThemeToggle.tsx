import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { isLight, toggleTheme } = useTheme();

  return (
    <label
      className={`theme-switch ${className}`}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label="Toggle light and dark theme"
        aria-checked={isLight}
        checked={isLight}
        onChange={toggleTheme}
      />
      <span className="theme-switch__slider" />
    </label>
  );
};

export default ThemeToggle;
