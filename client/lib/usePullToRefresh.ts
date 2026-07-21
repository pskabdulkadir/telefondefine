import { useEffect, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  const pullStartRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const refreshIndicatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    const documentElement = document.documentElement;

    const handleTouchStart = (e: TouchEvent) => {
      // Sadece sayfa en üstündeyse pull-to-refresh başlat
      if (documentElement.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pullStartRef.current = startY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStartRef.current === 0 || isRefreshingRef.current) return;
      if (documentElement.scrollTop !== 0) {
        pullStartRef.current = 0;
        return;
      }

      currentY = e.touches[0].clientY;
      const diff = currentY - pullStartRef.current;

      if (diff > 0) {
        e.preventDefault();
        // Indicator göster
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.style.height = `${Math.min(diff, threshold)}px`;
          refreshIndicatorRef.current.style.opacity = `${Math.min(diff / threshold, 1)}`;
          refreshIndicatorRef.current.style.display = 'block';
        }
      }
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      if (pullStartRef.current === 0 || isRefreshingRef.current) {
        pullStartRef.current = 0;
        return;
      }

      const diff = currentY - pullStartRef.current;
      pullStartRef.current = 0;

      if (diff > threshold) {
        isRefreshingRef.current = true;
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.style.height = `${threshold}px`;
          refreshIndicatorRef.current.innerHTML = 'Yenileniyor...';
        }

        try {
          await onRefresh();
        } catch (error) {
          console.error('Yenileme hatası:', error);
        } finally {
          isRefreshingRef.current = false;
          if (refreshIndicatorRef.current) {
            refreshIndicatorRef.current.style.height = '0px';
            refreshIndicatorRef.current.style.opacity = '0';
            setTimeout(() => {
              if (refreshIndicatorRef.current) {
                refreshIndicatorRef.current.style.display = 'none';
              }
            }, 300);
          }
        }
      } else {
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.style.height = '0px';
          refreshIndicatorRef.current.style.opacity = '0';
          setTimeout(() => {
            if (refreshIndicatorRef.current) {
              refreshIndicatorRef.current.style.display = 'none';
            }
          }, 300);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold]);

  return refreshIndicatorRef;
};
