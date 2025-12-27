import { atom, useAtom } from "jotai";
import { useEffect, useState } from "react";

const isCountdownCompleteAtom = atom(false);

export const useCountdown = (duration: number, intervalMs = 1000) => {
  const [, setElapsedTime] = useState(0);
  const [isCountdownComplete, setIsCountdownComplete] = useAtom(
    isCountdownCompleteAtom
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prevElapsedTime) => {
        const newElapsedTime = prevElapsedTime + intervalMs;

        if (newElapsedTime >= duration) {
          setIsCountdownComplete(true);

          clearInterval(interval);
        }

        return newElapsedTime;
      });
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [duration, intervalMs]);

  return { isCountdownComplete };
};
