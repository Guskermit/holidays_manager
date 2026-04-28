"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { XIcon, PlusIcon } from "lucide-react";
import {
  addSkill,
  removeSkill,
  updateSkillLevel,
  addSpecialization,
  removeSpecialization,
} from "@/app/main/skills/actions";
import { strings } from "@/lib/strings";
import { PREDEFINED_SPECIALIZATIONS, SKILL_CATEGORIES } from "@/lib/categories";

export type Skill = { id: string; name: string; category: string };
export type MySkill = { skillId: string; level: number };
export type Specialization = { id: string; name: string };

type Props = {
  allSkills: Skill[];
  mySkills: MySkill[];
  allSpecializations: Specialization[];
  mySpecializationIds: Set<string>;
};

const SKILL_LEVELS = [
  { value: 0, title: strings.skills.level0, activeClass: "bg-zinc-400 text-white dark:bg-zinc-500" },
  { value: 1, title: strings.skills.level1, activeClass: "bg-amber-500 text-white" },
  { value: 2, title: strings.skills.level2, activeClass: "bg-blue-500 text-white" },
  { value: 3, title: strings.skills.level3, activeClass: "bg-emerald-500 text-white" },
] as const;

export function SkillsEditor({
  allSkills,
  mySkills: initialMySkills,
  allSpecializations,
  mySpecializationIds: initialMySpecIds,
}: Props) {
  const [mySkillsMap, setMySkillsMap] = useState<Map<string, number>>(
    new Map(initialMySkills.map((s) => [s.skillId, s.level]))
  );
  const [mySpecNames, setMySpecNames] = useState<Set<string>>(() => {
    const nameSet = new Set<string>();
    for (const spec of allSpecializations) {
      if (initialMySpecIds.has(spec.id)) nameSet.add(spec.name);
    }
    return nameSet;
  });
  const [specIdMap, setSpecIdMap] = useState<Map<string, string>>(
    () => new Map(allSpecializations.map((s) => [s.name, s.id]))
  );

  const [skillError, setSkillError] = useState<string | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Group skills by category preserving SKILL_CATEGORIES order
  const skillsByCategory = new Map<string, Skill[]>();
  for (const cat of SKILL_CATEGORIES) skillsByCategory.set(cat, []);
  for (const s of allSkills) {
    if (!skillsByCategory.has(s.category)) skillsByCategory.set(s.category, []);
    skillsByCategory.get(s.category)!.push(s);
  }

  // ── Skill handlers ──────────────────────────────────────────────────────────

  const handleToggleSkill = (skill: Skill) => {
    if (mySkillsMap.has(skill.id)) {
      const prevLevel = mySkillsMap.get(skill.id)!;
      setMySkillsMap((prev) => { const n = new Map(prev); n.delete(skill.id); return n; });
      setSkillError(null);
      startTransition(async () => {
        const result = await removeSkill(skill.id);
        if (result.error) {
          setMySkillsMap((prev) => new Map([...prev, [skill.id, prevLevel]]));
          setSkillError(result.error);
        }
      });
    } else {
      setMySkillsMap((prev) => new Map([...prev, [skill.id, 1]]));
      setSkillError(null);
      startTransition(async () => {
        const result = await addSkill(skill.id);
        if (result.error) {
          setMySkillsMap((prev) => { const n = new Map(prev); n.delete(skill.id); return n; });
          setSkillError(result.error);
        }
      });
    }
  };

  const handleLevelChange = (skillId: string, level: number) => {
    const prevLevel = mySkillsMap.get(skillId) ?? 1;
    if (prevLevel === level) return;
    setMySkillsMap((prev) => new Map([...prev, [skillId, level]]));
    setSkillError(null);
    startTransition(async () => {
      const result = await updateSkillLevel(skillId, level);
      if (result.error) {
        setMySkillsMap((prev) => new Map([...prev, [skillId, prevLevel]]));
        setSkillError(result.error);
      }
    });
  };

  // ── Specialization handlers ─────────────────────────────────────────────────

  const handleToggleSpec = (name: string) => {
    if (mySpecNames.has(name)) {
      const id = specIdMap.get(name);
      if (!id) return;
      setMySpecNames((prev) => { const n = new Set(prev); n.delete(name); return n; });
      setSpecError(null);
      startTransition(async () => {
        const result = await removeSpecialization(id);
        if (result.error) {
          setMySpecNames((prev) => new Set([...prev, name]));
          setSpecError(result.error);
        }
      });
    } else {
      setMySpecNames((prev) => new Set([...prev, name]));
      setSpecError(null);
      startTransition(async () => {
        const result = await addSpecialization(name);
        if (result.error) {
          setMySpecNames((prev) => { const n = new Set(prev); n.delete(name); return n; });
          setSpecError(result.error);
        } else if (result.specializationId) {
          setSpecIdMap((prev) => new Map([...prev, [name, result.specializationId!]]));
        }
      });
    }
  };

  return (
    <div className="flex flex-col gap-10">

      {/* ═══════════ SKILLS ═══════════ */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{strings.skills.allSkillsLabel}</h2>
          <p className="text-xs text-muted-foreground">{strings.skills.pageSubtitle}</p>
        </div>

        {/* Level legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {SKILL_LEVELS.map((l) => (
            <span key={l.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0", l.activeClass)}>
                {l.value}
              </span>
              {l.title}
            </span>
          ))}
        </div>

        {skillError && <p className="text-sm text-destructive">{skillError}</p>}

        {/* Skills grouped by category */}
        <div className="flex flex-col gap-6">
          {[...skillsByCategory.entries()].map(([cat, skills]) => {
            if (skills.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {cat}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => {
                    const level = mySkillsMap.get(skill.id);
                    const isSelected = level !== undefined;
                    return (
                      <div key={skill.id} className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSkill(skill)}
                          disabled={isPending}
                          title={isSelected ? strings.skills.removeSkillTitle : strings.skills.addSkillTitle}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium border transition-colors disabled:opacity-50",
                            isSelected
                              ? "bg-primary/10 border-primary/40 text-primary rounded-l-full border-r-0"
                              : "border-input hover:bg-accent hover:border-primary rounded-full"
                          )}
                        >
                          {skill.name}
                        </button>
                        {isSelected && (
                          <>
                            {SKILL_LEVELS.map((l, i) => (
                              <button
                                key={l.value}
                                type="button"
                                title={l.title}
                                onClick={() => handleLevelChange(skill.id, l.value)}
                                disabled={isPending}
                                className={cn(
                                  "size-7 text-xs font-bold transition-colors disabled:opacity-50 border-y",
                                  i < SKILL_LEVELS.length - 1 ? "border-r-0" : "border-r",
                                  level === l.value
                                    ? l.activeClass + " border-primary/40"
                                    : "bg-muted text-muted-foreground hover:bg-muted/60 border-primary/40"
                                )}
                              >
                                {l.value}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleToggleSkill(skill)}
                              disabled={isPending}
                              title={strings.skills.removeSkillTitle}
                              className="size-7 flex items-center justify-center rounded-r-full border border-l-0 border-primary/40 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
                            >
                              <XIcon className="size-3" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t" />

      {/* ═══════════ SPECIALIZATIONS ═══════════ */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{strings.skills.specializationsLabel}</h2>
          <p className="text-xs text-muted-foreground">{strings.skills.specializationsSubtitle}</p>
        </div>

        {specError && <p className="text-sm text-destructive">{specError}</p>}

        <div className="flex flex-wrap gap-2">
          {PREDEFINED_SPECIALIZATIONS.map((name) => {
            const isSelected = mySpecNames.has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => handleToggleSpec(name)}
                disabled={isPending}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                    : "border-input hover:bg-accent hover:border-primary"
                )}
              >
                {isSelected
                  ? <XIcon className="size-3.5 shrink-0" />
                  : <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                }
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
