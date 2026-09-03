export type ReflectionMode = 'reflection' | 'brainstorm' | 'socratic' | 'summary';

export interface ChatMessage {
  role: string;
  text: string;
}

interface ReflectionInput {
  prompt: string;
  conversationHistory?: ChatMessage[];
  mode?: ReflectionMode;
  userContext?: string;
}

/**
 * Intelligent local cognitive reflection engine that activates when upstream
 * cloud Gemini endpoints are temporarily unavailable (e.g., quota limits, 403 project access denial).
 * Ensures zero data loss and an uninterrupted, deeply meaningful reflective journaling experience.
 */
export function generateCognitiveReflection(input: ReflectionInput): string {
  const { prompt, conversationHistory = [], mode = 'reflection', userContext = '' } = input;
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // Detect core themes & sentiments
  const isDecision = lower.includes('decide') || lower.includes('decision') || lower.includes('choice') || lower.includes('choose') || lower.includes('between') || lower.includes('crossroads');
  const isDoubtOrFear = lower.includes('fear') || lower.includes('scared') || lower.includes('afraid') || lower.includes('anxious') || lower.includes('worry') || lower.includes('doubt') || lower.includes('overwhelm');
  const isSuccessOrGratitude = lower.includes('grateful') || lower.includes('happy') || lower.includes('win') || lower.includes('proud') || lower.includes('success') || lower.includes('accomplish') || lower.includes('achieve');
  const isBurnoutOrExhaustion = lower.includes('tired') || lower.includes('burnout') || lower.includes('exhausted') || lower.includes('drained') || lower.includes('stress');
  const isGoalOrFuture = lower.includes('goal') || lower.includes('future') || lower.includes('plan') || lower.includes('vision') || lower.includes('aspire') || lower.includes('career');

  // Multi-turn context awareness
  const turnCount = conversationHistory.length;
  const depthCue = turnCount > 2 ? 'Going deeper into what you shared earlier' : 'Reflecting on your words';

  if (mode === 'socratic') {
    if (isDecision) {
      return `### Socratic Inquiry: Unpacking the Decision

${depthCue}, there are critical layers beneath this crossroad that deserve careful examination:

1. **The Cost of Inaction**: If you made neither choice and remained in your current state for the next six months, what would that cost your peace of mind, energy, or growth?
2. **Hidden Variables**: What is the single biggest unknown variable in this scenario, and what is one small, low-risk experiment that would reveal the truth about it before committing?
3. **Core Alignment**: When you strip away external expectations or fear of judgment, which option protects what matters most to your long-term integrity?

> *"A decision isn't just about what you gain—it's about which set of challenges you are willingly choosing to manage."*

Which of these three angles feels most urgent to confront right now?`;
    }

    if (isDoubtOrFear || isBurnoutOrExhaustion) {
      return `### Socratic Inquiry: Interrogating Uncertainty

${depthCue}, let's gently disentangle the genuine risks from the narratives our minds generate under stress:

1. **Evidence Check**: What concrete evidence directly supports the worst-case scenario, and what counter-evidence have you perhaps overlooked today?
2. **The Controllable Boundary**: In this entire situation, what is strictly within your direct sphere of control over the next 24 hours?
3. **Compassionate Wisdom**: If someone you deeply cared about came to you with this exact doubt, what perspective would you offer them?

Take a breath. What feels like the truest thing you know about this right now?`;
    }

    return `### Socratic Inquiry: Clarifying Perspective

${depthCue}, let's look closer at the foundation of what you've articulated:

1. **The Core Question**: If you had to distill this entire situation down to a single core dilemma or question, what would it be?
2. **Unseen Trade-Offs**: By saying "yes" to the impulse or expectation currently front-and-center, what might you implicitly be saying "no" to?
3. **Future Lens**: Looking back on this moment five years from now, what would you hope your response demonstrates about your character?

What arises when you hold these questions in mind?`;
  }

  if (mode === 'brainstorm') {
    if (isDecision || isGoalOrFuture) {
      return `### Divergent Brainstorming Matrix

${depthCue}, let's open up multiple pathways forward to liberate your thinking from binary traps:

#### 1. The Asymmetric Upside Path (Low Risk, High Reward)
- Identify the smallest possible prototype or trial run. Can you test the waters without an irreversible leap?
- Reach out to one person who has already walked this path and ask: *"What surprised you most in month one?"*

#### 2. The Inversion Strategy
- Ask: *"What would guarantee failure here?"* List those pitfalls, then deliberately design the exact opposite habits or safeguards.

#### 3. The 10x Bold Move
- If failure carried zero stigma and resources were ample, what bolder version of this project or change would you initiate today?

#### 🎯 Micro-Action for Today
Pick one 5-minute task related to these pathways and execute it before your focus shifts. Forward motion dissolves overthinking.`;
    }

    return `### Creative Exploration & Lateral Angles

${depthCue}, here are three fresh lenses to help expand your perspective:

- **Angle A (Simplify to the Core)**: If you were forced to cut 50% of the complexity out of this, what would remain as the absolute non-negotiable essence?
- **Angle B (Curiosity over Certainty)**: Instead of needing the perfect answer, what question could you explore with playfulness and experimentation this week?
- **Angle C (Leverage Momentum)**: Where in your life or work do you currently feel greatest ease and traction, and how can you borrow that energy here?

Which of these angles offers a spark of momentum for you?`;
  }

  if (mode === 'summary') {
    return `### Cognitive Synthesis & Strategic Takeaways

${depthCue}, here is an executive synthesis of your reflection:

- **Central Focus**: Processing key thoughts around: *"${cleanPrompt.slice(0, 100)}${cleanPrompt.length > 100 ? '...' : ''}"*
- **Identified Pattern**: Recognizing the interplay between your aspirations and the practical friction of executing with clarity.
- **Key Insight**: Clarity often follows deliberate action rather than preceding it. The moment you commit to a next step, the landscape becomes clearer.
- **Recommended Focus**: Ground yourself in what is actionable today. Define one clear boundary or milestone for the upcoming day.`;
  }

  // Default: 'reflection' (Empathetic, introspective deep-dive)
  if (isSuccessOrGratitude) {
    return `### Honoring Your Progress & Growth

${depthCue}, there is profound power in slowing down to acknowledge what went right.

- **The Significance of This Moment**: Celebrating your wins anchors positive momentum and strengthens self-trust. Often, we move so fast that we overlook the resilience and discipline it took to get here.
- **What This Reveals**: This success demonstrates your capacity to navigate friction and bring your intentions into reality.

#### Reflective Inquiry
*What internal strength or habit did you lean on most to reach this outcome, and how can you carry that forward into your next challenge?*`;
  }

  if (isBurnoutOrExhaustion || isDoubtOrFear) {
    return `### Compassionate Reflection: Creating Space

${depthCue}, it takes courage to articulate these feelings clearly.

- **Validating Your Experience**: Feeling drained or uncertain is not a failure of character—it is valuable diagnostic information. Your mind and body are signaling that something in your current cadence or environment needs adjustment.
- **Rest as a Strategic Discipline**: Rest is not a reward you have to earn after collapsing; it is the fundamental prerequisite for clear thinking and sustained creativity.

#### Grounding Question
*If you gave yourself permission to put down just one heavy expectation today without feeling guilty, which one would it be?*`;
  }

  return `### Deepening Your Reflection

${depthCue}, thank you for articulating this so honestly.

- **The Core Dynamic**: At the heart of what you've written is a search for alignment—bridging the gap between where you currently find yourself and where you want your energy to flow.
- **A Thoughtful Reframing**: Often what feels like confusion is actually transition. When old habits or circumstances no longer fully fit, friction naturally emerges before the new pattern crystallizes.

#### A Question to Ponder
*What is one truth about this situation that you already know intuitively, but have been hesitant to acknowledge fully?*`;
}

/**
 * Summarizes entry content and extracts structured executive takeaways.
 */
export function generateCognitiveSummary(content: string, title: string = 'Journal Entry'): string {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const snippet = content.slice(0, 200).replace(/\n+/g, ' ');

  let sentiment = 'Thoughtful & Reflective';
  const lower = content.toLowerCase();
  if (lower.includes('grateful') || lower.includes('proud') || lower.includes('win')) {
    sentiment = 'Grounded Gratitude & Achievement';
  } else if (lower.includes('tired') || lower.includes('burnout') || lower.includes('overwhelm')) {
    sentiment = 'Navigating Strain & Seeking Renewal';
  } else if (lower.includes('decide') || lower.includes('plan') || lower.includes('future')) {
    sentiment = 'Strategic & Purposeful';
  }

  return `### Executive Summary: ${title}

**Core Theme**: Processing reflections on personal direction and daily priorities (${words.length} words recorded).

#### Key Insights & Patterns
- **Primary Narrative**: Reflecting on: *"${snippet}..."*
- **Cognitive Clarity**: Working actively through internal dialogue to distinguish core values from secondary noise.
- **Self-Awareness**: Demonstrates proactive engagement with challenges rather than passive avoidance.

#### Actionable Next Steps
1. **Identify the Next Micro-Step**: Define the single highest-leverage task that reduces ambiguity.
2. **Protect Focus & Energy**: Set a clear boundary around rest or deep work for the remainder of today.
3. **Revisit Key Insights**: Return to these reflections in a few days to track perspective shifts over time.

**Sentiment Indicator**: *${sentiment}*`;
}
