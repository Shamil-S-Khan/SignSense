import { motion } from "framer-motion";

interface Props {
  hearts: number;
}

export function HeartBar({ hearts }: Props) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: i <= hearts ? 1 : 0.8, opacity: i <= hearts ? 1 : 0.3 }}
          className="text-red-500 text-2xl"
        >
          ❤️
        </motion.div>
      ))}
    </div>
  );
}
