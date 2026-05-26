
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { AiTool, ToolCategory, SubjectArea } from "@/lib/types";
import { ToolLogo } from "@/components/tool-logo";
import { Star, Check, ShieldAlert } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  tool: AiTool;
  categories: ToolCategory[];
  subjects: SubjectArea[];
}

function getIconComponent(iconName: string): LucideIcon | null {
  return (LucideIcons as any)[iconName] || null;
}

const costBadgeClass: Record<string, string> = {
  Free:         "badge-success",
  Freemium:     "badge-warning",
  Subscription: "badge-error",
};

const ageBadgeClass: Record<string, string> = {
  "All Ages": "badge-info",
  "13+":      "badge-secondary",
  "16+":      "badge-warning",
  "18+":      "badge-error",
};

export function ToolCard({ tool, categories }: ToolCardProps) {
  const toolCats = useMemo(
    () => (tool.toolCategoryIds || []).map(id => categories.find(c => c.id === id)).filter(Boolean) as ToolCategory[],
    [tool.toolCategoryIds, categories]
  );

  const costBadge = costBadgeClass[tool.costModel] ?? "badge-neutral";
  const ageBadge  = ageBadgeClass[tool.ageRestriction ?? ""] ?? "badge-neutral";

  // Header gradient: Unsafe (highest priority) > TASC > Recommended > Regular
  const headerClass = tool.unsafeDataPractices
    ? "bg-gradient-to-br from-amber-500 to-red-600"
    : tool.createdForTasc
    ? "bg-gradient-to-br from-primary to-accent"
    : tool.recommended
    ? "bg-gradient-to-br from-warning to-orange-400"
    : "bg-gradient-to-br from-success/80 to-info/80";

  return (
    <Link
      to={`/tool/${tool.id}`}
      className="hover-3d w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="card bg-base-100 shadow-md w-full overflow-hidden pointer-events-none flex flex-col">

        {/* ── Gradient header ── */}
        <div className={`relative ${headerClass} p-5`}>

          {/* Top-right badges */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            {tool.createdForTasc && (
              <span className="badge badge-sm bg-white/95 text-primary border-0 font-bold gap-1 shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" /> TASC Exclusive
              </span>
            )}
            {tool.recommended && !tool.createdForTasc && (
              <span className="badge badge-sm bg-white/95 text-amber-700 border-0 font-bold gap-1 shadow-sm">
                <Star className="w-3 h-3 fill-amber-500" /> Recommended
              </span>
            )}
            {tool.unsafeDataPractices && (
              <span className="badge badge-sm badge-error gap-1 font-bold">
                <ShieldAlert className="w-3 h-3" /> Data Warning
              </span>
            )}
          </div>

          {/* Logo — white bg ensures transparent logos render cleanly */}
          <div className="inline-flex rounded-xl bg-white p-1.5 shadow-sm">
            <ToolLogo toolUrl={tool.url} toolName={tool.name} logoUrl={tool.logoUrl} size={56} />
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="card-body p-4 gap-3 flex-1 flex flex-col">

          {/* Name */}
          <h3 className="font-bold text-base leading-snug text-base-content">{tool.name}</h3>

          {/* Description */}
          {tool.description && (
            <p className="text-xs text-base-content/60 line-clamp-2 leading-relaxed flex-1">
              {tool.description}
            </p>
          )}

          {/* Cost + Age badges */}
          <div className="flex gap-1.5 flex-wrap">
            <span className={`badge badge-sm badge-soft font-semibold ${costBadge}`}>{tool.costModel}</span>
            {tool.ageRestriction && (
              <span className={`badge badge-sm badge-soft font-semibold ${ageBadge}`}>{tool.ageRestriction}</span>
            )}
          </div>

          {/* Category tags */}
          {toolCats.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-base-200">
              {toolCats.slice(0, 2).map(cat => {
                const Icon = getIconComponent(cat.icon);
                return (
                  <span
                    key={cat.id}
                    className="badge badge-sm gap-1 font-medium border"
                    style={{
                      backgroundColor: `${cat.color}22`,
                      color: cat.color,
                      borderColor: `${cat.color}55`,
                    }}
                  >
                    {Icon && <Icon className="w-2.5 h-2.5" />}
                    {cat.name}
                  </span>
                );
              })}
              {toolCats.length > 2 && (
                <span className="badge badge-sm badge-ghost font-medium">+{toolCats.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Required by DaisyUI hover-3d */}
      <div /><div /><div /><div /><div /><div /><div /><div />
    </Link>
  );
}
