import { JournalEntry } from '../types';

export const BENCHMARK_ENTRIES: JournalEntry[] = [
  {
    id: 'benchmark-incident-horizon',
    userId: 'default',
    title: 'Incident Horizon',
    content: `Today went well because I gave myself permission to slow down and observe. I felt surprisingly calm through the day. I could really focus on what mattered most. There's still this pressure building inside me about what comes next. I'm genuinely grateful for the little things that kept me grounded. Small moments today made me happy and reminded me of who I want to be.`,
    createdAt: 1725364800000,
    updatedAt: 1725364800000,
    mode: 'reflection',
    tags: ['mindfulness', 'clarity', 'gratitude'],
    mood: 'peaceful',
    messages: [
      {
        id: 'bench-msg-1',
        role: 'user',
        text: 'Today went well because I gave myself permission to slow down and observe. I felt surprisingly calm through the day.',
        timestamp: 1725364810000,
      },
      {
        id: 'bench-msg-2',
        role: 'model',
        text: 'Slowing down allowed you to witness both the quiet calm and the underlying pressures with clear awareness.',
        timestamp: 1725364820000,
      },
    ],
  },
  {
    id: 'benchmark-cricket-gathering',
    userId: 'default',
    title: 'Saturday Cricket & Quiet Exhaustion',
    content: `I played cricket today with my friends at the park. We were down in the final overs, but I hit the winning boundary. Quiet relief washed over me after hours of physical tension. I felt so happy and exhausted afterwards, sharing dinner with my family and feeling grateful for this life.`,
    createdAt: 1725278400000,
    updatedAt: 1725278400000,
    mode: 'reflection',
    tags: ['cricket', 'family', 'joy'],
    mood: 'joyful',
    messages: [],
  },
  {
    id: 'benchmark-exam-career',
    userId: 'default',
    title: 'Academic Focus & Career Horizon',
    content: `Late night studying for the upcoming examinations. My thoughts kept spinning with overthinking about my career path and whether I am doing enough. Yet as I reviewed the concepts, a deep academic focus and renewed motivation took over, replacing confusion with quiet clarity and hope for what lies ahead.`,
    createdAt: 1725192000000,
    updatedAt: 1725192000000,
    mode: 'reflection',
    tags: ['studies', 'career', 'focus'],
    mood: 'contemplative',
    messages: [],
  },
];
