import { describe, expect, it } from 'vitest';
import {
  COMMAND_REGISTRY,
  COMMAND_NAMES,
  getCommandDefinition,
  requiresApiKey,
  requiresBank,
  isRepairable,
} from '../../server/commands/registry.js';

const REQUIRED_FIELDS = [
  'name',
  'description',
  'skill',
  'inputSchema',
  'outputContract',
  'requiresApiKey',
  'requiresBank',
  'repairable',
];

describe('Command Registry', () => {
  it('exports exactly the six skill commands', () => {
    expect(COMMAND_NAMES).toEqual(['peel', 'matrix', 'wizard', 'score', 'bank', 'learn']);
    expect(COMMAND_REGISTRY).toHaveLength(6);
    expect(COMMAND_REGISTRY.map((c) => c.name)).toEqual(
      COMMAND_NAMES
    );
  });

  it('every command exposes all eight contract fields', () => {
    for (const command of COMMAND_REGISTRY) {
      for (const field of REQUIRED_FIELDS) {
        expect(command, `${command.name} missing ${field}`).toHaveProperty(field);
      }
      expect(typeof command.name).toBe('string');
      expect(typeof command.description).toBe('string');
      expect(command.description.length).toBeGreaterThan(0);
      expect(typeof command.inputSchema).toBe('object');
      expect(command.inputSchema).not.toBeNull();
      expect(typeof command.outputContract).toBe('object');
      expect(command.outputContract).not.toBeNull();
    }
  });

  it('every command declares a valid skill surface', () => {
    const valid = new Set(['writing', 'speaking', 'both']);
    for (const command of COMMAND_REGISTRY) {
      expect(valid.has(command.skill), `${command.name} skill=${command.skill}`).toBe(true);
    }
  });

  it('requiresApiKey is a function for every command', () => {
    for (const command of COMMAND_REGISTRY) {
      expect(typeof command.requiresApiKey).toBe('function');
    }
  });

  it('requiresBank and repairable are booleans for every command', () => {
    for (const command of COMMAND_REGISTRY) {
      expect(typeof command.requiresBank).toBe('boolean');
      expect(typeof command.repairable).toBe('boolean');
    }
  });

  it('only bank requires the question bank feature flag', () => {
    const flagged = COMMAND_REGISTRY.filter((c) => c.requiresBank);
    expect(flagged.map((c) => c.name)).toEqual(['bank']);
  });

  it('score never requires an api key; peel/matrix/wizard always do', () => {
    const sample = 'online education harms social skills';
    expect(requiresApiKey('score', sample)).toBe(false);
    expect(requiresApiKey('peel', sample)).toBe(true);
    expect(requiresApiKey('matrix', sample)).toBe(true);
    expect(requiresApiKey('wizard', sample)).toBe(true);
  });

  it('bank requires an api key only for the generative peel subcommand', () => {
    expect(requiresApiKey('bank', '/bank random')).toBe(false);
    expect(requiresApiKey('bank', '/bank search education')).toBe(false);
    expect(requiresApiKey('bank', '/bank links edu')).toBe(false);
    expect(requiresApiKey('bank', '/bank stats')).toBe(false);
    expect(requiresApiKey('bank', '/bank peel edu-001')).toBe(true);
    expect(requiresApiKey('bank', '/bank answer edu-001')).toBe(true);
    expect(requiresApiKey('bank', 'bank peel edu-001')).toBe(true);
  });

  it('bank replicates the existing app.js apiKey gate verbatim (preserves the \\b-after-CJK quirk)', () => {
    // CJK verbs (答/作答) are not matched because \b is a no-op between two
    // non-word characters. The registry is the single source of truth and must
    // match the current app.js bankNeedsApiKey behaviour exactly so the app
    // can derive validation from the registry without a behaviour change.
    expect(requiresApiKey('bank', '/bank 作答 edu-001')).toBe(false);
    expect(requiresApiKey('bank', '/bank 答 edu-001')).toBe(false);
  });

  it('bank bare keyword without peel verb does not require an api key', () => {
    expect(requiresApiKey('bank', '/bank education')).toBe(false);
  });

  it('marks the generative commands repairable and score not repairable', () => {
    expect(isRepairable('peel')).toBe(true);
    expect(isRepairable('matrix')).toBe(true);
    expect(isRepairable('wizard')).toBe(true);
    expect(isRepairable('score')).toBe(false);
    expect(isRepairable('bank')).toBe(true);
  });

  it('marks peel as the only token-streaming command in its output contract', () => {
    const peel = getCommandDefinition('peel');
    const matrix = getCommandDefinition('matrix');
    expect(peel.outputContract.streamable).toBe(true);
    expect(matrix.outputContract.streamable).toBe(false);
  });

  it('getCommandDefinition is case-insensitive and returns undefined for unknown', () => {
    expect(getCommandDefinition('PEEL').name).toBe('peel');
    expect(getCommandDefinition('Wizard').name).toBe('wizard');
    expect(getCommandDefinition('nope')).toBeUndefined();
  });

  it('requiresApiKey returns false for an unknown command', () => {
    expect(requiresApiKey('nope', 'anything')).toBe(false);
  });

  it('each inputSchema declares the command name and max input length', () => {
    for (const command of COMMAND_REGISTRY) {
      expect(command.inputSchema.command).toBe(command.name);
      expect(typeof command.inputSchema.maxInputChars).toBe('number');
      expect(command.inputSchema.maxInputChars).toBeGreaterThan(0);
    }
  });
});
