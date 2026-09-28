// ============================================
// AI ADVISOR OPENAI PROMPT TEMPLATES
// ============================================

import { AdvisorOfferingData, ScoredOffering } from './types';

/**
 * PROMPT 1: Intent Analysis
 * Detect category and intent from user's problem description
 */
export function buildIntentAnalysisPrompt(problemDescription: string): string {
  return `You are an expert business software advisor helping SMBs find the right tools.

A user has described their business problem. Your task is to:
1. Identify the PRIMARY software category they need (choose ONE most relevant category)
2. Determine their specific intent/goal
3. Return ONLY a valid JSON object with this exact structure

User's Problem:
"${problemDescription}"

Available Categories - YOU MUST USE THE EXACT SLUG (choose the MOST specific ONE):

Customer & Sales:
- crm → for managing customers, sales pipeline, contacts, leads, deals, CRM systems
  Keywords: customers, sales, leads, contacts, pipeline, deals, opportunities, CRM

Finance & Accounting:
- accounting → for invoicing, bookkeeping, expenses, billing, taxes, financial management
  Keywords: invoice, accounting, bookkeeping, expenses, billing, taxes, financial reports, ledger

People & HR:
- hrtech → for payroll, hiring, employee management, benefits, time tracking, HR systems
  Keywords: payroll, employees, hiring, recruitment, HR, benefits, time off, leave, talent

Marketing & Growth:
- marketing → for email campaigns, social media, SEO, content marketing, advertising
  Keywords: marketing, email campaigns, social media, advertising, SEO, content, branding

Operations:
- project-management → for project tracking, team collaboration, tasks, sprints, agile, kanban
  Keywords: project, tasks, collaboration, team work, agile, sprints, kanban, workflow
- inventory → for stock management, warehouse, inventory tracking, orders, fulfillment
  Keywords: inventory, stock, warehouse, supply chain, orders, fulfillment, logistics
- procurement → for purchasing, vendor management, purchase orders, sourcing
  Keywords: purchasing, vendors, procurement, PO, sourcing, suppliers, buying

Technology:
- it-services → for hosting, cloud infrastructure, servers, DevOps, IT management
  Keywords: hosting, cloud, servers, infrastructure, AWS, Azure, DevOps, IT
- cybersecurity → for data protection, security monitoring, compliance, threat detection
  Keywords: security, protection, compliance, GDPR, encryption, firewall, threats, vulnerabilities

Support & Service:
- helpdesk → for support tickets, help desk, customer service, service requests
  Keywords: support, tickets, helpdesk, customer service, service desk, incidents
- field-workforce → for field workers, dispatch, mobile workforce, service calls, technicians
  Keywords: field service, dispatch, mobile workforce, service calls, technicians, on-site

Analytics & Data:
- bi-analytics → for reports, dashboards, data analysis, business intelligence, metrics, KPIs
  Keywords: analytics, reports, dashboards, BI, data visualization, insights, metrics, KPI, data analysis, blockchain analytics, blockchain data, blockchain tracking, crypto analytics

Business Systems:
- erp → for end-to-end business management, ERP systems, integrated enterprise software
  Keywords: ERP, business management, integrated system, end-to-end, enterprise
- management → for general business operations, strategy, business planning
  Keywords: business operations, strategy, general management, business planning
- mdm → for master data management, data governance, data quality
  Keywords: master data, data governance, data quality, MDM

CRITICAL INSTRUCTIONS:
1. Read the user's problem description VERY CAREFULLY
2. Look for SPECIFIC keywords that match ONE category
3. IMPORTANT SLUG MAPPINGS (use these EXACT slugs):
   - "tracking tasks" or "managing projects" → "project-management" (NOT "projects")
   - "customer data" or "sales" → "crm"
   - "invoices" or "accounting" → "accounting"
   - "employees" or "payroll" → "hrtech"
   - "analytics" or "blockchain analytics" or "data analysis" → "bi-analytics"
   - "reports" or "dashboards" or "BI" → "bi-analytics"
4. BE SPECIFIC - analyze the actual problem, don't guess or default
5. The detectedCategory MUST be the EXACT slug from the list above
6. If the problem mentions "blockchain", "crypto", or "data analytics" → use "bi-analytics"

Return ONLY this JSON (no markdown, no extra text):
{
  "detectedCategory": "exact-category-slug",
  "detectedIntent": "brief description of what they want to achieve",
  "confidence": 0.95
}`;
}

/**
 * PROMPT 2: Dynamic Question Generation
 * Generate clarifying questions based on user's problem and provider qualifying questions
 */
export function buildQuestionGenerationPrompt(
  problemDescription: string,
  detectedCategory: string,
  providerQualifyingQuestions: string[],
  knownFacts?: Record<string, string | undefined>,
  currencyContext?: {
    currencyCode: string;
    monthlyBudgetOptions: string[];
    hiringBudgetOptions: string[];
  }
): string {
  const budgetOptionGuidance = currencyContext
    ? `- Use ${currencyContext.currencyCode} as the currency whenever you ask a budget question
- For software/tool budget questions, prefer ranges like: ${currencyContext.monthlyBudgetOptions.join(', ')}
- For hiring or staffing budget questions, prefer ranges like: ${currencyContext.hiringBudgetOptions.join(', ')}`
    : '- If you ask about budget, use the user\'s likely local currency rather than defaulting to USD';

  return `You are helping an SMB find the right ${detectedCategory} solution.

User's Problem:
"${problemDescription}"

The vendors in this category typically ask these qualifying questions to prospects:
${providerQualifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Facts already known from the user's first message:
${knownFacts && Object.values(knownFacts).some(Boolean)
  ? Object.entries(knownFacts)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n')
  : '- None confirmed yet'}

Your task: Generate 3-4 clarifying questions that will help match the user to the best product.
Requirements:
- Questions should be multiple-choice with 3-5 options each
- Focus on: team size, budget, urgency, specific use cases, company stage
- Questions should be directly relevant to "${problemDescription}"
- Make options realistic and practical for SMBs
- IMPORTANT: Set "allowMultiple" to true when multiple answers make sense (like features required) and false for mutually exclusive choices (like budget or team size)
- IMPORTANT: Budget questions must use region-appropriate currency and ranges
- CRITICAL: Do NOT ask for facts that are already clearly present in the user's first message
${budgetOptionGuidance}

Return ONLY a valid JSON array (no markdown):
[
  {
    "id": "q1",
    "text": "What is your team size?",
    "options": ["1-5 people", "6-20 people", "21-50 people", "51+ people"],
    "allowMultiple": false
  },
  {
    "id": "q2",
    "text": "Which features are most important to you?",
    "options": ["Lead tracking", "Email automation", "Reporting", "Mobile access"],
    "allowMultiple": true
  }
]`;
}

/**
 * PROMPT 3: Use Case Similarity Scoring
 * Compare user's problem with product's use cases for semantic matching
 */
export function buildUseCaseSimilarityPrompt(
  userProblem: string,
  productName: string,
  productUseCases: string
): string {
  return `You are evaluating if a product matches a user's needs.

User's Problem:
"${userProblem}"

Product: ${productName}
Product's Top Use Cases:
"${productUseCases}"

Task: Rate how well this product's use cases match the user's problem.
Consider:
- Direct relevance to the stated problem
- Overlap in capabilities needed
- Likelihood this product solves their issue

Return ONLY a JSON object (no markdown):
{
  "similarityScore": 0.85,
  "reasoning": "Brief explanation of why this score"
}

Score should be 0.0 (no match) to 1.0 (perfect match).`;
}

/**
 * PROMPT 4: Batch Use Case Similarity (More Efficient)
 * Score multiple products at once
 */
export function buildBatchUseCaseSimilarityPrompt(
  userProblem: string,
  products: { id: string; name: string; useCases: string }[]
): string {
  return `You are evaluating how well multiple products match a user's needs.

User's Problem:
"${userProblem}"

Products to evaluate:
${products
  .map(
    (p, i) => `
Product ${i + 1}: ${p.name}
ID: ${p.id}
Use Cases: ${p.useCases}
`
  )
  .join('\n---\n')}

Task: Rate each product's use case match to the user's problem.
Return ONLY a valid JSON object (no markdown):
{
  "scores": {
    "product-id-1": 0.85,
    "product-id-2": 0.62,
    "product-id-3": 0.91
  }
}

Scores should be 0.0 (no match) to 1.0 (perfect match).`;
}

/**
 * PROMPT 5: Recommendation Reasoning
 * Generate human-readable explanation for why an offering matches
 */
export function buildReasoningPrompt(
  userProblem: string,
  userAnswers: Record<string, string>,
  scoredOffering: ScoredOffering
): string {
  const offering = scoredOffering.offering;
  const breakdown = scoredOffering.scoreBreakdown;

  // Extract use cases and pain points
  const useCases = offering.useCases.length > 0
    ? offering.useCases.join(', ')
    : 'Not provided';
  const painPoints = offering.painPointsSolved.length > 0
    ? offering.painPointsSolved.join(', ')
    : 'Not provided';

  return `You are explaining to an SMB why a solution is a good match for their needs.

User's Problem:
"${userProblem}"

User's Context:
${Object.entries(userAnswers)
  .map(([q, a]) => `- ${q}: ${a}`)
  .join('\n')}

Recommended Solution: ${offering.title}
Short Description: ${offering.shortDescription}
Match Score: ${scoredOffering.matchScore}/100

Score Breakdown:
- Category Match: ${breakdown.categoryMatch}/30
- Team Size Match: ${breakdown.teamSizeMatch}/15
- Budget Match: ${breakdown.budgetMatch}/15
- Use Case Match: ${breakdown.useCaseMatch}/20
- Target Customer Match: ${breakdown.targetCustomerMatch}/10
- Rating Score: ${breakdown.ratingScore}/10

Solution Details:
- Type: ${offering.offeringType}
- Top Use Cases: ${useCases}
- Pain Points Solved: ${painPoints}
- Target Team Size: ${offering.icpTeamSize || 'Any'}
- Pricing: ${offering.pricingModel} ${offering.startingPrice ? `starting at $${offering.startingPrice}` : ''}
- Rating: ${offering.averageRating}/5 (${offering.reviewCount} reviews)
- Has Free Trial: ${offering.hasFreeTrial ? 'Yes' : 'No'}

Task: Write a 2-3 sentence compelling explanation of why this solution matches their needs.
Focus on:
1. How it solves their specific problem
2. Why the pricing/team size fits
3. Any standout features or outcomes

Write in a friendly, helpful tone. Be specific and reference their stated needs.
Return ONLY the explanation text (no JSON, no markdown, no labels).`;
}

/**
 * PROMPT 6: Batch Reasoning Generation
 * Generate reasoning for top 3 recommendations at once
 */
export function buildBatchReasoningPrompt(
  userProblem: string,
  userAnswers: Record<string, string>,
  topOfferings: ScoredOffering[]
): string {
  const offeringSummaries = topOfferings
    .map((so, i) => {
      const offering = so.offering;
      const useCases = offering.useCases.length > 0
        ? offering.useCases.join(', ')
        : offering.shortDescription || 'Not provided';

      return `
Offering ${i + 1}: ${offering.title}
Match Score: ${so.matchScore}/100
Description: ${offering.shortDescription}
Top Use Cases: ${useCases}
Pricing: ${offering.pricingModel} ${
        offering.startingPrice ? `- $${offering.startingPrice}` : ''
      }
Rating: ${offering.averageRating}/5 stars`;
    })
    .join('\n---\n');

  // 🔥 Dynamically build expected JSON structure
  const jsonStructure = topOfferings
    .map(
      (so) =>
        `"${so.offering.id}": "Explanation for ${so.offering.title}..."`
    )
    .join(',\n  ');

  return `You are explaining to an SMB why these solutions match their needs.

User's Problem:
"${userProblem}"

User's Context:
${Object.entries(userAnswers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n')}

Recommended Solutions:
${offeringSummaries}

Task: For each solution, write a 2-3 sentence explanation of why it matches their needs.
Be specific and reference their stated problem and context.

Return ONLY a valid JSON object (no markdown):
{
  ${jsonStructure}
}`;
}


/**
 * Helper: Extract use cases from offering data
 */
export function extractUseCases(offering: AdvisorOfferingData): string {
  // Offerings have useCases as an array field
  if (offering.useCases && offering.useCases.length > 0) {
    return offering.useCases.join(', ');
  }
  return offering.shortDescription || 'Not provided';
}

/**
 * Helper: Build offering context string for prompts
 */
export function buildOfferingContext(offering: AdvisorOfferingData): string {
  const useCases = extractUseCases(offering);
  const painPoints = offering.painPointsSolved.length > 0
    ? offering.painPointsSolved.join(', ')
    : 'Not specified';

  return `${offering.title}
Description: ${offering.shortDescription}
Categories: ${offering.categories.map((c) => c.name).join(', ')}
Type: ${offering.offeringType}
Use Cases: ${useCases}
Pain Points Solved: ${painPoints}
Target Team Size: ${offering.icpTeamSize || 'Any'}
Pricing: ${offering.pricingModel} ${offering.startingPrice ? `- $${offering.startingPrice}` : ''}
Rating: ${offering.averageRating}/5 (${offering.reviewCount} reviews)`;
}

/**
 * PROMPT 7: External Product Recommendations
 * Generate external product/service suggestions when no internal offerings match
 */
export function buildExternalRecommendationsPrompt(
  problemDescription: string,
  detectedCategory: string,
  userContext: {
    teamSize?: string;
    budget?: string;
    urgency?: string;
    companyStage?: string;
    rejectedProducts?: string[];
    constraints?: string[];
  }
): string {
  const rejectedProducts = userContext.rejectedProducts || [];
  const constraints = userContext.constraints || [];

  return `You are an expert business software advisor helping SMBs find solutions.

A user needs help with the following problem, but we don't have matching solutions in our marketplace yet.

User's Problem:
"${problemDescription}"

Category: ${detectedCategory}
User Context:
${userContext.teamSize ? `- Team Size: ${userContext.teamSize}` : ''}
${userContext.budget ? `- Budget: ${userContext.budget}` : ''}
${userContext.companyStage ? `- Company Stage: ${userContext.companyStage}` : ''}
${userContext.urgency ? `- Urgency: ${userContext.urgency}` : ''}
${constraints.length > 0 ? `- User constraints/preferences: ${constraints.join('; ')}` : ''}
${rejectedProducts.length > 0 ? `- Products the user has rejected and must not be suggested: ${rejectedProducts.join(', ')}` : ''}

Task: Suggest 3-5 real-world, well-known products or services that would help solve this problem.

CRITICAL REQUIREMENTS:
- ONLY suggest well-known, established products that you are CERTAIN exist
- DO NOT invent product names or URLs
- DO NOT suggest products unless you are 100% confident they are real
- If you are unsure about a URL, use null instead of guessing
- Focus on market leaders and widely-recognized solutions
- Consider the user's budget and team size constraints
- Respect every user constraint above
- Do not suggest rejected products
- Each recommendation must be practical and actionable

Return ONLY a valid JSON array (no markdown, no extra text):
[
  {
    "productName": "HubSpot CRM",
    "productUrl": "https://www.hubspot.com/products/crm",
    "category": "${detectedCategory}",
    "shortDescription": "Free CRM with email tracking, pipeline management, and contact insights.",
    "reasoning": "HubSpot CRM is perfect for your team size and budget. It offers robust contact management and sales pipeline tracking that directly addresses your need to organize customer relationships. The free tier includes all core features, making it ideal for growing teams.",
    "confidence": 0.92
  }
]

JSON Field Requirements:
- productName: Exact official product name (verify it's real)
- productUrl: Official website only (use null if uncertain - DO NOT GUESS)
- category: "${detectedCategory}"
- shortDescription: 1-2 sentences about core functionality
- reasoning: 2-3 sentences explaining WHY it solves their specific problem
- confidence: 0.7-1.0 for strong recommendations, 0.5-0.7 for moderate fit

Return exactly 3-5 recommendations. Only suggest products you are CERTAIN exist.`;
}

/**
 * PROMPT 7: Iterative Question Generation
 * Generate next clarifying question based on current gaps
 */
export function buildIterativeQuestionPrompt(
  problem: string,
  category: string,
  answeredQuestions: Record<string, string>,
  criticalGaps: string[],
  currencyContext?: {
    currencyCode: string;
    monthlyBudgetOptions: string[];
    hiringBudgetOptions: string[];
  }
): string {
  const answersContext =
    Object.keys(answeredQuestions).length > 0
      ? Object.entries(answeredQuestions)
          .map(([q, a]) => `- ${q}: ${a}`)
          .join('\n')
      : 'None yet';

  return `You are helping clarify an SMB's software needs through targeted questions.

Current understanding:
- Problem: "${problem}"
- Category: ${category}
- What we know:
${answersContext}

Critical gaps identified:
${criticalGaps.length > 0 ? criticalGaps.map(gap => `- ${gap}`).join('\n') : '- General clarification needed'}

Your task:
Generate 1 clarifying question that addresses the MOST CRITICAL gap in our understanding.
This question will help us match them to the right solution.

IMPORTANT RULES:
- Do NOT ask about specific brand preferences or product names
- Ask about needs, constraints, requirements, and context only
- Keep questions simple and easy to answer
- Provide 3-4 clear answer options
- Focus on information that affects tool selection (budget, team size, urgency, features needed)
- Set "allowMultiple": true when multiple options make sense concurrently (like use cases or needed integrations)
- Set "allowMultiple": false for mutually exclusive choices (like budget range or team size)
- If you ask a budget question, use ${currencyContext?.currencyCode || 'the user’s local currency'} and do not default to USD
${currencyContext ? `- Software/tool budget options should be similar to: ${currencyContext.monthlyBudgetOptions.join(', ')}
- Hiring/staffing budget options should be similar to: ${currencyContext.hiringBudgetOptions.join(', ')}` : ''}

Return ONLY a valid JSON object (no markdown):
{
  "id": "qX",
  "text": "Clear, concise question text?",
  "options": ["Option 1", "Option 2", "Option 3"],
  "allowMultiple": false
}

Example good questions:
- "What's your approximate monthly budget for this solution?"
- "How many team members will be using this tool?"
- "How urgently do you need this implemented?"
- "What's your team's technical comfort level?"

Example bad questions:
- "Do you prefer Salesforce or HubSpot?" (asking about brands)
- "What color should the interface be?" (irrelevant to matching)`;
}

/**
 * PROMPT 8: AI Solution Generation
 * Generate generic business solution without brand names
 */
export function buildSolutionGenerationPrompt(
  problem: string,
  category: string,
  answers: Record<string, string>,
  detectedIntent: string
): string {
  const answersContext = Object.entries(answers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n');

  return `You are an expert business consultant helping an SMB solve their problem.

CRITICAL CONSTRAINTS:
- 500 WORD MAXIMUM (strictly enforce - be concise and actionable)
- ABSOLUTELY NO BRAND NAMES (say "CRM system" not "Salesforce", "project tool" not "Asana")
- NO SPECIFIC PRODUCT NAMES WHATSOEVER
- Focus on GENERIC tool types and best practices
- Be actionable, practical, and educational
- Think like a consultant, not a salesperson

User's Problem:
"${problem}"

Category: ${category}
Intent: ${detectedIntent}

User Context:
${answersContext}

Your task:
Provide a comprehensive business solution that:
1. Summarizes their problem and root causes (2-3 sentences)
2. Outlines 4-6 specific, actionable steps to solve it (numbered list with clear actions)
3. Mentions ONLY generic tool types needed (e.g., "customer relationship management platform", "automated email marketing tool", "project tracking system")
4. Includes realistic implementation timeline based on their context
5. Provides budget considerations specific to their stated budget
6. Stays UNDER 500 words total

IMPORTANT: Each actionable step should be concrete and implementable. Avoid vague advice like "improve processes" - instead say "Set up automated email sequences to follow up with leads within 24 hours."

Return ONLY valid JSON (no markdown, no code blocks, no backticks):
{
  "summary": "Your problem stems from... The root cause is... This results in...",
  "actionableSteps": [
    "1. First concrete step with specific action...",
    "2. Second concrete step...",
    "3. Third step...",
    "4. Fourth step...",
    "5. Fifth step (optional)...",
    "6. Sixth step (optional)..."
  ],
  "toolTypesNeeded": [
    "generic tool category 1",
    "generic tool category 2"
  ],
  "estimatedImplementationTime": "X-Y weeks/months with explanation",
  "budgetConsiderations": "Based on your $X budget, you should focus on... Consider... Expect to pay..."
}

Remember: NO BRAND NAMES. Say "spreadsheet software" not "Excel", "video conferencing tool" not "Zoom", etc.`;
}

/**
 * PROMPT 9: Solution-Aware Recommendation Reasoning
 * Generate reasoning that references the AI solution steps
 */
export function buildReasoningWithSolutionPrompt(
  userProblem: string,
  aiSolutionSteps: string[],
  scoredOffering: ScoredOffering
): string {
  return `You are explaining how a specific tool fits into a broader business solution plan.

User's Problem:
"${userProblem}"

Recommended Solution Steps:
${aiSolutionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Tool Being Recommended: ${scoredOffering.offering.title}
Description: ${scoredOffering.offering.shortDescription}
Match Score: ${scoredOffering.matchScore}/100

Your task:
Write 2-3 sentences explaining:
1. Which specific solution steps (by number) this tool directly addresses
2. Why it's a particularly good fit given their ${scoredOffering.matchScore}% match score
3. One unique benefit or capability that makes it stand out for their specific context

Be concise and ALWAYS reference the solution steps by number (e.g., "This tool addresses steps 1, 2, and 4...").

Return ONLY the explanation text (no JSON, no markdown, no formatting - just plain text).

Example good response:
"This CRM system directly addresses steps 1-3 of your solution by providing a centralized database, automated lead scoring, and customizable email sequences. With a 78% match score, it's well-suited to your team size and budget constraints. The platform's mobile app is particularly valuable for your field sales team who need real-time access to customer data."

Example bad response:
"This is a great tool that will help you. It has many features." (too vague, doesn't reference steps)`;
}
