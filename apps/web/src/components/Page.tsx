import { AnimatePresence, motion, type Variants } from "motion/react";
import type { FC, PropsWithChildren } from "react";

interface PageProps extends PropsWithChildren {
  className?: string;
}

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1],
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
    },
  },
};

export const itemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1],
    },
  },
};

export const Page: FC<PageProps> = ({ children, className }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate="animate"
        className={className}
        exit="exit"
        initial="initial"
        variants={pageVariants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
