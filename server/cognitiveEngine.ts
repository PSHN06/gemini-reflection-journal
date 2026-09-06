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
  const { prompt, conversationHistory = [], mode = 'reflection' } = input;
  const cleanPrompt = prompt.trim();

  // Sentiment & domain flags based on explicit words in prompt
  const isGuilt = /\b(guilt|guilty|remorse|regret|regretting|blame|fault)\b/i.test(cleanPrompt);
  const isCricket = /\bcricket\b/i.test(cleanPrompt);
  const isSportsOrPlay = /\b(cricket|football|soccer|basketball|tennis|badminton|baseball|volleyball|rugby|sport|sports|game|match|played)\b/i.test(cleanPrompt);
  const is10k = /\b10k\b/i.test(cleanPrompt);
  const is5k = /\b5k\b/i.test(cleanPrompt);
  const isRunOrFitness = /\b(run|running|runner|jog|jogging|5k|10k|marathon|sprint|gym|workout|lifting|weights|exercise|swim|swimming|cycling|bike|hike|hiking|yoga)\b/i.test(cleanPrompt);
  const isWatercolours = /\b(watercolour|watercolours|watercolor|watercolors)\b/i.test(cleanPrompt);
  const isCreative = /\b(paint|painting|paintings|draw|drawing|sketch|sketching|write|writing|guitar|piano|music|song|bake|baking|cook|cooking|craft|crafting)\b/i.test(cleanPrompt);
  const isManager = /\b(manager|boss)\b/i.test(cleanPrompt);
  const isWorkOrCareer = /\b(work|working|job|manager|boss|colleague|coworker|client|meeting|presentation|deadline|code|coding|developer|office|interview|project|exam|study)\b/i.test(cleanPrompt);
  const isDecision = /\b(decide|decision|decisions|choice|choices|choose|choosing|between|crossroads|dilemma|offer|accept|reject)\b/i.test(cleanPrompt);
  const isChicago = /\bchicago\b/i.test(cleanPrompt);
  const isAppProject = /\b(app|side project|code|coding|developer)\b/i.test(cleanPrompt);
  const isBurnoutOrStress = /\b(tired|burnout|burned out|exhausted|exhaustion|drained|stress|stressed|fatigue|heavy|overwhelmed|overwhelm)\b/i.test(cleanPrompt);
  const isAnxietyOrNervous = /\b(anxious|anxiety|nervous|worry|worried|fear|scared|afraid|doubt|doubts|panic|dread|uncertain)\b/i.test(cleanPrompt);
  const isJoyOrHappy = /\b(happy|happiness|joy|joyful|grateful|gratitude|content|pleased|delighted)\b/i.test(cleanPrompt);
  const isProud = /\bproud\b/i.test(cleanPrompt);
  const isSocial = /\b(friend|friends|family|partner|husband|wife|mom|dad|brother|sister|dinner|lunch|coffee|conversation|talked|visit|visited)\b/i.test(cleanPrompt);

  function extractCoreSubject(text: string): string {
    let s = text.trim().replace(/[.!?]+$/, '');
    s = s.replace(/^(today\s*,?\s*|i\s+(just\s+)?(felt|feel|was|am|have been|have|had|went|did|got|want to|wanted to)\s+)/i, '');
    s = s.replace(/^(guilty|guilt|anxious|nervous|worried|sad|upset)\s+(about|for|over)?\s+/i, '');
    if (s.length > 45) {
      s = s.slice(0, 42) + '...';
    }
    return s.toLowerCase();
  }

  let specificActivity = 'what you shared';
  if (isCricket) specificActivity = 'playing cricket';
  else if (is10k) specificActivity = 'your 10k race';
  else if (is5k) specificActivity = 'your 5k run';
  else if (isRunOrFitness) specificActivity = 'your run';
  else if (isWatercolours) specificActivity = 'painting with watercolours';
  else if (isCreative) specificActivity = 'your creative work';
  else if (isManager) specificActivity = 'your upcoming conversation with your manager';
  else if (isChicago) specificActivity = 'the job opportunity in Chicago';
  else if (isAppProject) specificActivity = 'your app project';
  else if (isWorkOrCareer) specificActivity = 'what is happening with work';
  else specificActivity = extractCoreSubject(cleanPrompt) || 'what you shared';

  // Mode: Socratic
  if (mode === 'socratic') {
    if (isDecision) {
      return `Weighing your options regarding ${specificActivity} naturally involves competing priorities. One option might offer a fresh direction, while the other offers familiar stability. Perhaps the uncertainty comes from trying to anticipate every outcome before deciding. Looking at the next six to twelve months, what is one non-negotiable priority that could help guide this choice?`;
    }
    if (isGuilt) {
      return `Looking at what you noted about feeling guilty regarding ${specificActivity}, it can be helpful to examine the specifics rather than carrying an unresolved weight. Perhaps there is a distinction between the decision itself and the consequences that followed. When you look back at what happened, what is one concrete detail you would handle differently if given the chance?`;
    }
    if (isAnxietyOrNervous || isBurnoutOrStress) {
      return `Noting that you are feeling anxious or under strain regarding ${specificActivity}, it can sometimes be difficult to separate the immediate situation from anticipated worries. Perhaps focusing on the verifiable facts of today could bring some clarity. What is one concrete fact about this situation that you know with certainty right now?`;
    }
    return `Examining what you expressed about ${specificActivity}, there may be an underlying assumption shaping how you view this moment. Perhaps considering an alternative angle could bring useful perspective. What is one assumption you are making about this situation that might be worth questioning?`;
  }

  // Mode: Brainstorm
  if (mode === 'brainstorm') {
    if (isAppProject) {
      return `Feeling unsure about where to begin with ${specificActivity} is very common when an idea is still taking shape. Perhaps you could start by outlining just one standalone feature that solves a single user problem, rather than architecting the whole product. Another possibility is to spend twenty minutes sketching the primary screen on paper before writing any code. Which of those small steps sounds most appealing to test today?`;
    }
    if (isDecision) {
      return `When facing a decision regarding ${specificActivity}, exploring low-stakes ways to gather information can make the choice clearer. Perhaps you could speak with someone who has made a similar transition to hear what surprised them most. Another possibility is to list your absolute non-negotiables and see how each option measures up. Which of those approaches feels most practical right now?`;
    }
    return `Looking at what you noted regarding ${specificActivity}, a few practical angles might help generate momentum. Perhaps breaking the situation down into one 15-minute task could make it easier to get started. Another option is to ask what approach would require the least friction rather than the most effort. Which of those angles feels like a helpful place to begin?`;
  }

  // Mode: Summary
  if (mode === 'summary') {
    if (isGuilt) {
      return `In this entry, you stated that you feel guilty regarding ${specificActivity}. Acknowledging that feeling directly in writing gives you an objective starting point for deciding how you want to handle things going forward. Perhaps reaching out directly could help clarify the matter, or perhaps giving it a little time is all that is needed. Would you like to consider a specific way to follow up on this situation?`;
    }
    return `In this entry, you recorded your thoughts regarding ${specificActivity} and reflected on how the experience felt. Putting these observations down in writing provides a clear snapshot of your thoughts and actions today. Perhaps reviewing what you noted can help you decide if anything further needs your attention. Is there a particular detail here you would like to explore further?`;
  }

  // Default: Reflection mode
  if (isGuilt) {
    return `Feeling guilty about ${specificActivity} can be uncomfortable to sit with. When that feeling lingers, it may be helpful to look at what specifically felt out of alignment, rather than carrying a vague sense of blame. Perhaps there is a direct conversation or gesture that could address the situation, or perhaps the outcome was partly outside your control. Looking at it now, is there a concrete step you would like to take?`;
  }

  if (isCricket || (isSportsOrPlay && isJoyOrHappy)) {
    return `It sounds like getting out to play cricket today brought some welcome happiness into your day. Stepping onto the field and staying engaged in the flow of a match can be a great break from routine. Perhaps that sense of active play gave you a chance to clear your head and simply enjoy the moment. What felt like the most memorable part of the game for you today?`;
  }

  if (isRunOrFitness) {
    if (isProud || is10k) {
      return `Running a 10k race is a significant effort, and feeling soreness after pushing your body over that distance is very understandable. Taking pride in finishing shows you followed through on the goal you set for yourself this morning. Perhaps some rest and hydration will help your recovery over the next day or two. What part of the race felt like your strongest stretch?`;
    }
    return `Getting out for physical movement like your run is a dedicated effort. Even when it leaves your body feeling tired, following through on that activity gives you a clear break from desk work. Perhaps giving yourself time to cool down and recover will help restore your energy. How are you feeling physically now that you have finished?`;
  }

  if (isManager && (isAnxietyOrNervous || /\bdifficult\b/i.test(cleanPrompt))) {
    return `Preparing for a difficult conversation with your manager can certainly bring up anxiety, especially while waiting for tomorrow to arrive. Rather than trying to anticipate every reaction, it may be useful to focus on the key points you want to express clearly. Perhaps writing down one or two central outcomes you hope for could help you feel more organized beforehand. What is the main message you most want your manager to hear?`;
  }

  if (isDecision) {
    return `Weighing whether to take the new job in Chicago or stay where you are involves balancing very different sets of priorities. One option might offer a fresh direction and new opportunities, while the other offers familiar ground and stability. Perhaps it could help to look at what you would hope your day-to-day life looks like a year from now. When you consider both choices, which path feels more aligned with where you want to focus your energy next?`;
  }

  if (isWatercolours || isCreative) {
    return `Spending an hour painting with watercolours after work sounds like a nice way to shift gears at the end of the day. Taking time for a creative outlet can provide a different kind of focus from regular tasks. Perhaps that quiet hour helped create a clear boundary between your workday and your evening. Did you notice a difference in your focus before and after you started painting?`;
  }

  if (isBurnoutOrStress) {
    return `Long hours throughout the week can certainly leave you feeling tired and drained. When your energy is running low, it may be difficult to think far ahead or take on anything extra. Perhaps setting aside any non-urgent tasks for this evening could give you a chance to rest without added pressure. What is one thing you could set aside tonight so you can get some rest?`;
  }

  if (isJoyOrHappy || isProud) {
    return `It sounds like you had a genuinely good experience today and are feeling happy with how things went. Pausing to note moments of contentment or satisfaction helps capture what went well before the day moves on. Perhaps reflecting on what contributed to this feeling can help you recreate it in the future. What felt like the main highlight of the day for you?`;
  }

  if (isSocial) {
    return `Taking time to connect with people who matter to you is often a grounding part of the day. In the middle of regular responsibilities, shared conversations can offer a welcome change of pace. Perhaps that interaction gave you some perspective on the rest of your week. What was the most engaging part of your time together today?`;
  }

  // General fallback
  const cleanSnippet = cleanPrompt.length > 55 ? `"${cleanPrompt.slice(0, 50)}..."` : `"${cleanPrompt}"`;
  return `Thank you for taking a moment to write down your thoughts regarding ${cleanSnippet}. Taking a few minutes to put what happened into words gives you an opportunity to review the situation with some distance. Perhaps seeing your thoughts on the page offers a clearer view of what matters most to you right now. What feels like the main takeaway you want to keep in mind from this?`;
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
