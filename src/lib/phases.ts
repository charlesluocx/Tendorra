export const PHASES = [
  {
    value: "Schematic",
    description:
      "You have a concept sketch or early idea and need an architect and town planner to develop it further.",
  },
  {
    value: "Feasibility & Concept",
    description:
      "You're assessing what's possible on the site and need early input from an architect, surveyor, or arborist.",
  },
  {
    value: "Planning & Approval",
    description:
      "You're preparing or have lodged a planning permit application and need town planning or referral consultants.",
  },
  {
    value: "Engineering & Delivery",
    description:
      "You have planning approval and need engineers, a building surveyor, or a project manager to prepare for construction.",
  },
  {
    value: "Marketing & Design",
    description:
      "You need marketing collateral, renders, or 3D visuals to promote or present the project.",
  },
  {
    value: "Sales/Legal & Ownership",
    description:
      "You need support with sales, legal, or ownership matters for the project.",
  },
] as const;

// Marketing & Design sits outside the sequence and can be added at any time.
export const PHASE_SEQUENCE = [
  "Schematic",
  "Feasibility & Concept",
  "Planning & Approval",
  "Engineering & Delivery",
  "Sales/Legal & Ownership",
];

export function suggestedNextPhase(startedPhases: string[]): string | null {
  const started = new Set(startedPhases);
  let lastIndex = -1;
  startedPhases.forEach((p) => {
    const i = PHASE_SEQUENCE.indexOf(p);
    if (i > lastIndex) lastIndex = i;
  });
  for (let i = lastIndex + 1; i < PHASE_SEQUENCE.length; i++) {
    const phase = PHASE_SEQUENCE[i]!;
    if (!started.has(phase)) return phase;
  }
  return null;
}
