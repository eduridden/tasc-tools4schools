

"use client";

import { useMemo, useState, useEffect, useTransition } from 'react';
import { Link } from "react-router-dom";
import type { AiTool, ToolCategory, SubjectArea, TargetAudience, IconMap } from "@/lib/types";
import { generateToolGuide } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import {
    Book,
    Globe,
    Users,
    GraduationCap,
    LifeBuoy,
    Star,
    Check,
    ShieldAlert,
    Sparkles,
    Loader2,
    RefreshCw,
    ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import * as lucideIcons from 'lucide-react';
import { YouTubeEmbed } from './youtube-embed';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { learningAreas } from '@/lib/constants';


const getIcon = (iconName: string): LucideIcon => {
    return (lucideIcons as any)[iconName] || Globe;
};


const audienceIcons: IconMap = {
    "Teachers": GraduationCap,
    "Students": Users,
    "Support Staff": LifeBuoy,
};

const costColorMap: { [key: string]: string } = {
    Free: "bg-green-100 text-green-800 border-green-200",
    Freemium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Subscription: "bg-red-100 text-red-800 border-red-200",
};

const ageColorMap: { [key: string]: string } = {
    "All Ages": "bg-blue-100 text-blue-800 border-blue-200",
    "13+": "bg-purple-100 text-purple-800 border-purple-200",
    "16+": "bg-orange-100 text-orange-800 border-orange-200",
    "18+": "bg-pink-100 text-pink-800 border-pink-200",
};

interface ToolDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    tool: AiTool | null;
    allCategories: ToolCategory[];
    allSubjects: SubjectArea[];
    allAudiences: TargetAudience[];
}


function TagList({ title, items, iconMap }: { title: string; items: (ToolCategory | SubjectArea | TargetAudience)[]; iconMap?: IconMap }) {
    if (!items || items.length === 0) return null;
    return (
        <div>
            <h3 className="text-[0.9rem] font-bold text-foreground mb-2">{title}</h3>
            <div className="flex flex-wrap gap-2">
                {items.map(item => {
                    const Icon = iconMap ? iconMap[item.name] || Globe : getIcon((item as ToolCategory | SubjectArea).icon);
                    return (
                        <Badge key={item.id} variant="secondary" style={{ backgroundColor: item.color }} className="text-black/70 text-xs py-1 px-2 border-transparent hover:opacity-80">
                            <Icon className="mr-1.5 h-3.5 w-3.5" />
                            {item.name}
                        </Badge>
                    )
                })}
            </div>
        </div>
    )
}


export function ToolDetailModal({ isOpen, onClose, tool, allCategories, allSubjects, allAudiences }: ToolDetailModalProps) {

    const { toast } = useToast();
    const [isGenerating, startTransition] = useTransition();
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
    const [selectedLearningArea, setSelectedLearningArea] = useState<string>(learningAreas[0]);

    const toolCategories = useMemo(() => {
        if (!tool || !allCategories || !tool.toolCategoryIds) return [];
        return allCategories.filter(category => tool.toolCategoryIds.includes(category.id));
    }, [tool, allCategories]);

    const toolSubjects = useMemo(() => {
        if (!tool || !allSubjects || !tool.subjectAreaIds) return [];
        return allSubjects.filter(subject => tool.subjectAreaIds.includes(subject.id));
    }, [tool, allSubjects]);

    const toolAudiences = useMemo(() => {
        if (!tool || !allAudiences || !tool.targetAudienceIds) return [];
        return allAudiences.filter(audience => tool.targetAudienceIds.includes(audience.id));
    }, [tool, allAudiences]);

    useEffect(() => {
        if (isOpen) {
            if (tool?.defaultIdea) {
                setGeneratedIdeas([tool.defaultIdea]);
            } else {
                setGeneratedIdeas([]);
            }
        }
    }, [isOpen, tool]);

    if (!tool) {
        return null;
    }

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

    const hasMedia = (tool.screenshotUrls && tool.screenshotUrls.length > 0) || tool.youtubeVideoUrl;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden border-slate-200 dark:border-slate-800 rounded-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="p-8 pb-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                                <ToolLogo toolUrl={tool.url} toolName={tool.name} logoUrl={tool.logoUrl} size={72} />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle asChild>
                                    <h1 className="text-4xl font-black font-headline text-slate-900 dark:text-white tracking-tight">
                                        {tool.name}
                                    </h1>
                                </DialogTitle>
                                <Button asChild variant="link" className="px-0 h-auto text-indigo-600 dark:text-indigo-400 font-bold hover:no-underline flex items-center gap-2">
                                    <a href={tool.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[200px] sm:max-w-md">
                                        {tool.url.replace(/^https?:\/\//, '')}
                                        <Globe className="h-4 w-4 inline ml-1.5" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                            <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950 p-1 gap-1">
                                <div className={cn("text-center py-2 px-6 rounded-lg font-black text-sm transition-all",
                                    tool.costModel === 'Free' ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                        tool.costModel === 'Freemium' ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                                            "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                                )}>
                                    <span className="text-[10px] uppercase block leading-none mb-1 opacity-70">Cost</span>
                                    {tool.costModel}
                                </div>
                                <div className="text-center py-2 px-6 rounded-lg font-black text-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs">
                                    <span className="text-[10px] uppercase block leading-none mb-1 text-slate-400">Limit</span>
                                    {tool.ageRestriction}
                                </div>
                            </div>
                            {tool.unsafeDataPractices && (
                                <Alert variant="destructive" className="p-4 bg-rose-50 border-rose-100 text-rose-900 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl">
                                    <ShieldAlert className="h-5 w-5 mr-3 text-rose-600" />
                                    <AlertDescription className="font-bold text-sm">
                                        Data Policy Warning: This tool may share data publicly. Never use with personal, student or school information.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-7 space-y-8">
                            {hasMedia && (
                                <section>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-indigo-500" />
                                        Multimedia Gallery
                                    </h2>
                                    <Carousel className="w-full">
                                        <CarouselContent>
                                            {tool.youtubeVideoUrl && (
                                                <CarouselItem>
                                                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
                                                        <YouTubeEmbed videoUrl={tool.youtubeVideoUrl} />
                                                    </div>
                                                </CarouselItem>
                                            )}
                                            {tool.screenshotUrls?.map((url, index) => (
                                                <CarouselItem key={index}>
                                                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-md">
                                                        <img
                                                            src={url}
                                                            alt={`${tool.name} screenshot ${index + 1}`}
                                                            className="object-contain w-full h-full"
                                                        />
                                                    </div>
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        <div className="hidden sm:block">
                                            <CarouselPrevious className="-left-4 bg-white/90 shadow-xl border-slate-100 hover:bg-white" />
                                            <CarouselNext className="-right-4 bg-white/90 shadow-xl border-slate-100 hover:bg-white" />
                                        </div>
                                    </Carousel>
                                </section>
                            )}

                            <section className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">About {tool.name}</h2>
                                    <div className="flex items-center gap-2">
                                        {tool.recommended && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 py-1.5 px-3 rounded-full uppercase tracking-wider shadow-sm">
                                                <Star className="w-3 h-3 fill-amber-500" />
                                                <span>Recommended</span>
                                            </div>
                                        )}
                                        {tool.createdForTasc && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 py-1.5 px-3 rounded-full uppercase tracking-wider shadow-sm">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                                <span>TASC Exclusive</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed font-medium">
                                    {tool.description}
                                </p>
                            </section>

                            <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50/30 dark:bg-slate-900/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-black flex items-center gap-2">
                                        <Users className="h-5 w-5 text-indigo-500" />
                                        Classification
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <TagList title="Recommended For" items={toolAudiences} iconMap={audienceIcons} />
                                    <TagList title="Main Categories" items={toolCategories} />
                                    <TagList title="Applied Subject Areas" items={toolSubjects} />
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-5 space-y-8">
                            <Card className="rounded-2xl border-indigo-100 dark:border-indigo-900/30 shadow-indigo-100/50 dark:shadow-none bg-indigo-50/30 dark:bg-indigo-900/10 overflow-hidden">
                                <CardHeader className="pb-4 border-b border-indigo-100/50 dark:border-indigo-900/20 bg-indigo-50/50 dark:bg-indigo-900/20">
                                    <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-900 dark:text-indigo-400">
                                        <Sparkles className="h-5 w-5" />
                                        Smart Suggestions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-indigo-600/70 dark:text-indigo-400/70 ml-1">Learning Area</Label>
                                            <Select value={selectedLearningArea} onValueChange={setSelectedLearningArea}>
                                                <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-indigo-200 dark:border-indigo-900/50 rounded-xl shadow-sm focus:ring-indigo-500">
                                                    <SelectValue placeholder="Select a Learning Area" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-indigo-100 dark:border-indigo-900/50">
                                                    {learningAreas.map(area => (
                                                        <SelectItem key={area} value={area} className="rounded-lg">{area}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            onClick={handleGenerateIdeas}
                                            disabled={isGenerating}
                                            className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                                        >
                                            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                            <span className="ml-2">Generate Teaching Ideas</span>
                                        </Button>
                                    </div>

                                    {isGenerating ? (
                                        <div className="flex flex-col items-center justify-center gap-4 p-10 bg-white/50 dark:bg-slate-950/50 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 border-dashed">
                                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                            <p className="text-indigo-900 dark:text-indigo-400 font-bold text-center text-sm animate-pulse">Consulting AI for {selectedLearningArea}...</p>
                                        </div>
                                    ) : generatedIdeas.length > 0 ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-wider">Results for {selectedLearningArea}</h4>
                                                <button onClick={handleGenerateIdeas} className="text-indigo-600/60 hover:text-indigo-600 p-1 rounded-full transition-colors">
                                                    <RefreshCw className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                                                <ul className="space-y-4">
                                                    {generatedIdeas.map((idea, index) => (
                                                        <li key={index} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                            {idea}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center bg-white/30 dark:bg-slate-950/30 rounded-2xl border border-indigo-100/30 border-dashed">
                                            <p className="text-indigo-900/50 dark:text-indigo-400/50 text-xs font-semibold">Select a learning area to see AI generated integration ideas.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-3 pt-2">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Resources & Links</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {tool.documentationUrl && (
                                        <Button asChild variant="outline" className="h-12 justify-start rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group font-bold">
                                            <a href={tool.documentationUrl} target="_blank" rel="noopener noreferrer">
                                                <Book className="mr-3 h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
                                                View Documentation
                                            </a>
                                        </Button>
                                    )}
                                    {tool.trainingUrl && (
                                        <Button asChild variant="outline" className="h-12 justify-start rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group font-bold">
                                            <a href={tool.trainingUrl} target="_blank" rel="noopener noreferrer">
                                                <GraduationCap className="mr-3 h-4 w-4 text-slate-400 group-hover:text-emerald-500" />
                                                Training Academy
                                            </a>
                                        </Button>
                                    )}
                                    {!tool.documentationUrl && !tool.trainingUrl && (
                                        <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                            <p className="text-xs text-slate-400 font-medium">No additional links available.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button asChild className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all mt-4">
                                <a href={tool.url} target="_blank" rel="noopener noreferrer">
                                    Launch Tool <ArrowRight className="ml-2 h-5 w-5" />
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
