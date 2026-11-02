"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export function MotionPage({
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={false}
      animate="visible"
      variants={pageVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}
