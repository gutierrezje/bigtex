import { useEffect, useState } from "react";

export function useWindowFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    void window.bigTex.window.isFullscreen().then((value) => {
      if (active) setIsFullscreen(value);
    });
    const unsubscribe = window.bigTex.window.onFullscreenChanged(setIsFullscreen);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return isFullscreen;
}
