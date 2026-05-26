
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";
import type { ToolCategory, SubjectArea, TargetAudience } from "@/lib/types";
import { costModels } from "@/lib/constants";
import { Skeleton } from "./ui/skeleton";
import { submitTool } from "@/lib/api";

interface SubmitToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCategories: ToolCategory[];
  allSubjects: SubjectArea[];
  allAudiences: TargetAudience[];
  isLoading: boolean;
}

const urlSchema = z
  .string()
  .trim()
  .min(1, "Please enter a website address.")
  .max(2048, "URL is too long.")
  .refine((url) => {
    // Reject `javascript:`, `data:`, `vbscript:` and other unsafe schemes.
    // Naked domains are allowed (they get `https://` prepended on submit).
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
      const parsed = new URL(candidate);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, { message: "Please enter a valid https URL." });

const formSchema = z.object({
  name: z.string().trim().min(1, "Tool name is required.").max(120, "Tool name is too long."),
  url: urlSchema,
  costModel: z.enum(["Free", "Freemium", "Subscription"]),
  toolCategoryIds: z.array(z.string()).min(1, "Please select at least one category.").max(20),
  subjectAreaIds: z.array(z.string()).min(1, "Please select at least one subject area.").max(40),
  targetAudienceIds: z.array(z.string()).min(1, "Please select at least one target audience.").max(20),
});

type ToolFormValues = z.infer<typeof formSchema>;

export function SubmitToolModal({
  isOpen,
  onClose,
  allCategories,
  allSubjects,
  allAudiences,
  isLoading,
}: SubmitToolModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ToolFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur", 
    defaultValues: {
      name: "",
      url: "",
      costModel: "Freemium",
      toolCategoryIds: [],
      subjectAreaIds: [],
      targetAudienceIds: [],
    },
  });

  const categoryOptions = allCategories.map(uc => ({ value: uc.id, label: uc.name }));
  const subjectOptions = allSubjects.map(s => ({ value: s.id, label: s.name }));
  const audienceOptions = allAudiences.map(a => ({ value: a.id, label: a.name }));
  
  async function onSubmit(data: ToolFormValues) {
    setIsSubmitting(true);
    try {
      // All submissions go through the locked-down `submitTool` callable:
      //  - server-side auth, App Check, strict zod, rate limit
      //  - server controls status/createdAt/submittedBy
      // Direct Firestore writes to `ai_tools` are blocked by the rules
      // (admin-only write), so this is the only valid submission path.
      const normalisedUrl = /^(https?:\/\/)/i.test(data.url) ? data.url : `https://${data.url}`;
      await submitTool({
        name: data.name,
        url: normalisedUrl,
        costModel: data.costModel,
        toolCategoryIds: data.toolCategoryIds,
        subjectAreaIds: data.subjectAreaIds,
        targetAudienceIds: data.targetAudienceIds,
      });

      toast({
        title: "Tool Submitted!",
        description: "Thank you for your submission. It has been sent for review.",
      });
      form.reset();
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to submit tool:", error);
      const message = error instanceof Error && error.message.includes("resource-exhausted")
        ? "Daily submission limit reached. Please try again tomorrow."
        : "An error occurred. Please try again.";
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit a Tool</DialogTitle>
          <DialogDescription>
            Found an AI tool that could help? Share it with the community!
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        ) : (
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
                        name="costModel"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cost Structure</FormLabel>
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
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter className="pt-4 pr-4">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Add Tool"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

    