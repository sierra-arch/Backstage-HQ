// DashboardApp.tsx - Main app shell: routing, state, and handlers
import "./styles.css";
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
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
import {
  fromDbToUi, isFounder,
  COMPANIES, LEVEL_XP_THRESHOLD,
  Role, AppRole, Page, Client, Product, DBTask, Accomplishment,
} from "./types";

// Page components
import { CompaniesPage as CompaniesPageDB } from "./CompaniesPage";
import { CompanyDrawer } from "./CompanyDrawer";
import { ChatPanel } from "./ChatPanel";
import { TodayFounder, TodayTeam, Confetti } from "./TodayPage";
import { TasksPage } from "./TasksPage";
import { MyTeamPage } from "./MyTeamPage";
import { Sidebar, TopHeader } from "./Navigation";
import { Card, LevelRing } from "./ui";
import {
  TaskModal,
  TaskCreateModal,
  ClientModal,
  ProductModal,
  AddAccomplishmentModal,
  KudosModal,
} from "./TaskModals";

/* ──────────────────────────────────────────────────────────────────
   useSession hook
   ────────────────────────────────────────────────────────────────── */
function useSession() {
  const [s, setS] = React.useState<any>(undefined);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setS(sess ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return s;
}

/* ──────────────────────────────────────────────────────────────────
   Inline simple pages (small enough to stay here)
   ────────────────────────────────────────────────────────────────── */
function MeetingsPage() {
  const [agenda, setAgenda] = useState("");
  return (
    <div className="space-y-6">
      <Card title="Upcoming Meetings" subtitle="Next 7 days">
        <div className="space-y-2">
          <div className="rounded-xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Ops Standup</div>
              <div className="text-xs text-neutral-500">Tue 11:30 AM • Backstage</div>
            </div>
            <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300">Open agenda</button>
          </div>
          <div className="rounded-xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Client Onboarding</div>
              <div className="text-xs text-neutral-500">Thu 2:00 PM • Prose Florals</div>
            </div>
            <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300">Checklist</button>
          </div>
        </div>
      </Card>
      <Card title="Meeting Agenda & Notes">
        <textarea
          className="w-full min-h-[200px] rounded-xl border p-3 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          placeholder={"Add meeting notes and agenda items here...\n\n• Topic 1\n• Topic 2\n• Action items"}
          value={agenda} onChange={(e) => setAgenda(e.target.value)}
        />
        <button className="mt-3 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium">
          Save to Google Doc
        </button>
      </Card>
    </div>
  );
}

function SettingsPage({ userName }: { userName: string }) {
  return (
    <div className="space-y-6">
      <Card title="Account Settings">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Display Name</label>
            <input type="text" defaultValue={userName}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input type="email" defaultValue="sierra@backstageop.com"
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
          </div>
          <button className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium">
            Save Changes
          </button>
        </div>
      </Card>
      <Card title="Notifications">
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Email notifications for task assignments</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Daily digest of team activity</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Browser notifications for new messages</span>
          </label>
        </div>
      </Card>
      <Card title="Danger Zone">
        <button className="text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 text-sm font-medium">
          Sign Out
        </button>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main App
   ────────────────────────────────────────────────────────────────── */
export default function DashboardApp() {
  const session = useSession();
  const { profile } = useProfile();
  const { teamMembers } = useTeamMembers();
  const { tasks, loading: tasksLoading, refetch } = useTasks({ status: ["focus", "active", "submitted"] });
  const { messages, unreadCount, refetch: refetchMessages } = useMessages();
  const { clients: allClients, refetch: refetchClients } = useClients();
  const { products: allProducts, refetch: refetchProducts } = useProducts();

  const [celebrate, setCelebrate] = useState(false);
  const [page, setPage] = useState<Page>("Today");
  const [selectedTask, setSelectedTask] = useState<DBTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [kudosTask, setKudosTask] = useState<DBTask | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAddAccomplishment, setShowAddAccomplishment] = useState(false);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>(() => {
    try {
      const saved = localStorage.getItem("backstage-accomplishments");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilters, setTaskFilters] = useState({
    company: "all", impact: "all", priority: "all", status: "all", assignee: "all",
  });
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedCompanyData, setSelectedCompanyData] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const role: Role = profile?.role ? fromDbToUi[profile.role as AppRole] : "Founder";
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const userName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.email?.split("@")[0] ??
    "Sierra";

  // Persist accomplishments
  React.useEffect(() => {
    localStorage.setItem("backstage-accomplishments", JSON.stringify(accomplishments));
  }, [accomplishments]);

  const completedThisWeek = tasks.filter((t) => t.status === "completed").length;

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = taskFilters.company === "all" || t.company_name === taskFilters.company;
    const matchesImpact = taskFilters.impact === "all" || t.impact === taskFilters.impact;
    const matchesPriority = taskFilters.priority === "all" || t.priority === taskFilters.priority;
    const matchesStatus = taskFilters.status === "all" || t.status === taskFilters.status;
    const matchesAssignee = taskFilters.assignee === "all" || t.assignee_name === taskFilters.assignee;
    return matchesSearch && matchesCompany && matchesImpact && matchesPriority && matchesStatus && matchesAssignee;
  });

  const focusTasks = filteredTasks.filter((t) => t.status === "focus");
  const activeTasks = filteredTasks.filter((t) => t.status === "active");
  const submittedTasks = filteredTasks.filter((t) => t.status === "submitted");
  const allActiveTasks = [...focusTasks, ...activeTasks];

  async function handleComplete(task: DBTask) {
    const success = await dbCompleteTask(task.id);
    if (success) {
      await sendMessage(`🎉 ${userName} completed: ${task.title}`, undefined, true, task.id);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1500);
      refetch();
    }
  }

  function handleApprove(task: DBTask) {
    setKudosTask(task);
    setShowKudosModal(true);
  }

  async function handleSendKudos(kudosText: string) {
    if (!kudosTask) return;
    await dbUpdateTask(kudosTask.id, { status: "completed" });
    if (kudosText && kudosTask.assigned_to) {
      await sendMessage(kudosText, kudosTask.assigned_to, true, kudosTask.id);
    }
    refetch();
    setShowKudosModal(false);
    setKudosTask(null);
  }

  async function handleAddAccomplishment(text: string, postToTeam: boolean) {
    const accomplishment: Accomplishment = {
      id: Date.now().toString(),
      user: userName,
      text,
      timestamp: Date.now(),
      postedToTeam: postToTeam,
    };
    setAccomplishments([...accomplishments, accomplishment]);
    if (postToTeam) {
      await sendMessage(`🎉 ${text}`, undefined, false, undefined);
      refetchMessages();
    }
  }

  async function handleSendMessage(content: string, to?: string) {
    let toUserId: string | undefined;
    if (to) {
      const recipient = teamMembers.find((tm) => tm.display_name === to);
      toUserId = recipient?.id;
    }
    await sendMessage(content, toUserId);
  }

  function openTaskModal(task: DBTask) {
    setSelectedTask(task);
    setShowTaskModal(true);
  }

  async function handleCompanyClick(companyName: string) {
    const companyData = await getCompanyByName(companyName);
    setSelectedCompanyData(companyData);
    setSelectedCompany(companyName);
    if (page !== "Companies") setPage("Companies" as Page);
  }

  if (tasksLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-500">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 relative text-[15px]">
      <Confetti fire={celebrate} />
      <div className="flex">
        <Sidebar role={role} active={page} onSelect={setPage as any} userName={userName} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-0 space-y-6">
          <TopHeader
            name={userName} levelXP={xp} levelMax={LEVEL_XP_THRESHOLD}
            onSearch={setSearchQuery}
            onOpenChat={() => setShowChat(true)}
            unreadCount={unreadCount}
          />

          {page === "Today" && isFounder(role) && (
            <TodayFounder
              userName={userName} completedThisWeek={completedThisWeek} level={level} xp={xp}
              focusTasks={focusTasks} submittedTasks={submittedTasks} allActiveTasks={allActiveTasks}
              accomplishments={accomplishments}
              onOpenCreateTask={() => setShowCreateModal(true)}
              onTaskClick={openTaskModal} onApprove={handleApprove}
              onOpenAddAccomplishment={() => setShowAddAccomplishment(true)}
              onCompanyClick={handleCompanyClick} refetch={refetch}
            />
          )}

          {page === "Today" && !isFounder(role) && (
            <TodayTeam
              userName={userName} completedThisWeek={completedThisWeek} level={level} xp={xp}
              focusTasks={focusTasks} submittedTasks={submittedTasks} filteredTasks={filteredTasks}
              accomplishments={accomplishments}
              onOpenCreateTask={() => setShowCreateModal(true)}
              onTaskClick={openTaskModal}
              onOpenAddAccomplishment={() => setShowAddAccomplishment(true)}
            />
          )}

          {page === "Meetings" && isFounder(role) && <MeetingsPage />}

          {page === "Tasks" && (
            <TasksPage
              filteredTasks={filteredTasks} taskFilters={taskFilters} setTaskFilters={setTaskFilters}
              role={role} teamMembers={teamMembers}
              onOpenCreateTask={() => setShowCreateModal(true)} onTaskClick={openTaskModal}
            />
          )}

          {page === "Companies" && (
            <CompaniesPageDB
              companies={[...COMPANIES]} tasks={tasks}
              clients={allClients} products={allProducts}
              onCompanyClick={handleCompanyClick}
              onClientClick={setSelectedClient} onProductClick={setSelectedProduct}
            />
          )}

          {page === "My Team" && isFounder(role) && (
            <MyTeamPage tasks={tasks} teamMembers={teamMembers} />
          )}

          {page === "Settings" && <SettingsPage userName={userName} />}

          {page === "Career Path" && !isFounder(role) && (
            <Card title="Career Path" subtitle="Your progress">
              <LevelRing level={level} value={xp} max={LEVEL_XP_THRESHOLD} />
            </Card>
          )}

          {page === "Playbook" && (
            <Card title="Playbook" subtitle="SOPs and guides">
              <div className="text-sm text-neutral-500">Coming soon with database integration</div>
            </Card>
          )}
        </main>
      </div>

      {/* Modal stack */}
      <TaskModal
        task={selectedTask} isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onComplete={() => selectedTask && handleComplete(selectedTask)}
        role={role}
      />

      <TaskCreateModal
        isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
        onCreated={refetch} role={role} userName={userName} teamMembers={teamMembers}
      />

      <CompanyDrawer
        isOpen={!!selectedCompany}
        onClose={() => { setSelectedCompany(null); setSelectedCompanyData(null); }}
        role={role} company={selectedCompanyData} tasks={tasks}
        clients={allClients.filter((c: any) => c.company_id === selectedCompanyData?.id)}
        products={allProducts.filter((p: any) => p.company_id === selectedCompanyData?.id)}
        onRefetch={() => { refetchClients(); refetchProducts(); }}
      />

      <ClientModal client={selectedClient} isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} />
      <ProductModal product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} />

      <AnimatePresence>
        {showAddAccomplishment && (
          <AddAccomplishmentModal
            isOpen={showAddAccomplishment} onClose={() => setShowAddAccomplishment(false)}
            userName={userName} onAdd={handleAddAccomplishment}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKudosModal && (
          <KudosModal
            isOpen={showKudosModal} onClose={() => setShowKudosModal(false)}
            task={kudosTask} onSend={handleSendKudos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <ChatPanel
            userName={userName} isOpen={showChat} onClose={() => setShowChat(false)}
            messages={messages} onSendMessage={handleSendMessage} teamMembers={teamMembers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
