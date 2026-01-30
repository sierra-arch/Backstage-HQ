// DashboardApp.tsx (refactored, ready-to-go wiring for CompanyDrawer)
import "./styles.css";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  useTasks,
  useProfile,
  useTeamMembers,
  useClients,
  useProducts,
  useMessages,
  updateTask as dbUpdateTask,
  completeTask as dbCompleteTask,
  getCompanyByName,
  sendMessage,
} from "./useDatabase";

import { CompaniesPage } from "./CompaniesPage";
import { CompanyDrawer } from "./CompanyDrawer";
import { ChatPanel } from "./ChatPanel";
import { TaskModal, TaskCreateModal } from "./TaskModals";
import { Card } from "./ui";
import { fromDbToUi, Role, AppRole, isFounder, COMPANIES, Page, DBTask } from "./types";

function useSession() {
  const [s, setS] = React.useState<any>(undefined);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setS(sess ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return s;
}

export default function DashboardApp() {
  const session = useSession();
  const { profile } = useProfile();
  const { teamMembers } = useTeamMembers();

  const { tasks, refetch } = useTasks({ status: ["focus", "active", "submitted", "completed"] });
  const { clients, refetch: refetchClients } = useClients();
  const { products, refetch: refetchProducts } = useProducts();
  const { messages, unreadCount } = useMessages();

  const [page, setPage] = useState<Page>("Companies");
  const [showChat, setShowChat] = useState(false);

  const role: Role = profile?.role
    ? fromDbToUi[profile.role as AppRole]
    : "Founder";

  const currentUserId = profile?.id || null;

  const userName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.email?.split("@")[0] ??
    "Sierra";

  // Task modal state
  const [selectedTask, setSelectedTask] = useState<DBTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function openTaskModal(task: DBTask) {
    setSelectedTask(task);
    setShowTaskModal(true);
  }

  async function handleCompleteSelectedTask() {
    if (!selectedTask) return;
    await dbCompleteTask(selectedTask.id);
    await refetch();
  }

  // =========================
  // Company Drawer Wiring ✅
  // =========================
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [selectedCompanyRow, setSelectedCompanyRow] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!selectedCompanyName) {
        setSelectedCompanyRow(null);
        return;
      }
      const row = await getCompanyByName(selectedCompanyName);
      if (!mounted) return;
      setSelectedCompanyRow(row || { name: selectedCompanyName });
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedCompanyName]);

  const companyClients = useMemo(() => {
    if (!selectedCompanyRow) return [];
    // Prefer company_id when available, else fallback to name matching
    if (selectedCompanyRow.id) {
      return (clients || []).filter((c: any) => c.company_id === selectedCompanyRow.id);
    }
    return (clients || []).filter((c: any) => c.company === selectedCompanyRow.name);
  }, [clients, selectedCompanyRow]);

  const companyProducts = useMemo(() => {
    if (!selectedCompanyRow) return [];
    if (selectedCompanyRow.id) {
      return (products || []).filter((p: any) => p.company_id === selectedCompanyRow.id);
    }
    return (products || []).filter((p: any) => p.company === selectedCompanyRow.name);
  }, [products, selectedCompanyRow]);

  function openCompanyDrawer(companyName: string) {
    setSelectedCompanyName(companyName);
    setDrawerOpen(true);
  }

  function closeCompanyDrawer() {
    setDrawerOpen(false);
    // Keep selectedCompanyName so reopen is instant; clear if you prefer:
    // setSelectedCompanyName(null);
  }

  async function handleSendMessage(content: string, to?: string) {
    let toUserId: string | undefined;
    if (to) {
      const recipient = teamMembers.find((tm) => tm.display_name === to);
      toUserId = recipient?.id;
    }
    await sendMessage(content, toUserId);
  }

  function refetchCompanyData() {
    refetchClients?.();
    refetchProducts?.();
  }

  return (
    <div className="min-h-screen bg-[#F6FAF9]">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">Backstage Headquarters</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-2 hover:bg-teal-50 text-sm font-medium"
            >
              New Task
            </button>
            <button
              onClick={() => setShowChat(true)}
              className="relative rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm hover:bg-teal-100 transition-colors font-medium text-teal-900"
            >
              Inbox
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Companies page as the default view */}
        <CompaniesPage
          companies={[...COMPANIES]}
          tasks={tasks}
          clients={clients || []}
          products={products || []}
          onCompanyClick={openCompanyDrawer}
          onClientClick={() => {}}
          onProductClick={() => {}}
        />

        {/* Drawer */}
        <CompanyDrawer
          isOpen={drawerOpen}
          onClose={closeCompanyDrawer}
          role={role}
          company={selectedCompanyRow}
          tasks={tasks}
          clients={companyClients}
          products={companyProducts}
          onRefetch={refetchCompanyData}
        />

        {/* Task modals */}
        <TaskModal
          task={selectedTask}
          isOpen={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          onComplete={handleCompleteSelectedTask}
          role={role}
        />
        <TaskCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => refetch()}
          role={role}
          userName={userName}
          teamMembers={teamMembers}
        />

        {/* Chat */}
        <ChatPanel
          userName={userName}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={messages || []}
          onSendMessage={handleSendMessage}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
