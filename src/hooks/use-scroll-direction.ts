import { useEffect, useState } from 'react';

type Direction = 'up' | 'down';

/**
 * Track vertical scroll direction. Used to auto-hide the header on scroll
 * down and reveal it on scroll up. Ignores tiny jitters below `threshold`.
 */
export function useScrollDirection(threshold = 8) {
  const [direction, setDirection] = useState<Direction>('up');
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      setAtTop(y < 16);
      const delta = y - lastY;
      if (Math.abs(delta) >= threshold) {
        setDirection(delta > 0 ? 'down' : 'up');
        lastY = y;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return { direction, atTop };
}
