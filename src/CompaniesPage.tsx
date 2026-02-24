// CompaniesPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "./ui";
import { remainingBreakdown } from "./ui";
import { Client, Product, DBTask, TASK_WEIGHT } from "./types";

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

        const isMaire = companyName === "Mairé";
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
                  <h3 className="text-3xl font-bold text-teal-900 tracking-tight">{companyName}</h3>
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
