import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemo } from "./useDemo";
import { toast } from "sonner";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  user_id: string;
}

export interface Folder {
  id: string;
  category_id: string;
  parent_id: string | null;
  user_id: string;
  folder_name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface FolderRule {
  id: string;
  folder_id: string;
  user_id: string;
  keywords: string[];
}

const DEFAULT_CATEGORIES = [
  { name: "Collabs", slug: "collabs", sort_order: 0 },
  { name: "Sponsorships", slug: "sponsorships", sort_order: 1 },
  { name: "Payments", slug: "payments", sort_order: 2 },
  { name: "Leads", slug: "leads", sort_order: 3 },
  { name: "Fans", slug: "fans", sort_order: 4 },
  { name: "Other", slug: "other", sort_order: 5 },
];

// Demo data
const DEMO_CATEGORIES: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  id: `demo-cat-${i}`,
  name: c.name,
  slug: c.slug,
  sort_order: c.sort_order,
  user_id: "demo",
}));

const DEMO_FOLDERS: Folder[] = [
  { id: "demo-f1", category_id: "demo-cat-0", parent_id: null, user_id: "demo", folder_name: "Nike", color: "#f97316", sort_order: 0, created_at: new Date().toISOString() },
  { id: "demo-f2", category_id: "demo-cat-0", parent_id: null, user_id: "demo", folder_name: "Adidas", color: "#3b82f6", sort_order: 1, created_at: new Date().toISOString() },
  { id: "demo-f3", category_id: "demo-cat-1", parent_id: null, user_id: "demo", folder_name: "TechStartup", color: "#8b5cf6", sort_order: 0, created_at: new Date().toISOString() },
];

export function useFolders() {
  const { user } = useAuth();
  const isDemo = useDemo();
  const [categories, setCategories] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rules, setRules] = useState<FolderRule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (isDemo) {
      setCategories(DEMO_CATEGORIES);
      setFolders(DEMO_FOLDERS);
      setRules([]);
      setLoading(false);
      return;
    }
    if (!user) return;

    setLoading(true);
    const [catRes, folderRes, rulesRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("folders").select("*").order("sort_order"),
      supabase.from("folder_rules").select("*"),
    ]);

    let cats = (catRes.data as any[] || []) as Category[];

    // Seed defaults if empty
    if (cats.length === 0) {
      const toInsert = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id }));
      const { data: inserted } = await supabase.from("categories").insert(toInsert).select();
      cats = (inserted as any[] || []) as Category[];
    }

    setCategories(cats);
    setFolders((folderRes.data as any[] || []) as Folder[]);
    setRules((rulesRes.data as any[] || []) as FolderRule[]);
    setLoading(false);
  }, [user, isDemo]);

  useEffect(() => { loadData(); }, [loadData]);

  const createFolder = async (categoryId: string, name: string, color: string, parentId?: string) => {
    if (isDemo) {
      const newFolder: Folder = {
        id: `demo-f-${Date.now()}`,
        category_id: categoryId,
        parent_id: parentId || null,
        user_id: "demo",
        folder_name: name,
        color,
        sort_order: folders.filter((f) => f.category_id === categoryId).length,
        created_at: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, newFolder]);
      toast.success(`Folder "${name}" created`);
      return newFolder;
    }
    if (!user) return null;
    const { data, error } = await supabase
      .from("folders")
      .insert({
        category_id: categoryId,
        parent_id: parentId || null,
        user_id: user.id,
        folder_name: name,
        color,
        sort_order: folders.filter((f) => f.category_id === categoryId).length,
      } as any)
      .select()
      .single();
    if (error) { toast.error("Failed to create folder"); return null; }
    const folder = data as unknown as Folder;
    setFolders((prev) => [...prev, folder]);
    toast.success(`Folder "${name}" created`);
    return folder;
  };

  const renameFolder = async (folderId: string, newName: string) => {
    if (isDemo) {
      setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, folder_name: newName } : f));
      toast.success("Folder renamed");
      return;
    }
    await supabase.from("folders").update({ folder_name: newName } as any).eq("id", folderId);
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, folder_name: newName } : f));
    toast.success("Folder renamed");
  };

  const deleteFolder = async (folderId: string) => {
    if (isDemo) {
      setFolders((prev) => prev.filter((f) => f.id !== folderId && f.parent_id !== folderId));
      toast.success("Folder deleted");
      return;
    }
    await supabase.from("folders").delete().eq("id", folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId && f.parent_id !== folderId));
    toast.success("Folder deleted");
  };

  const updateFolderColor = async (folderId: string, color: string) => {
    if (isDemo) {
      setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, color } : f));
      return;
    }
    await supabase.from("folders").update({ color } as any).eq("id", folderId);
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, color } : f));
  };

  const reorderFolders = async (categoryId: string, orderedIds: string[]) => {
    const updated = folders.map((f) => {
      const idx = orderedIds.indexOf(f.id);
      if (idx >= 0) return { ...f, sort_order: idx };
      return f;
    });
    setFolders(updated);
    if (!isDemo) {
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase.from("folders").update({ sort_order: i } as any).eq("id", orderedIds[i]);
      }
    }
  };

  const setFolderRules = async (folderId: string, keywords: string[]) => {
    if (isDemo) {
      setRules((prev) => {
        const existing = prev.find((r) => r.folder_id === folderId);
        if (existing) return prev.map((r) => r.folder_id === folderId ? { ...r, keywords } : r);
        return [...prev, { id: `demo-r-${Date.now()}`, folder_id: folderId, user_id: "demo", keywords }];
      });
      toast.success("Rules updated");
      return;
    }
    if (!user) return;
    // Upsert: delete then insert
    await supabase.from("folder_rules").delete().eq("folder_id", folderId);
    if (keywords.length > 0) {
      const { data } = await supabase
        .from("folder_rules")
        .insert({ folder_id: folderId, user_id: user.id, keywords } as any)
        .select()
        .single();
      if (data) {
        setRules((prev) => [...prev.filter((r) => r.folder_id !== folderId), data as unknown as FolderRule]);
      }
    } else {
      setRules((prev) => prev.filter((r) => r.folder_id !== folderId));
    }
    toast.success("Rules updated");
  };

  return {
    categories,
    folders,
    rules,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    updateFolderColor,
    reorderFolders,
    setFolderRules,
    refetch: loadData,
  };
}
