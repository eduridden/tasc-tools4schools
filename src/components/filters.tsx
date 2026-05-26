
"use client";

import { Search, Star, RotateCcw, Sparkles } from "lucide-react";

type FilterOption = {
  id: string;
  name: string;
}

interface FiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  categories: FilterOption[];
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  subjects: FilterOption[];
  selectedAudience: string;
  setSelectedAudience: (value: string) => void;
  audiences: FilterOption[];
  selectedCostModel: string;
  setSelectedCostModel: (value: string) => void;
  costModels: string[];
  showRecommendedOnly: boolean;
  setShowRecommendedOnly: (value: boolean) => void;
  onResetFilters: () => void;
}

export function Filters({
  searchTerm,
  setSearchTerm,
  onSearch,
  isSearching,
  selectedCategory,
  setSelectedCategory,
  categories,
  selectedSubject,
  setSelectedSubject,
  subjects,
  selectedAudience,
  setSelectedAudience,
  audiences,
  selectedCostModel,
  setSelectedCostModel,
  costModels,
  showRecommendedOnly,
  setShowRecommendedOnly,
  onResetFilters,
}: FiltersProps) {

  const filterSelects = [
    { value: selectedCategory,  onChange: setSelectedCategory,  placeholder: "All Categories", options: categories,                                label: "Category" },
    { value: selectedSubject,   onChange: setSelectedSubject,   placeholder: "All Subjects",   options: subjects,                                  label: "Subject"  },
    { value: selectedAudience,  onChange: setSelectedAudience,  placeholder: "All Audiences",  options: audiences,                                 label: "Audience" },
    { value: selectedCostModel, onChange: setSelectedCostModel, placeholder: "All Costs",      options: costModels.map(c => ({ id: c, name: c })), label: "Cost"     },
  ];

  return (
    <div className="space-y-4 bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm">

      {/* ── Search row ── */}
      <div className="flex flex-col lg:flex-row gap-3">

        {/* Search input */}
        <label className="input input-lg flex-1 flex items-center gap-3">
          {isSearching
            ? <span className="loading loading-spinner loading-sm text-primary shrink-0" />
            : <Search className="h-5 w-5 text-base-content/40 shrink-0" />
          }
          <input
            type="text"
            placeholder="Ask anything — e.g. 'free tools to help students write essays'…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isSearching && onSearch()}
            className="grow"
            aria-label="Search for tools"
            disabled={isSearching}
          />
          {searchTerm && !isSearching && (
            <button
              type="button"
              onClick={onResetFilters}
              className="btn btn-ghost btn-xs btn-circle shrink-0"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </label>

        {/* Search button */}
        <button
          type="button"
          onClick={onSearch}
          disabled={isSearching || !searchTerm.trim()}
          className="btn btn-primary btn-lg gap-2 font-bold"
        >
          {isSearching ? (
            <><span className="loading loading-spinner loading-sm" /> Searching…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> AI Search</>
          )}
        </button>

        {/* Recommended toggle */}
        <label className="flex items-center gap-2.5 h-14 px-4 rounded-xl border border-base-300 bg-base-100 cursor-pointer select-none">
          <Star className="w-5 h-5 text-warning fill-warning/30 shrink-0" />
          <span className="font-semibold text-sm whitespace-nowrap">Recommended only</span>
          <input
            type="checkbox"
            className="toggle toggle-warning toggle-sm"
            checked={showRecommendedOnly}
            onChange={(e) => setShowRecommendedOnly(e.target.checked)}
            disabled={isSearching}
          />
        </label>
      </div>

      {/* ── Filter dropdowns row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {filterSelects.map((filter, i) => (
          <select
            key={i}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={`Filter by ${filter.label}`}
            className="select select-bordered bg-base-100 w-full"
            disabled={isSearching}
          >
            <option value="all">{filter.placeholder}</option>
            {filter.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ))}

        <button
          type="button"
          onClick={onResetFilters}
          disabled={isSearching}
          className="btn btn-outline btn-error w-full group"
        >
          <RotateCcw className="h-4 w-4 transition-transform group-hover:-rotate-90" />
          Reset Filters
        </button>
      </div>
    </div>
  );
}
