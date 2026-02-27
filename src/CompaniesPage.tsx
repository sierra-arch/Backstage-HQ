// CompaniesPage.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "./ui";
import { Client, Product, DBTask, TASK_WEIGHT } from "./types";
import { supabase } from "./supabase";

function calculateClientProgress(clientId: string, tasks: DBTask[]) {
  const relevant = tasks.filter(
    (t) => t.client_id === clientId && t.status !== "archived"
  );
  if (relevant.length === 0) return null;
  let total = 0;
  let completed = 0;
  relevant.forEach((t) => {
    total += TASK_WEIGHT[t.impact];
    if (t.status === "completed") completed += TASK_WEIGHT[t.impact];
  });
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function progressColor(pct: number) {
  if (pct >= 70) return "bg-teal-500";
  if (pct >= 40) return "bg-amber-400";
  return "bg-red-400";
}

function calculateCompanyProgress(companyName: string, tasks: DBTask[]) {
  const relevant = tasks.filter(
    (t) => t.company_name === companyName && t.status !== "archived"
  );
  if (relevant.length === 0) return 100;
  let total = 0;
  let completed = 0;
  relevant.forEach((t) => {
    total += TASK_WEIGHT[t.impact];
    if (t.status === "completed") completed += TASK_WEIGHT[t.impact];
  });
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

type CompanyRow = { id: string; name: string; software_links?: { name: string; url: string }[] | null };

/* ── Sortable client card ── */
function SortableClientCard({
  client,
  tasks,
  onClientClick,
}: {
  client: Client;
  tasks: DBTask[];
  onClientClick: (c: Client) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
  };

  const clientTasks = tasks.filter(
    (t) => t.client_id === client.id && t.status !== "archived"
  );
  const clientProgress = calculateClientProgress(client.id, tasks);
  const completedCount = clientTasks.filter((t) => t.status === "completed").length;
  const openCount = clientTasks.filter((t) => t.status !== "completed").length;

  return (
    <div ref={setNodeRef} style={style} className="w-44 shrink-0">
      <div
        onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
        className="rounded-xl border bg-white overflow-hidden cursor-pointer hover:shadow-md hover:border-teal-200 transition-all"
      >
        <div className="p-2.5 flex items-start gap-2">
          {/* Round avatar — also the drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="w-12 h-12 rounded-full overflow-hidden shrink-0 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            {client.photo_url ? (
              <img src={client.photo_url} alt={client.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-teal-100 flex items-center justify-center">
                <span className="text-teal-700 font-bold text-[11px] leading-none select-none">
                  {client.name.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-0.5 pt-0.5">
            <p className="text-xs font-semibold text-neutral-800 truncate leading-tight">{client.name}</p>
            {client.scope && (
              <p className="text-[10px] text-neutral-500 line-clamp-1 leading-snug">{client.scope}</p>
            )}
            {client.deadline && (
              <span className="text-[10px] font-medium text-teal-600 block">
                {new Date(client.deadline).toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
            )}
            {clientProgress !== null && (
              <>
                <div className="h-1 w-3/4 rounded-full bg-neutral-100 overflow-hidden mt-3">
                  <motion.div
                    className={`h-full rounded-full ${progressColor(clientProgress)}`}
                    initial={false}
                    animate={{ width: `${clientProgress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export function CompaniesPage({
  companies,
  tasks,
  clients,
  products,
  companiesData = [],
  onCompanyClick,
  onClientClick,
  onProductClick,
}: {
  companies: string[];
  tasks: DBTask[];
  clients: Client[];
  products: Product[];
  companiesData?: CompanyRow[];
  onCompanyClick: (companyName: string) => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
  onTaskClick?: (task: DBTask) => void;
}) {
  // Custom drag order per company (keyed by company ID or name)
  const [orderedIds, setOrderedIds] = useState<Record<string, string[]>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function sortByDeadline(list: Client[]): Client[] {
    return [...list].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }

  function getOrderedClients(key: string, list: Client[]): Client[] {
    const custom = orderedIds[key];
    if (custom) {
      return custom.map((id) => list.find((c) => c.id === id)).filter(Boolean) as Client[];
    }
    return sortByDeadline(list);
  }

  async function handleDragEnd(event: DragEndEvent, key: string, list: Client[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = getOrderedClients(key, list).map((c) => c.id);
    const newOrder = arrayMove(current, current.indexOf(active.id as string), current.indexOf(over.id as string));
    setOrderedIds((prev) => ({ ...prev, [key]: newOrder }));
    // Persist sort_order to DB (requires: ALTER TABLE clients ADD COLUMN IF NOT EXISTS sort_order integer)
    newOrder.forEach((id, idx) => {
      supabase.from("clients").update({ sort_order: idx }).eq("id", id);
    });
  }

  return (
    <div className="space-y-6">
      {companies.map((companyName) => {
        const companyTasks = tasks.filter((t) => t.company_name === companyName);
        const openTasks = companyTasks.filter(
          (t) => t.status !== "completed" && t.status !== "archived"
        );
        const progress = calculateCompanyProgress(companyName, tasks);

        const companyRow = companiesData.find(
          (c) => c.name === companyName || c.name.toLowerCase() === companyName.toLowerCase()
        );
        const tools: { name: string; url: string }[] = companyRow?.software_links ?? [];

        const companyClients = clients.filter((c) =>
          (companyRow && c.company_id === companyRow.id) ||
          c.company_name === companyName
        );

        const companyProducts = products
          .filter((p) =>
            (companyRow && p.company_id === companyRow.id) ||
            p.company_name === companyName
          )
          .slice(0, 6);

        const isMaire = companyName === "Mairë";
        const key = companyRow?.id ?? companyName;
        const orderedClients = getOrderedClients(key, companyClients);

        return (
          <section
            key={companyName}
            onClick={() => onCompanyClick(companyName)}
            className="rounded-2xl border border-neutral-200 bg-white p-5 md:p-6 shadow-sm cursor-pointer hover:border-teal-300 transition-colors"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-extrabold text-teal-900 tracking-tight">{companyName}</h3>
                  <span className="text-xs text-neutral-500">{openTasks.length} open tasks</span>
                </div>
                <div className="flex flex-wrap justify-end gap-2 shrink-0 max-w-[55%]">
                  {tools.map((tool, i) => (
                    <a
                      key={i}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-3 py-1.5 rounded-xl border bg-white hover:bg-teal-50 hover:border-teal-200 text-neutral-700 font-medium transition-colors whitespace-nowrap"
                    >
                      {tool.name} →
                    </a>
                  ))}
                </div>
              </div>

              {/* Clients / Products */}
              <div>
                <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  {isMaire ? "Products" : "Clients"}
                </div>

                {isMaire ? (
                  <div className="relative">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {companyProducts.map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => { e.stopPropagation(); onProductClick(item as Product); }}
                        className="relative w-36 shrink-0 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity aspect-[3/4]"
                        style={{
                          backgroundImage: item.photo_url
                            ? `url(${item.photo_url})`
                            : `linear-gradient(135deg, #F0FAF7 0%, #E2F5EF 100%)`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-medium truncate">{item.name}</p>
                        </div>
                      </div>
                    ))}
                    {companyProducts.length === 0 && (
                      <div className="text-xs text-neutral-400 py-4">No products yet.</div>
                    )}
                  </div>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-white to-transparent" />
                  </div>
                ) : (
                  <div className="relative">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, key, companyClients)}
                  >
                    <SortableContext items={orderedClients.map((c) => c.id)} strategy={rectSortingStrategy}>
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {orderedClients.map((client) => (
                          <SortableClientCard
                            key={client.id}
                            client={client}
                            tasks={tasks}
                            onClientClick={onClientClick}
                          />
                        ))}
                        {orderedClients.length === 0 && (
                          <div className="text-xs text-neutral-400 py-4">No clients yet.</div>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-white to-transparent" />
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
