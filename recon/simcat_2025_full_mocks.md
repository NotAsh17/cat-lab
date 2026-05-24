# SIMCAT 2025 Full Mocks Recon

## Status
Yellow-green. The source structure is clean HTML with embedded JSON, but it is a new full-mock mode with LRDI contexts and many inline images, so it should get visual review before treating it as final.

## Source
- Folder: `C:\Users\Not Ash\Downloads\Telegram Desktop`
- Files: 17 standalone SIMCAT HTML files.
- Format: generated SingleFile-style HTML app with `const testData = {...}` embedded in script.
- Extraction strategy: parse `testData` directly. Do not scrape visible DOM.

## Section Markers
`testData.sections` maps exact section names to source question IDs:
- `Verbal Ability & Reading Comprehension`
- `Data Interpretation & Logical Reasoning`
- `Quantitative Ability`

Runner order must always be:
1. VARC
2. LRDI
3. QA

Each section is 40 minutes. Break/pause is allowed only after a section is submitted and before the next section begins.

## Counts
Most mocks are 68 questions:
- VARC: 24
- LRDI: 22
- QA: 22

Source exceptions preserved exactly:
- `SimCAT 3 2025`: 66 total, LRDI has 20
- `SimCAT 5 2025`: 66 total, LRDI has 20
- `SimCAT 17 2025`: 66 total, LRDI has 20

## Question Numbering And IDs
- Source IDs are numeric per file, e.g. `10000`.
- Normalized IDs use `simcat2025-<mock>-q<global>`, e.g. `simcat2025-01-q001`.
- Stable source trace keeps original file and original ID.

## MCQ/TITA Cues
- `is_input_type: true` means TITA.
- `is_input_type: false` with `options[]` means MCQ.
- `correct_response` is an array wrapper; the accepted answer is the first flattened value.
- No multi-select questions found in the current folder.

## Media And Math
- Images are embedded as `data:image/png;base64,...`.
- Ingestion extracts these to `public/bank_assets/simcat_2025_full_mocks/<sha>.png`.
- HTML is rewritten to local image URLs.
- Source includes MathJax/CSS wrappers in some fields; the extractor strips document/head/style wrappers and preserves body content.

## VARC Passage Preservation
- RC passage text lives in `question.instructions`, repeated for each RC question.
- The first instruction paragraph is removed for RC context display.
- Remaining paragraph HTML is preserved as context HTML and linked through `passage_id`.
- VA questions usually have empty `instructions` and carry directions plus statements in `question_text`.

## LRDI Context Preservation
- LRDI set data lives in `question.instructions`, repeated for every question in a set.
- Contexts are deduplicated by normalized instruction text and attached as passage-like left-panel contexts.
- Images inside LRDI contexts are retained as local assets.

## Answer And Explanation Location
- Answer: `correct_response`
- Explanation: `solution`
- Explanation HTML is preserved after stripping outer wrappers and rewriting inline images.

## Sample Questions
1. `SIMCAT 1 2025`, VARC Q1: TITA odd sentence out, answer `2`, no passage.
2. `SIMCAT 1 2025`, VARC Q2: RC MCQ, answer `1`, passage from repeated `instructions`.
3. `SIMCAT 1 2025`, LRDI Q1: TITA, answer `8400`, data set from repeated `instructions`.

## Known Review Points
- Verify image sizing in LRDI and QA after local asset rewrite.
- Verify the 66-question mocks are acceptable as source-faithful rather than forced to 68.
- Verify RC passage display uses only passage paragraphs, not the source instruction line.
