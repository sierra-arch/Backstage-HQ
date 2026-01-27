# 🎯 COMPLETE DASHBOARDAPP.TSX UPDATE GUIDE
## Step-by-Step Integration of All New Features

---

## PART 1: ADD COMPONENT FILES

First, create these 3 new files in your `/src` folder:

1. **EditTaskModal.tsx** (from the file I gave you)
2. **CompanyManagement_Components.tsx** (from the file I gave you)
3. **ApprovalQueue.tsx** (from the file I gave you)

---

## PART 2: UPDATE IMPORTS (Top of DashboardApp.tsx)

### A. Update useDatabase imports (around line 7):

**FIND:**
```typescript
import {
  useTasks,
  useProfile,
  useTeamMembers,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  completeTask as dbCompleteTask,
  getCompanyByName,
} from "./useDatabase";
```

**REPLACE WITH:**
```typescript
import {
  useTasks,
  useProfile,
  useTeamMembers,
  useClients,
  useProducts,
  useSOPs,
  usePendingApprovals,
  useMessages,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  completeTask as dbCompleteTask,
  getCompanyByName,
  saveClient,
  saveProduct,
  saveSOP,
  syncProductWithEtsy,
  sendMessage,
  markMessagesFromUserAsRead,
  approvePendingChange,
  rejectPendingChange,
  type Client,
  type Product,
  type SOP,
} from "./useDatabase";
```

### B. Add component imports (after the useDatabase import):

```typescript
import EditTaskModal from "./EditTaskModal";
import { 
  ClientCard, 
  ClientModal,
  ProductCard,
  ProductModal,
  SOPCard,
  SOPModal 
} from "./CompanyManagement_Components";
import { ApprovalQueue, ApprovalBadge } from "./ApprovalQueue";
```

---

## PART 3: UPDATE MESSAGE TYPE (around line 108)

**FIND:**
```typescript
type Message = {
  id: string;
  from: string;
  to?: string;
  content: string;
  timestamp: number;
  type: "dm" | "team";
  read: boolean;
  attachment?: {
    name: string;
    url: string;
    type: string;
  };
  isKudos?: boolean;
  taskLink?: string;
};
```

**REPLACE WITH:**
```typescript
type Message = {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  content: string;
  message_type: "team" | "dm" | "kudos";
  is_kudos: boolean;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
  from_name?: string;
  to_name?: string;
};
```

---

## PART 4: UPDATE MAIN DASHBOARDAPP FUNCTION

### A. Replace message state with hook (around line 2268):

**FIND:**
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
```

**REPLACE WITH:**
```typescript
const { messages, unreadCount, refetch: refetchMessages } = useMessages();
const hasUnreadMessages = unreadCount > 0;
```

### B. Add new state variables (after line 2280):

```typescript
// NEW: Edit task
const [showEditModal, setShowEditModal] = useState(false);
const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<DBTask | null>(null);

// NEW: Client management
const [showClientModal, setShowClientModal] = useState(false);
const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null>(null);

// NEW: Product management
const [showProductModal, setShowProductModal] = useState(false);
const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

// NEW: SOP management
const [showSOPModal, setShowSOPModal] = useState(false);
const [selectedSOPForEdit, setSelectedSOPForEdit] = useState<SOP | null>(null);

// NEW: Approval queue (founders only)
const [showApprovalQueue, setShowApprovalQueue] = useState(false);
```

---

## PART 5: UPDATE MESSAGE SENDING

### A. Update handleSendMessage function:

**FIND:**
```typescript
function handleSendMessage(content: string, to?: string) {
  const newMsg: Message = {
    id: Date.now().toString(),
    from: userName,
    to,
    content,
    timestamp: Date.now(),
    type: to ? "dm" : "team",
    read: false,
    isKudos: false,
  };
  setMessages([...messages, newMsg]);
}
```

**REPLACE WITH:**
```typescript
async function handleSendMessage(content: string, to?: string) {
  // Find the recipient's user ID if it's a DM
  let toUserId: string | undefined;
  if (to) {
    const recipient = teamMembers.find(tm => tm.display_name === to);
    toUserId = recipient?.id;
  }
  
  await sendMessage(content, toUserId);
  // Messages will update via real-time subscription
}
```

### B. Update kudos sending (in handleTaskComplete or similar):

**FIND where you create kudos messages and REPLACE WITH:**
```typescript
async function handleKudos(task: DBTask) {
  await sendMessage(
    `🎉 Completed: ${task.title}`,
    undefined, // No recipient = team message
    true, // is kudos
    task.id // related task
  );
  setCelebrate(true);
  setTimeout(() => setCelebrate(false), 4000);
}
```

---

## PART 6: UPDATE CHATPANEL COMPONENT

**FIND the ChatPanel function (around line 1119) and make these updates:**

### A. Add profile to get user ID:
```typescript
function ChatPanel({
  userName,
  isOpen,
  onClose,
  messages,
  onSendMessage,
  teamMembers = [],
}: {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (content: string, to?: string) => void;
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const { profile } = useProfile(); // ADD THIS
  const currentUserId = profile?.id; // ADD THIS
  
  // ... rest of component
}
```

### B. Update message filtering:
```typescript
const filteredMessages = messages.filter((msg) => {
  if (activeChannel === "team") {
    // Team messages (to_user_id is null)
    return msg.message_type === "team" && !msg.is_kudos;
  } else {
    // DM channel
    const otherUser = teamMembers.find(tm => tm.display_name === activeChannel);
    const otherUserId = otherUser?.id;
    
    return (
      (msg.from_user_id === otherUserId && msg.to_user_id === currentUserId) ||
      (msg.from_user_id === currentUserId && msg.to_user_id === otherUserId)
    );
  }
});
```

### C. Update message rendering:
```typescript
{filteredMessages.map((msg) => (
  <div key={msg.id} className={msg.from_user_id === currentUserId ? "message-sent" : "message-received"}>
    <div className="message-author">{msg.from_name || "Unknown"}</div>
    <div className="message-content">{msg.content}</div>
    <div className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</div>
  </div>
))}
```

### D. Update unread checks:
```typescript
function hasUnreadDM(person: string) {
  const otherUser = teamMembers.find(tm => tm.display_name === person);
  if (!otherUser) return false;
  
  return messages.some(
    (msg) => 
      msg.from_user_id === otherUser.id && 
      msg.to_user_id === currentUserId && 
      !msg.is_read
  );
}
```

### E. Mark messages as read when switching channels:
```typescript
function switchToChannel(channel: string) {
  if (channel !== "team") {
    const otherUser = teamMembers.find(tm => tm.display_name === channel);
    if (otherUser) {
      markMessagesFromUserAsRead(otherUser.id);
    }
  }
  setActiveChannel(channel);
}
```

---

## PART 7: ADD EDIT BUTTON TO TASK CARDS

**FIND where you render task cards and ADD this button:**

```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    setSelectedTaskForEdit(task);
    setShowEditModal(true);
  }}
  className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
  title="Edit task"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
</button>
```

---

## PART 8: ADD APPROVAL BADGE TO SIDEBAR

**FIND your sidebar navigation (where you have "Today", "My Work", etc.) and ADD:**

```typescript
{isFounder(role) && (
  <div 
    className={`nav-item relative ${page === "Approvals" ? "active" : ""}`}
    onClick={() => {
      setPage("Approvals" as Page);
      setShowApprovalQueue(true);
    }}
  >
    <span>Approvals</span>
    <ApprovalBadge />
  </div>
)}
```

---

## PART 9: ADD ALL MODALS AT THE BOTTOM

**FIND the end of your return statement (before the closing `</div>` and `</AnimatePresence>`) and ADD:**

```typescript
{/* Edit Task Modal */}
<EditTaskModal
  task={selectedTaskForEdit}
  isOpen={showEditModal}
  onClose={() => {
    setShowEditModal(false);
    setSelectedTaskForEdit(null);
  }}
  onSaved={refetch}
  role={role}
  userName={userName}
  teamMembers={teamMembers}
/>

{/* Client Modal */}
<ClientModal
  client={selectedClientForEdit}
  companyId={selectedCompany ? "find-company-id-here" : ""}
  isOpen={showClientModal}
  onClose={() => {
    setShowClientModal(false);
    setSelectedClientForEdit(null);
  }}
  onSaved={() => {
    // Refetch clients
  }}
  isFounder={isFounder(role)}
/>

{/* Product Modal */}
<ProductModal
  product={selectedProductForEdit}
  companyId={selectedCompany ? "find-company-id-here" : ""}
  isOpen={showProductModal}
  onClose={() => {
    setShowProductModal(false);
    setSelectedProductForEdit(null);
  }}
  onSaved={() => {
    // Refetch products
  }}
  isFounder={isFounder(role)}
/>

{/* SOP Modal */}
<SOPModal
  sop={selectedSOPForEdit}
  companyId={selectedCompany ? "find-company-id-here" : ""}
  isOpen={showSOPModal}
  onClose={() => {
    setShowSOPModal(false);
    setSelectedSOPForEdit(null);
  }}
  onSaved={() => {
    // Refetch SOPs
  }}
  isFounder={isFounder(role)}
/>

{/* Approval Queue (Founders Only) */}
{isFounder(role) && (
  <ApprovalQueue
    isOpen={showApprovalQueue}
    onClose={() => setShowApprovalQueue(false)}
  />
)}
```

---

## PART 10: ADD COMPANY PAGE MANAGEMENT

**FIND your CompanyModal or company page rendering and ADD sections for clients/products/SOPs:**

```typescript
{/* Inside company page */}
<Card 
  title="Clients"
  action={
    <button 
      onClick={() => {
        setSelectedClientForEdit(null);
        setShowClientModal(true);
      }}
      className="btn primary"
    >
      + Add Client
    </button>
  }
>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {clients.map(client => (
      <ClientCard
        key={client.id}
        client={client}
        onEdit={(c) => {
          setSelectedClientForEdit(c);
          setShowClientModal(true);
        }}
        isFounder={isFounder(role)}
      />
    ))}
  </div>
</Card>

{/* Similar sections for Products and SOPs */}
```

---

## ✅ TESTING CHECKLIST

After making all changes:

- [ ] Messages persist after refresh
- [ ] Can edit tasks
- [ ] Can create clients (team = approval, founder = direct)
- [ ] Can create products
- [ ] Can create SOPs
- [ ] SOPs expand/collapse
- [ ] Approval badge shows count (founders only)
- [ ] Can approve/reject changes
- [ ] Etsy sync button appears
- [ ] Chat works with database
- [ ] Unread count updates

---

## 🆘 TROUBLESHOOTING

**"Cannot find module './EditTaskModal'"**
→ Make sure you created the EditTaskModal.tsx file

**"Property 'from_name' does not exist"**
→ Make sure you updated the Message type

**"messages.map is not a function"**
→ Make sure you're using `useMessages()` hook instead of `useState`

**"Cannot read property 'id' of undefined"**
→ Add null checks: `profile?.id`

---

## 📦 FILES YOU NEED

Make sure you have:
1. ✅ Updated `useDatabase.ts` (I gave you this)
2. ✅ `EditTaskModal.tsx` (new file)
3. ✅ `CompanyManagement_Components.tsx` (new file)
4. ✅ `ApprovalQueue.tsx` (new file)
5. ✅ Updated `DashboardApp.tsx` (follow this guide)

---

This is comprehensive! Each section is independent, so you can test as you go. Start with messages, then add edit task, then add the management components!
