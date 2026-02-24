// CompaniesPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "./ui";
import { CompanyChip, remainingBreakdown } from "./ui";
import { Client, Product, DBTask, Page, TASK_WEIGHT } from "./types";

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

export function CompaniesPage({
  companies,
  tasks,
  clients,
  products,
  onCompanyClick,
  onClientClick,
  onProductClick,
  onTaskClick,
}: {
  companies: string[];
  tasks: DBTask[];
  clients: Client[];
  products: Product[];
  onCompanyClick: (companyName: string) => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
  onTaskClick?: (task: DBTask) => void;
}) {
  return (
    <div className="space-y-6">
      {companies.map((companyName) => {
        const companyTasks = tasks.filter((t) => t.company_name === companyName);
        const openTasks = companyTasks.filter(
          (t) => t.status !== "completed" && t.status !== "archived"
        );

        const progress = calculateCompanyProgress(companyName, tasks);
        const remaining = remainingBreakdown(companyName, tasks);

        // Impact breakdown for open tasks
        const sCount = openTasks.filter((t) => t.impact === "small").length;
        const mCount = openTasks.filter((t) => t.impact === "medium").length;
        const lCount = openTasks.filter((t) => t.impact === "large").length;

        // Tasks sorted: focus first, then large → medium → small
        const impactOrder = { large: 0, medium: 1, small: 2 };
        const sortedTasks = [...openTasks].sort((a, b) => {
          if (a.status === "focus" && b.status !== "focus") return -1;
          if (b.status === "focus" && a.status !== "focus") return 1;
          return impactOrder[a.impact] - impactOrder[b.impact];
        }).slice(0, 6);

        // Client / product tiles
        const companyClients = clients
          .filter((c) => c.company === companyName || c.company_name === companyName)
          .slice(0, 4);

        const companyProducts = products
          .filter((p) => p.company === companyName || p.company_name === companyName)
          .slice(0, 6);

        const isMaire = companyName === "Mairé";
        const items: any[] = isMaire ? companyProducts : companyClients;

        return (
          <Card
            key={companyName}
            onClick={() => onCompanyClick(companyName)}
          >
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 200 150" className="w-7 h-7 opacity-60">
                      <path d="M0,150 L50,80 L100,100 L150,40 L200,150 Z" fill="#0F766E" />
                      <circle cx="160" cy="40" r="15" fill="#0F766E" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{companyName}</h3>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <CompanyChip name={companyName} />
                      <span className="text-xs text-neutral-500">{openTasks.length} open</span>
                      {remaining.total > 0 && (
                        <div className="flex items-center gap-1">
                          {sCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">{sCount}S</span>}
                          {mCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{mCount}M</span>}
                          {lCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{lCount}L</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-teal-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-teal-600"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">{progress}%</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {remaining.total === 0 ? "All clear" : `${remaining.total} remaining`}
                  </span>
                </div>
              </div>

              {/* Two-column body: clients/products left, tasks right */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left: client / product tiles */}
                <div>
                  <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    {isMaire ? "Products" : "Clients"}
                  </div>
                  <div className={`grid gap-2 ${isMaire ? "grid-cols-3" : "grid-cols-2"}`}>
                    {items.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          isMaire ? onProductClick(item as Product) : onClientClick(item as Client);
                        }}
                        className={`relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                          isMaire ? "aspect-[3/4]" : "aspect-[4/3]"
                        }`}
                        style={{
                          backgroundImage: item.photo_url
                            ? `url(${item.photo_url})`
                            : `linear-gradient(135deg, #F0FAF7 0%, #E2F5EF 100%)`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        {!item.photo_url && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg viewBox="0 0 200 150" className="w-3/4 h-3/4 opacity-20">
                              <path d="M0,150 L50,80 L100,100 L150,40 L200,150 Z" fill="#0F766E" />
                              <circle cx="160" cy="40" r="15" fill="#0F766E" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-medium truncate">{item.name}</p>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="col-span-2 text-xs text-neutral-400 py-4">
                        No {isMaire ? "products" : "clients"} yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: open tasks */}
                <div>
                  <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    Open Tasks
                  </div>
                  <div className="space-y-1.5">
                    {sortedTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-colors ${
                          onTaskClick ? "cursor-pointer hover:border-teal-200 hover:bg-teal-50/40" : "cursor-default"
                        } bg-white`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          t.status === "focus" ? "bg-teal-500" : "bg-neutral-300"
                        }`} />
                        <span className="text-xs text-neutral-700 truncate flex-1">{t.title}</span>
                        {t.assignee_name && (
                          <span className="text-[10px] text-neutral-400 flex-shrink-0 truncate max-w-[60px]">
                            {t.assignee_name.split(" ")[0]}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize ${
                          t.impact === "large" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          t.impact === "medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-sky-50 text-sky-700 border border-sky-200"
                        }`}>{t.impact}</span>
                      </div>
                    ))}
                    {openTasks.length === 0 && (
                      <div className="text-xs text-neutral-400 py-4">All clear!</div>
                    )}
                    {openTasks.length > 6 && (
                      <div className="text-[10px] text-neutral-400 text-right pt-1">
                        +{openTasks.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
