# AI Onboarding Testing Guide

This directory contains comprehensive tests for the AI Product Intelligence Builder system.

## Test Files

### 1. Integration Test (Unit-level)
**File:** `integration-test.ts`

Tests the complete pipeline without hitting the database:
- Stage 1: Context extraction (GPT-4o-mini)
- Stage 2: Intelligence generation (GPT-4o)
- Stage 3: Refinement (incremental updates)
- Stage 4: Questionnaire parsing
- Stage 5: Enrichment Q&A extraction
- Stage 6: Embedding generation

**Run:**
```bash
npx ts-node src/lib/ai-onboarding/__tests__/integration-test.ts
```

**Expected Output:**
- ✅ All 6 stages complete successfully
- Context extracted with structured facts
- Questionnaire answers generated (37 questions)
- Missing questions identified
- Offering data parsed correctly
- Embedding vector generated (1536 dimensions)

---

### 2. Database Verification
**File:** `verify-database.ts`

Verifies an offering was created correctly in the database with all expected records.

**Run:**
```bash
npx ts-node src/lib/ai-onboarding/__tests__/verify-database.ts <offeringId>
```

**Checks:**
- ✅ Basic fields (title, slug, type, status)
- ✅ Array fields (useCases, painPointsSolved, integrations, etc.)
- ✅ ICP fields (team size, industries, budget, stage)
- ✅ Embedding (1536 dimensions)
- ✅ Enrichment answers (~37 Q&A pairs)
- ✅ Partner integration
- ✅ Category assignment

**Expected Output:**
```
Checks Passed: 5/5
  ✅ basicFields
  ✅ embedding
  ✅ enrichmentAnswers
  ✅ category
  ✅ partner

✅ All checks passed! Offering is ready for AI Advisor. 🚀
```

---

### 3. AI Advisor Integration Test
**File:** `test-ai-advisor-integration.ts`

Tests that AI-generated offerings work correctly with the AI Advisor recommendation system.

**Run:**
```bash
npx ts-node src/lib/ai-onboarding/__tests__/test-ai-advisor-integration.ts <offeringId>
```

**Tests:**
1. **Embedding Validation** - Verifies 1536 dimensions
2. **Semantic Similarity** - Generates user problem embedding and calculates cosine similarity
3. **Published Offerings Query** - Tests database query performance
4. **AI Advisor Scoring** - Simulates full scoring algorithm
5. **Enrichment Context** - Verifies Q&A pairs available

**Expected Output:**
```
Checks Passed: 5/5
  ✅ embeddingExists
  ✅ embeddingDimensions
  ✅ similarityCalculation
  ✅ enrichmentAnswers
  ✅ aiGeneratedFlag

✅ Offering fully compatible with AI Advisor! 🚀
   AI Advisor can now recommend this offering based on semantic similarity.
```

---

## End-to-End Testing Workflow

### Step 1: Test API Endpoints (Manual)

Use Postman or curl to test the complete API flow:

#### 1.1 Start Session
```bash
curl -X POST http://localhost:3000/api/partners/offerings/ai/start \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>" \
  -d '{
    "offeringName": "TestCRM Pro",
    "offeringSummary": "A powerful customer relationship management system designed for small to medium businesses. Helps teams manage contacts, track sales, and automate marketing campaigns.",
    "websiteUrl": "https://example.com",
    "allowWebBrowsing": "yes"
  }'
```

**Expected Response:**
```json
{
  "sessionId": "clxxx...xxx",
  "status": "initialized",
  "message": "AI onboarding session started successfully",
  "nextAction": "extracting"
}
```

#### 1.2 Extract Context (Stage 1)
```bash
curl -X POST http://localhost:3000/api/partners/offerings/ai/extract-context \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>" \
  -d '{
    "sessionId": "clxxx...xxx"
  }'
```

**Expected Response:**
```json
{
  "contextSummary": {
    "product_description": "...",
    "target_industries": ["SaaS", "Technology"],
    "use_cases": ["..."],
    "key_features": ["..."],
    "integrations": ["..."],
    "security_features": ["..."],
    "pricing_signals": ["..."],
    "deployment_models": ["SaaS"],
    "implementation_notes": ["..."],
    "tokensUsed": 1500
  },
  "tokensUsed": 1500,
  "websiteScraped": true,
  "filesProcessed": 0
}
```

#### 1.3 Generate Intelligence (Stage 2)
```bash
curl -X POST http://localhost:3000/api/partners/offerings/ai/generate-intelligence \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>" \
  -d '{
    "sessionId": "clxxx...xxx"
  }'
```

**Expected Response:**
```json
{
  "answers": "Q1) Tools Ideal Fit...\nAnswer: CRM...",
  "missingQuestions": ["Q3a", "Q16", "Q28"],
  "clarificationNeeded": [
    {
      "questionId": "Q3a",
      "question": "Target Industry",
      "context": "This information will help us better understand your offering."
    }
  ],
  "confidenceScore": 75,
  "estimatedCompleteness": 85
}
```

#### 1.4 Refine (Clarification Loop) - If Needed
```bash
curl -X POST http://localhost:3000/api/partners/offerings/ai/refine \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>" \
  -d '{
    "sessionId": "clxxx...xxx",
    "clarifications": {
      "Q3a": "SaaS, Technology, Professional Services",
      "Q16": "Salesforce, HubSpot, Slack",
      "Q28": "per user"
    }
  }'
```

**Expected Response:**
```json
{
  "updatedAnswers": "...",
  "stillMissing": [],
  "readyToFinalize": true,
  "confidenceScore": 85,
  "clarificationRound": 1
}
```

#### 1.5 Finalize (Create Offering)
```bash
curl -X POST http://localhost:3000/api/partners/offerings/ai/finalize \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>" \
  -d '{
    "sessionId": "clxxx...xxx"
  }'
```

**Expected Response:**
```json
{
  "offeringId": "clyyy...yyy",
  "slug": "testcrm-pro",
  "status": "pending_review",
  "confidenceScore": 85,
  "embeddingGenerated": true,
  "enrichmentAnswersCount": 37,
  "redirectUrl": "/partners/offerings/testcrm-pro/review"
}
```

### Step 2: Verify Database Records
```bash
npx ts-node src/lib/ai-onboarding/__tests__/verify-database.ts clyyy...yyy
```

### Step 3: Test AI Advisor Integration
```bash
npx ts-node src/lib/ai-onboarding/__tests__/test-ai-advisor-integration.ts clyyy...yyy
```

---

## Success Criteria

### Day 5 Complete When:

- [x] All API endpoints return expected responses
- [x] Offering created in database with all fields
- [x] 37 OfferingEnrichmentAnswer records created
- [x] Embedding vector generated (1536 dimensions)
- [x] Partner stats updated (totalOfferings incremented)
- [x] Category assigned correctly
- [x] AI Advisor can calculate semantic similarity
- [x] Confidence score ≥ 70%

---

## Troubleshooting

### Issue: OPENAI_API_KEY not set
**Solution:** Add to `.env` file:
```
OPENAI_API_KEY=sk-...
```

### Issue: Website scraping fails (403/timeout)
**Expected:** System should gracefully degrade and continue without website data
**Check:** Look for log message: "Could not access website, proceeding with provided information"

### Issue: Embedding generation fails
**Expected:** Offering created without embedding, flagged for batch processing
**Check:** `embeddingGenerated: false` in response

### Issue: Low confidence score (<60%)
**Expected:** Finalize endpoint returns 400 error
**Solution:** Use `forceCreate: true` flag or provide more clarifications

### Issue: Missing enrichment answers (<30)
**Check:** Look at Stage 2 output - verify all 37 questions were answered
**Debug:** Check for "Unknown" answers in questionnaire

---

## Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Stage 1 latency | 5-10s | TBD |
| Stage 2 latency | 20-40s | TBD |
| Clarification round | 10-15s | TBD |
| Embedding generation | 1-3s | TBD |
| Database transaction | <1s | TBD |
| Total tokens/session | 5000-8000 | TBD |
| Cost per offering | ~$0.038 | TBD |

---

## Next Steps (Days 6-7)

After Day 5 testing passes:
- **Days 6-7:** Build frontend UI with theme support
- **Day 8:** Edge case handling and optimization
- **Days 9-10:** Production testing and deployment
