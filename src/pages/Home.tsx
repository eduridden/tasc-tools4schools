
import { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, where, query, doc } from "firebase/firestore";
import type { AiTool, ToolCategory, SubjectArea, TargetAudience, SiteSettings } from "@/lib/types";
import { interpretSearchQuery, aiSearch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Filters } from "@/components/filters";
import { ToolCard } from "@/components/tool-card";
import { LoginModal } from "@/components/login-modal";
import { Wrench, Star, Zap, Sparkles, X } from "lucide-react";

export default function Home() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // ── Filter state ──
  const [searchTerm, setSearchTerm]               = useState('');
  const [selectedCategory, setSelectedCategory]   = useState('all');
  const [selectedSubject, setSelectedSubject]     = useState('all');
  const [selectedAudience, setSelectedAudience]   = useState('all');
  const [selectedCostModel, setSelectedCostModel] = useState('all');
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);

  // ── AI search state ──
  const [isSearching, setIsSearching]         = useState(false);
  const [activeQuery, setActiveQuery]         = useState('');         // query that was submitted
  const [rankedToolIds, setRankedToolIds]     = useState<string[] | null>(null); // null = AI search inactive

  // ── Modal state ──
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // ── Firestore queries ──
  const toolsQuery      = useMemoFirebase(() => firestore ? query(collection(firestore, "ai_tools"), where("status", "==", "Approved")) : null, [firestore]);
  const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "tool_categories")  : null, [firestore]);
  const subjectsQuery   = useMemoFirebase(() => firestore ? collection(firestore, "subject_areas")    : null, [firestore]);
  const audiencesQuery  = useMemoFirebase(() => firestore ? collection(firestore, "target_audiences") : null, [firestore]);
  const settingsRef     = useMemoFirebase(() => firestore ? doc(firestore, "site_settings", "global") : null, [firestore]);

  const { data: tools,      isLoading: loadingTools }      = useCollection<AiTool>(toolsQuery);
  const { data: categories, isLoading: loadingCategories } = useCollection<ToolCategory>(categoriesQuery);
  const { data: subjects,   isLoading: loadingSubjects }   = useCollection<SubjectArea>(subjectsQuery);
  const { data: audiences,  isLoading: loadingAudiences }  = useCollection<TargetAudience>(audiencesQuery);
  const { data: siteSettings }                             = useDoc<SiteSettings>(settingsRef);

  const isLoading = loadingTools || loadingCategories || loadingSubjects || loadingAudiences;

  // ── AI-powered search ──
  const handleSearch = async () => {
    if (!searchTerm.trim() || isSearching) return;

    setIsSearching(true);
    setActiveQuery(searchTerm);

    try {
      // Step 1: Extract structured intent from natural language
      const interpreted = await interpretSearchQuery({
        query: searchTerm,
        availableCategories: (categories || []).map(c => ({ id: c.id, name: c.name })),
        availableAudiences:  (audiences  || []).map(a => ({ id: a.id, name: a.name })),
        availableCostModels: ['Free', 'Freemium', 'Subscription'],
      });

      // Auto-populate filter dropdowns from AI interpretation
      if (interpreted.categoryId) setSelectedCategory(interpreted.categoryId);
      if (interpreted.audienceId) setSelectedAudience(interpreted.audienceId);
      if (interpreted.costModel)  setSelectedCostModel(interpreted.costModel);

      // Step 2: Semantic ranking of all approved tools
      const toolsForRanking = (tools || []).map(t => ({
        id:            t.id,
        name:          t.name,
        description:   t.description || '',
        categoryNames: (t.toolCategoryIds || [])
          .map(id => categories?.find(c => c.id === id)?.name)
          .filter(Boolean) as string[],
        keyFeatures:         t.keyFeatures ?? [],
        gdprCompliant:       t.gdprCompliant,
        coppaCompliant:      t.coppaCompliant,
        ferpaCompliant:      t.ferpaCompliant,
        dataHostingLocation: t.dataHostingLocation,
        st4sVerified:        t.st4sVerified,
        costModel:           t.costModel,
        ageRestriction:      t.ageRestriction,
      }));

      const searchResult = await aiSearch({
        query: interpreted.keywords || searchTerm,
        tools: toolsForRanking,
      });

      setRankedToolIds(searchResult.rankedToolIds?.length > 0 ? searchResult.rankedToolIds : null);

    } catch (error) {
      console.error('AI search failed:', error);
      toast({
        variant: 'destructive',
        title: 'AI Search failed',
        description: 'Showing text-filtered results instead.',
      });
      // Keep activeQuery so text filtering still applies
      setRankedToolIds(null);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Reset everything ──
  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveQuery('');
    setRankedToolIds(null);
    setSelectedCategory('all');
    setSelectedSubject('all');
    setSelectedAudience('all');
    setSelectedCostModel('all');
    setShowRecommendedOnly(false);
  };

  // ── Dismiss AI search but keep dropdowns ──
  const handleDismissAiSearch = () => {
    setSearchTerm('');
    setActiveQuery('');
    setRankedToolIds(null);
  };

  // ── Filtered + sorted tools ──
  const filteredTools = useMemo(() => {
    if (!tools) return [];

    // Apply dropdown filters (always active regardless of search mode)
    const filtered = tools.filter(tool => {
      const matchesCategory    = selectedCategory    === 'all' || tool.toolCategoryIds.includes(selectedCategory);
      const matchesSubject     = selectedSubject     === 'all' || tool.subjectAreaIds.includes(selectedSubject);
      const matchesAudience    = selectedAudience    === 'all' || tool.targetAudienceIds.includes(selectedAudience);
      const matchesCost        = selectedCostModel   === 'all' || tool.costModel === selectedCostModel;
      const matchesRecommended = !showRecommendedOnly || tool.recommended;
      // Text filter only applies when there is no AI ranking active
      const matchesText = rankedToolIds !== null || !activeQuery
        || tool.name.toLowerCase().includes(activeQuery.toLowerCase())
        || tool.description?.toLowerCase().includes(activeQuery.toLowerCase());
      return matchesCategory && matchesSubject && matchesAudience && matchesCost && matchesRecommended && matchesText;
    });

    // AI ranking active: show only AI-ranked tools, in ranked order
    if (rankedToolIds && rankedToolIds.length > 0) {
      const rankMap = new Map(rankedToolIds.map((id, i) => [id, i]));
      return filtered
        .filter(t => rankMap.has(t.id))
        .sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
    }

    // Default: TASC Exclusive → Recommended → Alphabetical
    return filtered.sort((a, b) => {
      const priority = (t: AiTool) => t.createdForTasc ? 0 : t.recommended ? 1 : 2;
      const diff = priority(a) - priority(b);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [tools, selectedCategory, selectedSubject, selectedAudience, selectedCostModel, showRecommendedOnly, activeQuery, rankedToolIds]);

  const stats = useMemo(() => ({
    total:       tools?.length ?? 0,
    free:        tools?.filter(t => t.costModel === 'Free').length ?? 0,
    recommended: tools?.filter(t => t.recommended).length ?? 0,
  }), [tools]);

  const isAiSearchActive = !!activeQuery && !isSearching;
  const hasActiveFilters = isAiSearchActive
    || selectedCategory !== 'all' || selectedSubject !== 'all'
    || selectedAudience !== 'all' || selectedCostModel !== 'all'
    || showRecommendedOnly;

  const costModels = ['Free', 'Freemium', 'Subscription'];

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* ── Hero ── */}
      <section className="animate-gradient-hero relative overflow-hidden text-white">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 container mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-3 drop-shadow-sm">
            {siteSettings?.siteName || 'AI Tools for Schools'}
          </h1>
          <p className="text-lg sm:text-xl opacity-75 mb-10 max-w-xl mx-auto font-medium">
            {siteSettings?.siteSubtitle || 'Discover and explore curated AI tools for educators and students'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {[
              { icon: Wrench, value: stats.total,       label: 'Curated Tools' },
              { icon: Zap,    value: stats.free,        label: 'Free Tools'    },
              { icon: Star,   value: stats.recommended, label: 'Recommended'   },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-3"
              >
                <Icon className="h-5 w-5 opacity-80" />
                <span className="font-black text-2xl leading-none">{isLoading ? '…' : value}</span>
                <span className="text-sm opacity-70 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto px-4 py-8 space-y-5">
        <Filters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSearch={handleSearch}
          isSearching={isSearching}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories || []}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          subjects={subjects || []}
          selectedAudience={selectedAudience}
          setSelectedAudience={setSelectedAudience}
          audiences={audiences || []}
          selectedCostModel={selectedCostModel}
          setSelectedCostModel={setSelectedCostModel}
          costModels={costModels}
          showRecommendedOnly={showRecommendedOnly}
          setShowRecommendedOnly={setShowRecommendedOnly}
          onResetFilters={handleResetFilters}
        />

        {/* ── AI search results banner ── */}
        {isAiSearchActive && (
          <div className="flex items-center gap-3 px-5 py-3 bg-primary/10 border border-primary/25 rounded-xl text-sm">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-base-content/70 font-medium flex-1">
              AI results for{' '}
              <span className="font-bold text-base-content">"{activeQuery}"</span>
              {rankedToolIds && (
                <> — {filteredTools.length} relevant {filteredTools.length === 1 ? 'tool' : 'tools'} found</>
              )}
            </span>
            <button
              onClick={handleDismissAiSearch}
              className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}

        {/* ── Searching overlay ── */}
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <span className="loading loading-spinner loading-lg text-primary" />
              <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="text-base-content/60 font-medium text-center">
              Gemini is searching for the best tools…
            </p>
          </div>

        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-72 w-full rounded-2xl" />
            ))}
          </div>

        ) : filteredTools.length > 0 ? (
          <>
            {hasActiveFilters && !isAiSearchActive && (
              <p className="text-sm text-base-content/50 font-medium">
                Showing <span className="font-bold text-base-content">{filteredTools.length}</span> of {stats.total} tools
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  categories={categories || []}
                  subjects={subjects || []}
                />
              ))}
            </div>
          </>

        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-6xl opacity-30">🔍</div>
            <h3 className="text-xl font-bold text-base-content">No tools found</h3>
            <p className="text-base-content/50">
              {isAiSearchActive
                ? 'Gemini couldn\'t find relevant tools for this query. Try different wording.'
                : 'Try adjusting your filters.'}
            </p>
            <button onClick={handleResetFilters} className="btn btn-primary btn-sm mt-2">
              Reset Everything
            </button>
          </div>
        )}
      </main>

      <Footer
        categories={categories || []}
        onCategoryClick={(id) => { setSelectedCategory(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onRecommendedClick={() => { setShowRecommendedOnly(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onAudienceClick={(id) => { setSelectedAudience(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
