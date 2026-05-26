
'use client';

import { useRef, useState } from 'react';
import { PlusCircle, Pencil, Trash2, Globe } from 'lucide-react';
import type { SubjectArea, TaxonomyItem } from '@/lib/types';
import { TaxonomyEditModal } from './taxonomy-edit-modal';
import { useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import * as lucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SubjectManagerProps {
  subjects: SubjectArea[];
}

const getIcon = (iconName: string): LucideIcon =>
  (lucideIcons as any)[iconName] || Globe;

export function SubjectManager({ subjects }: SubjectManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TaxonomyItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TaxonomyItem | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleEdit = (subject: SubjectArea) => {
    setEditingItem(subject);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleDeletePrompt = (subject: SubjectArea) => {
    setItemToDelete(subject);
    confirmDialogRef.current?.showModal();
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'subject_areas', itemToDelete.id));
    toast({ title: "Subject area deleted", description: `"${itemToDelete.name}" has been removed.` });
    confirmDialogRef.current?.close();
    setItemToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleAddNew} className="btn btn-primary btn-sm gap-2">
          <PlusCircle className="h-4 w-4" />
          Add New Subject Area
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-300">
        <table className="table table-zebra">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-base-content/60">
              <th className="w-14">Icon</th>
              <th>Name</th>
              <th>Colour</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr><td colSpan={4} className="text-center text-base-content/40 py-8">No subject areas yet</td></tr>
            )}
            {subjects.map((subject) => {
              const Icon = getIcon(subject.icon);
              return (
                <tr key={subject.id} className="hover:bg-base-200/50">
                  <td>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${subject.color}22`, color: subject.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </td>
                  <td className="font-bold">{subject.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full border border-base-300 shadow-sm" style={{ backgroundColor: subject.color }} />
                      <code className="text-xs text-base-content/40 font-mono">{subject.color}</code>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
                        onClick={() => handleEdit(subject)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
                        onClick={() => handleDeletePrompt(subject)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm delete dialog */}
      <dialog ref={confirmDialogRef} className="modal modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg text-base-content">Delete Subject Area?</h3>
          <p className="py-4 text-base-content/70">
            This will permanently delete <span className="font-semibold text-base-content">"{itemToDelete?.name}"</span>.
            Any tools in this subject area will need to be updated.
          </p>
          <div className="modal-action gap-2">
            <form method="dialog">
              <button className="btn btn-ghost">Cancel</button>
            </form>
            <button className="btn btn-error" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      {isModalOpen && (
        <TaxonomyEditModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          item={editingItem}
          itemType="Subject Area"
          collectionName="subject_areas"
        />
      )}
    </div>
  );
}
