
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { type TaxonomyItem } from '@/lib/types';

import { useFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { iconNames } from '@/lib/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Globe } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';
import { suggestIcon } from '@/lib/api';

interface TaxonomyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TaxonomyItem | null;
  itemType: 'Category' | 'Subject Area';
  collectionName: 'tool_categories' | 'subject_areas';
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  color: z.string().regex(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/, 'Must be a valid HSL color string.'),
  icon: z.string().min(1, 'Icon is required.'),
});

type FormValues = z.infer<typeof formSchema>;

const getIcon = (iconName: string): LucideIcon => {
  return (lucideIcons as any)[iconName] || Globe;
};

const generatePastelColors = (count: number) => {
  const colors: string[] = [];
  let hue = Math.floor(Math.random() * 360);
  const goldenRatioConjugate = 0.618033988749895;

  for (let i = 0; i < count; i++) {
    hue = (hue + goldenRatioConjugate * 360) % 360;
    const saturation = 40 + Math.floor(Math.random() * 30); // 40-70%
    const lightness = 80 + Math.floor(Math.random() * 10); // 80-90%
    colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
};


export function TaxonomyEditModal({
  isOpen,
  onClose,
  item,
  itemType,
  collectionName,
}: TaxonomyEditModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingIcon, startTransition] = useTransition();
  const { firestore } = useFirebase();
  const isEditMode = !!item;

  const colorPalette = useMemo(() => generatePastelColors(20), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      color: colorPalette[0],
      icon: 'Globe',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (item) {
        form.reset({
          name: item.name,
          description: item.description || '',
          color: item.color,
          icon: item.icon,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
          icon: 'Globe',
        });
      }
    }
  }, [item, isOpen, form, colorPalette]);

  const handlePickIcon = () => {
    const currentName = form.getValues('name');
    if (!currentName) {
      toast({
        variant: 'destructive',
        title: 'Please enter a name first',
        description: 'An icon cannot be suggested without a name.',
      });
      return;
    }
    startTransition(async () => {
      try {
        const suggestedIcon = await suggestIcon({ term: currentName, iconList: iconNames });
        if (iconNames.includes(suggestedIcon)) {
          form.setValue('icon', suggestedIcon, { shouldValidate: true });
          toast({
            title: 'Icon Suggested!',
            description: `We've selected the "${suggestedIcon}" icon for you.`,
          });
        } else {
          throw new Error(`Suggested icon "${suggestedIcon}" is not a valid icon.`);
        }
      } catch (error) {
        console.error("AI Icon suggestion failed:", error);
        toast({
          variant: 'destructive',
          title: 'Suggestion Failed',
          description: `AI could not find a matching icon for "${currentName}". Please select one manually.`,
        });
      }
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);

    const payload: Omit<TaxonomyItem, 'id'> = {
      name: data.name,
      color: data.color,
      icon: data.icon,
    };
    if (itemType === 'Category') {
      payload.description = data.description;
    }


    try {
      if (isEditMode && item) {
        const itemRef = doc(firestore, collectionName, item.id);
        await setDocumentNonBlocking(itemRef, payload, { merge: true });
      } else {
        const itemCollection = collection(firestore, collectionName);
        await addDocumentNonBlocking(itemCollection, payload);
      }
      toast({
        title: `${itemType} ${isEditMode ? 'Updated' : 'Added'}`,
        description: `"${data.name}" has been saved.`,
      });
      onClose();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: `Could not save the ${itemType.toLowerCase()}.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Edit ${itemType}` : `Add New ${itemType}`}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {itemType === 'Category' && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconNames.map(iconName => {
                          const Icon = getIcon(iconName);
                          return (
                            <SelectItem key={iconName} value={iconName}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{iconName}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={handlePickIcon} disabled={isSuggestingIcon}>
                      {isSuggestingIcon ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Pick for me
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-10 gap-2"
                    >
                      {colorPalette.map((color) => (
                        <FormItem key={color} className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value={color} className="sr-only" />
                          </FormControl>
                          <FormLabel className={cn(
                            "h-8 w-8 rounded-full border-2 border-transparent cursor-pointer transition-all",
                            field.value === color && "ring-2 ring-offset-2 ring-primary"
                          )} style={{ backgroundColor: color }} />
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
