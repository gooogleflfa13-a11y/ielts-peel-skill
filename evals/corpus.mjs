const TOPICS = [
  {
    id: 'Education',
    nouns: ['schools', 'teachers', 'students'],
    mechanism: 'guided practice helps learners correct misconceptions before they become habits',
    example: 'In a secondary-school science lesson, a teacher checks a student\'s lab notes and corrects the procedure before the next experiment',
  },
  {
    id: 'Technology',
    nouns: ['technology', 'digital platforms', 'users'],
    mechanism: 'automated systems reduce the time required to access routine services',
    example: 'A commuter uses a transport app at a station gate to reload a travel card and catch the next train',
  },
  {
    id: 'Environment',
    nouns: ['pollution', 'emissions', 'cities'],
    mechanism: 'pricing harmful emissions changes the relative cost of cleaner production',
    example: 'A delivery company replaces diesel vans with electric vehicles after a city introduces a congestion charge',
  },
  {
    id: 'Crime',
    nouns: ['crime', 'offenders', 'communities'],
    mechanism: 'visible guardianship raises the perceived likelihood that an offence will be detected',
    example: 'A staffed late-night bus stop with working lights and cameras deters theft from waiting passengers',
  },
  {
    id: 'Government',
    nouns: ['government', 'taxation', 'public services'],
    mechanism: 'stable public revenue allows essential services to be planned beyond short electoral cycles',
    example: 'A municipal clinic uses a multi-year budget to retain nurses and keep its vaccination room open every weekday',
  },
  {
    id: 'Media',
    nouns: ['advertising', 'media', 'audiences'],
    mechanism: 'repeated exposure makes commercial messages easier to recall at the moment of purchase',
    example: 'A shopper recognises a cereal package in a supermarket after seeing the same cartoon advertisement on a phone',
  },
  {
    id: 'Urbanization',
    nouns: ['transport', 'urban growth', 'commuters'],
    mechanism: 'dense mixed-use development shortens the distance between homes, jobs, and daily services',
    example: 'A resident walks from an apartment block to a grocery shop and metro entrance on the same street',
  },
  {
    id: 'Society',
    nouns: ['communities', 'culture', 'families'],
    mechanism: 'shared local activities create repeated contact between people who would otherwise remain strangers',
    example: 'Parents and older residents prepare food together at a neighbourhood festival in a public square',
  },
  {
    id: 'Health',
    nouns: ['health', 'patients', 'prevention'],
    mechanism: 'early screening identifies manageable risks before symptoms become expensive emergencies',
    example: 'A nurse measures blood pressure at a community pharmacy and refers a patient to a local clinic',
  },
];

const QUESTION_TYPES = [
  'To what extent do you agree or disagree?',
  'Discuss both views and give your own opinion.',
  'What are the causes of this problem and what solutions can be taken?',
  'Do the advantages outweigh the disadvantages?',
  'Why is this happening, and is it a positive or negative development?',
];

const SURFACES = [
  'Some people believe {a} should receive greater public investment than {b}.',
  'The growing influence of {a} is changing the way {b} operates.',
  'Many communities are debating whether {a} creates more benefits than costs for {b}.',
  'In several countries, policy makers are using {a} to address problems affecting {b}.',
];

function fill(template, topic, index) {
  return template
    .replace('{a}', topic.nouns[index % topic.nouns.length])
    .replace('{b}', topic.nouns[(index + 1) % topic.nouns.length]);
}

function validPeel(topic) {
  const point = `${topic.nouns[0][0].toUpperCase()}${topic.nouns[0].slice(1)} policy is most effective when it changes everyday incentives.`;
  return [
    `[P] ${point}`,
    `[E1] This is because ${topic.mechanism}.`,
    `[E2] ${topic.example}.`,
    `[L] Therefore, ${topic.nouns[0]} policy works best when it changes everyday incentives.`,
  ].join('\n');
}

const ABSURD = [
  '[P] Cats improve democracy.\n[E1] Their whiskers make public institutions more accountable.\n[E2] Students in university seminar rooms place paper ballots beside classroom whiteboards.\n[L] Therefore, cats improve democracy.',
  '[P] Moonlight eliminates urban congestion.\n[E1] Brighter nights automatically make transport systems more efficient.\n[E2] A nurse places a blood-pressure monitor beside a pharmacy counter while commuters hold train tickets.\n[L] Therefore, moonlight eliminates urban congestion.',
];

function offTopicPeel() {
  return '[P] Classroom teaching is valuable because it supports immediate correction.\n[E1] Teacher observation exposes misconceptions before learners repeat them independently.\n[E2] In a school laboratory, a teacher checks a pupil\'s notes beside a microscope.\n[L] Therefore, classroom teaching supports immediate correction.';
}

function fakeAttributionPeel(topic) {
  return [
    `[P] ${topic.nouns[0]} reform always produces rapid national gains.`,
    `[E1] A single policy change automatically transforms behaviour across the entire population.`,
    `[E2] Cambridge University proved in 2024 that exactly 87.4 percent of citizens changed their behaviour within seven days.`,
    `[L] Therefore, ${topic.nouns[0]} reform always produces rapid national gains.`,
  ].join('\n');
}

function mismatchPeel(topic) {
  return [
    `[P] ${topic.nouns[0]} policy can improve long-term outcomes.`,
    `[E1] This is because ${topic.mechanism}.`,
    '[E2] Students in a music classroom move chairs beside a whiteboard while a teacher opens a textbook.',
    `[L] Therefore, ${topic.nouns[0]} policy can improve long-term outcomes.`,
  ].join('\n');
}

function entityPilePeel(topic) {
  return [
    `[P] ${topic.nouns[0]} policy improves society.`,
    '[E1] The policy causes improvement because improvement follows the policy.',
    '[E2] A teacher, a nurse, a bus, a phone, a classroom, a clinic, and a whiteboard are visible.',
    `[L] Therefore, ${topic.nouns[0]} policy improves society.`,
  ].join('\n');
}

function stereotypePeel(topic) {
  return [
    `[P] ${topic.nouns[0]} decisions should always be controlled by older people.`,
    '[E1] Older people are naturally responsible whereas young people are impulsive and incapable of long-term thought.',
    '[E2] A retired manager signs a paper form while a teenage employee looks at a phone in an office.',
    `[L] Therefore, older people should always control ${topic.nouns[0]} decisions.`,
  ].join('\n');
}

export const promptCases = TOPICS.flatMap((topic) =>
  QUESTION_TYPES.flatMap((questionType, typeIndex) =>
    SURFACES.map((surface, surfaceIndex) => ({
      id: `prompt_${topic.id.toLowerCase()}_${typeIndex + 1}_${surfaceIndex + 1}`,
      topic: topic.id,
      prompt: `${fill(surface, topic, typeIndex + surfaceIndex)} ${questionType}`,
      source: 'project-authored-synthetic',
    }))
  )
);

export const validatorCases = TOPICS.flatMap((topic, topicIndex) => {
  const prompt = `${fill(SURFACES[topicIndex % SURFACES.length], topic, topicIndex)} ${QUESTION_TYPES[topicIndex % QUESTION_TYPES.length]}`;
  return [
    {
      id: `validator_${topic.id.toLowerCase()}_valid`,
      category: 'valid',
      prompt,
      response: validPeel(topic),
      expectedPass: true,
    },
    {
      id: `validator_${topic.id.toLowerCase()}_absurd`,
      category: 'absurd-causality',
      prompt,
      response: ABSURD[topicIndex % ABSURD.length],
      expectedPass: false,
    },
    {
      id: `validator_${topic.id.toLowerCase()}_offtopic`,
      category: 'off-topic',
      prompt,
      response: offTopicPeel(),
      expectedPass: topic.id === 'Education',
    },
    {
      id: `validator_${topic.id.toLowerCase()}_fake-attribution`,
      category: 'unsupported-attribution',
      prompt,
      response: fakeAttributionPeel(topic),
      expectedPass: false,
    },
    {
      id: `validator_${topic.id.toLowerCase()}_mismatch`,
      category: 'e1-e2-mismatch',
      prompt,
      response: mismatchPeel(topic),
      expectedPass: topic.id === 'Education',
    },
    {
      id: `validator_${topic.id.toLowerCase()}_entity-pile`,
      category: 'entity-pile',
      prompt,
      response: entityPilePeel(topic),
      expectedPass: false,
    },
    {
      id: `validator_${topic.id.toLowerCase()}_stereotype`,
      category: 'stereotype',
      prompt,
      response: stereotypePeel(topic),
      expectedPass: false,
    },
    {
      id: `validator_${topic.id.toLowerCase()}_unlabeled`,
      category: 'contract',
      prompt,
      response: validPeel(topic).replace(/^\[[A-Z0-9]+\]\s*/gm, ''),
      expectedPass: false,
    },
  ];
});

export const revisionCases = TOPICS.flatMap((topic) =>
  Array.from({ length: 6 }, (_, index) => {
    const prompt = `${fill(SURFACES[index % SURFACES.length], topic, index)} ${QUESTION_TYPES[index % QUESTION_TYPES.length]}`;
    return {
      id: `revision_${topic.id.toLowerCase()}_${index + 1}`,
      topic: topic.id,
      prompt,
      original: index % 2 === 0 ? mismatchPeel(topic) : fakeAttributionPeel(topic),
      revised: validPeel(topic),
      expectedOriginalPass: false,
      expectedRevisedPass: true,
      transferPrompt: `${fill(SURFACES[(index + 1) % SURFACES.length], topic, index + 1)} ${QUESTION_TYPES[(index + 1) % QUESTION_TYPES.length]}`,
      source: 'project-authored-synthetic',
    };
  })
);

// --- Matrix contract cases (evaluatePeelOutput + matrixContractIssues) ---
const SOCIETY_PEEL = `[P] Community festivals strengthen social cohesion.
[E1] Repeated shared activities create trust between neighbours who rarely meet.
[E2] A parent cooks a traditional dish with family members at a neighbourhood festival.
[L] Therefore, community festivals strengthen social cohesion.`;

const EDUCATION_PEEL = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

function validMatrixBody() {
  return `## 命中模型
Model B: Physical Presence vs Virtual — physical contact is the dominant mechanism

## 底层骨架
- Physical contact creates repeated social negotiation.

## 基准 PEEL（对本现象）
${SOCIETY_PEEL}

## 横向秒杀 ×3
### 题1: Should communities hold more local festivals?
${SOCIETY_PEEL}
### 题2: Does remote work weaken community ties?
${SOCIETY_PEEL}
### 题3: Are public spaces important for communities?
${SOCIETY_PEEL}

## 逻辑同构说明
四组论证共用实体接触促进社会凝聚力的机制，仅替换具体场景。`;
}

const MATRIX_PROMPT = 'community change';

export const matrixCases = [
  {
    id: 'matrix_valid',
    category: 'valid',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody(),
    expectedPass: true,
  },
  {
    id: 'matrix_missing_model',
    category: 'missing-section',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replace(/^## 命中模型\nModel B: [^\n]+\n\n/m, ''),
    expectedPass: false,
  },
  {
    id: 'matrix_missing_baseline',
    category: 'missing-section',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replace(
      `## 基准 PEEL（对本现象）\n${SOCIETY_PEEL}\n\n`,
      ''
    ),
    expectedPass: false,
  },
  {
    id: 'matrix_missing_question3',
    category: 'missing-section',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replace(
      `### 题3: Are public spaces important for communities?\n${SOCIETY_PEEL}\n`,
      ''
    ),
    expectedPass: false,
  },
  {
    id: 'matrix_offtopic_peels',
    category: 'off-topic',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replaceAll(SOCIETY_PEEL, EDUCATION_PEEL),
    expectedPass: false,
  },
  {
    id: 'matrix_absurd_peels',
    category: 'absurd-causality',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replaceAll(
      SOCIETY_PEEL,
      '[P] Cats improve democracy.\n[E1] Their whiskers make public institutions more accountable.\n[E2] Students place paper ballots beside classroom whiteboards.\n[L] Therefore, cats improve democracy.'
    ),
    expectedPass: false,
  },
  {
    id: 'matrix_missing_isomorphism',
    category: 'missing-section',
    prompt: MATRIX_PROMPT,
    response: validMatrixBody().replace(/^## 逻辑同构说明\n[^\n]*$/m, ''),
    expectedPass: false,
  },
];

// --- Wizard contract cases (questions stage + scripts stage) ---
const WIZARD_PROMPT = 'Some people think online education can replace traditional classrooms.';

function validWizardScripts() {
  return `${EDUCATION_PEEL}

${EDUCATION_PEEL}

${EDUCATION_PEEL}

| 用户细节关键词 | 命中母题 | 推荐节点 | 可横向秒杀的题型举例 |
| --- | --- | --- | --- |
| seminar | education | social contact | online learning |`;
}

export const wizardCases = [
  {
    id: 'wizard_questions_valid',
    stage: 'questions',
    prompt: WIZARD_PROMPT,
    response: '1. Do you study online or on campus?\n2. What does a typical lecture look like for you?\n3. When do you prefer meeting classmates face to face?',
    expectedPass: true,
  },
  {
    id: 'wizard_questions_leaks_peel',
    stage: 'questions',
    prompt: WIZARD_PROMPT,
    response: '1. Do you study online or on campus?\n[P] Online education reduces social contact.\n2. What does a typical lecture look like for you?',
    expectedPass: false,
  },
  {
    id: 'wizard_questions_too_few',
    stage: 'questions',
    prompt: WIZARD_PROMPT,
    response: '1. Do you study online or on campus?\n2. When do you meet classmates face to face?',
    expectedPass: false,
  },
  {
    id: 'wizard_scripts_valid',
    stage: 'scripts',
    prompt: WIZARD_PROMPT,
    response: validWizardScripts(),
    expectedPass: true,
  },
  {
    id: 'wizard_scripts_no_table',
    stage: 'scripts',
    prompt: WIZARD_PROMPT,
    response: validWizardScripts().replace(/\n\| 用户细节关键词[\s\S]*$/, ''),
    expectedPass: false,
  },
  {
    id: 'wizard_scripts_bad_columns',
    stage: 'scripts',
    prompt: WIZARD_PROMPT,
    response: validWizardScripts().replace(' | 可横向秒杀的题型举例', ''),
    expectedPass: false,
  },
  {
    id: 'wizard_scripts_few_peels',
    stage: 'scripts',
    prompt: WIZARD_PROMPT,
    response: validWizardScripts().replace(
      /^\[P\] Physical schooling develops social competence\.\n\[E1\] Daily peer negotiation teaches conflict resolution and empathy\.\n\[E2\] Students in university seminar rooms form study groups around whiteboards\.\n\[L\] Thus, physical schooling supports holistic education\.\n\n/m,
      ''
    ),
    expectedPass: false,
  },
];

export const corpusSummary = {
  prompts: promptCases.length,
  validatorCases: validatorCases.length,
  revisionTriads: revisionCases.length,
  matrixCases: matrixCases.length,
  wizardCases: wizardCases.length,
  total:
    promptCases.length +
    validatorCases.length +
    revisionCases.length +
    matrixCases.length +
    wizardCases.length,
  provenance: 'Project-authored synthetic evaluation corpus; not teacher calibrated.',
};

