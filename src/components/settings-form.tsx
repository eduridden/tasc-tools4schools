
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { SiteSettings } from "@/lib/types";
import { useFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface SettingsFormProps {
  currentSettings: SiteSettings | null;
}

const formSchema = z.object({
  siteName: z.string().min(1, "Site name is required."),
  siteSubtitle: z.string().min(1, "Subtitle is required."),
  allowToolSubmission: z.boolean(),
  requireLogin: z.boolean(),
  allowedDomains: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof formSchema>;

export function SettingsForm({ currentSettings }: SettingsFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { firestore } = useFirebase();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: "",
      siteSubtitle: "",
      allowToolSubmission: true,
      requireLogin: false,
      allowedDomains: "",
    },
  });

  useEffect(() => {
    if (currentSettings) {
      form.reset({
        siteName: currentSettings.siteName,
        siteSubtitle: currentSettings.siteSubtitle,
        allowToolSubmission: currentSettings.allowToolSubmission ?? true,
        requireLogin: currentSettings.requireLogin ?? false,
        allowedDomains: (currentSettings.allowedDomains || []).join('\n'),
      });
    }
  }, [currentSettings, form]);

  async function onSubmit(data: SettingsFormValues) {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Firestore not available. Please try again later.",
      });
      return;
    }
    setIsSubmitting(true);

    const domainsArray = data.allowedDomains
      ? data.allowedDomains.split('\n').map(d => d.trim()).filter(Boolean)
      : [];

    const settingsData = {
      ...data,
      allowedDomains: domainsArray,
    }


    try {
      const settingsRef = doc(firestore, "site_settings", "config");

      // Use non-blocking update. The 'merge' option creates the doc if it doesn't exist.
      setDocumentNonBlocking(settingsRef, settingsData, { merge: true });



      toast({
        title: "Settings Update Initiated",
        description: "Your changes are being saved in the background.",
      });
    } catch (error) {
      console.error("Failed to initiate settings update:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while submitting the update.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="siteName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. AI Tools for Schools" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="siteSubtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Subtitle</FormLabel>
              <FormControl>
                <Input placeholder="A short, descriptive subtitle for the header." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="allowedDomains"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Allowed Email Domains</FormLabel>
              <FormControl>
                <Textarea placeholder="example.com&#x0a;school.edu" {...field} rows={4} />
              </FormControl>
              <FormDescription>
                Enter one email domain per line. Only users with these email domains can sign in with Google. Leave empty to allow all domains.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="allowToolSubmission"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Allow tool submission</FormLabel>
                <FormDescription>
                  If enabled, users can submit new tools for approval. Admins can always submit tools.
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
          name="requireLogin"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Require User Login</FormLabel>
                <FormDescription>
                  If enabled, users must log in to view the tool directory.
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Form>
  );
}
