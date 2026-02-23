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
  updateProfileGoogleDocId,
  addXPToProfile,
  saveAccomplishment,
  useAllAccomplishments,
} from "./useDatabase";
import { connectGoogle, getTokenSilently, createGoogleDoc, appendToDoc } from "./useGoogleDocs";
import {
  fromDbToUi, isFounder,
  COMPANIES, XP_BY_IMPACT,
  Role, AppRole, Page, Client, Product, DBTask,
} from "./types";

// Page components
import { CompaniesPage as CompaniesPageDB } from "./CompaniesPage";
import { CompanyDrawer } from "./CompanyDrawer";
import { ChatPanel } from "./ChatPanel";
import { TodayFounder, TodayTeam, Confetti } from "./TodayPage";
import { TasksPage } from "./TasksPage";
import { MyTeamPage } from "./MyTeamPage";
import { PlaybookPage } from "./PlaybookPage";
import { CareerPathPage } from "./CareerPathPage";
import { MeetingsPage } from "./MeetingsPage";
import { Sidebar, TopHeader } from "./Navigation";
import { Card } from "./ui";
import {
  TaskModal,
  TaskCreateModal,
  ClientModal,
  ProductModal,
  AddAccomplishmentModal,
  KudosModal,
  SendKudosModal,
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
function NotificationPrefsCard() {
  const get = (key: string, def: boolean) => {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "true";
  };
  const [assignment, setAssignment] = useState(() => get("notif-assignment", true));
  const [digest, setDigest] = useState(() => get("notif-digest", true));
  const [browser, setBrowser] = useState(() => get("notif-browser", false));
  const [permissionDenied, setPermissionDenied] = useState(false);

  function toggle(key: string, val: boolean, set: (v: boolean) => void) {
    set(val);
    localStorage.setItem(key, String(val));
  }

  async function toggleBrowser(val: boolean) {
    if (val) {
      if (!("Notification" in window)) {
        alert("Your browser does not support desktop notifications.");
        return;
      }
      if (Notification.permission === "denied") {
        setPermissionDenied(true);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
    }
    toggle("notif-browser", val, setBrowser);
  }

  return (
    <Card title="Notifications">
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={assignment} onChange={(e) => toggle("notif-assignment", e.target.checked, setAssignment)} className="w-4 h-4 accent-teal-600" />
          <div>
            <span className="text-sm">In-app notifications for task assignments</span>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={digest} onChange={(e) => toggle("notif-digest", e.target.checked, setDigest)} className="w-4 h-4 accent-teal-600" />
          <span className="text-sm">Daily digest of team activity</span>
        </label>
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={browser} onChange={(e) => toggleBrowser(e.target.checked)} className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Browser notifications for new messages</span>
          </label>
          {permissionDenied && (
            <p className="text-xs text-red-500 mt-1 ml-7">
              Permission denied. Enable notifications in your browser settings, then try again.
            </p>
          )}
          {browser && !permissionDenied && (
            <p className="text-xs text-teal-600 mt-1 ml-7">Active — you'll get a notification when a new message arrives.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function SettingsPage({ userName, userEmail, userId, googleDocId, avatarUrl }: {
  userName: string; userEmail: string; userId: string; googleDocId?: string | null; avatarUrl?: string | null;
}) {
  const [displayName, setDisplayName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [docId, setDocId] = useState(googleDocId ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(avatarUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (!uploadError && uploadData) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      setPhotoPreview(publicUrl);
    }
    setUploadingPhoto(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleConnectGoogle() {
    setConnecting(true);
    try {
      const token = await connectGoogle();
      const newDocId = await createGoogleDoc(`${userName}'s Backstage Notes`, token);
      await updateProfileGoogleDocId(userId, newDocId);
      setDocId(newDocId);
    } catch (err) {
      console.error("Google Docs connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Account Settings">
        <div className="space-y-4">
          {/* Profile Photo */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-teal-100 flex items-center justify-center border">
                {photoPreview ? (
                  <img src={photoPreview} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-teal-700">{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-white border rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-neutral-50 shadow-sm">
                <span className="text-[11px] text-neutral-600">✎</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoPreview(URL.createObjectURL(file));
                    handlePhotoUpload(file);
                  }
                }} />
              </label>
            </div>
            <div>
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-xs text-neutral-400">{uploadingPhoto ? "Uploading photo…" : "Click pencil to change photo"}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input type="email" defaultValue={userEmail} disabled
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm bg-neutral-50 text-neutral-500 cursor-not-allowed" />
          </div>
          <button onClick={handleSave} disabled={saving || displayName === userName}
            className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Card>
      <NotificationPrefsCard />
      <Card title="Google Docs">
        {docId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-teal-700 font-medium">
              <span>✓ Connected</span>
            </div>
            <p className="text-xs text-neutral-500">Notes from your Today page are saved to your personal doc.</p>
            <a
              href={`https://docs.google.com/document/d/${docId}/edit`}
              target="_blank" rel="noopener noreferrer"
              className="inline-block text-sm text-teal-600 underline hover:text-teal-800">
              Open my notes doc →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Connect Google Docs to automatically save your notes to a personal doc — one per team member, all in one place.
            </p>
            <button onClick={handleConnectGoogle} disabled={connecting}
              className="border rounded-xl px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {connecting ? "Connecting..." : "Connect Google Docs"}
            </button>
          </div>
        )}
      </Card>
      <Card title="Danger Zone">
        <button onClick={handleSignOut}
          className="text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 text-sm font-medium">
          Sign Out
        </button>
      </Card>
    </div>
  );
}

// Stable reference — defined outside component so useTasks doesn't re-subscribe every render
const ALL_STATUSES = ["focus", "active", "submitted", "completed", "archived"] as const;

/* ──────────────────────────────────────────────────────────────────
   Main App
   ────────────────────────────────────────────────────────────────── */
export default function DashboardApp() {
  const session = useSession();
  const { profile, refetch: refetchProfile } = useProfile();
  const { teamMembers } = useTeamMembers();
  const { tasks, loading: tasksLoading, refetch } = useTasks({ status: ALL_STATUSES as any });
  const { messages, unreadCount, refetch: refetchMessages } = useMessages();
  const { clients: allClients, refetch: refetchClients } = useClients();
  const { products: allProducts, refetch: refetchProducts } = useProducts();

  const [celebrate, setCelebrate] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [page, setPage] = useState<Page>("Today");
  const [selectedTask, setSelectedTask] = useState<DBTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [kudosTask, setKudosTask] = useState<DBTask | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showSendKudos, setShowSendKudos] = useState(false);
  const [kudosDefaultMemberId, setKudosDefaultMemberId] = useState<string | undefined>(undefined);
  const [showAddAccomplishment, setShowAddAccomplishment] = useState(false);
  const { accomplishments, refetch: refetchAccomplishments } = useAllAccomplishments();
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


  // Fire browser notification when a new DM arrives (if permission granted + pref enabled)
  const prevMessageCount = React.useRef(messages.length);
  React.useEffect(() => {
    const browserNotifEnabled = localStorage.getItem("notif-browser") === "true";
    if (!browserNotifEnabled || Notification.permission !== "granted") {
      prevMessageCount.current = messages.length;
      return;
    }
    const newMessages = messages.slice(0, messages.length - prevMessageCount.current);
    newMessages.forEach((msg) => {
      if (msg.to_user_id === profile?.id && !msg.is_read) {
        new Notification(`New message from ${msg.from_name || "teammate"}`, {
          body: msg.content,
          icon: "/favicon.ico",
        });
      }
    });
    prevMessageCount.current = messages.length;
  }, [messages, profile?.id]);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const completedThisWeek = tasks.filter((t) =>
    t.status === "completed" && t.completed_at && new Date(t.completed_at) >= startOfWeek
  ).length;

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
      if (profile?.id) {
        await addXPToProfile(profile.id, XP_BY_IMPACT[task.impact]);
        await refetchProfile();
      }
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

  async function handleSendKudos(action: "archive" | "return", message: string) {
    if (!kudosTask) return;
    if (action === "archive") {
      await dbUpdateTask(kudosTask.id, { status: "completed" });
      if (kudosTask.assigned_to) {
        await addXPToProfile(kudosTask.assigned_to, XP_BY_IMPACT[kudosTask.impact]);
        if (message) {
          await sendMessage(`🎉 ${message}`, kudosTask.assigned_to, true, kudosTask.id);
        }
      }
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1500);
    } else {
      const updatedDescription = message
        ? `📋 Notes: ${message}\n\n${kudosTask.description ?? ""}`.trim()
        : kudosTask.description ?? null;
      await dbUpdateTask(kudosTask.id, { status: "active", description: updatedDescription });
    }
    refetch();
    setShowKudosModal(false);
    setKudosTask(null);
  }

  async function handleSaveNote(text: string) {
    if (!profile?.google_doc_id) {
      alert("Connect Google Docs in Settings first to save notes.");
      return;
    }
    const token = await getTokenSilently();
    if (!token) {
      alert("Google session expired — reconnect in Settings.");
      return;
    }
    await appendToDoc(profile.google_doc_id, text, token);
  }

  async function handleAddAccomplishment(text: string) {
    await saveAccomplishment(text, userName, true);
    refetchAccomplishments();
    await sendMessage(`🎉 ${text}`, undefined, false, undefined);
    refetchMessages();
    if (profile?.google_doc_id) {
      const token = await getTokenSilently();
      if (token) {
        appendToDoc(profile.google_doc_id, text, token).catch(console.error);
      }
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

  async function handleSubmitForApproval(task: DBTask) {
    await dbUpdateTask(task.id, { status: "submitted" });
    refetch();
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
        <Sidebar
          role={role} active={page} onSelect={setPage as any} userName={userName}
          mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-0 space-y-6">
          <TopHeader
            onSearch={setSearchQuery}
            onOpenChat={() => setShowChat(true)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            unreadCount={unreadCount}
            userName={userName}
          />

          {page === "Today" && isFounder(role) && (
            <TodayFounder
              userName={userName} completedThisWeek={completedThisWeek} level={level} xp={xp}
              focusTasks={focusTasks} submittedTasks={submittedTasks} allActiveTasks={allActiveTasks}
              accomplishments={accomplishments}
              onOpenCreateTask={() => setShowCreateModal(true)}
              onTaskClick={openTaskModal} onApprove={handleApprove}
              onOpenAddAccomplishment={() => setShowAddAccomplishment(true)}
              onCompanyClick={handleCompanyClick} onSaveNote={handleSaveNote} refetch={refetch}
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
              onSaveNote={handleSaveNote}
              onPinTask={async (task) => {
                await dbUpdateTask(task.id, { status: task.status === "focus" ? "active" : "focus" });
                refetch();
              }}
            />
          )}

          {page === "Meetings" && isFounder(role) && <MeetingsPage role={role} />}

          {page === "Tasks" && (
            <TasksPage
              filteredTasks={filteredTasks} taskFilters={taskFilters} setTaskFilters={setTaskFilters}
              role={role} userName={userName} userId={profile?.id ?? ""} teamMembers={teamMembers}
              onOpenCreateTask={() => setShowCreateModal(true)} onTaskClick={openTaskModal}
              onSubmit={!isFounder(role) ? handleSubmitForApproval : undefined}
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
            <MyTeamPage
              tasks={tasks}
              teamMembers={teamMembers}
              accomplishments={accomplishments}
              onSendKudos={(memberId) => {
                setKudosDefaultMemberId(memberId);
                setShowSendKudos(true);
              }}
            />
          )}

          {page === "Settings" && (
            <SettingsPage
              userName={userName}
              userEmail={session?.user?.email ?? ""}
              userId={profile?.id ?? ""}
              googleDocId={profile?.google_doc_id}
              avatarUrl={profile?.avatar_url}
            />
          )}

          {page === "Career Path" && !isFounder(role) && (
            <CareerPathPage
              level={level} xp={xp} tasks={tasks}
              userName={userName} userId={profile?.id ?? ""}
            />
          )}

          {page === "Playbook" && <PlaybookPage role={role} />}
        </main>
      </div>

      {/* Modal stack */}
      <TaskModal
        task={selectedTask} isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onComplete={() => selectedTask && (isFounder(role) ? handleComplete(selectedTask) : handleSubmitForApproval(selectedTask))}
        onApprove={(task) => { setShowTaskModal(false); handleApprove(task); }}
        onReassign={async (taskId, memberId) => {
          await dbUpdateTask(taskId, { assigned_to: memberId });
          if (memberId && selectedTask) {
            await sendMessage(`You've been assigned a task: "${selectedTask.title}"`, memberId, false, taskId);
          }
          refetch();
        }}
        onSave={async (taskId, updates) => { await dbUpdateTask(taskId, updates); refetch(); }}
        role={role}
        teamMembers={teamMembers}
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
            onSendKudos={() => setShowSendKudos(true)}
            onTaskClick={(taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              if (task) { setSelectedTask(task); setShowTaskModal(true); }
              setShowChat(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSendKudos && (
          <SendKudosModal
            isOpen={showSendKudos}
            onClose={() => { setShowSendKudos(false); setKudosDefaultMemberId(undefined); }}
            teamMembers={teamMembers}
            defaultMemberId={kudosDefaultMemberId}
            onSend={async (toUserId, message) => {
              await sendMessage(`🏆 ${message}`, toUserId, true, undefined);
              refetchMessages();
              setShowSendKudos(false);
              setKudosDefaultMemberId(undefined);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
