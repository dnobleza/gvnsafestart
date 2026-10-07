import { motion, useReducedMotion } from 'motion/react';

import Button from '../../components/Button';
import Container from '../../components/Container';

export default function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <section
      id="top"
      className="relative flex min-h-[100dvh] items-center overflow-hidden pt-28 pb-16"
    >
      {/* The business's own hero photograph, so it carries real alt text rather
          than being marked decorative. */}
      <img
        src="/hero-driving.jpg"
        alt="A GVN-Safestart instructor and student during a driving lesson"
        width="1900"
        height="790"
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />

      {/* Two scrim layers, because the real photo is unknown and contrast
          cannot depend on it. A flat tint knocks back highlights everywhere,
          then a directional gradient goes near-opaque under the text. The
          direction flips at lg: the text is a left column on desktop but full
          width on mobile, where a left-to-right fade would leave the end of
          every line unprotected. */}
      <div className="bg-surface-950/35 absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="from-surface-950/55 via-surface-950/90 to-surface-950/55 lg:from-surface-950/95 lg:via-surface-950/80 lg:via-55% lg:to-transparent absolute inset-0 -z-10 bg-gradient-to-b lg:bg-gradient-to-r"
        aria-hidden="true"
      />

      <Container className="relative z-10">
        <div className="max-w-xl lg:max-w-2xl">
          <motion.p
            {...rise(0)}
            className="text-accent-400 text-xs font-medium tracking-[0.18em] uppercase"
          >
            Private driving tutorial services
          </motion.p>

          <motion.h1
            {...rise(0.08)}
            className="mt-5 text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl"
          >
            Build confidence. Drive safely.
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="text-ink-100 mt-6 max-w-[52ch] text-lg leading-relaxed"
          >
            One-on-one lessons with a patient instructor, at your own pace, door to door.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
            <Button to="/book" size="lg">
              Book now
            </Button>
            <Button to="/login" variant="outlineOnMedia" size="lg">
              Sign in
            </Button>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
