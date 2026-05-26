
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ToolCategory } from "@/lib/types";
import { Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as lucideIcons from 'lucide-react';


const getIcon = (iconName: string): LucideIcon => {
    return (lucideIcons as any)[iconName] || Globe;
};

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ToolCategory[];
  onCategoryClick: (categoryId: string) => void;
}

const CategoryTile = ({ category, onCategoryClick }: { category: ToolCategory, onCategoryClick: (id: string) => void }) => {
    const Icon = getIcon(category.icon);

    return (
        <div 
            className={`p-6 rounded-xl text-black/70 shadow-lg cursor-pointer transition-transform hover:-translate-y-1`}
            style={{ backgroundColor: category.color }}
            onClick={() => onCategoryClick(category.id)}
        >
            <Icon className="w-10 h-10 mb-3 opacity-80" strokeWidth={1.5} />
            <h3 className="text-xl font-bold mb-1 text-black/80">{category.name}</h3>
            <p className="text-sm text-black/60">{category.description}</p>
        </div>
    )
}

export function CategoryModal({ isOpen, onClose, categories, onCategoryClick }: CategoryModalProps) {
  
  const handleCategorySelect = (categoryId: string) => {
    onCategoryClick(categoryId);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-8">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold mb-6">Browse by Category</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
                <CategoryTile key={category.id} category={category} onCategoryClick={handleCategorySelect} />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
    
