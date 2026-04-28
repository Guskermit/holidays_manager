"use client";

import { useState, useTransition, useRef } from "react";
import { cn } from "@/lib/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSkill, deleteSkill } from "@/app/main/admin/skills/actions";
import { strings } from "@/lib/strings";

type Skill = { id: string; name: string; category: string };

type Props = {
  skills: Skill[];
  categories: string[];
};

export function SkillsManager({ skills: initialSkills, categories: initialCategories }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategories[0] ?? "");
  const [newSkillName, setNewSkillName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const skillInputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  const skillsByCategory = (cat: string) => skills.filter((s) => s.category === cat);

  // ── Add new category (client-side only — becomes real once a skill is created in it) ──
  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      setSelectedCategory(categories.find(c => c.toLowerCase() === name.toLowerCase())!);
      setNewCatName("");
      setShowNewCat(false);
      return;
    }
    setCategories((prev) => [...prev, name]);
    setSelectedCategory(name);
    setNewCatName("");
    setShowNewCat(false);
  };

  const handleCatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); }
    if (e.key === "Escape") { setShowNewCat(false); setNewCatName(""); }
  };

  // ── Add skill ──
  const handleCreate = () => {
    const name = newSkillName.trim();
    if (!name || !selectedCategory) return;
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const tempSkill = { id: tempId, name, category: selectedCategory };
    setSkills((prev) => [...prev, tempSkill]);
    setNewSkillName("");
    skillInputRef.current?.focus();

    startTransition(async () => {
      const result = await createSkill(name, selectedCategory);
      if (result.error) {
        setSkills((prev) => prev.filter((s) => s.id !== tempId));
        setError(result.error);
      }
    });
  };

  const handleDelete = (skill: Skill) => {
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    setError(null);
    startTransition(async () => {
      const result = await deleteSkill(skill.id);
      if (result.error) {
        setSkills((prev) => [...prev, skill]);
        setError(result.error);
      }
    });
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              selectedCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            {cat}
            <span className="ml-1.5 text-xs opacity-70">({skillsByCategory(cat).length})</span>
          </button>
        ))}

        {/* New category button / inline input */}
        {showNewCat ? (
          <div className="flex items-center gap-1">
            <Input
              ref={catInputRef}
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={handleCatKeyDown}
              placeholder={strings.skills.adminNewCategoryPlaceholder}
              className="h-8 w-40 text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
              className="h-8"
            >
              {strings.skills.adminAddButton}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowNewCat(false); setNewCatName(""); }}
              className="h-8"
            >
              ✕
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setShowNewCat(true); setTimeout(() => catInputRef.current?.focus(), 0); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-input text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <PlusIcon className="size-3.5" />
            {strings.skills.adminAddCategory}
          </button>
        )}
      </div>

      {/* Add new skill */}
      <div className="flex gap-2">
        <Input
          ref={skillInputRef}
          value={newSkillName}
          onChange={(e) => { setNewSkillName(e.target.value); setError(null); }}
          onKeyDown={handleSkillKeyDown}
          placeholder={selectedCategory ? strings.skills.adminAddPlaceholder(selectedCategory) : ""}
          disabled={isPending || !selectedCategory}
          className="max-w-sm"
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !newSkillName.trim() || !selectedCategory}
        >
          <PlusIcon className="size-4 mr-1" />
          {strings.skills.adminAddButton}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Skill list for selected category */}
      {selectedCategory && (
        <div className="rounded-md border divide-y">
          {skillsByCategory(selectedCategory).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              {strings.skills.adminNoSkills(selectedCategory)}
            </p>
          ) : (
            skillsByCategory(selectedCategory).map((skill) => (
              <div key={skill.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className="text-sm">{skill.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={isPending}
                  onClick={() => handleDelete(skill)}
                  title={strings.skills.adminDeleteTitle}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
