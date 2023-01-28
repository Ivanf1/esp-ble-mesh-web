import { motion } from "framer-motion";

interface Props {
  total: number;
  completed: number;
  /** show label as completed/total right of progress bar */
  showLabel: boolean;
}

const ProgressBar = ({ total, completed, showLabel }: Props) => {
  return (
    <div className={`flex items-center w-full ${showLabel && "space-x-4"}`}>
      <div className="w-full h-[14px] rounded-lg bg-border">
        <motion.div
          initial={{ width: "0%" }}
          whileInView={{ width: `${completed / (total / 100)}%` }}
          viewport={{ once: true }}
          transition={{
            duration: 0.2,
          }}
          className="h-[14px] rounded-lg bg-secondary"
        ></motion.div>
      </div>
      {showLabel && <span>{completed}%</span>}
    </div>
  );
};

export default ProgressBar;
