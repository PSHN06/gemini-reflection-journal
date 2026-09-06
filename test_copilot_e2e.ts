import assert from 'node:assert/strict';

async function testCopilotEndpoint() {
  console.log('--- Starting Copilot End-to-End Verification ---');

  const testCases = [
    {
      id: 1,
      prompt: 'I have a doubt',
      expectedKeywords: [/clarif|help|writing|question|app/i],
    },
    {
      id: 2,
      prompt: 'Will you clarify my doubt?',
      expectedKeywords: [/clarif|help|writing|question|app|certainly|glad/i],
    },
    {
      id: 3,
      prompt: 'What shall I write about today?',
      expectedKeywords: [/write|prompt|moment|feeling|today|reflection/i],
    },
    {
      id: 4,
      prompt: 'Give me a funny writing prompt',
      expectedKeywords: [/prompt|movie|warning|humor|funny|laugh|absurd|tagline|draft|amusing|scenario|imagine|story/i],
    },
    {
      id: 5,
      prompt: 'Why are there five emotions in my landscape?',
      expectedKeywords: [/landscape|emotion|node|strand|theme|quote|celestial|universe/i],
    },
    {
      id: 6,
      prompt: 'How do Temporal Tapes unlock?',
      expectedKeywords: [/tape|condition|streak|stress|focus|telemetry|evaluat|unlock/i],
    },
    {
      id: 7,
      prompt: 'Summarize my current entry',
      entryContext: {
        id: 'test-1',
        title: 'Morning Reflections on Transition',
        content: 'I decided to take the leap into a new creative role today. There is some trepidation about the unknown, but also a deep sense of relief after making the decision.',
      },
      expectedKeywords: [/transition|creative|role|decision|trepidation|relief|unknown|summar/i],
    },
    {
      id: 8,
      prompt: 'What is the main theme of what I wrote?',
      entryContext: {
        id: 'test-1',
        title: 'Morning Reflections on Transition',
        content: 'I decided to take the leap into a new creative role today. There is some trepidation about the unknown, but also a deep sense of relief after making the decision.',
      },
      expectedKeywords: [/theme|transition|change|courage|career|decision|relief|uncertainty/i],
    },
    {
      id: 9,
      prompt: 'Suggest a title for this entry',
      entryContext: {
        id: 'test-1',
        title: '',
        content: 'I spent the entire afternoon walking through the pine forest after the first snowfall. The silence between the trees felt completely restoring.',
      },
      expectedKeywords: [/title|forest|snow|silence|winter|pine|restor/i],
    },
    {
      id: 10,
      prompt: 'Are my entries stored privately?',
      expectedKeywords: [/private|privately|cloud|firestore|account|authenticated|user/i],
    },
    {
      id: 11,
      prompt: 'Can I upload a PDF?',
      expectedKeywords: [/pdf|attachment|5|file|mb/i],
    },
    {
      id: 12,
      prompt: 'Can I use emojis in my entry?',
      expectedKeywords: [/emoji|picker|cursor|insert/i],
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    console.log(`\nTesting Case ${tc.id}: "${tc.prompt}"...`);

    const payload: any = {
      message: tc.prompt,
      prompt: tc.prompt,
      currentView: 'journal',
      mode: tc.id <= 4 || tc.id >= 10 ? 'guide' : 'companion',
    };

    if (tc.entryContext) {
      payload.entryId = tc.entryContext.id;
      payload.entryTitle = tc.entryContext.title;
      payload.entryContent = tc.entryContext.content;
      payload.entryContext = tc.entryContext;
    }

    const res = await fetch('http://localhost:3000/api/copilot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer preview_guest_e2e_tester',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();

    const text = data.reply || data.content || data.text;
    assert.ok(text && text.length > 20, `Expected non-empty reply, got: "${text}"`);

    // Verify it is NOT the old generic catch-all
    assert.notEqual(
      text.trim(),
      "I am here as your writing companion and application guide. You can ask me questions about your current entry, how Temporal Tapes or the Emotional Landscape work, or ask for a gentle reflection prompt whenever you're ready to write.",
      'Must NOT return the old static catch-all sentence'
    );

    // Verify keywords
    for (const kw of tc.expectedKeywords) {
      assert.match(text, kw, `Expected response to match ${kw}`);
    }

    console.log(`  ✓ Case ${tc.id} Passed!`);
    console.log(`    Model used: ${data.modelUsed} (usedFallback: ${data.usedFallback})`);
    console.log(`    Preview reply: "${text.slice(0, 100).replace(/\n/g, ' ')}..."`);
    passed++;
  }

  // Test error handling: empty message should return 400
  console.log('\nTesting Case 13: Empty message rejection...');
  const emptyRes = await fetch('http://localhost:3000/api/copilot/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer preview_guest_e2e_tester',
    },
    body: JSON.stringify({ message: '   ' }),
  });
  assert.equal(emptyRes.status, 400, 'Empty message should return 400');
  console.log('  ✓ Case 13 Passed: Empty message rejected with 400');

  // Test error handling: missing authorization header should return 401
  console.log('\nTesting Case 14: Missing authorization rejection...');
  const unauthRes = await fetch('http://localhost:3000/api/copilot/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert.equal(unauthRes.status, 401, 'Missing token should return 401');
  console.log('  ✓ Case 14 Passed: Missing auth rejected with 401');

  console.log(`\n========================================`);
  console.log(` ALL ${passed + 2} COPILOT END-TO-END TESTS PASSED! `);
  console.log(`========================================\n`);
}

testCopilotEndpoint().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
