"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Isla de animación: los `children` se renderizan en el servidor, aquí solo se
 * les añade una entrada al montar. Con `prefers-reduced-motion` no anima nada.
 *
 * Se usa `animate` (no `whileInView`): el contenido tiene que ser visible
 * siempre, aunque el IntersectionObserver no dispare.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  // Solo se anima `y`: sin tocar `opacity`, el contenido es visible aunque la
  // animación no llegue a ejecutarse (SSR, captura, JS lento). El desplazamiento
  // residual de 16px es inofensivo.
  return (
    <motion.div
      className={className}
      initial={{ y: 16 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
