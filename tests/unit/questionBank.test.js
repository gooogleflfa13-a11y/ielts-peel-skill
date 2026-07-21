import { describe, it, expect } from 'vitest';
import {
  randomQuestion,
  searchTopics,
  analyzeLinks,
  stats,
  toPeelInput,
  getTopicById,
} from '../../server/knowledge/questionBank.js';

describe('question warehouse', () => {
  it('loads stats from embedded bank', () => {
    const s = stats();
    expect(s.meta.counts.part1_topics).toBeGreaterThan(20);
    expect(s.meta.counts.part2_topics).toBeGreaterThan(20);
    expect(s.meta.surface).toBe('embedded_data_plane');
  });

  it('draws random P2 with cue card', () => {
    const q = randomQuestion({ part: 'P2' });
    expect(q).toBeTruthy();
    expect(q.part).toBe('P2');
    expect(q.prompt).toBeTruthy();
    expect(q.ref).toMatch(/^p2_/);
  });

  it('searches by keyword', () => {
    const hits = searchTopics('music');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].topic.toLowerCase()).toMatch(/music|音乐/);
  });

  it('analyzes horizontal/vertical links', () => {
    const q = randomQuestion({ part: 'P2', keyword: 'traffic' });
    expect(q).toBeTruthy();
    const graph = analyzeLinks(q.ref);
    expect(graph.focus.ref).toBe(q.ref);
    expect(graph.analysis.horizontal).toBeTruthy();
    expect(graph.analysis.vertical).toBeTruthy();
  });

  it('builds peel input from warehouse topic', () => {
    const hits = searchTopics('traffic');
    const topic = getTopicById(hits[0].ref);
    const input = toPeelInput(topic);
    expect(input.length).toBeGreaterThan(10);
  });
});
