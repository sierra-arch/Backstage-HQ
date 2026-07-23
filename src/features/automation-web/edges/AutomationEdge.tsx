import React from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

// Subtle connector -- deliberately lighter stroke weight than a selected
// node's border, so edges never compete visually with nodes (Coggle-style
// calm canvas, not HighLevel's denser look).
export function AutomationEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return <BaseEdge id={id} path={edgePath} style={{ stroke: "#D3E9CE", strokeWidth: 2 }} />;
}
