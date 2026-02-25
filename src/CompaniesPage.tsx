// CompaniesPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "./ui";
import { remainingBreakdown } from "./ui";
import { Client, Product, DBTask, TASK_WEIGHT } from "./types";

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
  return (
    <div className="space-y-6">
      {companies.map((companyName) => {
        const companyTasks = tasks.filter((t) => t.company_name === companyName);
        const openTasks = companyTasks.filter(
          (t) => t.status !== "completed" && t.status !== "archived"
        );

        const progress = calculateCompanyProgress(companyName, tasks);
        const remaining = remainingBreakdown(companyName, tasks);

        // Client / product tiles
        const companyClients = clients
          .filter((c) => c.company_name === companyName)
          .slice(0, 4);

        const companyProducts = products
          .filter((p) => p.company_name === companyName)
          .slice(0, 6);

        const isMaire = companyName === "Mairë";
        const items: any[] = isMaire ? companyProducts : companyClients;

        // Software tools from DB
        const companyRow = companiesData.find((c) => c.name === companyName);
        const tools: { name: string; url: string }[] = companyRow?.software_links ?? [];

        return (
          <Card
            key={companyName}
            onClick={() => onCompanyClick(companyName)}
          >
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-teal-900 tracking-tight">{companyName}</h3>
                  <span className="text-xs text-neutral-500">{openTasks.length} open tasks</span>
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

              {/* Two-column body: clients/products left, tools right */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left: client / product tiles */}
                <div>
                  <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    {isMaire ? "Products" : "Clients"}
                  </div>
                  <div className={`grid gap-2 ${isMaire ? "grid-cols-3" : "grid-cols-2"}`}>
                    {items.map((item: any) => {
                      if (isMaire) {
                        // Products: keep original photo tile style
                        return (
                          <div
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); onProductClick(item as Product); }}
                            className="relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity aspect-[3/4]"
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
                        );
                      }
                      // Clients: card with photo + progress bar
                      const client = item as Client;
                      const clientProgress = calculateClientProgress(client.id, tasks);
                      const openCount = tasks.filter(
                        (t) => t.client_id === client.id && t.status !== "completed" && t.status !== "archived"
                      ).length;
                      return (
                        <div
                          key={client.id}
                          onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                          className="rounded-xl border bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        >
                          {/* Photo */}
                          <div
                            className="h-20 w-full"
                            style={{
                              backgroundImage: client.photo_url
                                ? `url(${client.photo_url})`
                                : `linear-gradient(135deg, #F0FAF7 0%, #E2F5EF 100%)`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          />
                          {/* Info */}
                          <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
                            <p className="text-xs font-semibold text-neutral-800 truncate">{client.name}</p>
                            {clientProgress !== null ? (
                              <>
                                <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full ${progressColor(clientProgress)}`}
                                    initial={false}
                                    animate={{ width: `${clientProgress}%` }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-neutral-400">
                                    {openCount > 0 ? `${openCount} open` : "All done"}
                                  </span>
                                  <span className="text-[10px] font-medium text-neutral-500">{clientProgress}%</span>
                                </div>
                              </>
                            ) : (
                              <p className="text-[10px] text-neutral-400">No tasks yet</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="col-span-2 text-xs text-neutral-400 py-4">
                        No {isMaire ? "products" : "clients"} yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: software tools */}
                <div>
                  <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                    Tools & Software
                  </div>
                  {tools.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool, i) => (
                        <a
                          key={i}
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs px-3 py-1.5 rounded-xl border bg-white hover:bg-teal-50 hover:border-teal-200 text-neutral-700 font-medium transition-colors"
                        >
                          {tool.name} →
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 py-1">
                      Click to add tools in the drawer.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
