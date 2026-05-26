
"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";
import type { AiTool, ToolCategory, SubjectArea, TargetAudience } from "@/lib/types";
import { generateToolGuide, findLogo } from "@/lib/api";
import { costModels, ageRestrictions, toolStatuses, learningAreas } from "@/lib/constants";
import { useFirebase } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { X, Trash2, Sparkles, Loader2, RefreshCw, Star, Bot, Upload } from "lucide-react";
import { ToolLogo } from "./tool-logo";
import { cn } from "@/lib/utils";
import { uploadFile, toolAssetPath } from "@/firebase/storage/upload";


interface EditToolModalProps {
    isOpen: boolean;
    onClose: () => void;
    tool: AiTool | null; // Null when adding a new tool
    allCategories: ToolCategory[];
    allSubjects: SubjectArea[];
    allAudiences: TargetAudience[];
}

const urlSchema = z.string().refine((val) => {
    if (val === "" || val === undefined || val === null) return true; // Optional
    try {
        const fullUrl = /^(https?:\/\/)/.test(val) ? val : `https://${val}`;
        new URL(fullUrl);
        return true;
    } catch {
        return false;
    }
}, { message: "Please enter a valid URL." });

const formSchema = z.object({
    name: z.string().min(1, "Tool name is required."),
    description: z.string().optional(),
    url: urlSchema.refine(val => val && val.length > 0, { message: "Website URL is required." }),
    logoUrl: urlSchema.optional(),
    costModel: z.enum(["Free", "Freemium", "Subscription"]),
    ageRestriction: z.enum(["All Ages", "13+", "16+", "18+"]),
    status: z.enum(["Pending", "Approved", "Rejected"]),
    recommended: z.boolean(),
    unsafeDataPractices: z.boolean(),
    createdForTasc: z.boolean(),
    youtubeVideoUrl: urlSchema.optional().or(z.literal('')),
    documentationUrl: urlSchema.optional().or(z.literal('')),
    trainingUrl: urlSchema.optional().or(z.literal('')),
    toolCategoryIds: z.array(z.string()).min(1, "Please select at least one category."),
    subjectAreaIds: z.array(z.string()).min(1, "Please select at least one subject area."),
    targetAudienceIds: z.array(z.string()).min(1, "Please select at least one target audience."),
    screenshotUrls: z.array(z.string().url("Please enter a valid URL.")).max(4).default([]),
    defaultIdea: z.string().optional(),
    vettingNotes: z.string().optional(),
});

type ToolFormValues = z.infer<typeof formSchema>;

const defaultFormValues: ToolFormValues = {
    name: "",
    description: "",
    url: "",
    logoUrl: "",
    costModel: "Freemium",
    ageRestriction: "All Ages",
    status: 'Pending',
    recommended: false,
    unsafeDataPractices: false,
    createdForTasc: false,
    youtubeVideoUrl: "",
    documentationUrl: "",
    trainingUrl: "",
    toolCategoryIds: [],
    subjectAreaIds: [],
    targetAudienceIds: [],
    screenshotUrls: [],
    defaultIdea: "",
    vettingNotes: "",
};

const ensureProtocol = (url: string | undefined | null): string => {
    if (!url) return '';
    if (url.trim() === '') return '';
    if (/^(https?:\/\/)/.test(url)) {
        return url;
    }
    return `https://${url}`;
};

export function EditToolModal({
    isOpen,
    onClose,
    tool,
    allCategories,
    allSubjects,
    allAudiences,
}: EditToolModalProps) {
    const { toast } = useToast();
    const { firestore, storage } = useFirebase();
    const isEditMode = !!tool;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [uploadingScreenshot, setUploadingScreenshot] = useState<number | null>(null);

    // Stable tool ID: use existing tool.id for edits, or generate one upfront for new tools
    const [toolUploadId] = useState(() => tool?.id ?? crypto.randomUUID());

    // State for AI idea generation
    const [isGeneratingIdeas, startIdeaGeneration] = useTransition();
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
    const [selectedLearningArea, setSelectedLearningArea] = useState<string>(learningAreas[0]);

    // State for AI Vetting
    const [isVetting, startVetting] = useTransition();
    const [aiVettedFields, setAiVettedFields] = useState<Set<keyof ToolFormValues>>(new Set());

    // State for Logo Fetching
    const [isFetchingLogo, startFetchingLogo] = useTransition();


    const form = useForm<ToolFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: isEditMode && tool ? {
            ...tool,
            logoUrl: tool.logoUrl || "",
            description: tool.description || "",
            ageRestriction: tool.ageRestriction || "All Ages",
            status: tool.status || 'Pending',
            recommended: tool.recommended || false,
            unsafeDataPractices: tool.unsafeDataPractices || false,
            createdForTasc: tool.createdForTasc || false,
            youtubeVideoUrl: tool.youtubeVideoUrl || "",
            documentationUrl: tool.documentationUrl || "",
            trainingUrl: tool.trainingUrl || "",
            screenshotUrls: tool.screenshotUrls || [],
            defaultIdea: tool.defaultIdea || "",
            vettingNotes: tool.vettingNotes || "",
        } : defaultFormValues,
    });

    // react-hook-form's `useFieldArray` is typed for arrays of objects;
    // `screenshotUrls` is an array of strings (schema: z.array(z.string().url())).
    // The runtime works fine with primitive arrays — cast the name to satisfy
    // the type without changing schema shape.
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "screenshotUrls" as never,
    });

    const toolName = form.watch("name");
    const toolUrl = form.watch("url");
    const logoUrl = form.watch("logoUrl");

    useEffect(() => {
        if (isOpen) {
            setLoadedImages({});
            setAiVettedFields(new Set()); // Reset highlights
            const initialValues = isEditMode && tool ? {
                ...tool,
                logoUrl: tool.logoUrl || "",
                description: tool.description || "",
                ageRestriction: tool.ageRestriction || "All Ages",
                status: tool.status || 'Pending',
                recommended: tool.recommended || false,
                unsafeDataPractices: tool.unsafeDataPractices || false,
                createdForTasc: tool.createdForTasc || false,
                youtubeVideoUrl: tool.youtubeVideoUrl || "",
                documentationUrl: tool.documentationUrl || "",
                trainingUrl: tool.trainingUrl || "",
                screenshotUrls: tool.screenshotUrls || [],
                defaultIdea: tool.defaultIdea || "",
                vettingNotes: tool.vettingNotes || "",
            } : defaultFormValues;
            form.reset(initialValues);
            setGeneratedIdeas([]);
            // Pre-populate loaded state for existing images
            const preloaded: Record<number, boolean> = {};
            initialValues.screenshotUrls?.forEach((url, index) => {
                if (url) preloaded[index] = true;
            });
            setLoadedImages(preloaded);
        }
    }, [tool, isEditMode, isOpen, form]);

    const categoryOptions = allCategories.map(uc => ({ value: uc.id, label: uc.name }));
    const subjectOptions = allSubjects.map(s => ({ value: s.id, label: s.name }));
    const audienceOptions = allAudiences.map(a => ({ value: a.id, label: a.name }));

    async function onSubmit(data: ToolFormValues) {
        if (!firestore) {
            toast({
                variant: "destructive",
                title: isEditMode ? "Update Failed" : "Add Failed",
                description: "Firestore not available. Please try again later.",
            });
            return;
        }
        setIsSubmitting(true);

        const processedData = {
            ...data,
            url: ensureProtocol(data.url),
            logoUrl: ensureProtocol(data.logoUrl),
            youtubeVideoUrl: ensureProtocol(data.youtubeVideoUrl),
            documentationUrl: ensureProtocol(data.documentationUrl),
            trainingUrl: ensureProtocol(data.trainingUrl),
            screenshotUrls: (data.screenshotUrls || []).filter(url => url && url.trim() !== '').map(url => ensureProtocol(url)),
        };

        try {
            if (isEditMode && tool) {
                const toolRef = doc(firestore, "ai_tools", tool.id);
                await updateDocumentNonBlocking(toolRef, processedData);
                toast({
                    title: "Tool Update Initiated",
                    description: `${tool.name} is being updated in the background.`,
                });
            } else {
                const toolsCollection = collection(firestore, 'ai_tools');
                await addDocumentNonBlocking(toolsCollection, processedData);
                toast({
                    title: "Tool Added",
                    description: `${data.name} is being added in the background.`,
                });
            }
            onClose();
        } catch (error) {
            console.error("Failed to submit tool:", error);
            toast({
                variant: "destructive",
                title: isEditMode ? "Update Failed" : "Add Failed",
                description: "An error occurred while submitting. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleCancel = () => {
        if (form.formState.isDirty) {
            setShowCancelConfirm(true);
        } else {
            onClose();
        }
    };

    const handleGenerateIdeas = () => {
        const currentToolData = form.getValues();
        if (!currentToolData.name || !currentToolData.url) {
            toast({
                variant: "destructive",
                title: "Missing Information",
                description: "Please provide a tool name and URL before generating ideas.",
            });
            return;
        }

        startIdeaGeneration(async () => {
            try {
                const result = await generateToolGuide({
                    toolName: currentToolData.name,
                    toolDescription: currentToolData.description || '',
                    toolUrl: ensureProtocol(currentToolData.url),
                    learningArea: selectedLearningArea,
                    isDataUnsafe: currentToolData.unsafeDataPractices || false,
                });
                setGeneratedIdeas(result.ideas);
            } catch (error) {
                console.error("Failed to generate tool guide:", error);
                toast({
                    variant: "destructive",
                    title: "AI Suggestion Failed",
                    description: "There was an issue generating ideas. Please try again.",
                });
            }
        });
    };

    const handleFetchLogo = () => {
        const url = form.getValues('url');
        if (!url) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please provide a tool URL before fetching a logo.',
            });
            return;
        }

        startFetchingLogo(async () => {
            try {
                const foundLogoUrl = await findLogo(ensureProtocol(url));

                if (foundLogoUrl) {
                    form.setValue('logoUrl', foundLogoUrl, { shouldDirty: true, shouldValidate: true });
                    toast({
                        title: 'Logo Found!',
                        description: 'The logo URL has been updated. Review and save.',
                    });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'No Logo Found',
                        description: 'Could not automatically find a logo. Please add a URL manually.',
                    });
                }
            } catch (error) {
                console.error('Logo Fetch failed:', error);
                toast({
                    variant: 'destructive',
                    title: 'Logo Fetch Failed',
                    description: 'An error occurred while trying to find a logo.',
                });
            }
        });
    };

    const handleSetDefaultIdea = (idea: string) => {
        form.setValue('defaultIdea', idea, { shouldDirty: true });
        toast({
            title: "Default Idea Set",
            description: "The idea has been set as the default. Remember to save your changes.",
        });
    };

    const handleClearDefaultIdea = () => {
        form.setValue('defaultIdea', '', { shouldDirty: true });
        toast({
            title: "Default Idea Cleared",
            description: "The default idea has been cleared. Remember to save your changes.",
        });
    }

    const isFieldVetted = (fieldName: keyof ToolFormValues) => aiVettedFields.has(fieldName);

    const handleLogoUpload = async (file: File) => {
        if (!storage) return;
        setIsUploadingLogo(true);
        try {
            const path = toolAssetPath(toolUploadId, 'logo', file);
            const url = await uploadFile(storage, path, file);
            form.setValue('logoUrl', url, { shouldDirty: true, shouldValidate: true });
            toast({ title: 'Logo uploaded', description: 'Logo has been uploaded and URL set.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleScreenshotUpload = async (file: File, index: number) => {
        if (!storage) return;
        setUploadingScreenshot(index);
        try {
            const path = toolAssetPath(toolUploadId, 'screenshot', file);
            const url = await uploadFile(storage, path, file);
            form.setValue(`screenshotUrls.${index}`, url, { shouldDirty: true, shouldValidate: true });
            setLoadedImages(prev => ({ ...prev, [index]: true }));
            toast({ title: 'Screenshot uploaded' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
        } finally {
            setUploadingScreenshot(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
                <DialogContent
                    className="max-w-4xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle>{isEditMode ? `Edit: ${toolName}` : 'Add a New Tool'}</DialogTitle>
                                <DialogDescription>
                                    {isEditMode ? 'Make changes to the tool details below. Click save when you are done.' : 'Fill in the details for the new tool. All fields are visible to admins.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tool Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. MagicSchool AI" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="url"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Website URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="logoUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tool Logo URL</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <ToolLogo
                                                    toolUrl={toolUrl}
                                                    toolName={toolName || "Tool"}
                                                    logoUrl={field.value}
                                                    size={40}
                                                />
                                                <FormControl>
                                                    <Input placeholder="Paste URL or upload" {...field} />
                                                </FormControl>
                                                <label className="cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        disabled={isUploadingLogo}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleLogoUpload(file);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                    <Button type="button" variant="outline" size="icon" disabled={isUploadingLogo} asChild>
                                                        <span>{isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                                                    </Button>
                                                </label>
                                                <Button type="button" onClick={handleFetchLogo} disabled={isFetchingLogo}>
                                                    {isFetchingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => form.setValue('logoUrl', '')}
                                                    aria-label="Remove logo URL"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="A short description of what the tool does. You can use the AI vet tool to automatically populate this." {...field} className={cn(isFieldVetted("description") && "bg-orange-100 border-orange-300 ring-orange-400")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormItem>
                                <FormLabel>Screenshots</FormLabel>
                                <div className="space-y-2">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex items-center gap-2">
                                            <FormField
                                                control={form.control}
                                                name={`screenshotUrls.${index}`}
                                                render={({ field: urlField }) => (
                                                    <div className="grow flex items-start gap-2">
                                                        {uploadingScreenshot === index ? (
                                                            <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                                                            </div>
                                                        ) : !loadedImages[index] ? (
                                                            <Input {...urlField} placeholder={`Image URL ${index + 1}`} onBlur={(e) => {
                                                                urlField.onBlur();
                                                                if (e.target.value) {
                                                                    const img = new window.Image();
                                                                    img.src = ensureProtocol(e.target.value);
                                                                    img.onload = () => setLoadedImages(prev => ({ ...prev, [index]: true }));
                                                                    img.onerror = () => setLoadedImages(prev => ({ ...prev, [index]: false }));
                                                                }
                                                            }} />
                                                        ) : null}

                                                        {urlField.value && uploadingScreenshot !== index && (
                                                            <div className="relative h-16 w-28 shrink-0">
                                                                <img src={ensureProtocol(urlField.value)} alt={`Preview ${index + 1}`} className="object-cover rounded-md border w-full h-full"
                                                                    onError={() => {
                                                                        setLoadedImages(prev => ({ ...prev, [index]: false }));
                                                                        if (form.getValues(`screenshotUrls.${index}`)) {
                                                                            form.setError(`screenshotUrls.${index}`, { type: 'manual', message: 'URL could not be loaded.' });
                                                                        }
                                                                    }}
                                                                    onLoad={() => {
                                                                        setLoadedImages(prev => ({ ...prev, [index]: true }));
                                                                        form.clearErrors(`screenshotUrls.${index}`);
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            />
                                            <label className="cursor-pointer shrink-0">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    disabled={uploadingScreenshot !== null}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleScreenshotUpload(file, index);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <Button type="button" variant="outline" size="icon" disabled={uploadingScreenshot !== null} asChild>
                                                    <span><Upload className="h-4 w-4" /></span>
                                                </Button>
                                            </label>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => {
                                                    remove(index);
                                                    setLoadedImages(prev => {
                                                        const next = { ...prev };
                                                        delete next[index];
                                                        return next;
                                                    });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {fields.length < 4 && (
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => append("")}
                                            >
                                                Add URL
                                            </Button>
                                            <label className="cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    disabled={uploadingScreenshot !== null}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            append("");
                                                            // Upload to the new last slot
                                                            handleScreenshotUpload(file, fields.length);
                                                        }
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <Button type="button" variant="outline" size="sm" disabled={uploadingScreenshot !== null} asChild>
                                                    <span><Upload className="h-4 w-4 mr-1" />Upload Image</span>
                                                </Button>
                                            </label>
                                        </div>
                                    )}
                                </div>
                                <FormDescription>
                                    Add up to 4 image URLs for the tool screenshots.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="vettingNotes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vetting Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="AI-generated notes about the tool's privacy and security will appear here." {...field} rows={5} className={cn("text-xs", isFieldVetted("vettingNotes") && "bg-orange-100 border-orange-300 ring-orange-400")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="youtubeVideoUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>YouTube Video URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="youtube.com/watch?v=..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="documentationUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Documentation URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="example.com/docs" {...field} className={cn(isFieldVetted("documentationUrl") && "bg-orange-100 border-orange-300 ring-orange-400")} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="trainingUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Training URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="example.com/training" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="costModel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cost Model</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select cost model" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {costModels.map(model => (
                                                        <SelectItem key={model} value={model}>{model}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ageRestriction"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Age Restriction</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={cn(isFieldVetted("ageRestriction") && "bg-orange-100 border-orange-300 ring-orange-400")}><SelectValue placeholder="Select age restriction" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ageRestrictions.map(age => (
                                                        <SelectItem key={age} value={age}>{age}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {toolStatuses.map(status => (
                                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="toolCategoryIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tool Categories</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={categoryOptions}
                                                selected={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select categories..."
                                                showSelectAll={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="subjectAreaIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subject Areas</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={subjectOptions}
                                                selected={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select subjects..."
                                                showSelectAll={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="targetAudienceIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Target Audience</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={audienceOptions}
                                                selected={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select audiences..."
                                                showSelectAll={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-bold text-foreground">Great ways to use this tool</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="defaultIdea"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Default Classroom Idea</FormLabel>
                                                <FormControl>
                                                    <Textarea {...field} placeholder="Type a default idea, or use the generator below." />
                                                </FormControl>
                                                {field.value && (
                                                    <Button type="button" variant="link" size="sm" className="p-0 h-auto text-destructive" onClick={handleClearDefaultIdea}>
                                                        Clear Default Idea
                                                    </Button>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex items-center gap-2">
                                        <Select value={selectedLearningArea} onValueChange={setSelectedLearningArea}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a Learning Area" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {learningAreas.map(area => (
                                                    <SelectItem key={area} value={area}>{area}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" onClick={handleGenerateIdeas} disabled={isGeneratingIdeas}>
                                            {isGeneratingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            <span className="ml-2">Generate</span>
                                        </Button>
                                    </div>

                                    {isGeneratingIdeas && (
                                        <div className="flex items-center justify-center gap-3 p-8 bg-muted rounded-lg">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <p className="text-primary font-medium">Generating ideas for {selectedLearningArea}...</p>
                                        </div>
                                    )}

                                    {generatedIdeas.length > 0 && !isGeneratingIdeas && (
                                        <Card className="bg-accent/50 border-accent animate-in fade-in duration-500">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <Sparkles className="h-5 w-5 text-primary" />
                                                    Ideas for {selectedLearningArea}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="space-y-3">
                                                    {generatedIdeas.map((idea, index) => (
                                                        <li key={index} className="text-sm text-accent-foreground border-b border-accent/50 pb-2 last:border-b-0">
                                                            <p>{idea}</p>
                                                            <Button type="button" size="sm" variant="link" className="p-0 h-auto" onClick={() => handleSetDefaultIdea(idea)}>
                                                                <Star className="mr-2 h-4 w-4" /> Set as Default
                                                            </Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}
                                </CardContent>
                            </Card>


                            <FormField
                                control={form.control}
                                name="recommended"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-xs">
                                        <div className="space-y-0.5">
                                            <FormLabel>Recommended Tool</FormLabel>
                                            <FormDescription>
                                                Highlight this tool as recommended across the site.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="createdForTasc"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-xs">
                                        <div className="space-y-0.5">
                                            <FormLabel>Created for TASC</FormLabel>
                                            <FormDescription>
                                                Tools created specifically for TASC Schools.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="unsafeDataPractices"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-xs">
                                        <div className="space-y-0.5">
                                            <FormLabel>Unsafe Data practices</FormLabel>
                                            <FormDescription>
                                                Toggle this if the tool may train or learn off data uploaded.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={cn(isFieldVetted("unsafeDataPractices") && "data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-orange-200 ring-2 ring-orange-400")}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <DialogFooter className="pt-4 pr-4 sticky bottom-0 bg-background pb-6">
                                <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? (isEditMode ? "Saving..." : "Adding...") : (isEditMode ? "Save Changes" : "Add Tool")}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Any unsaved changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                        <AlertDialogAction onClick={onClose} className="bg-destructive hover:bg-destructive/90">Discard Changes</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

