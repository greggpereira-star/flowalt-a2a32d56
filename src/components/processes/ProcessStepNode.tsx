import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface ProcessStepData {
  stepNumber: number;
  title: string;
  description?: string;
  onNodeClick?: (id: string) => void;
  [key: string]: unknown;
}

function ProcessStepNode({ id, data, selected }: NodeProps) {
  const { stepNumber, title, onNodeClick } = data as ProcessStepData;

  return (
    <div
      onClick={() => onNodeClick?.(id)}
      className="cursor-pointer group"
      style={{ minWidth: 180 }}
    >
      <div
        className="rounded-xl px-5 py-4 transition-all duration-200"
        style={{
          background: selected ? "linear-gradient(135deg, #0055ff15, #00aeff15)" : "#121418",
          border: `1.5px solid ${selected ? "#0055ff" : "#22262d"}`,
          boxShadow: selected
            ? "0 0 20px rgba(0,85,255,0.15), 0 4px 12px rgba(0,0,0,0.4)"
            : "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg text-xs font-bold shrink-0"
            style={{
              width: 28,
              height: 28,
              background: selected
                ? "linear-gradient(135deg, #0055ff, #00aeff)"
                : "#1a1e24",
              color: selected ? "#fff" : "#6b7280",
              border: selected ? "none" : "1px solid #22262d",
            }}
          >
            {stepNumber}
          </div>
          <span
            className="text-sm font-medium truncate"
            style={{ color: selected ? "#e2e8f0" : "#94a3b8" }}
          >
            {title}
          </span>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#0055ff", border: "2px solid #0a0a0c", width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#0055ff", border: "2px solid #0a0a0c", width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(ProcessStepNode);
