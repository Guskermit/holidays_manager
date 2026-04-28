"use client";

import { useState, useTransition, useRef } from "react";
import { cn } from "@/lib/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSkill, deleteSkill } from "@/app/main/admin/skills/actions";
import { strings } from "@/lib/strings";
import { SKILL_CATEGORIES, type SkillCategory } from "@/lib/categories";

type Skill = { id: string; name: string; category: string };

type Props = {
  skills: Skill[];
};

export function SkillsManager({ skills: initialSkills }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>(SKILL_CATEGORIES[0]);
  const [newSkillName, setNewSkillName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const skillsByCategory = (cat: string) => skills.filter((s) => s.category === cat);

  const handleCreate = () => {
    const name = newSkillName.trim();
    if (!name) return;
    setError(null);

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const tempSkill = { id: tempId, name, category: selectedCategory };
    setSkills((prev) => [...prev, tempSkill]);
    setNewSkillName("");
    inputRef.current?.focus();

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {SKILL_CATEGORIES.map((cat) => (
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
      </div>

      {/* Add new skill */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={newSkillName}
          onChange={(e) => { setNewSkillName(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder={strings.skills.adminAddPlaceholder(selectedCategory)}
          disabled={isPending}
          className="max-w-sm"
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !newSkillName.trim()}
        >
          <PlusIcon className="size-4 mr-1" />
          {strings.skills.adminAddButton}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Skill list for selected category */}
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
    </div>
  );
}
