import { describe, it, expect } from 'vitest';
import { COMMAND_REGISTRY, getCommandDefinition } from '../../server/commands/registry.js';
import { buildPeelPrompt } from '../../server/prompts/peelPrompt.js';

const VALID_SKILLS = new Set(['writing', 'speaking', 'both']);

describe('Writing/Speaking separation - registry skill field', () => {
  it('every command declares a skill field', () => {
    for (const command of COMMAND_REGISTRY) {
      expect(command, `${command.name} missing skill`).toHaveProperty('skill');
      expect(VALID_SKILLS.has(command.skill), `${command.name} skill=${command.skill}`).toBe(true);
    }
  });

  it('peel and score support both writing and speaking', () => {
    expect(getCommandDefinition('peel').skill).toBe('both');
    expect(getCommandDefinition('score').skill).toBe('both');
  });

  it('bank is scoped to speaking', () => {
    expect(getCommandDefinition('bank').skill).toBe('speaking');
  });

  it('matrix and wizard are scoped to writing', () => {
    expect(getCommandDefinition('matrix').skill).toBe('writing');
    expect(getCommandDefinition('wizard').skill).toBe('writing');
  });
});

describe('Writing/Speaking separation - prompt template selection', () => {
  it('defaults to the writing template (academic register)', () => {
    const prompt = buildPeelPrompt({ topicId: 'Education' });
    expect(prompt).toContain('[P]');
    expect(prompt).toContain('FOUR SENTENCE LOCK');
    // Writing enforces academic register / banned discourse glue.
    expect(prompt.toLowerCase()).toMatch(/academic|forbidden discourse glue/);
  });

  it('selects the speaking template when skill is speaking', () => {
    const prompt = buildPeelPrompt({ topicId: 'Education', skill: 'speaking' });
    expect(prompt).toContain('[P]');
    expect(prompt).toContain('FOUR SENTENCE LOCK');
    // Speaking mode signals natural spoken fluency and interaction markers.
    expect(prompt.toLowerCase()).toMatch(/natural (spoken )?fluency|spoken english/);
    expect(prompt.toLowerCase()).toMatch(/interaction marker|you know|i mean|like/);
  });

  it('speaking mode does NOT enforce the academic banned-glue list', () => {
    const writing = buildPeelPrompt({ topicId: 'Education', skill: 'writing' });
    const speaking = buildPeelPrompt({ topicId: 'Education', skill: 'speaking' });

    // Writing template carries the academic banned-glue enforcement.
    expect(writing).toContain('Forbidden discourse glue');
    // Speaking template relaxes academic register: no banned-glue block.
    expect(speaking).not.toContain('Forbidden discourse glue');
    // Speaking template must still keep the four-sentence PEEL lock.
    expect(speaking).toContain('[P]');
    expect(speaking).toContain('[E1]');
    expect(speaking).toContain('[E2]');
    expect(speaking).toContain('[L]');
  });

  it('speaking template keeps the four-sentence structure but allows interaction markers', () => {
    const speaking = buildPeelPrompt({ topicId: 'Society', skill: 'speaking' });
    expect(speaking).toContain('FOUR SENTENCE LOCK');
    // Interaction markers are explicitly permitted in speaking mode.
    expect(speaking.toLowerCase()).toMatch(/you know|i mean|well,|like,/);
  });
});
