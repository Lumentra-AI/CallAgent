"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { post, put, del } from "@/lib/api/client";
import type { KnowledgeBaseItem } from "./types";

interface KnowledgeBaseTabProps {
  items: KnowledgeBaseItem[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

interface EditingItem {
  id: string | null; // null = new item
  question: string;
  answer: string;
  category: string;
}

export default function KnowledgeBaseTab({
  items,
  isLoading,
  onRefresh,
}: KnowledgeBaseTabProps) {
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveItem = useCallback(async () => {
    if (!editingItem) return;
    if (!editingItem.question.trim() || !editingItem.answer.trim()) {
      setError("Question and answer are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        question: editingItem.question.trim(),
        answer: editingItem.answer.trim(),
        category: editingItem.category.trim() || undefined,
        sort_order: items.length,
      };

      if (editingItem.id) {
        // Update existing
        await put(`/api/knowledge-base/${editingItem.id}`, payload);
      } else {
        // Create new
        await post("/api/knowledge-base", payload);
      }

      setEditingItem(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editingItem, items.length, onRefresh]);

  const handleDeleteItem = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      setError(null);

      try {
        await del(`/api/knowledge-base/${id}`);
        setDeleteConfirmId(null);
        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setIsDeleting(false);
      }
    },
    [onRefresh],
  );

  const handleToggleActive = useCallback(
    async (item: KnowledgeBaseItem) => {
      try {
        await put(`/api/knowledge-base/${item.id}`, {
          is_active: !item.is_active,
        });
        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to toggle");
      }
    },
    [onRefresh],
  );

  const handleSeedDefaults = useCallback(async () => {
    setIsSeeding(true);
    setError(null);

    try {
      await post("/api/knowledge-base/seed");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load defaults");
    } finally {
      setIsSeeding(false);
    }
  }, [onRefresh]);

  const activeCount = items.filter((i) => i.is_active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">Knowledge Base</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} Q&A pair{items.length !== 1 ? "s" : ""}
              {activeCount !== items.length && ` (${activeCount} active)`}
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() =>
            setEditingItem({ id: null, question: "", answer: "", category: "" })
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add New
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No knowledge base entries yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add Q&A pairs to help your chatbot answer common questions
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={isSeeding}
          >
            {isSeeding ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Load Industry Defaults
              </>
            )}
          </Button>
        </div>
      )}

      {/* Q&A list */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-colors",
                !item.is_active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.question}
                    </p>
                    {item.category && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px]"
                      >
                        {item.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.answer}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={() => handleToggleActive(item)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem({
                        id: item.id,
                        question: item.question,
                        answer: item.answer,
                        category: item.category || "",
                      })
                    }
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Load defaults hint (when few items) */}
          {items.length > 0 && items.length < 3 && (
            <div className="flex items-center justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="text-xs text-muted-foreground"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3 w-3" />
                    Load Industry Defaults
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit / Create modal */}
      <Modal
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>
              {editingItem?.id ? "Edit Q&A Pair" : "Add Q&A Pair"}
            </ModalTitle>
            <ModalDescription>
              {editingItem?.id
                ? "Update this knowledge base entry"
                : "Add a new question and answer for the chatbot"}
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb_question" className="text-xs">
                Question
              </Label>
              <textarea
                id="kb_question"
                value={editingItem?.question || ""}
                onChange={(e) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, question: e.target.value } : prev,
                  )
                }
                placeholder="What do customers commonly ask?"
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-offset-background placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb_answer" className="text-xs">
                Answer
              </Label>
              <textarea
                id="kb_answer"
                value={editingItem?.answer || ""}
                onChange={(e) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, answer: e.target.value } : prev,
                  )
                }
                placeholder="The chatbot's response to this question"
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-offset-background placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb_category" className="text-xs">
                Category (optional)
              </Label>
              <Input
                id="kb_category"
                value={editingItem?.category || ""}
                onChange={(e) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, category: e.target.value } : prev,
                  )
                }
                placeholder="e.g. Hours, Pricing, Location"
                className="text-sm"
              />
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setEditingItem(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : editingItem?.id ? (
                "Update"
              ) : (
                "Add"
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Delete Q&A Pair</ModalTitle>
            <ModalDescription>
              This action cannot be undone. The chatbot will no longer be able
              to reference this answer.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) handleDeleteItem(deleteConfirmId);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
