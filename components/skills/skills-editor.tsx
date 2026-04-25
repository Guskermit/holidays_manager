"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon, PlusIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { addSkill, removeSkill } from "@/app/main/skills/actions";
import { strings } from "@/lib/strings";

export type Skill = {
  id: string;
  name: string;
};

type Props = {
  /** All skills that exist in the global pool */
  allSkills: Skill[];
  /** IDs of the skills already assigned to the current employee */
  mySkillIds: Set<string>;
};

export function SkillsEditor({ allSkills, mySkillIds: initialMySkillIds }: Props) {
  const [mySkillIds, setMySkillIds] = useState<Set<string>>(initialMySkillIds);
  // Skills created during this session not yet reflected in allSkills from server
  const [localSkills, setLocalSkills] = useState<Skill[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Merged pool: server-fetched + newly created this session
  const allPoolSkills: Skill[] = [
    ...allSkills,
    ...localSkills.filter((ls) => !allSkills.some((s) => s.id === ls.id)),
  ];

  // Filter visible skills by search input
  const query = inputValue.trim().toLowerCase();
  const visibleSkills = query
    ? allPoolSkills.filter((s) => s.name.toLowerCase().includes(query))
    : allPoolSkills;

  // "Create" option: show when input doesn't match any existing skill exactly
  const exactMatch = allPoolSkills.find((s) => s.name.toLowerCase() === query);
  const showCreateOption = query.length > 0 && !exactMatch;

  const handleToggle = (skill: Skill) => {
    setError(null);
    if (mySkillIds.has(skill.id)) {
      // Remove from profile
      startTransition(async () => {
        const result = await removeSkill(skill.id);
        if (result.error) {
          setError(strings.skills.errorRemoving(result.error));
          return;
        }
        setMySkillIds((prev) => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
      });
    } else {
      // Add to profile
      startTransition(async () => {
        const result = await addSkill(skill.name);
        if (result.error) {
          setError(strings.skills.errorAdding(result.error));
          return;
        }
        setMySkillIds((prev) => new Set([...prev, skill.id]));
        setInputValue("");
        inputRef.current?.focus();
      });
    }
  };

  const handleCreate = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setError(null);

    startTransition(async () => {
      const result = await addSkill(trimmed);
      if (result.error) {
        setError(strings.skills.errorAdding(result.error));
        return;
      }
      // Optimistically add to local pool and select it
      const tempId = `temp-${trimmed}-${Date.now()}`;
      const newSkill: Skill = { id: tempId, name: trimmed };
      setLocalSkills((prev) => [...prev, newSkill]);
      setMySkillIds((prev) => new Set([...prev, tempId]));
      setInputValue("");
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreateOption) {
        handleCreate();
      } else if (exactMatch && !mySkillIds.has(exactMatch.id)) {
        handleToggle(exactMatch);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search / create input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={strings.skills.inputPlaceholder}
          aria-label={strings.skills.inputAriaLabel}
          disabled={isPending}
          className="max-w-sm"
        />
        {showCreateOption && (
          <Button type="button" onClick={handleCreate} disabled={isPending}>
            <PlusIcon className="size-4 mr-1" />
            {strings.skills.addButton}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Unified skill pool — all skills, selected ones highlighted */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{strings.skills.allSkillsLabel}</span>
          <span className="text-xs text-muted-foreground">{strings.skills.allSkillsHint}</span>
        </div>

        {allPoolSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.skills.noSkills}</p>
        ) : visibleSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.skills.noMatchCreate}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visibleSkills.map((skill) => {
              const selected = mySkillIds.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleToggle(skill)}
                  disabled={isPending}
                  title={selected ? `Remove ${skill.name}` : `Add ${skill.name}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50",
                    selected
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                      : "border-input hover:bg-accent hover:border-primary"
                  )}
                >
                  {selected ? (
                    <CheckIcon className="size-3.5 shrink-0" />
                  ) : (
                    <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {skill.name}
                  {selected && <XIcon className="size-3 shrink-0 ml-0.5 opacity-70" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
