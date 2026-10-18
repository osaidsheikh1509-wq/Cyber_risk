import React, { useState, useEffect } from 'react';
import FolderFloat, { FolderFloatProps } from './FolderFloat';
import { useTheme } from '../../context/ThemeContext';

export interface ThemedFolderFloatProps extends FolderFloatProps {
  maxSpread?: number;
}

export const ThemedFolderFloat: React.FC<ThemedFolderFloatProps> = ({
  trigger: userTrigger,
  spread: userSpread,
  folderColor: customFolderColor,
  frontColor: customFrontColor,
  paperColor: customPaperColor,
  itemColor: customItemColor,
  itemTextColor = '#090d16',
  labelColor: customLabelColor,
  width = 190,
  height = 140,
  maxSpread = 180,
  ...rest
}) => {
  const { isLight } = useTheme();

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none)').matches;
  });

  const [responsiveSpread, setResponsiveSpread] = useState<number>(() => {
    if (typeof window === 'undefined') return 180;
    const base = userSpread ?? maxSpread;
    return Math.max(90, Math.min(base, Math.floor((window.innerWidth - 48) / 2)));
  });

  useEffect(() => {
    const hoverMq = window.matchMedia('(hover: none)');
    const handleHoverChange = (e: MediaQueryListEvent) => {
      setIsTouchDevice(e.matches);
    };

    const handleResize = () => {
      const base = userSpread ?? maxSpread;
      const calculated = Math.max(90, Math.min(base, Math.floor((window.innerWidth - 48) / 2)));
      setResponsiveSpread(calculated);
    };

    if (hoverMq.addEventListener) {
      hoverMq.addEventListener('change', handleHoverChange);
    } else {
      hoverMq.addListener(handleHoverChange);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      if (hoverMq.removeEventListener) {
        hoverMq.removeEventListener('change', handleHoverChange);
      } else {
        hoverMq.removeListener(handleHoverChange);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [userSpread, maxSpread]);

  const effectiveTrigger = userTrigger ?? (isTouchDevice ? 'click' : 'hover');

  // Compute theme-aware defaults if not explicitly passed
  const folderColor = customFolderColor ?? (isLight ? '#cbd5e1' : '#0f172a');
  const frontColor = customFrontColor ?? (isLight ? '#e2e8f0' : '#1e293b');
  const paperColor = customPaperColor ?? (isLight ? '#ffffff' : '#334155');
  const labelColor = customLabelColor ?? (isLight ? '#0f172a' : '#f8fafc');
  const itemColor = customItemColor ?? (isLight ? '#06b6d4' : '#22d3ee');

  return (
    <FolderFloat
      trigger={effectiveTrigger}
      spread={responsiveSpread}
      folderColor={folderColor}
      frontColor={frontColor}
      paperColor={paperColor}
      itemColor={itemColor}
      itemTextColor={itemTextColor}
      labelColor={labelColor}
      width={width}
      height={height}
      {...rest}
    />
  );
};

export default ThemedFolderFloat;
