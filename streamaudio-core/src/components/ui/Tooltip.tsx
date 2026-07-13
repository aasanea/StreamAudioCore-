import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  content,
  children,
  delay = 500,
  position = "top",
  className = ""
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPositionStyles = () => {
    switch (position) {
      case "top":
        return { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "8px" };
      case "bottom":
        return { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "8px" };
      case "left":
        return { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: "8px" };
      case "right":
        return { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: "8px" };
      default:
        return {};
    }
  };

  const getInitialAnimation = () => {
    switch (position) {
      case "top": return { opacity: 0, y: 5, x: "-50%" };
      case "bottom": return { opacity: 0, y: -5, x: "-50%" };
      case "left": return { opacity: 0, x: 5, y: "-50%" };
      case "right": return { opacity: 0, x: -5, y: "-50%" };
      default: return { opacity: 0 };
    }
  };

  const getAnimate = () => {
    switch (position) {
      case "top": return { opacity: 1, y: 0, x: "-50%" };
      case "bottom": return { opacity: 1, y: 0, x: "-50%" };
      case "left": return { opacity: 1, x: 0, y: "-50%" };
      case "right": return { opacity: 1, x: 0, y: "-50%" };
      default: return { opacity: 1 };
    }
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={getInitialAnimation()}
            animate={getAnimate()}
            exit={getInitialAnimation()}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ ...getPositionStyles(), position: "absolute", zIndex: 100 }}
            className="pointer-events-none whitespace-nowrap rounded-md bg-[#0a1217] border border-ocean-500/20 px-3 py-1.5 text-[11px] font-bold text-ocean-100 shadow-xl"
            dir="rtl"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
