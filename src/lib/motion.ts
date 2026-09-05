import type { Variants } from "framer-motion";

/** Reveal con jerarquia: el elemento principal entra primero y con mas recorrido; el resto lo sigue con stagger corto. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
  }),
};

export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeSwift = [0.65, 0, 0.35, 1] as const;
