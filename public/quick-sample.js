// Public fictional material for trying the same editor and exports as a real draft.
export const QUICK_LIST_SAMPLE = '4. Inspect the article\n  - Compare facts\n    + Keep uncertainty\n  - Check links\n5. Prepare the handoff\n  7) Paste the blocks\n  8) Preview the post';
export const QUICK_TABLE_SAMPLE = '| Step | Keep |\n| :--- | :--- |\n| Observation | What happened |\n| Interpretation | What you think it means |\n| Next check | What remains uncertain |';
export const QUICK_SAMPLE = Object.freeze({
  title: 'A simpler way to keep a project log',
  excerpt: 'A fictional guide to keeping a short, useful project log.',
  description: 'A fictional sample showing headings, nested lists, a table, quotes, and links before a manual WordPress handoff.',
  slug: 'a-simpler-project-log',
  body: 'This is a **fictional sample article**. Replace it with your own writing before publishing.\n\n## Keep the useful details\n\nA project log can be short. Record the decision, what prompted it, and what you need to check next.\n\n- What changed?\n- Why did it change?\n- What remains uncertain?\n\n## Make the next step clear\n\n1. Write one observation.\n2. Separate the observation from your interpretation.\n3. Name the next thing to check.\n\n> A small, honest note is more useful than a polished guess.\n\nFor an example of a publishing destination, visit [WordPress](https://wordpress.org/). This sample does not represent a real project or its results.'.replace('1. Write one observation.\n2. Separate the observation from your interpretation.\n3. Name the next thing to check.', 'The closing steps of this fictional publishing checklist continue from earlier steps.\n\n' + QUICK_LIST_SAMPLE).replace('\n\n> A small', '\n\n' + QUICK_TABLE_SAMPLE + '\n\n> A small')
});
