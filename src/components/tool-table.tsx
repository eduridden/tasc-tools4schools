
import { AiTool, ToolCategory, TargetAudience, SubjectArea } from "@/lib/types";
import { ToolLogo } from "./tool-logo";
import { ExternalLink, Star, Pencil, Trash2, CheckCircle, XCircle, Clock, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

export type SortConfig = {
  key: keyof AiTool | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
};

interface ToolTableProps {
  tools: AiTool[];
  categories: ToolCategory[];
  subjects: SubjectArea[];
  audiences: TargetAudience[];
  isAdminView?: boolean;
  onEditClick?: (tool: AiTool) => void;
  onDeleteClick?: (tool: AiTool) => void;
  onDetailsClick?: (tool: AiTool) => void;
  onToggleRecommend?: (tool: AiTool) => void;
  onTogglePublish?: (tool: AiTool) => void;
  sortConfig?: SortConfig;
  onSort?: (config: SortConfig) => void;
}

const costBadgeClass: Record<string, string> = {
  Free:         'badge-success',
  Freemium:     'badge-warning',
  Subscription: 'badge-error',
};

const statusConfig: Record<string, { cls: string; icon: React.ElementType }> = {
  Approved: { cls: 'badge-success', icon: CheckCircle },
  Pending:  { cls: 'badge-warning', icon: Clock },
  Rejected: { cls: 'badge-error',   icon: XCircle },
};

function formatDate(ts: { seconds: number } | undefined) {
  if (!ts) return '—';
  try { return formatDistanceToNow(new Date(ts.seconds * 1000), { addSuffix: true }); }
  catch { return 'Invalid date'; }
}

export function ToolTable({
  tools,
  categories,
  subjects,
  audiences,
  isAdminView = false,
  onEditClick,
  onDeleteClick,
  onDetailsClick,
  onToggleRecommend,
  onTogglePublish,
  sortConfig,
  onSort,
}: ToolTableProps) {
  const getCat = (id: string) => categories.find(c => c.id === id);
  const getAud = (id: string) => audiences.find(a => a.id === id);

  const requestSort = (key: SortConfig['key']) => {
    if (!onSort || !sortConfig) return;
    onSort({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const SortTh = ({ sortKey, children }: { sortKey: SortConfig['key']; children: React.ReactNode }) => (
    <th onClick={() => requestSort(sortKey)} className="cursor-pointer hover:bg-base-200 select-none">
      <span className="flex items-center gap-1">
        {children}
        {sortConfig?.key === sortKey
          ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')
          : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
        <div className="text-5xl opacity-20">🔍</div>
        <p className="text-base-content/50 font-medium">No tools found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-pin-rows">
        <thead>
          <tr className="bg-base-200 text-base-content/60 text-xs uppercase tracking-wider">
            {isAdminView
              ? <SortTh sortKey="name">Tool</SortTh>
              : <th>Tool</th>}
            {isAdminView && <SortTh sortKey="status">Status</SortTh>}
            <th>Categories</th>
            <th>Audience</th>
            <th>Cost</th>
            {isAdminView && <SortTh sortKey="createdAt">Added</SortTh>}
            {isAdminView && <SortTh sortKey="updatedAt">Edited</SortTh>}
            <th className="text-right">{isAdminView ? 'Actions' : 'Links'}</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const toolCats = (tool.toolCategoryIds || []).map(getCat).filter(Boolean) as ToolCategory[];
            const toolAuds = (tool.targetAudienceIds || []).map(getAud).filter(Boolean) as TargetAudience[];
            const status = statusConfig[tool.status] ?? statusConfig.Pending;
            const StatusIcon = status.icon;

            return (
              <tr
                key={tool.id}
                className={cn(
                  'hover:bg-base-200/50 transition-colors',
                  tool.createdForTasc && 'border-l-4 border-l-primary bg-primary/5',
                  tool.recommended && !tool.createdForTasc && 'border-l-4 border-l-warning bg-warning/5',
                  tool.unsafeDataPractices && 'border-l-4 border-l-error bg-error/5',
                )}
              >
                {/* Tool name + logo */}
                <td className="py-3">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <button
                      onClick={() => onDetailsClick?.(tool)}
                      className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <ToolLogo toolUrl={tool.url} toolName={tool.name} logoUrl={tool.logoUrl} size={40} />
                    </button>
                    <div className="min-w-0">
                      <button
                        onClick={() => onDetailsClick?.(tool)}
                        className="font-bold text-base-content hover:text-primary transition-colors text-left line-clamp-1 focus:outline-none"
                      >
                        {tool.name}
                      </button>
                      <p className="text-xs text-base-content/50 line-clamp-1 mt-0.5">{tool.description}</p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                {isAdminView && (
                  <td>
                    <span className={cn('badge badge-soft badge-sm gap-1 font-semibold', status.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {tool.status}
                    </span>
                  </td>
                )}

                {/* Categories */}
                <td>
                  <div className="flex flex-wrap gap-1">
                    {toolCats.slice(0, 2).map(cat => (
                      <span
                        key={cat.id}
                        className="badge badge-sm font-semibold border"
                        style={{ backgroundColor: `${cat.color}22`, color: cat.color, borderColor: `${cat.color}44` }}
                      >
                        {cat.name}
                      </span>
                    ))}
                    {toolCats.length > 2 && (
                      <span className="badge badge-ghost badge-sm">+{toolCats.length - 2}</span>
                    )}
                  </div>
                </td>

                {/* Audience */}
                <td>
                  <div className="flex flex-wrap gap-1">
                    {toolAuds.map(aud => (
                      <span key={aud.id} className="badge badge-ghost badge-sm">{aud.name}</span>
                    ))}
                  </div>
                </td>

                {/* Cost */}
                <td>
                  <span className={cn('badge badge-soft badge-sm font-bold', costBadgeClass[tool.costModel] ?? 'badge-neutral')}>
                    {tool.costModel}
                  </span>
                </td>

                {/* Dates */}
                {isAdminView && (
                  <td className="text-xs text-base-content/50 whitespace-nowrap">{formatDate(tool.createdAt)}</td>
                )}
                {isAdminView && (
                  <td className="text-xs text-base-content/50 whitespace-nowrap">{formatDate(tool.updatedAt)}</td>
                )}

                {/* Actions */}
                <td className="text-right">
                  {isAdminView ? (
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        className={cn('btn btn-ghost btn-xs btn-square', tool.recommended ? 'text-warning' : 'text-base-content/20')}
                        onClick={() => onToggleRecommend?.(tool)}
                        title={tool.recommended ? 'Remove recommendation' : 'Mark recommended'}
                      >
                        <Star className={cn('h-4 w-4', tool.recommended && 'fill-current')} />
                      </button>
                      <button
                        className={cn(
                          'btn btn-ghost btn-xs btn-square',
                          tool.status === 'Approved' ? 'text-success hover:text-warning' : 'text-base-content/30 hover:text-success',
                        )}
                        onClick={() => onTogglePublish?.(tool)}
                        title={tool.status === 'Approved' ? 'Unpublish' : 'Publish'}
                      >
                        {tool.status === 'Approved'
                          ? <Eye className="h-4 w-4" />
                          : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
                        onClick={() => onEditClick?.(tool)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
                        onClick={() => onDeleteClick?.(tool)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs gap-1"
                      >
                        Visit <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => onDetailsClick?.(tool)}
                      >
                        Details
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
