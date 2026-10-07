import { motion, useReducedMotion } from 'motion/react';

// One place where prefers-reduced-motion is honoured, so each section does not
// have to remember. Under reduced motion the element renders in place, visible.
export default function Reveal({ as = 'div', delay = 0, className = '', children }) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
