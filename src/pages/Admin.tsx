
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc, updateDoc } from "firebase/firestore";
import type { AiTool, ToolCategory, SubjectArea, TargetAudience } from "@/lib/types";
import { Header } from "@/components/header";
import { ToolTable, SortConfig } from "@/components/tool-table";
import { CategoryManager } from "@/components/category-manager";
import { SubjectManager } from "@/components/subject-manager";
import { SiteSettingsManager } from "@/components/site-settings-manager";
import { ReviewsManager } from "@/components/reviews-manager";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Settings, Tag, BookOpen, BarChart2,
  CheckCircle, Clock, XCircle, Menu, Shield, Plus, Star,
} from "lucide-react";

type AdminSection = 'tools' | 'settings' | 'categories' | 'subjects' | 'reports' | 'reviews';

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: 'tools',      label: 'Tool Management',  icon: Wrench },
  { id: 'settings',   label: 'Site Settings',    icon: Settings },
  { id: 'categories', label: 'Categories',       icon: Tag },
  { id: 'subjects',   label: 'Subject Areas',    icon: BookOpen },
  { id: 'reviews',    label: 'Teacher Reviews',  icon: Star },
  { id: 'reports',    label: 'Reports',          icon: BarChart2 },
];

export default function AdminPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AdminSection>('tools');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'createdAt', direction: 'desc' });

  const toolsQuery      = useMemoFirebase(() => firestore ? collection(firestore, "ai_tools")          : null, [firestore]);
  const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "tool_categories")   : null, [firestore]);
  const subjectsQuery   = useMemoFirebase(() => firestore ? collection(firestore, "subject_areas")     : null, [firestore]);
  const audiencesQuery  = useMemoFirebase(() => firestore ? collection(firestore, "target_audiences")  : null, [firestore]);

  const { data: tools,      isLoading: loadingTools }      = useCollection<AiTool>(toolsQuery);
  const { data: categories, isLoading: loadingCategories } = useCollection<ToolCategory>(categoriesQuery);
  const { data: subjects,   isLoading: loadingSubjects }   = useCollection<SubjectArea>(subjectsQuery);
  const { data: audiences,  isLoading: loadingAudiences }  = useCollection<TargetAudience>(audiencesQuery);

  const isLoading = loadingTools || loadingCategories || loadingSubjects || loadingAudiences;

  const handleEditTool = (tool: AiTool) => navigate(`/admin/tools/${tool.id}`);

  const handleDeleteTool = async (tool: AiTool) => {
    if (!firestore) return;
    if (window.confirm(`Are you sure you want to delete "${tool.name}"?`)) {
      try {
        await deleteDoc(doc(firestore, "ai_tools", tool.id));
        toast({ title: "Tool deleted", description: `${tool.name} has been removed.` });
      } catch {
        toast({ variant: "destructive", title: "Delete failed", description: "There was an error deleting the tool." });
      }
    }
  };

  const handleToggleRecommend = async (tool: AiTool) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "ai_tools", tool.id), { recommended: !tool.recommended });
    } catch (error) {
      console.error("Error toggling recommendation:", error);
    }
  };

  const handleTogglePublish = async (tool: AiTool) => {
    if (!firestore) return;
    const newStatus = tool.status === 'Approved' ? 'Pending' : 'Approved';
    try {
      await updateDoc(doc(firestore, "ai_tools", tool.id), { status: newStatus });
      toast({ title: newStatus === 'Approved' ? 'Tool published' : 'Tool unpublished', description: tool.name });
    } catch (error) {
      console.error("Error toggling publish:", error);
      toast({ variant: "destructive", title: "Update failed", description: "Could not change publish status." });
    }
  };

  const sortedTools = useMemo(() => {
    if (!tools) return [];
    return [...tools].sort((a, b) => {
      const aVal = a[sortConfig.key], bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      const mod = sortConfig.direction === 'asc' ? 1 : -1;
      return aVal < bVal ? -1 * mod : 1 * mod;
    });
  }, [tools, sortConfig]);

  const stats = useMemo(() => ({
    total:     tools?.length ?? 0,
    approved:  tools?.filter(t => t.status === 'Approved').length ?? 0,
    pending:   tools?.filter(t => t.status === 'Pending').length ?? 0,
    rejected:  tools?.filter(t => t.status === 'Rejected').length ?? 0,
  }), [tools]);

  const navTo = (section: AdminSection) => {
    setActiveSection(section);
    const el = document.getElementById('admin-drawer') as HTMLInputElement | null;
    if (el) el.checked = false;
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Header onLoginClick={() => {}} />

      {/* ── Drawer layout ── */}
      <div className="drawer lg:drawer-open flex-1">
        <input id="admin-drawer" type="checkbox" className="drawer-toggle" />

        {/* ── Main content ── */}
        <div className="drawer-content flex flex-col">

          {/* Mobile top bar */}
          <div className="navbar bg-base-100 border-b border-base-300 lg:hidden px-4">
            <label htmlFor="admin-drawer" className="btn btn-ghost btn-square" aria-label="Open sidebar">
              <Menu className="h-5 w-5" />
            </label>
            <span className="ml-2 font-bold text-base-content flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Admin Dashboard
            </span>
          </div>

          {/* Content area */}
          <main className="flex-1 py-6 lg:py-8">
          <div className="container space-y-6">

            {/* Page heading + Add Tool button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {(() => { const Item = NAV_ITEMS.find(n => n.id === activeSection)!; return <Item.icon className="h-6 w-6 text-primary" />; })()}
                <h1 className="text-2xl font-bold text-base-content">
                  {NAV_ITEMS.find(n => n.id === activeSection)?.label}
                </h1>
              </div>
              {activeSection === 'tools' && (
                <button
                  className="btn btn-primary btn-sm gap-2"
                  onClick={() => navigate('/admin/tools/new')}
                >
                  <Plus className="h-4 w-4" />
                  Add Tool
                </button>
              )}
            </div>

            {/* Stats bar — only on tools section */}
            {activeSection === 'tools' && (
              <div className="stats stats-vertical sm:stats-horizontal w-full shadow bg-base-100">
                <div className="stat">
                  <div className="stat-figure text-primary"><Wrench className="h-8 w-8" /></div>
                  <div className="stat-title">Total Tools</div>
                  <div className="stat-value text-primary">{isLoading ? '…' : stats.total}</div>
                </div>
                <div className="stat">
                  <div className="stat-figure text-success"><CheckCircle className="h-8 w-8" /></div>
                  <div className="stat-title">Approved</div>
                  <div className="stat-value text-success">{isLoading ? '…' : stats.approved}</div>
                </div>
                <div className="stat">
                  <div className="stat-figure text-warning"><Clock className="h-8 w-8" /></div>
                  <div className="stat-title">Pending Review</div>
                  <div className="stat-value text-warning">{isLoading ? '…' : stats.pending}</div>
                  {stats.pending > 0 && <div className="stat-desc text-warning">Needs attention</div>}
                </div>
                <div className="stat">
                  <div className="stat-figure text-error"><XCircle className="h-8 w-8" /></div>
                  <div className="stat-title">Rejected</div>
                  <div className="stat-value text-error">{isLoading ? '…' : stats.rejected}</div>
                </div>
              </div>
            )}

            {/* Section content */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-x-auto">
              {activeSection === 'tools' && (
                <ToolTable
                  tools={sortedTools}
                  categories={categories || []}
                  subjects={subjects || []}
                  audiences={audiences || []}
                  isAdminView
                  onEditClick={handleEditTool}
                  onDeleteClick={handleDeleteTool}
                  onToggleRecommend={handleToggleRecommend}
                  onTogglePublish={handleTogglePublish}
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              )}
              {activeSection === 'settings' && (
                <div className="p-6 lg:p-8">
                  <SiteSettingsManager />
                </div>
              )}
              {activeSection === 'categories' && (
                <div className="p-6 lg:p-8">
                  <CategoryManager categories={categories || []} />
                </div>
              )}
              {activeSection === 'subjects' && (
                <div className="p-6 lg:p-8">
                  <SubjectManager subjects={subjects || []} />
                </div>
              )}
              {activeSection === 'reviews' && (
                <ReviewsManager tools={tools ?? []} />
              )}
              {activeSection === 'reports' && (
                <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
                  <BarChart2 className="h-16 w-16 text-base-300" />
                  <h3 className="text-xl font-semibold text-base-content">Analytics & Reports</h3>
                  <p className="text-base-content/50 max-w-sm">
                    Comprehensive insights and reports on tool usage and engagement are coming soon.
                  </p>
                </div>
              )}
            </div>
          </div>
          </main>
        </div>

        {/* ── Sidebar ── */}
        <div className="drawer-side z-40">
          <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay" />
          <aside className="flex flex-col min-h-full w-64 bg-base-100 border-r border-base-300">

            {/* Sidebar header */}
            <div className="p-4 border-b border-base-300">
              <div className="flex items-center gap-2 px-2 py-1">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-bold text-base-content">Admin Panel</span>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-3">
              <ul className="menu menu-sm gap-1 w-full p-0">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <li key={id}>
                    <button
                      onClick={() => navTo(id)}
                      className={activeSection === id ? 'active font-semibold' : ''}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {id === 'tools' && stats.pending > 0 && (
                        <span className="badge badge-warning badge-sm ml-auto">{stats.pending}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Sidebar footer */}
            <div className="p-4 border-t border-base-300">
              <p className="text-xs text-base-content/40 text-center">TASC Tools Admin v4.1</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
