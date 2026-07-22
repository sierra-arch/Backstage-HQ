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
}: {
  companies: string[];
  tasks: DBTask[];
  clients: Client[];
  products: Product[];
  onCompanyClick: (companyName: string) => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
}) {
  const SocialIcon = ({ platform }: { platform: string }) => {
    const letters: Record<string, string> = {
      Instagram: "IG",
      Facebook: "FB",
      Twitter: "TW",
      Website: "W",
      TikTok: "TT",
      Etsy: "ET",
      LinkedIn: "LI",
      Pinterest: "PI",
    };
    return (
      <div className="w-8 h-8 rounded-full border-2 border-teal-700 flex items-center justify-center text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors">
        <span className="text-[9px] font-bold">
          {letters[platform] || platform.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  };

  // NOTE: We don't assume company metadata columns here.
  // The drawer is the “details” place; this page is a fast overview.
  const chipColors: Record<string, string> = {
    "Prose Florals": "bg-lime-50 text-lime-900 border-lime-200",
    Backstage: "bg-teal-100 text-teal-900 border-teal-300",
    "Mairé": "bg-emerald-50 text-emerald-900 border-emerald-200",
  };

  return (
    <div className="space-y-6">
      {companies.map((companyName) => {
        const companyTasks = tasks.filter((t) => t.company_name === companyName);
        const open = companyTasks.filter(
          (t) => t.status !== "completed" && t.status !== "archived"
        ).length;

        const progress = calculateCompanyProgress(companyName, tasks);
        const remaining = remainingBreakdown(companyName, tasks);
        const tooltip =
          remaining.total === 0
            ? "All clear 🎉"
            : `${remaining.small} small • ${remaining.medium} medium • ${remaining.large} large remaining`;

        // Real data tiles
        const companyClients = clients
          .filter((c) => c.company === companyName || c.company_name === companyName)
          .slice(0, 4);

        const companyProducts = products
          .filter((p) => p.company === companyName || p.company_name === companyName)
          .slice(0, 6);

        const items: any[] =
          companyName === "Mairé" ? companyProducts : companyClients;

        return (
          <Card
            key={companyName}
            className="border-2 border-teal-100 hover:border-teal-200 transition-colors"
            onClick={() => onCompanyClick(companyName)}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 200 150" className="w-7 h-7 opacity-60">
                      <path
                        d="M0,150 L50,80 L100,100 L150,40 L200,150 Z"
                        fill="#0F766E"
                      />
                      <circle cx="160" cy="40" r="15" fill="#0F766E" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{companyName}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <CompanyChip name={companyName} />
                      <span className="text-xs text-neutral-500">{open} open</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2" title={tooltip}>
                    <div className="h-2 w-32 rounded-full bg-teal-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-teal-600"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 w-10">
                      {progress}%
                    </span>
                  </div>

                  {/* Chips (safe placeholders if you later add these links per company) */}
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${
                        chipColors[companyName] || "bg-neutral-50 text-neutral-900 border-neutral-200"
                      }`}
                    >
                      Overview
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {/* Keep icon row for visual parity; real links live in the drawer */}
                    <span><SocialIcon platform="Website" /></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      companyName === "Mairé"
                        ? onProductClick(item as Product)
                        : onClientClick(item as Client);
                    }}
                    className={`relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                      companyName === "Mairé" ? "aspect-[3/4]" : "aspect-[4/3]"
                    }`}
                    style={{
                      backgroundImage: item.photo_url
                        ? `url(${item.photo_url})`
                        : `linear-gradient(135deg, #CDEDE6 0%, #B8E0D9 100%)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {!item.photo_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          viewBox="0 0 200 150"
                          className="w-3/4 h-3/4 opacity-30"
                        >
                          <path
                            d="M0,150 L50,80 L100,100 L150,40 L200,150 Z"
                            fill="#0F766E"
                          />
                          <circle cx="160" cy="40" r="15" fill="#0F766E" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium truncate">
                        {item.name}
                      </p>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="col-span-12 text-xs text-neutral-500">
                    No {companyName === "Mairé" ? "products" : "clients"} yet.
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
