import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import {
  ArrowLeft, FlaskConical, Save, Upload, X, Loader2,
  ExternalLink, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronDown, Youtube, BookOpen, GraduationCap, Star,
  Shield, Sparkles,
} from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { uploadFile, toolAssetPath } from '@/firebase/storage/upload';
import { vetTool, findLogo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ToolLogo } from '@/components/tool-logo';
import { Header } from '@/components/header';
import { useToast } from '@/hooks/use-toast';
import type { AiTool, ToolCategory, SubjectArea, TargetAudience } from '@/lib/types';
import { costModels, ageRestrictions, toolStatuses } from '@/lib/constants';

// ─── AI research field status ───────────────────────────────────────────────

type FieldStatus = 'idle' | 'running' | 'success' | 'empty' | 'error';

const AI_FIELDS = [
  'description', 'costModel', 'ageRestriction', 'unsafeDataPractices',
  'documentationUrl', 'trainingUrl', 'vettingNotes',
  'keyFeatures', 'gdprCompliant', 'coppaCompliant', 'ferpaCompliant',
  'dataHostingLocation', 'st4sVerified',
] as const;
type AiField = typeof AI_FIELDS[number];

const AI_FIELD_LABELS: Record<AiField, string> = {
  description: 'Description',
  costModel: 'Cost Model',
  ageRestriction: 'Age Restriction',
  unsafeDataPractices: 'Data Safety',
  documentationUrl: 'Documentation URL',
  trainingUrl: 'Training URL',
  vettingNotes: 'Vetting Notes',
  keyFeatures: 'Key Features',
  gdprCompliant: 'GDPR',
  coppaCompliant: 'COPPA',
  ferpaCompliant: 'FERPA',
  dataHostingLocation: 'Data Hosting',
  st4sVerified: 'ST4S Verified',
};

function AiDot({ status, label }: { status: FieldStatus; label?: string }) {
  const base = 'w-2.5 h-2.5 rounded-full shrink-0 inline-block';
  const map: Record<FieldStatus, string> = {
    idle:    cn(base, 'bg-base-300'),
    running: cn(base, 'bg-info animate-pulse'),
    success: cn(base, 'bg-success'),
    empty:   cn(base, 'bg-warning'),
    error:   cn(base, 'bg-error'),
  };
  const titles: Record<FieldStatus, string> = {
    idle:    'Not yet researched',
    running: 'Researching…',
    success: 'Found and applied',
    empty:   'Researched — no data found',
    error:   'Research failed',
  };
  return <span className={map[status]} title={label ? `${label}: ${titles[status]}` : titles[status]} />;
}

// ─── Field wrapper (defined OUTSIDE component to prevent remount on re-render) ─

function Field({ label, children, required, aiField, aiStatus }: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  aiField?: AiField;
  aiStatus?: Record<AiField, FieldStatus>;
}) {
  return (
    <div className="form-control w-full">
      <label className="label pb-1">
        <span className="label-text font-medium flex items-center gap-2">
          {label}
          {required && <span className="text-error text-xs">*</span>}
          {aiField && aiStatus && <AiDot status={aiStatus[aiField]} label={label} />}
        </span>
      </label>
      {children}
    </div>
  );
}

// ─── Select-all checkbox with proper indeterminate support ───────────────────

function SelectAllCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-base-200 text-sm border-b border-base-200 font-semibold text-primary">
      <input
        ref={ref}
        type="checkbox"
        className="checkbox checkbox-xs checkbox-primary"
        checked={checked}
        onChange={onChange}
      />
      <span>Select All</span>
    </label>
  );
}

// ─── Multi-checkbox dropdown ─────────────────────────────────────────────────

function MultiCheckbox({
  label, options, selected, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-outline btn-sm w-full justify-between font-normal"
        onClick={() => setOpen(o => !o)}
      >
        <span className="truncate">
          {selected.length === 0 ? `Select ${label}…` : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-base-100 border border-base-300 rounded-box shadow-lg max-h-52 overflow-y-auto">
          {/* Select All / Deselect All */}
          <SelectAllCheckbox
            checked={selected.length === options.length && options.length > 0}
            indeterminate={selected.length > 0 && selected.length < options.length}
            onChange={() => onChange(selected.length === options.length ? [] : options.map(o => o.value))}
          />
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-base-200 text-sm"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screenshot slot ─────────────────────────────────────────────────────────

function ScreenshotSlot({
  url, index, uploading, onUpload, onDelete,
}: {
  url?: string;
  index: number;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (url) {
    return (
      <div className="relative group aspect-video rounded-xl overflow-hidden border border-base-300 bg-base-200">
        <img src={url} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            type="button"
            className="btn btn-error btn-sm btn-circle"
            onClick={onDelete}
            title="Remove screenshot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute top-2 left-2 badge badge-neutral badge-sm">#{index + 1}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'aspect-video rounded-xl border-2 border-dashed border-base-300 flex flex-col items-center justify-center gap-2 cursor-pointer',
        'hover:border-primary hover:bg-primary/5 transition-colors',
        uploading && 'pointer-events-none opacity-70',
      )}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <span className="text-xs text-base-content/50">Uploading…</span>
        </>
      ) : (
        <>
          <Upload className="h-6 w-6 text-base-content/30" />
          <span className="text-xs text-base-content/40">Click to upload</span>
        </>
      )}
    </div>
  );
}

// ─── Key feature tag input ────────────────────────────────────────────────────

function KeyFeatureInput({
  features, onChange, suggestions,
}: {
  features: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = input.trim().length > 0
    ? suggestions.filter(s =>
        s.toLowerCase().includes(input.toLowerCase()) && !features.includes(s),
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || features.includes(trimmed)) return;
    onChange([...features, trimmed]);
    setInput('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (feature: string) => onChange(features.filter(f => f !== feature));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && features.length > 0) {
      onChange(features.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="min-h-10 flex flex-wrap gap-1.5 p-2 border border-base-300 rounded-lg bg-base-100 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {features.map(f => (
          <span key={f} className="badge badge-neutral gap-1 pl-2 pr-1">
            {f}
            <button
              type="button"
              className="hover:text-error transition-colors ml-0.5"
              onClick={e => { e.stopPropagation(); remove(f); }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="grow min-w-32 bg-transparent outline-none text-sm"
          placeholder={features.length === 0 ? 'Type a feature, press Enter to add…' : ''}
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-base-100 border border-base-300 rounded-box shadow-lg">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 transition-colors"
              onMouseDown={e => { e.preventDefault(); add(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-base-content/40 mt-1">Press Enter or comma to add. Backspace removes last.</p>
    </div>
  );
}

// ─── Compliance select ────────────────────────────────────────────────────────

type ComplianceValue = 'Yes' | 'No' | 'Unknown';
function ComplianceSelect({ value, onChange }: { value: ComplianceValue; onChange: (v: ComplianceValue) => void }) {
  return (
    <select
      className="select select-bordered select-sm w-full"
      value={value}
      onChange={e => onChange(e.target.value as ComplianceValue)}
    >
      <option value="Unknown">Unknown</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}

// ─── Initial form state ───────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  url: '',
  description: '',
  logoUrl: '',
  costModel: 'Freemium' as AiTool['costModel'],
  ageRestriction: 'All Ages' as NonNullable<AiTool['ageRestriction']>,
  status: 'Pending' as AiTool['status'],
  recommended: false,
  unsafeDataPractices: false,
  createdForTasc: false,
  youtubeVideoUrl: '',
  documentationUrl: '',
  trainingUrl: '',
  toolCategoryIds: [] as string[],
  subjectAreaIds: [] as string[],
  targetAudienceIds: [] as string[],
  screenshotUrls: [] as string[],
  defaultIdea: '',
  vettingNotes: '',
  keyFeatures: [] as string[],
  gdprCompliant: 'Unknown' as ComplianceValue,
  coppaCompliant: 'Unknown' as ComplianceValue,
  ferpaCompliant: 'Unknown' as ComplianceValue,
  dataHostingLocation: '',
  st4sVerified: 'Unknown' as ComplianceValue,
};

type FormState = typeof emptyForm;

// Wraps the shared `safeUrl` helper so URLs sourced from admin form input
// never reach `<a href>` / `<iframe src>` with a `javascript:` or `data:`
// scheme. Returns '' if the URL is empty or unsafe.
import { safeUrl } from '@/lib/url';
const ensureHttps = (url: string) => safeUrl(url);

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminToolEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  // Stable ID: for edits use the existing doc ID; for new tools generate once via useRef
  const generatedId = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
  const uploadId: string = (!isNew && id) ? id : generatedId.current;

  const [categories, setCategories]           = useState<ToolCategory[]>([]);
  const [subjects, setSubjects]               = useState<SubjectArea[]>([]);
  const [audiences, setAudiences]             = useState<TargetAudience[]>([]);
  const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);

  // Load the existing tool doc (edit mode)
  const toolDocRef = useMemo(
    () => (!isNew && firestore && id) ? doc(firestore, 'ai_tools', id) : null,
    [firestore, isNew, id],
  );
  const { data: existingTool, isLoading: loadingTool } = useDoc<AiTool>(toolDocRef);

  // ── Form state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── AI research state ────────────────────────────────────────────────────
  const [isResearching, setIsResearching] = useState(false);
  const [aiStatus, setAiStatus] = useState<Record<AiField, FieldStatus>>(
    () => Object.fromEntries(AI_FIELDS.map(f => [f, 'idle'])) as Record<AiField, FieldStatus>,
  );
  const [researchError, setResearchError] = useState<string | null>(null);

  // ── Logo state ───────────────────────────────────────────────────────────
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isFetchingLogo, setIsFetchingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Screenshot state ─────────────────────────────────────────────────────
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  // ── Load taxonomy + feature suggestion pool from Firestore ───────────────
  useEffect(() => {
    if (!firestore) return;
    Promise.all([
      getDocs(collection(firestore, 'tool_categories')),
      getDocs(collection(firestore, 'subject_areas')),
      getDocs(collection(firestore, 'target_audiences')),
      getDocs(collection(firestore, 'ai_tools')),
    ]).then(([catSnap, subSnap, audSnap, toolsSnap]) => {
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as ToolCategory)));
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectArea)));
      setAudiences(audSnap.docs.map(d => ({ id: d.id, ...d.data() } as TargetAudience)));
      // Build deduplicated pool of all existing key features for autocomplete
      const all = new Set<string>();
      toolsSnap.docs.forEach(d => {
        const features = (d.data() as AiTool).keyFeatures ?? [];
        features.forEach(f => all.add(f));
      });
      setFeatureSuggestions([...all].sort());
    }).catch(console.error);
  }, [firestore]);

  // Populate form only ONCE when the existing tool first loads.
  // We deliberately ignore subsequent real-time updates to avoid overwriting
  // in-progress edits when the admin's own save triggers a Firestore snapshot.
  const hasPopulated = useRef(false);
  useEffect(() => {
    if (!isNew && existingTool && !hasPopulated.current) {
      hasPopulated.current = true;
      setForm({
        name:               existingTool.name ?? '',
        url:                existingTool.url ?? '',
        description:        existingTool.description ?? '',
        logoUrl:            existingTool.logoUrl ?? '',
        costModel:          existingTool.costModel ?? 'Freemium',
        ageRestriction:     existingTool.ageRestriction ?? 'All Ages',
        status:             existingTool.status ?? 'Pending',
        recommended:        existingTool.recommended ?? false,
        unsafeDataPractices: existingTool.unsafeDataPractices ?? false,
        createdForTasc:     existingTool.createdForTasc ?? false,
        youtubeVideoUrl:    existingTool.youtubeVideoUrl ?? '',
        documentationUrl:   existingTool.documentationUrl ?? '',
        trainingUrl:        existingTool.trainingUrl ?? '',
        toolCategoryIds:    existingTool.toolCategoryIds ?? [],
        subjectAreaIds:     existingTool.subjectAreaIds ?? [],
        targetAudienceIds:  existingTool.targetAudienceIds ?? [],
        screenshotUrls:     existingTool.screenshotUrls ?? [],
        defaultIdea:        existingTool.defaultIdea ?? '',
        vettingNotes:       existingTool.vettingNotes ?? '',
        keyFeatures:        existingTool.keyFeatures ?? [],
        gdprCompliant:      (existingTool.gdprCompliant ?? 'Unknown') as ComplianceValue,
        coppaCompliant:     (existingTool.coppaCompliant ?? 'Unknown') as ComplianceValue,
        ferpaCompliant:     (existingTool.ferpaCompliant ?? 'Unknown') as ComplianceValue,
        dataHostingLocation: existingTool.dataHostingLocation ?? '',
        st4sVerified:       (existingTool.st4sVerified ?? 'Unknown') as ComplianceValue,
      });
      // Don't mark dirty — this is initial load, not a user edit
      setIsDirty(false);
    }
  }, [existingTool, isNew]);

  // ── Field helpers ─────────────────────────────────────────────────────────
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
    // Clear validation error for this field as soon as user edits it
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Tool name is required';
    if (!form.url.trim()) e.url = 'Website URL is required';
    if (form.toolCategoryIds.length === 0) e.toolCategoryIds = 'Select at least one category';
    if (form.subjectAreaIds.length === 0) e.subjectAreaIds = 'Select at least one subject area';
    if (form.targetAudienceIds.length === 0) e.targetAudienceIds = 'Select at least one audience';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!firestore || !validate()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const raw = {
        ...form,
        url:              ensureHttps(form.url),
        documentationUrl: ensureHttps(form.documentationUrl),
        trainingUrl:      ensureHttps(form.trainingUrl),
        youtubeVideoUrl:  form.youtubeVideoUrl.trim(),
        screenshotUrls:   form.screenshotUrls.filter(Boolean),
      };

      // Strip undefined values (Firestore rejects them).
      // Also strip empty strings for optional URL/freetext fields — but NOT for
      // fields like description, vettingNotes, keyFeatures which must be written
      // even when empty so that clearing them in the editor actually clears Firestore.
      const omitWhenEmpty = new Set([
        'logoUrl', 'documentationUrl', 'trainingUrl', 'youtubeVideoUrl',
        'defaultIdea', 'dataHostingLocation',
      ]);
      const data = Object.fromEntries(
        Object.entries(raw).filter(([k, v]) => {
          if (v === undefined) return false;
          if (omitWhenEmpty.has(k) && v === '') return false;
          return true;
        })
      );

      if (isNew) {
        await setDoc(doc(firestore, 'ai_tools', uploadId), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(firestore, 'ai_tools', uploadId), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      }
      setIsDirty(false);
      navigate('/admin');
    } catch (e: any) {
      console.error('Save failed:', e);
      setSaveError(e.message ?? 'An unknown error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── AI Research ───────────────────────────────────────────────────────────
  const handleResearch = async () => {
    const toolUrl = ensureHttps(form.url);
    if (!form.name.trim() || !toolUrl) {
      setResearchError('Enter a tool name and URL before running research.');
      return;
    }
    setResearchError(null);
    setIsResearching(true);
    setAiStatus(Object.fromEntries(AI_FIELDS.map(f => [f, 'running'])) as Record<AiField, FieldStatus>);

    try {
      const result = await vetTool({ toolName: form.name, toolUrl });

      // Start from a fresh 'running' object — don't use stale closure state
      const next: Record<AiField, FieldStatus> = Object.fromEntries(
        AI_FIELDS.map(f => [f, 'running'])
      ) as Record<AiField, FieldStatus>;

      // description — always returned
      if (result.description) {
        set('description', result.description);
        next.description = 'success';
      } else {
        next.description = 'empty';
      }

      // costModel — optional
      if (result.costModel) {
        set('costModel', result.costModel);
        next.costModel = 'success';
      } else {
        next.costModel = 'empty';
      }

      // ageRestriction — always returned
      if (result.ageRestriction) {
        set('ageRestriction', result.ageRestriction);
        next.ageRestriction = 'success';
      } else {
        next.ageRestriction = 'empty';
      }

      // unsafeDataPractices — always returned (boolean)
      set('unsafeDataPractices', result.unsafeDataPractices ?? true);
      next.unsafeDataPractices = 'success';

      // documentationUrl — optional
      if (result.documentationUrl) {
        set('documentationUrl', result.documentationUrl);
        next.documentationUrl = 'success';
      } else {
        next.documentationUrl = 'empty';
      }

      // trainingUrl — optional
      if (result.trainingUrl) {
        set('trainingUrl', result.trainingUrl);
        next.trainingUrl = 'success';
      } else {
        next.trainingUrl = 'empty';
      }

      // vettingNotes — always returned
      if (result.vettingNotes) {
        set('vettingNotes', result.vettingNotes);
        next.vettingNotes = 'success';
      } else {
        next.vettingNotes = 'empty';
      }

      // keyFeatures — optional array
      if (result.keyFeatures?.length) {
        setForm(f => ({ ...f, keyFeatures: result.keyFeatures! }));
        // Merge into suggestions pool
        setFeatureSuggestions(prev => {
          const merged = new Set([...prev, ...result.keyFeatures!]);
          return [...merged].sort();
        });
        next.keyFeatures = 'success';
      } else {
        next.keyFeatures = 'empty';
      }

      // compliance fields
      const applyCompliance = (
        key: 'gdprCompliant' | 'coppaCompliant' | 'ferpaCompliant' | 'st4sVerified',
        value: string | undefined,
      ) => {
        if (value === 'Yes' || value === 'No' || value === 'Unknown') {
          set(key, value as ComplianceValue);
          next[key] = 'success';
        } else {
          next[key] = 'empty';
        }
      };
      applyCompliance('gdprCompliant', result.gdprCompliant);
      applyCompliance('coppaCompliant', result.coppaCompliant);
      applyCompliance('ferpaCompliant', result.ferpaCompliant);
      applyCompliance('st4sVerified', result.st4sVerified);

      if (result.dataHostingLocation) {
        set('dataHostingLocation', result.dataHostingLocation);
        next.dataHostingLocation = 'success';
      } else {
        next.dataHostingLocation = 'empty';
      }

      setAiStatus(next);
    } catch (e: any) {
      console.error('AI research failed:', e);
      setResearchError(e.message ?? 'Research failed. Try again.');
      setAiStatus(Object.fromEntries(AI_FIELDS.map(f => [f, 'error'])) as Record<AiField, FieldStatus>);
    } finally {
      setIsResearching(false);
    }
  };

  // ── Logo handlers ─────────────────────────────────────────────────────────
  const handleLogoUpload = async (file: File) => {
    if (!storage) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadFile(storage, toolAssetPath(uploadId, 'logo', file), file);
      set('logoUrl', url);
    } catch (e: any) {
      console.error('Logo upload failed:', e);
      toast({ variant: 'destructive', title: 'Logo upload failed', description: e.message });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleFetchLogo = async () => {
    const toolUrl = ensureHttps(form.url);
    if (!toolUrl) return;
    setIsFetchingLogo(true);
    try {
      const url = await findLogo(toolUrl);
      if (url) {
        set('logoUrl', url);
      } else {
        toast({ title: 'No logo found', description: 'Could not auto-detect a logo for this URL.' });
      }
    } catch (e: any) {
      console.error('Logo fetch failed:', e);
      toast({ variant: 'destructive', title: 'Logo fetch failed', description: e.message });
    } finally {
      setIsFetchingLogo(false);
    }
  };

  // ── Screenshot handlers ───────────────────────────────────────────────────
  const handleScreenshotUpload = async (file: File, index: number) => {
    if (!storage) return;
    setUploadingSlot(index);
    try {
      const url = await uploadFile(storage, toolAssetPath(uploadId, 'screenshot', file), file);
      const next = [...form.screenshotUrls];
      next[index] = url;
      set('screenshotUrls', next);
    } catch (e: any) {
      console.error('Screenshot upload failed:', e);
      toast({ variant: 'destructive', title: 'Screenshot upload failed', description: e.message });
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDeleteScreenshot = (index: number) => {
    const next = [...form.screenshotUrls];
    next.splice(index, 1);
    set('screenshotUrls', next);
  };

  // ── Unsaved changes warning ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/admin');
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!isNew && loadingTool) {
    return (
      <div className="flex flex-col min-h-screen bg-base-200">
        <Header onLoginClick={() => {}} />
        <div className="flex flex-1 items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const subjectOptions  = subjects.map(s => ({ value: s.id, label: s.name }));
  const audienceOptions = audiences.map(a => ({ value: a.id, label: a.name }));

  const researchRan = AI_FIELDS.some(f => aiStatus[f] !== 'idle');

  // Build 4 screenshot slots (existing + empty up to 4)
  const screenshotSlots = Array.from({ length: 4 }, (_, i) => form.screenshotUrls[i] ?? '');

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Header onLoginClick={() => {}} />

      {/* ── Sticky action bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-base-100 border-b border-base-300 shadow-sm">
        {saveError && (
          <div className="bg-error/10 border-b border-error/20 px-4 py-2 flex items-center gap-2 text-sm text-error">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="btn btn-ghost btn-xs"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="container h-16 flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Tools</span>
          </button>

          <div className="divider divider-horizontal mx-0 h-6" />

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base-content truncate">
              {isNew ? 'Add New Tool' : (form.name || 'Edit Tool')}
            </h1>
            {!isNew && (
              <p className="text-xs text-base-content/40 hidden sm:block">
                Editing existing tool record
              </p>
            )}
          </div>

          {/* Status badge */}
          <div className="hidden sm:flex items-center gap-2">
            <select
              className="select select-sm select-bordered"
              value={form.status}
              onChange={e => set('status', e.target.value as AiTool['status'])}
            >
              {toolStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* ── Page body ────────────────────────────────────────────────────── */}
      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN (2/3 width) ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Info */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Basic Info</h2>

                <Field label="Tool Name" required>
                  <input
                    type="text"
                    className={cn('input input-bordered w-full', errors.name && 'input-error')}
                    placeholder="e.g. MagicSchool AI"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                  />
                  {errors.name && <p className="label-text-alt text-error mt-1">{errors.name}</p>}
                </Field>

                <Field label="Website URL" required>
                  <input
                    type="url"
                    className={cn('input input-bordered w-full', errors.url && 'input-error')}
                    placeholder="https://example.com"
                    value={form.url}
                    onChange={e => set('url', e.target.value)}
                  />
                  {errors.url && <p className="label-text-alt text-error mt-1">{errors.url}</p>}
                </Field>

                <Field label="Description" aiField="description" aiStatus={aiStatus}>
                  <textarea
                    className="textarea textarea-bordered w-full h-28 resize-none"
                    placeholder="A short description of what this tool does in an educational setting."
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Key Features */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="card-title text-base">Key Features</h2>
                  <AiDot status={aiStatus.keyFeatures} label="Key Features" />
                </div>
                <p className="text-xs text-base-content/50 -mt-2">
                  Short feature tags shown to users on the tool page. Use predictive text from existing features.
                </p>
                <KeyFeatureInput
                  features={form.keyFeatures}
                  onChange={v => set('keyFeatures', v)}
                  suggestions={featureSuggestions}
                />
              </div>
            </div>

            {/* Logo */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Logo</h2>
                <div className="flex items-center gap-5">
                  {/* Preview */}
                  <div className="w-20 h-20 rounded-2xl border border-base-300 bg-base-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <ToolLogo toolUrl={form.url} toolName={form.name || 'Tool'} size={48} />
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm gap-2"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Upload className="h-4 w-4" />}
                      Upload Logo
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm gap-2"
                      onClick={handleFetchLogo}
                      disabled={isFetchingLogo || !form.url}
                    >
                      {isFetchingLogo
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                      Auto-fetch from URL
                    </button>
                    {form.logoUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error gap-2"
                        onClick={() => set('logoUrl', '')}
                      >
                        <X className="h-4 w-4" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Screenshots */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <div>
                  <h2 className="card-title text-base">Screenshots</h2>
                  <p className="text-xs text-base-content/50 mt-0.5">Up to 4 screenshots. Click an empty slot to upload.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {screenshotSlots.map((url, i) => (
                    <ScreenshotSlot
                      key={i}
                      url={url || undefined}
                      index={i}
                      uploading={uploadingSlot === i}
                      onUpload={file => handleScreenshotUpload(file, i)}
                      onDelete={() => handleDeleteScreenshot(i)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Resources */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Resources</h2>

                <Field label="YouTube Video URL">
                  <label className="input input-bordered flex items-center gap-2 w-full">
                    <Youtube className="h-4 w-4 text-base-content/40 shrink-0" />
                    <input
                      type="url"
                      className="grow"
                      placeholder="https://youtube.com/watch?v=..."
                      value={form.youtubeVideoUrl}
                      onChange={e => set('youtubeVideoUrl', e.target.value)}
                    />
                  </label>
                </Field>

                <Field label="Documentation URL" aiField="documentationUrl" aiStatus={aiStatus}>
                  <label className="input input-bordered flex items-center gap-2 w-full">
                    <BookOpen className="h-4 w-4 text-base-content/40 shrink-0" />
                    <input
                      type="url"
                      className="grow"
                      placeholder="https://example.com/docs"
                      value={form.documentationUrl}
                      onChange={e => set('documentationUrl', e.target.value)}
                    />
                    {form.documentationUrl && (
                      <a href={ensureHttps(form.documentationUrl)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-4 w-4 text-base-content/40 hover:text-primary" />
                      </a>
                    )}
                  </label>
                </Field>

                <Field label="Training / Certification URL" aiField="trainingUrl" aiStatus={aiStatus}>
                  <label className="input input-bordered flex items-center gap-2 w-full">
                    <GraduationCap className="h-4 w-4 text-base-content/40 shrink-0" />
                    <input
                      type="url"
                      className="grow"
                      placeholder="https://example.com/academy"
                      value={form.trainingUrl}
                      onChange={e => set('trainingUrl', e.target.value)}
                    />
                    {form.trainingUrl && (
                      <a href={ensureHttps(form.trainingUrl)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-4 w-4 text-base-content/40 hover:text-primary" />
                      </a>
                    )}
                  </label>
                </Field>
              </div>
            </div>

            {/* Classroom Use */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Classroom Use</h2>
                <Field label="Default Classroom Idea">
                  <textarea
                    className="textarea textarea-bordered w-full h-28 resize-none"
                    placeholder="A scenario or idea for how teachers can use this tool in class..."
                    value={form.defaultIdea}
                    onChange={e => set('defaultIdea', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Safety & Compliance */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="card-title text-base">Safety & Compliance</h2>
                  <span className="badge badge-ghost badge-sm">Self-declared by company</span>
                </div>
                <p className="text-xs text-base-content/50 -mt-2">
                  AI research will attempt to detect these from the privacy policy and website.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="form-control">
                    <label className="label py-0.5">
                      <span className="label-text text-sm flex items-center gap-2">
                        GDPR Compliant <AiDot status={aiStatus.gdprCompliant} />
                      </span>
                    </label>
                    <ComplianceSelect value={form.gdprCompliant} onChange={v => set('gdprCompliant', v)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5">
                      <span className="label-text text-sm flex items-center gap-2">
                        COPPA Compliant <AiDot status={aiStatus.coppaCompliant} />
                      </span>
                    </label>
                    <ComplianceSelect value={form.coppaCompliant} onChange={v => set('coppaCompliant', v)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5">
                      <span className="label-text text-sm flex items-center gap-2">
                        FERPA Compliant <AiDot status={aiStatus.ferpaCompliant} />
                      </span>
                    </label>
                    <ComplianceSelect value={form.ferpaCompliant} onChange={v => set('ferpaCompliant', v)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5">
                      <span className="label-text text-sm flex items-center gap-2">
                        ST4S Verified <AiDot status={aiStatus.st4sVerified} />
                      </span>
                    </label>
                    <ComplianceSelect value={form.st4sVerified} onChange={v => set('st4sVerified', v)} />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-sm flex items-center gap-2">
                      Data Hosting Location <AiDot status={aiStatus.dataHostingLocation} />
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    placeholder="e.g. United States, European Union"
                    value={form.dataHostingLocation}
                    onChange={e => set('dataHostingLocation', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Vetting Notes */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="card-title text-base">Vetting Notes</h2>
                  <AiDot status={aiStatus.vettingNotes} label="Vetting Notes" />
                </div>
                {/* The AI vetting flow can be steered by content on the
                    tool's own website (indirect prompt injection). Treat
                    every AI-populated compliance and notes field as a
                    SUGGESTION ONLY — manually confirm each item against
                    the source documents before approving the tool. */}
                <div className="alert alert-warning text-sm">
                  <span>
                    <strong>AI-generated — requires admin confirmation.</strong>{' '}
                    These notes and the compliance/safety fields below are produced by an AI
                    research step that can be influenced by content on the tool's own website.
                    Verify every claim against the source documents before approving this tool.
                  </span>
                </div>
                <p className="text-xs text-base-content/50 -mt-2">
                  Markdown supported. Covers data safety, compliance, age limits, and pricing details.
                </p>
                <textarea
                  className="textarea textarea-bordered w-full font-mono text-sm resize-y"
                  rows={12}
                  placeholder="* **Data for Training:** &#10;* **Data Retention:** &#10;* **Compliance:** "
                  value={form.vettingNotes}
                  onChange={e => set('vettingNotes', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (1/3 width) ─────────────────────────────────── */}
          <div className="space-y-6">

            {/* AI Research */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <div>
                  <h2 className="card-title text-base gap-2">
                    <FlaskConical className="h-5 w-5 text-secondary" />
                    AI Research
                  </h2>
                  <p className="text-xs text-base-content/50 mt-1 leading-relaxed">
                    Reads the tool's website, Terms of Service, and Privacy Policy to auto-fill fields. Requires a tool name and URL.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary gap-2 w-full"
                  onClick={handleResearch}
                  disabled={isResearching || !form.name || !form.url}
                >
                  {isResearching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Researching…</>
                    : <><Sparkles className="h-4 w-4" /> Run AI Research</>}
                </button>

                {researchError && (
                  <div className="alert alert-error alert-sm py-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {researchError}
                  </div>
                )}

                {/* Field status grid */}
                {researchRan && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Field Results</p>
                    {AI_FIELDS.map(field => (
                      <div key={field} className="flex items-center gap-2.5 text-xs">
                        <AiDot status={aiStatus[field]} />
                        <span className={cn(
                          'flex-1',
                          aiStatus[field] === 'success' ? 'text-base-content' : 'text-base-content/50',
                        )}>
                          {AI_FIELD_LABELS[field]}
                        </span>
                        {aiStatus[field] === 'success' && <CheckCircle2 className="h-3 w-3 text-success shrink-0" />}
                        {aiStatus[field] === 'empty'   && <span className="text-warning text-[10px]">None found</span>}
                        {aiStatus[field] === 'error'   && <span className="text-error text-[10px]">Failed</span>}
                      </div>
                    ))}
                    <div className="flex gap-3 pt-2 text-[10px] text-base-content/40">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Applied</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> Not found</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error inline-block" /> Error</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status & Flags */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Status & Flags</h2>

                {/* Status (also in header bar, shown here for mobile) */}
                <Field label="Approval Status">
                  <div className="flex gap-2 flex-wrap">
                    {toolStatuses.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('status', s)}
                        className={cn(
                          'btn btn-sm',
                          form.status === s
                            ? s === 'Approved' ? 'btn-success' : s === 'Rejected' ? 'btn-error' : 'btn-warning'
                            : 'btn-ghost',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="divider my-0" />

                {/* Toggles */}
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-error" />
                      Unsafe Data Practices
                      <AiDot status={aiStatus.unsafeDataPractices} label="Data Safety" />
                    </p>
                    <p className="text-xs text-base-content/50">Tool may use or share student data for training</p>
                  </div>
                  <input
                    type="checkbox"
                    className={cn('toggle toggle-sm', form.unsafeDataPractices ? 'toggle-error' : '')}
                    checked={form.unsafeDataPractices}
                    onChange={e => set('unsafeDataPractices', e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-warning" />
                      Recommended
                    </p>
                    <p className="text-xs text-base-content/50">Featured as a recommended tool</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm toggle-warning"
                    checked={form.recommended}
                    onChange={e => set('recommended', e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-primary" />
                      TASC Exclusive
                    </p>
                    <p className="text-xs text-base-content/50">Built specifically for TASC schools</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm toggle-primary"
                    checked={form.createdForTasc}
                    onChange={e => set('createdForTasc', e.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* Pricing & Restrictions */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Pricing & Access</h2>

                <Field label="Cost Model" aiField="costModel" aiStatus={aiStatus}>
                  <div className="flex gap-2 flex-wrap">
                    {costModels.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('costModel', m)}
                        className={cn(
                          'btn btn-sm',
                          form.costModel === m
                            ? m === 'Free' ? 'btn-success' : m === 'Freemium' ? 'btn-warning' : 'btn-error'
                            : 'btn-ghost',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Age Restriction" aiField="ageRestriction" aiStatus={aiStatus}>
                  <div className="flex gap-2 flex-wrap">
                    {ageRestrictions.map(a => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => set('ageRestriction', a)}
                        className={cn(
                          'btn btn-sm',
                          form.ageRestriction === a ? 'btn-neutral' : 'btn-ghost',
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>

            {/* Classification */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base">Classification</h2>

                <Field label="Tool Categories" required>
                  <MultiCheckbox
                    label="categories"
                    options={categoryOptions}
                    selected={form.toolCategoryIds}
                    onChange={v => set('toolCategoryIds', v)}
                  />
                  {errors.toolCategoryIds && (
                    <p className="text-error text-xs mt-1">{errors.toolCategoryIds}</p>
                  )}
                </Field>

                <Field label="Subject Areas" required>
                  <MultiCheckbox
                    label="subjects"
                    options={subjectOptions}
                    selected={form.subjectAreaIds}
                    onChange={v => set('subjectAreaIds', v)}
                  />
                  {errors.subjectAreaIds && (
                    <p className="text-error text-xs mt-1">{errors.subjectAreaIds}</p>
                  )}
                </Field>

                <Field label="Target Audiences" required>
                  <MultiCheckbox
                    label="audiences"
                    options={audienceOptions}
                    selected={form.targetAudienceIds}
                    onChange={v => set('targetAudienceIds', v)}
                  />
                  {errors.targetAudienceIds && (
                    <p className="text-error text-xs mt-1">{errors.targetAudienceIds}</p>
                  )}
                </Field>
              </div>
            </div>

            {/* Save (bottom of sidebar for convenience) */}
            <button
              type="button"
              className="btn btn-primary w-full gap-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                : <><Save className="h-4 w-4" /> Save Tool</>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
