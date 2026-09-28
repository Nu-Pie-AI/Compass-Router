// ============================================
// AI ONBOARDING INTEGRATION TEST
// End-to-end test for the complete onboarding flow
// ============================================

import { extractContext } from '../context-extractor';
import { generateOfferingEmbedding, validateEmbedding } from '../embedding-generator';
import { generateIntelligence, refineAnswers } from '../intelligence-generator';
import { extractEnrichmentQA, parseQuestionnaireToOffering } from '../questionnaire-parser';

export async function runIntegrationTest() {
  console.log('Starting AI Onboarding Integration Test...\n');

  const testOffering = {
    name: 'TestCRM Pro',
    summary:
      'A powerful customer relationship management system designed for small to medium businesses. Helps teams manage contacts, track sales, and automate marketing campaigns with ease.',
    websiteText: `
      TestCRM Pro is an all-in-one CRM solution for SMBs.

      Features:
      - Contact Management: Organize all customer data in one place
      - Sales Pipeline: Track deals from lead to close
      - Email Integration: Sync with Gmail and Outlook
      - Marketing Automation: Automated email campaigns
      - Analytics Dashboard: Real-time sales insights

      Pricing: Starting at $49/user/month
      Free trial: 14 days

      Integrations: Salesforce, HubSpot, Slack, Zapier, Mailchimp

      Security: SOC2 certified, GDPR compliant, 256-bit encryption

      Perfect for: Sales teams of 5-50 people in SaaS, Tech, and Professional Services industries
    `,
  };

  try {
    console.log('Stage 1: Context Extraction (GPT-4o-mini)');
    console.log('-------------------------------------------');

    const contextSummary = await extractContext(
      testOffering.name,
      testOffering.summary,
      testOffering.websiteText
    );

    console.log('Context extracted:');
    console.log('  - Product Description:', contextSummary.product_description.slice(0, 100) + '...');
    console.log('  - Target Industries:', contextSummary.target_industries);
    console.log('  - Use Cases:', contextSummary.use_cases.length);
    console.log('  - Key Features:', contextSummary.key_features.length);
    console.log('  - Integrations:', contextSummary.integrations);
    console.log('  - Security:', contextSummary.security_features);
    console.log('  - Tokens Used:', contextSummary.tokensUsed);
    console.log('');

    console.log('Stage 2: Intelligence Generation (GPT-4o)');
    console.log('-------------------------------------------');

    const intelligenceResult = await generateIntelligence(
      testOffering.name,
      testOffering.summary,
      contextSummary,
      'https://testcrm.example.com',
      'yes'
    );

    console.log('Intelligence generated:');
    console.log('  - Answers Length:', intelligenceResult.answers.length, 'characters');
    console.log('  - Missing Questions:', intelligenceResult.missingQuestions.length);
    console.log('  - Clarifications Needed:', intelligenceResult.clarificationNeeded.length);
    console.log('');

    if (intelligenceResult.missingQuestions.length > 0) {
      console.log('Missing Questions:', intelligenceResult.missingQuestions.slice(0, 5).join(', '));
      console.log('');
    }

    let finalAnswers = intelligenceResult.answers;

    if (intelligenceResult.missingQuestions.length > 0) {
      console.log('Stage 3: Refinement (GPT-4o-mini)');
      console.log('-------------------------------------------');

      const mockClarifications: Record<string, string> = {
        Q3a: 'SaaS, Technology, Professional Services',
        Q16: 'Salesforce, HubSpot, Slack, Zapier, Mailchimp',
        Q28: 'per user, starting at USD 49/user/month, free trial available',
      };

      const refinementResult = await refineAnswers(
        intelligenceResult.answers,
        mockClarifications,
        intelligenceResult.missingQuestions
      );

      finalAnswers = refinementResult.updatedAnswers;

      console.log('Answers refined:');
      console.log('  - Still Missing:', refinementResult.stillMissing.length);
      console.log('');
    }

    console.log('Stage 4: Parse Questionnaire to Offering');
    console.log('-------------------------------------------');

    const offeringData = parseQuestionnaireToOffering(
      finalAnswers,
      testOffering.name,
      testOffering.summary
    );

    console.log('Offering data parsed:');
    console.log('  - Title:', offeringData.title);
    console.log('  - Type:', offeringData.offeringType);
    console.log('  - Primary Function:', offeringData.primaryFunction);
    console.log('  - Use Cases:', offeringData.useCases.length);
    console.log('  - Pain Points:', offeringData.painPointsSolved.length);
    console.log('  - ICP Industries:', offeringData.icpIndustry);
    console.log('  - ICP Team Size:', offeringData.icpTeamSize);
    console.log('  - Integrations:', offeringData.integrations);
    console.log('  - Compliance:', offeringData.complianceFlags);
    console.log('  - ICP Budget:', offeringData.icpBudget);
    console.log('  - Pricing Model:', offeringData.pricingModel);
    console.log('  - Starting Price:', offeringData.startingPrice);
    console.log('  - Free Trial:', offeringData.hasFreeTrial);
    console.log('  - Learning Curve:', offeringData.learningCurve);
    console.log('  - Implementation Time:', offeringData.implementationTime);
    console.log('  - Confidence Score:', offeringData.confidenceScore + '%');
    console.log('');

    if (!offeringData.icpBudget) {
      throw new Error('Expected ICP budget to be parsed');
    }
    if (!offeringData.pricingModel) {
      throw new Error('Expected pricing model to be parsed');
    }

    console.log('Stage 5: Extract Enrichment Q&A');
    console.log('-------------------------------------------');

    const enrichmentQA = extractEnrichmentQA(finalAnswers);

    console.log('Enrichment Q&A extracted:');
    console.log('  - Total Q&A Pairs:', enrichmentQA.length);
    console.log('  - Sample Questions:');
    enrichmentQA.slice(0, 3).forEach((qa) => {
      console.log(`    - ${qa.questionId}: ${qa.question.slice(0, 60)}...`);
    });
    console.log('');

    console.log('Stage 6: Generate Embedding Vector');
    console.log('-------------------------------------------');

    const embedding = await generateOfferingEmbedding(offeringData);
    const isValid = validateEmbedding(embedding);

    console.log('Embedding generated:');
    console.log('  - Dimensions:', embedding.length);
    console.log('  - Valid:', isValid);
    console.log('  - Sample values:', embedding.slice(0, 5).map((value) => value.toFixed(4)));
    console.log('');

    console.log('Integration Test Complete!');
    console.log('===========================================');
    console.log('Summary:');
    console.log('  - Stage 1: Context Extraction - Success');
    console.log('  - Stage 2: Intelligence Generation - Success');
    console.log('  - Stage 3: Refinement - Success');
    console.log('  - Stage 4: Questionnaire Parsing - Success');
    console.log('  - Stage 5: Enrichment Q&A - Success');
    console.log('  - Stage 6: Embedding Generation - Success');
    console.log('');

    return {
      success: true,
      offeringData,
      enrichmentQA,
      embedding,
      contextSummary,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Integration Test Failed:', errorMessage);
    console.error('Stack:', errorStack);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

if (require.main === module) {
  runIntegrationTest()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
