import type { Answers, Scenario, ScenarioResponse } from './scenario';
export type Invitation = {
  id: string; authorId: string; status: 'draft' | 'published' | 'answered'; version: number;
  scenario: Scenario; publishedId: string | null; publishedScenario: Scenario | null;
  response: (ScenarioResponse & { versionId: string; eventId: string | null; scenario: Scenario }) | null;
  run: { versionId: string; scenario: Scenario; answers: Answers } | null;
  publicationError?: string;
};
