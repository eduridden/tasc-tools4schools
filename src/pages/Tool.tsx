
import { useMemo, useState, useTransition, useEffect } from 'react';
import { useParams, Link } from "react-router-dom";
import { useDoc, useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import type { AiTool, ToolCategory, SubjectArea, TargetAudience, ToolReview } from "@/lib/types";
import { generateToolGuide } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ToolLogo } from "@/components/tool-logo";
import { FloatingCubes } from "@/components/floating-cubes";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { LoginModal } from "@/components/login-modal";
import { YouTubeEmbed } from '@/components/youtube-embed';
import * as lucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft, Book, Globe, Users, GraduationCap, LifeBuoy,
  Star, Check, Sparkles, Loader2, RefreshCw, ShieldAlert, ExternalLink,
  CheckCircle2, Shield, MessageSquare, Send, Pencil, Trash2,
} from "lucide-react";
import { learningAreas } from '@/lib/constants';

/** Read-only star display */
const StarDisplay = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) => {
  const cls = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const rounded = Math.round(rating);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`${cls} ${s <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-none text-base-300'}`}
        />
      ))}
    </div>
  );
};

const getIcon = (iconName: string): LucideIcon => (lucideIcons as any)[iconName] || Globe;

const costBadgeClass: Record<string, string> = {
  Free: 'badge-success',
  Freemium: 'badge-warning',
  Subscription: 'badge-error',
};

const ageBadgeClass: Record<string, string> = {
  'All Ages': 'badge-info',
  '13+': 'badge-secondary',
  '16+': 'badge-warning',
  '18+': 'badge-error',
};

export default function ToolPage() {
  const { id: toolId } = useParams();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user, userDoc, isAdmin } = useUser();

  const [isGenerating, startTransition] = useTransition();
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  const [selectedLearningArea, setSelectedLearningArea] = useState<string>(learningAreas[0]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // ── Review state ──
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  const toolRef = useMemoFirebase(() => (firestore && toolId) ? doc(firestore, "ai_tools", toolId) : null, [firestore, toolId]);
  const catsRef = useMemoFirebase(() => firestore ? collection(firestore, "tool_categories") : null, [firestore]);
  const subjectsRef = useMemoFirebase(() => firestore ? collection(firestore, "subject_areas") : null, [firestore]);
  const audiencesRef = useMemoFirebase(() => firestore ? collection(firestore, "target_audiences") : null, [firestore]);

  const { data: tool, isLoading: toolLoading, error: toolError } = useDoc<AiTool>(toolRef);
  const { data: categories } = useCollection<ToolCategory>(catsRef);
  const { data: subjects } = useCollection<SubjectArea>(subjectsRef);
  const { data: audiences } = useCollection<TargetAudience>(audiencesRef);
  const [reviews, setReviews] = useState<(ToolReview & { id: string })[] | null>(null);

  // Load reviews with a local subscription — errors are caught silently so a
  // permission failure never propagates to the global error handler.
  useEffect(() => {
    if (!firestore || !toolId) return;
    const unsub = onSnapshot(
      collection(firestore, 'ai_tools', toolId, 'reviews'),
      snap => setReviews(snap.docs.map(d => ({ ...(d.data() as ToolReview), id: d.id }))),
      _err => setReviews([]),   // fail silently — don't touch global error emitter
    );
    return unsub;
  }, [firestore, toolId]);

  useEffect(() => {
    if (tool?.defaultIdea) setGeneratedIdeas([tool.defaultIdea]);
    else setGeneratedIdeas([]);
  }, [tool]);

  // Pre-fill form with user's existing review
  const userReview = useMemo(() => {
    if (!reviews || !user) return null;
    return reviews.find(r => r.userId === user.uid) ?? null;
  }, [reviews, user]);

  useEffect(() => {
    if (userReview) {
      setReviewRating(userReview.rating);
      setReviewText(userReview.reviewText);
    }
  }, [userReview]);

  const avgRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const handleSubmitReview = async () => {
    if (!user || !firestore || !toolId || reviewRating === 0) return;
    setIsSubmittingReview(true);
    try {
      // Identity is taken from Firebase Auth, NOT from the writable userDoc.
      // userDoc.displayName/avatarUrl are user-mutable Firestore fields and
      // would let any user spoof their identity in reviews.
      await setDoc(doc(firestore, 'ai_tools', toolId, 'reviews', user.uid), {
        userId: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Teacher',
        avatarUrl: user.photoURL || '',
        rating: reviewRating,
        reviewText: reviewText.trim().slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Review submitted!', description: 'Thanks for helping other teachers.' });
      setIsEditingReview(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Review] submit failed:', err);
      toast({ variant: 'destructive', title: 'Failed to submit review', description: 'Please try again.' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toolCategories = useMemo(() => {
    if (!tool || !categories) return [];
    return tool.toolCategoryIds.map(id => categories.find(c => c.id === id)).filter(Boolean) as ToolCategory[];
  }, [tool, categories]);

  const toolSubjects = useMemo(() => {
    if (!tool || !subjects) return [];
    return tool.subjectAreaIds.map(id => subjects.find(s => s.id === id)).filter(Boolean) as SubjectArea[];
  }, [tool, subjects]);

  const toolAudiences = useMemo(() => {
    if (!tool || !audiences) return [];
    return tool.targetAudienceIds.map(id => audiences.find(a => a.id === id)).filter(Boolean) as TargetAudience[];
  }, [tool, audiences]);

  const media = useMemo(() => {
    const items: { type: 'youtube' | 'image'; url: string }[] = [];
    if (tool?.youtubeVideoUrl) items.push({ type: 'youtube', url: tool.youtubeVideoUrl });
    tool?.screenshotUrls?.forEach(url => items.push({ type: 'image', url }));
    return items;
  }, [tool]);

  const handleGenerateIdeas = () => {
    if (!tool) return;
    startTransition(async () => {
      try {
        const result = await generateToolGuide({
          toolName: tool.name,
          toolDescription: tool.description || '',
          toolUrl: tool.url,
          learningArea: selectedLearningArea,
          isDataUnsafe: tool.unsafeDataPractices || false,
        });
        setGeneratedIdeas(result.ideas);
      } catch {
        toast({ variant: "destructive", title: "AI Suggestion Failed", description: "Please try again." });
      }
    });
  };

  if (!toolId) {
    return <div className="min-h-screen flex items-center justify-center"><p>Invalid Tool ID</p></div>;
  }

  if (toolError) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-error">Error loading tool.</p></div>;
  }

  /* ── Loading skeleton ── */
  if (toolLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <div className="animate-gradient-hero py-28 relative">
          <div className="container mx-auto px-4">
            <div className="skeleton h-5 w-32 bg-white/20 mb-8 rounded-lg" />
            <div className="flex items-center gap-6">
              <div className="skeleton w-24 h-24 rounded-2xl bg-white/20" />
              <div className="space-y-3">
                <div className="skeleton h-10 w-64 bg-white/20 rounded-xl" />
                <div className="skeleton h-5 w-40 bg-white/20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          <div className="lg:col-span-7 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
          <div className="lg:col-span-5 space-y-4">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-5xl opacity-30">🔍</div>
        <p className="text-xl font-bold">Tool not found</p>
        <Link to="/" className="btn btn-primary btn-sm">Back to All Tools</Link>
      </div>
    );
  }

  const audienceIcon = (name: string): LucideIcon =>
    name === 'Teachers' ? GraduationCap : name === 'Students' ? Users : LifeBuoy;

  // Accent bar at the bottom of the hero — reflects the tool's "personality"
  const accentGradient = tool.unsafeDataPractices
    ? 'from-amber-500 via-orange-500 to-red-600'
    : tool.createdForTasc
      ? 'from-primary via-accent to-secondary'
      : tool.recommended
        ? 'from-warning via-orange-400 to-amber-500'
        : 'from-success via-teal-500 to-info';

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* ── Hero — always calm blue→purple; accent bar carries the tool's colour ── */}
      <section className="relative overflow-hidden text-white animate-gradient-hero">
        <FloatingCubes />

        <div className="relative z-10 container mx-auto px-4 pt-6 pb-10">

          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Tools
          </Link>

          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-10">

            {/* Left: logo + name + url */}
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <div className="p-3 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20 shrink-0">
                <ToolLogo toolUrl={tool.url} toolName={tool.name} logoUrl={tool.logoUrl} size={80} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {tool.createdForTasc && (
                    <span className="badge badge-sm bg-white/20 border-white/30 text-white font-bold gap-1">
                      <Check className="w-3 h-3 stroke-[3]" /> TASC Exclusive
                    </span>
                  )}
                  {tool.recommended && (
                    <span className="badge badge-sm bg-warning/30 border-warning/40 text-white font-bold gap-1">
                      <Star className="w-3 h-3 fill-current" /> Recommended
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight truncate">
                  {tool.name}
                </h1>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-white/55 hover:text-white text-sm mt-2 transition-colors"
                >
                  {tool.url.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
            </div>

            {/* Right: badges + review stars */}
            <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="flex gap-2 flex-wrap">
                <span className={`badge badge-lg font-bold ${costBadgeClass[tool.costModel] ?? 'badge-neutral'}`}>
                  {tool.costModel}
                </span>
                {tool.ageRestriction && (
                  <span className={`badge badge-lg font-bold ${ageBadgeClass[tool.ageRestriction] ?? 'badge-neutral'}`}>
                    {tool.ageRestriction}
                  </span>
                )}
              </div>
              {/* Review stars */}
              <div className="flex flex-col items-start lg:items-end gap-1">
                <StarDisplay rating={avgRating} size="md" />
                <span className="text-white/60 text-xs font-medium">
                  {(reviews?.length ?? 0) === 0
                    ? 'No teacher reviews yet'
                    : `${avgRating.toFixed(1)} · ${reviews!.length} teacher ${reviews!.length === 1 ? 'review' : 'reviews'}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Data warning */}
          {tool.unsafeDataPractices && (
            <div className="mt-6 alert bg-error border border-error/40 text-white max-w-2xl">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <p className="text-sm font-bold">
                Data Policy Warning: This tool may share data publicly.
                Never use with personal, student or school information.
              </p>
            </div>
          )}
        </div>

        {/* Accent bar */}
        <div className={`h-[5px] w-full bg-gradient-to-r ${accentGradient}`} />
      </section>

      {/* ── Content ── */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Left column ── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Media gallery */}
            {media.length > 0 && (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body gap-4">
                  <h2 className="card-title gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Gallery
                  </h2>
                  <div className="carousel w-full rounded-xl overflow-hidden border border-base-200">
                    {media.map((item, i) => (
                      <div key={i} id={`slide-${i}`} className="carousel-item w-full shrink-0">
                        {item.type === 'youtube' ? (
                          <YouTubeEmbed videoUrl={item.url} />
                        ) : (
                          <img
                            src={item.url}
                            alt={`${tool.name} screenshot ${i + 1}`}
                            className="w-full aspect-video object-contain bg-base-200"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {media.length > 1 && (
                    <div className="flex justify-center gap-2">
                      {media.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setActiveSlide(i);
                            document.getElementById(`slide-${i}`)?.scrollIntoView({
                              behavior: 'smooth', inline: 'nearest', block: 'nearest',
                            });
                          }}
                          className={`btn btn-xs btn-circle ${activeSlide === i ? 'btn-primary' : 'btn-ghost'}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* About */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-3">
                <h2 className="card-title">About {tool.name}</h2>
                <p className="text-base-content/70 leading-relaxed">{tool.description}</p>
              </div>
            </div>

            {/* Key Features */}
            {tool.keyFeatures && tool.keyFeatures.length > 0 && (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body gap-4">
                  <h2 className="card-title">Key Features</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tool.keyFeatures.map(feature => (
                      <div
                        key={feature}
                        className="flex items-center gap-2.5 border border-base-200 rounded-xl px-3 py-2.5 bg-base-50"
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-base-content/80">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Safety & Compliance */}
            {(tool.gdprCompliant || tool.coppaCompliant || tool.ferpaCompliant || tool.dataHostingLocation || tool.st4sVerified) && (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="card-title gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Safety & Compliance
                    </h2>
                    <span className="badge badge-ghost badge-sm">Self-declared by company</span>
                  </div>
                  <div className="divider my-0" />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {[
                      {
                        label: 'GDPR Compliant',
                        value: tool.gdprCompliant,
                        tip: 'EU regulation requiring informed consent before collecting personal data. Relevant when students or staff are based in Europe, or the tool uses EU-hosted servers.',
                      },
                      {
                        label: 'COPPA Compliant',
                        value: tool.coppaCompliant,
                        tip: 'US law restricting online data collection from children under 13. Check this before allowing younger students to create accounts or submit personal information.',
                      },
                      {
                        label: 'FERPA Compliant',
                        value: tool.ferpaCompliant,
                        tip: 'US law protecting student education records. A compliant tool won\'t share student data with third parties without school or parental consent.',
                      },
                      { label: 'Data Hosting', value: tool.dataHostingLocation, tip: null },
                    ].map(({ label, value, tip }) => value && (
                      <div key={label} className="flex items-center justify-between border-b border-base-200 pb-3">
                        {tip ? (
                          <div className="tooltip tooltip-right text-left" data-tip={tip}>
                            <span className="text-base-content/60 underline decoration-dotted decoration-base-content/30 cursor-help">{label}</span>
                          </div>
                        ) : (
                          <span className="text-base-content/60">{label}</span>
                        )}
                        <span className={
                          value === 'Yes' ? 'font-semibold text-success' :
                            value === 'No' ? 'font-semibold text-error' :
                              'font-semibold text-base-content/40'
                        }>{value}</span>
                      </div>
                    ))}
                  </div>
                  {tool.st4sVerified && (
                    <div className="flex items-center justify-between pt-1">
                      <div
                        className="tooltip tooltip-right text-left"
                        data-tip="Safe Technology for Schools — an Australian certification confirming this tool meets privacy and safety standards for K-12 school use."
                      >
                        <a
                          href="https://st4s.edu.au/verify-a-badge/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary transition-colors underline decoration-dotted decoration-base-content/30"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          ST4S Verified
                        </a>
                      </div>
                      <span className={
                        tool.st4sVerified === 'Yes' ? 'font-bold text-success' :
                          tool.st4sVerified === 'No' ? 'font-semibold text-error' :
                            'font-semibold text-base-content/40'
                      }>{tool.st4sVerified}</span>
                    </div>
                  )}
                  {tool.st4sVerified === 'Yes' && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-success/80 bg-success/10 rounded-lg px-3 py-2 border border-success/20">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Verified on the Safe Technology for Schools register
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Classification */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-6">
                <h2 className="card-title gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Classification
                </h2>

                {toolAudiences.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Recommended For</p>
                    <div className="flex flex-wrap gap-2">
                      {toolAudiences.map(aud => {
                        const Icon = audienceIcon(aud.name);
                        return (
                          <span
                            key={aud.id}
                            className="badge badge-outline gap-1.5 font-semibold"
                            style={{ color: aud.color, borderColor: `${aud.color}66` }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {aud.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {toolCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {toolCategories.map(cat => {
                        const Icon = getIcon(cat.icon);
                        return (
                          <span
                            key={cat.id}
                            className="badge gap-1.5 font-semibold border"
                            style={{ backgroundColor: `${cat.color}22`, color: cat.color, borderColor: `${cat.color}44` }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {cat.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {toolSubjects.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Subject Areas</p>
                    <div className="flex flex-wrap gap-2">
                      {toolSubjects.map(sub => {
                        const Icon = getIcon(sub.icon);
                        return (
                          <span
                            key={sub.id}
                            className="badge gap-1.5 font-semibold border"
                            style={{ backgroundColor: `${sub.color}22`, color: sub.color, borderColor: `${sub.color}44` }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {sub.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Teacher Reviews — list */}
            {reviews && reviews.length > 0 && (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body gap-5">
                  <div className="flex items-center gap-3">
                    <h2 className="card-title gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      Teacher Reviews
                    </h2>
                    <span className="badge badge-ghost">{reviews.length}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <StarDisplay rating={avgRating} size="sm" />
                      <span className="text-sm font-bold text-base-content/70">{avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[...reviews]
                      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
                      .map(review => (
                        <div key={review.id} className="flex flex-col gap-2 border-b border-base-200 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-base-300 overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold text-base-content/60">
                                {review.avatarUrl
                                  ? <img src={review.avatarUrl} alt={review.displayName} className="w-full h-full object-cover" />
                                  : (review.displayName?.[0] ?? '?').toUpperCase()
                                }
                              </div>
                              <span className="font-semibold text-sm text-base-content truncate">{review.displayName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <StarDisplay rating={review.rating} size="sm" />
                              {isAdmin && (
                                <button
                                  className="btn btn-ghost btn-xs text-error/50 hover:text-error"
                                  title="Delete review"
                                  onClick={async () => {
                                    if (!firestore || !toolId) return;
                                    if (!window.confirm(`Delete ${review.displayName}'s review?`)) return;
                                    await deleteDoc(doc(firestore, 'ai_tools', toolId, 'reviews', review.id));
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {review.reviewText && (
                            <p className="text-sm text-base-content/70 leading-relaxed">{review.reviewText}</p>
                          )}
                          {review.createdAt && (
                            <span className="text-xs text-base-content/35">
                              {new Date(review.createdAt.seconds * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-5 space-y-6">

            {/* AI Smart Suggestions */}
            <div className="card bg-primary/5 border border-primary/20 shadow-sm">
              <div className="card-body gap-5">
                <h2 className="card-title gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  Smart Suggestions
                </h2>
                <p className="text-sm text-base-content/60 -mt-2">
                  AI-powered ideas for using {tool.name} in your classroom.
                </p>

                <fieldset className="fieldset gap-1">
                  <legend className="fieldset-legend">Learning Area</legend>
                  <select
                    className="select select-bordered w-full bg-base-100"
                    value={selectedLearningArea}
                    onChange={(e) => setSelectedLearningArea(e.target.value)}
                    disabled={isGenerating}
                  >
                    {learningAreas.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </fieldset>

                <button
                  onClick={handleGenerateIdeas}
                  disabled={isGenerating}
                  className="btn btn-primary w-full gap-2"
                >
                  {isGenerating
                    ? <><span className="loading loading-spinner loading-sm" /> Generating ideas…</>
                    : <><Sparkles className="h-4 w-4" /> Generate Teaching Ideas</>
                  }
                </button>

                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3 text-primary/60">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-medium animate-pulse text-center">
                      Consulting AI for {selectedLearningArea}…
                    </p>
                  </div>
                ) : generatedIdeas.length > 0 && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary/70">
                        Ideas for {selectedLearningArea}
                      </p>
                      <button onClick={handleGenerateIdeas} className="btn btn-ghost btn-xs gap-1 text-primary/60">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                    </div>
                    <div className="bg-base-100 rounded-xl p-4 border border-primary/15">
                      <ul className="space-y-3">
                        {generatedIdeas.map((idea, i) => (
                          <li key={i} className="flex gap-3 text-sm text-base-content/80 leading-relaxed">
                            <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {idea}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {!isGenerating && generatedIdeas.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-primary/20 rounded-xl">
                    <p className="text-xs text-base-content/40 font-medium">
                      Select a learning area above and generate ideas.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Teacher Reviews — write a review */}
            <div className="card bg-amber-50 border border-amber-200 shadow-sm">
              <div className="card-body gap-4">
                <h2 className="card-title text-amber-800 gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  Teacher Reviews
                </h2>

                {!user ? (
                  /* ── Not logged in ── */
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-amber-900/70">
                      Used <span className="font-semibold">{tool.name}</span>? Help other teachers by sharing your experience.
                    </p>
                    <button
                      onClick={() => setIsLoginModalOpen(true)}
                      className="btn btn-warning btn-sm gap-2 self-start"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Sign in to write a review
                    </button>
                  </div>

                ) : userReview && !isEditingReview ? (
                  /* ── Thank-you state: review already submitted ── */
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-semibold text-amber-800">Thanks for your review!</span>
                    </div>
                    <figure className="border-l-4 border-amber-300 pl-4 space-y-2">
                      <StarDisplay rating={userReview.rating} size="sm" />
                      {userReview.reviewText && (
                        <blockquote className="text-sm text-amber-900/80 italic leading-relaxed">
                          &ldquo;{userReview.reviewText}&rdquo;
                        </blockquote>
                      )}
                    </figure>
                    <button
                      onClick={() => setIsEditingReview(true)}
                      className="btn btn-outline btn-warning btn-xs gap-1.5 self-start"
                    >
                      <Pencil className="h-3 w-3" /> Edit Review
                    </button>
                  </div>

                ) : (
                  /* ── Write / edit form ── */
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-amber-900/70">
                      {userReview
                        ? <>Editing your review of <span className="font-semibold">{tool.name}</span>.</>
                        : <>Used <span className="font-semibold">{tool.name}</span>? Help other teachers by sharing your experience.</>
                      }
                    </p>

                    {/* Star picker */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800/60">Your Rating</span>
                      <div className="rating rating-lg">
                        {[1, 2, 3, 4, 5].map(star => (
                          <input
                            key={star}
                            type="radio"
                            name={`review-rating-${toolId}`}
                            className="mask mask-star-2 bg-amber-400"
                            checked={reviewRating === star}
                            onChange={() => setReviewRating(star)}
                          />
                        ))}
                      </div>
                    </div>

                    <textarea
                      className="textarea textarea-bordered bg-white w-full text-sm leading-relaxed resize-none"
                      rows={3}
                      placeholder="Share how you used this tool, what worked well, and any tips for other teachers…"
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview || reviewRating === 0}
                        className="btn btn-warning btn-sm gap-2 font-bold"
                      >
                        {isSubmittingReview
                          ? <><span className="loading loading-spinner loading-xs" /> Submitting…</>
                          : <><Send className="h-3.5 w-3.5" /> {userReview ? 'Update Review' : 'Submit Review'}</>
                        }
                      </button>
                      {isEditingReview && (
                        <button
                          onClick={() => setIsEditingReview(false)}
                          className="btn btn-ghost btn-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resources & Links */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-3">
                <h2 className="card-title text-base">Resources & Links</h2>
                <div className="space-y-2">
                  {tool.documentationUrl && (
                    <a
                      href={tool.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-block justify-start gap-3 font-semibold"
                    >
                      <Book className="h-4 w-4 text-base-content/50" />
                      View Documentation
                    </a>
                  )}
                  {tool.trainingUrl && (
                    <a
                      href={tool.trainingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-block justify-start gap-3 font-semibold"
                    >
                      <GraduationCap className="h-4 w-4 text-base-content/50" />
                      Training Academy
                    </a>
                  )}
                  {!tool.documentationUrl && !tool.trainingUrl && (
                    <p className="text-sm text-base-content/40 text-center py-4">No additional links available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success btn-lg btn-block gap-2 font-black shadow-lg shadow-success/20"
            >
              <ExternalLink className="h-5 w-5" />
              Launch {tool.name}
            </a>
          </div>
        </div>
      </main>

      <Footer
        categories={categories || []}
        onCategoryClick={() => { }}
        onRecommendedClick={() => { }}
        onAudienceClick={() => { }}
      />

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
