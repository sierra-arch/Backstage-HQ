import React, { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { updateAutomationPosition } from "../../useDatabase";
import { canViewAutomation, canEditAutomation } from "./permissions";
import type { Automation, AutomationEdge, CompanyMember } from "./types";
import { nodeTypes } from "./nodes/nodeTypes";
import { edgeTypes } from "./edges/edgeTypes";
import type { AutomationNodeData } from "./nodes/AutomationNode";

export function AutomationWebCanvas({
  automations,
  edges: automationEdges,
  isFounder,
  member,
  onSelectAutomation,
}: {
  automations: Automation[];
  edges: AutomationEdge[];
  isFounder: boolean;
  member: CompanyMember | null;
  onSelectAutomation: (automation: Automation) => void;
}) {
  const visible = useMemo(
    () => automations.filter((a) => canViewAutomation(a, isFounder, member)),
    [automations, isFounder, member]
  );
  const visibleIds = useMemo(() => new Set(visible.map((a) => a.id)), [visible]);

  const initialNodes: Node<AutomationNodeData>[] = useMemo(
    () =>
      visible.map((automation) => ({
        id: automation.id,
        type: "automation",
        position: { x: automation.position_x, y: automation.position_y },
        data: { automation, editable: canEditAutomation(automation, isFounder, member) },
      })),
    [visible, isFounder, member]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      automationEdges
        .filter((e) => visibleIds.has(e.source_automation_id) && visibleIds.has(e.target_automation_id))
        .map((e) => ({ id: e.id, source: e.source_automation_id, target: e.target_automation_id, type: "automation" })),
    [automationEdges, visibleIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Server data is the source of truth -- resync whenever it changes
  // (realtime updates, a confirmed edit elsewhere, switching companies).
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const automation = visible.find((a) => a.id === node.id);
    if (automation) onSelectAutomation(automation);
  };

  // Repositioning is pure presentation -- saves immediately, no confirm
  // step (per the spec's "no auto-save on drag... EXCEPT reposition" rule).
  const handleNodeDragStop: OnNodeDrag = (_event, node) => {
    updateAutomationPosition(node.id, node.position.x, node.position.y);
  };

  return (
    <div className="h-full w-full rounded-3xl border border-neutral-200/80 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#E7E5E4" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
