import React, { useEffect, useRef, useState } from "react";
import { Text, TextProps } from "react-native";

interface Props extends Omit<TextProps, "children"> {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

/**
 * Counts smoothly from the previous value to the new one.
 * Used in the dashboard stat pills.
 */
export function AnimatedNumber({
  value, prefix = "", suffix = "", decimals = 0, duration = 700, style, ...rest
}: Props) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(0);

  useEffect(() => {
    if (shown === value) return;
    fromRef.current = shown;
    startRef.current = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (value - fromRef.current) * eased;
      setShown(decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const display = decimals > 0 ? shown.toFixed(decimals) : String(shown);
  return <Text style={style} {...rest}>{prefix}{display}{suffix}</Text>;
}
