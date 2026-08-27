import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { nextNavCompact } from './navAdaptivity';

type NavAdaptivityValue = {
  compact: boolean;
  reportScroll: (offsetY: number) => void;
  expand: () => void;
};

const NavAdaptivityContext = createContext<NavAdaptivityValue>({
  compact: false,
  reportScroll: () => {},
  expand: () => {},
});

export function NavAdaptivityProvider({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (alive) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(!!enabled);
      if (enabled) setCompact(false);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  const reportScroll = useCallback(
    (offsetY: number) => {
      const deltaY = offsetY - lastY.current;
      lastY.current = offsetY;
      setCompact((current) =>
        nextNavCompact({ compact: current, offsetY, deltaY, reduceMotion })
      );
    },
    [reduceMotion]
  );

  const expand = useCallback(() => {
    lastY.current = 0;
    setCompact(false);
  }, []);

  return (
    <NavAdaptivityContext.Provider value={{ compact, reportScroll, expand }}>
      {children}
    </NavAdaptivityContext.Provider>
  );
}

export function useNavAdaptivity() {
  return useContext(NavAdaptivityContext);
}
