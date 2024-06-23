import { AnimatePresence, motion } from "framer-motion";
import { FC, PropsWithChildren } from "react";

interface PageProps extends PropsWithChildren {
  className?: string;
}

export const Page: FC<PageProps> = ({ children, className }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
