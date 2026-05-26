import { useState, useEffect } from 'react';
import { collectionGroup, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { AiTool, ToolReview } from '@/lib/types';
import { Star, Pencil, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ReviewRow = ToolReview & { id: string; toolId: string };

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <Star
        key={s}
        className={`h-3.5 w-3.5 ${s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-base-300'}`}
      />
    ))}
  </div>
);

export function ReviewsManager({ tools }: { tools: AiTool[] }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [reviews, setReviews]         = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editRating, setEditRating]   = useState(0);
  const [editText, setEditText]       = useState('');
  const [isSaving, setIsSaving]       = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const unsub = onSnapshot(
      collectionGroup(firestore, 'reviews'),
      snap => {
        setReviews(
          snap.docs.map(d => ({
            ...(d.data() as ToolReview),
            id:     d.id,
            toolId: d.ref.parent.parent?.id ?? '',
          }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        );
        setIsLoading(false);
      },
      _err => { setIsLoading(false); }
    );
    return unsub;
  }, [firestore]);

  const toolName = (toolId: string) =>
    tools.find(t => t.id === toolId)?.name ?? toolId;

  const startEdit = (r: ReviewRow) => {
    setEditingId(r.id + r.toolId);
    setEditRating(r.rating);
    setEditText(r.reviewText);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (r: ReviewRow) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'ai_tools', r.toolId, 'reviews', r.id), {
        rating:     editRating,
        reviewText: editText.trim(),
      });
      toast({ title: 'Review updated' });
      setEditingId(null);
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (r: ReviewRow) => {
    if (!firestore) return;
    if (!window.confirm(`Delete ${r.displayName}'s review of "${toolName(r.toolId)}"?`)) return;
    try {
      await deleteDoc(doc(firestore, 'ai_tools', r.toolId, 'reviews', r.id));
      toast({ title: 'Review deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Star className="h-12 w-12 text-base-300" />
        <p className="text-base-content/50">No teacher reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Reviewer</th>
            <th>Rating</th>
            <th>Review</th>
            <th>Date</th>
            <th className="w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map(r => {
            const rowKey = r.id + r.toolId;
            const isEditing = editingId === rowKey;
            return (
              <tr key={rowKey} className={isEditing ? 'bg-amber-50' : 'hover'}>
                <td className="font-medium max-w-[140px] truncate">{toolName(r.toolId)}</td>
                <td className="text-base-content/70 whitespace-nowrap">{r.displayName}</td>
                <td>
                  {isEditing ? (
                    <div className="rating rating-sm">
                      {[1, 2, 3, 4, 5].map(s => (
                        <input
                          key={s}
                          type="radio"
                          name={`admin-edit-${rowKey}`}
                          className="mask mask-star-2 bg-amber-400"
                          checked={editRating === s}
                          onChange={() => setEditRating(s)}
                        />
                      ))}
                    </div>
                  ) : (
                    <StarDisplay rating={r.rating} />
                  )}
                </td>
                <td className="max-w-xs">
                  {isEditing ? (
                    <textarea
                      className="textarea textarea-bordered textarea-sm w-full text-xs resize-none"
                      rows={2}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                    />
                  ) : (
                    <span className="text-sm text-base-content/70 line-clamp-2">
                      {r.reviewText || <span className="italic text-base-content/30">No text</span>}
                    </span>
                  )}
                </td>
                <td className="text-xs text-base-content/40 whitespace-nowrap">
                  {r.createdAt
                    ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </td>
                <td>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button
                        className="btn btn-success btn-xs gap-1"
                        onClick={() => saveEdit(r)}
                        disabled={isSaving || editRating === 0}
                      >
                        {isSaving ? <span className="loading loading-spinner loading-xs" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-xs text-base-content/50 hover:text-primary"
                        onClick={() => startEdit(r)}
                        title="Edit review"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-base-content/50 hover:text-error"
                        onClick={() => handleDelete(r)}
                        title="Delete review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
