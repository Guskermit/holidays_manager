"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addSkill,
  removeSkill,
  updateSkillLevel,
  addSpecialization,
  removeSpecialization,
} from "@/app/main/skills/actions";
import { strings } from "@/lib/strings";
import { PREDEFINED_SPECIALIZATIONS } from "@/lib/categories";

export type Skill = { id: string; name: string };
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
  // Map<skillId, level> for optimistic skill state
  const [mySkillsMap, setMySkillsMap] = useState<Map<string, number>>(
    new Map(initialMySkills.map((s) => [s.skillId, s.level]))
  );
  // Newly created skills with real IDs returned from server
  const [localNewSkills, setLocalNewSkills] = useState<Skill[]>([]);

  // Specializations: track by name (closed list), map name→id for removals
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

  const [skillInput, setSkillInput] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const skillInputRef = useRef<HTMLInputElement>(null);

  // Merged pools (server + newly created this session)
  const allPoolSkills: Skill[] = [
    ...allSkills,
    ...localNewSkills.filter((ls) => !allSkills.some((s) => s.id === ls.id)),
  ];

  const skillQuery = skillInput.trim().toLowerCase();
  const visibleSkills = skillQuery
    ? allPoolSkills.filter((s) => s.name.toLowerCase().includes(skillQuery))
    : allPoolSkills;
  const exactSkillMatch = allPoolSkills.find((s) => s.name.toLowerCase() === skillQuery);
  const showCreateSkill = skillQuery.length > 0 && !exactSkillMatch;

  const getSkillName = (skillId: string) =>
    allPoolSkills.find((s) => s.id === skillId)?.name ?? skillId;

  // ── Skill handlers ──────────────────────────────────────────────────────────

  const handleAddFromPool = (skill: Skill) => {
    if (mySkillsMap.has(skill.id)) {
      handleRemoveSkill(skill.id);
      return;
    }
    setMySkillsMap((prev) => new Map([...prev, [skill.id, 1]]));
    setSkillError(null);
    startTransition(async () => {
      const result = await addSkill(skill.name);
      if (result.error) {
        setMySkillsMap((prev) => { const n = new Map(prev); n.delete(skill.id); return n; });
        setSkillError(result.error);
      }
    });
  };

  const handleCreateSkill = () => {
    const name = skillInput.trim();
    if (!name) return;
    setSkillError(null);
    startTransition(async () => {
      const result = await addSkill(name);
      if (result.error) { setSkillError(result.error); return; }
      const realId = result.skillId!;
      if (!allPoolSkills.some((s) => s.id === realId)) {
        setLocalNewSkills((prev) => [...prev, { id: realId, name }]);
      }
      setMySkillsMap((prev) => new Map([...prev, [realId, 1]]));
      setSkillInput("");
      skillInputRef.current?.focus();
    });
  };

  const handleRemoveSkill = (skillId: string) => {
    const prevLevel = mySkillsMap.get(skillId) ?? 1;
    setMySkillsMap((prev) => { const n = new Map(prev); n.delete(skillId); return n; });
    setSkillError(null);
    startTransition(async () => {
      const result = await removeSkill(skillId);
      if (result.error) {
        setMySkillsMap((prev) => new Map([...prev, [skillId, prevLevel]]));
        setSkillError(result.error);
      }
    });
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

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (showCreateSkill) handleCreateSkill();
    else if (exactSkillMatch && !mySkillsMap.has(exactSkillMatch.id)) handleAddFromPool(exactSkillMatch);
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

  const mySkillsArray = [...mySkillsMap.entries()];

  return (
    <div className="flex flex-col gap-10">

      {/* ═══════════ SKILLS ═══════════ */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{strings.skills.allSkillsLabel}</h2>
          <p className="text-xs text-muted-foreground">{strings.skills.pageSubtitle}</p>
        </div>

        {/* My skills: level selector rows */}
        {mySkillsArray.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium">
                {strings.skills.mySkillsLabel}
                <span className="ml-1.5 text-muted-foreground font-normal text-xs">({mySkillsArray.length})</span>
              </span>
              {/* Level legend */}
              <div className="flex items-center gap-2 flex-wrap">
                {SKILL_LEVELS.map((l) => (
                  <span key={l.value} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={cn("size-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0", l.activeClass)}>
                      {l.value}
                    </span>
                    {l.title}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md border divide-y">
              {mySkillsArray.map(([skillId, level]) => (
                <div key={skillId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {getSkillName(skillId)}
                  </span>
                  <div className="flex gap-1">
                    {SKILL_LEVELS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        title={l.title}
                        onClick={() => handleLevelChange(skillId, l.value)}
                        disabled={isPending}
                        className={cn(
                          "size-6 rounded text-xs font-bold transition-colors disabled:opacity-50",
                          level === l.value
                            ? l.activeClass
                            : "bg-muted text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        {l.value}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skillId)}
                    disabled={isPending}
                    title="Remove skill"
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 ml-1"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {skillError && <p className="text-sm text-destructive">{skillError}</p>}

        {/* Search + pool */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              ref={skillInputRef}
              value={skillInput}
              onChange={(e) => { setSkillInput(e.target.value); setSkillError(null); }}
              onKeyDown={handleSkillKeyDown}
              placeholder={strings.skills.inputPlaceholder}
              aria-label={strings.skills.inputAriaLabel}
              disabled={isPending}
              className="max-w-sm"
            />
            {showCreateSkill && (
              <Button type="button" onClick={handleCreateSkill} disabled={isPending}>
                <PlusIcon className="size-4 mr-1" />
                {strings.skills.addButton}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{strings.skills.allSkillsHint}</p>

          {allPoolSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">{strings.skills.noSkills}</p>
          ) : visibleSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">{strings.skills.noMatchCreate}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleSkills.map((skill) => {
                const addedLevel = mySkillsMap.get(skill.id);
                const isAdded = addedLevel !== undefined;
                const levelCfg = isAdded ? SKILL_LEVELS[addedLevel] : null;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleAddFromPool(skill)}
                    disabled={isPending}
                    title={isAdded ? `Remove ${skill.name}` : `Add ${skill.name}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50",
                      isAdded
                        ? "bg-primary/5 border-primary/40 hover:bg-red-50/60 hover:border-red-300 dark:hover:bg-red-950/20"
                        : "border-input hover:bg-accent hover:border-primary"
                    )}
                  >
                    {isAdded && levelCfg ? (
                      <span className={cn("size-4 rounded text-[10px] font-bold flex items-center justify-center shrink-0", levelCfg.activeClass)}>
                        {addedLevel}
                      </span>
                    ) : (
                      <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {skill.name}
                    {isAdded && <XIcon className="size-3 shrink-0 ml-0.5 opacity-60" />}
                  </button>
                );
              })}
            </div>
          )}
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

