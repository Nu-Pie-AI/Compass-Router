// ============================================
// AI ADVISOR INTEGRATION TEST
// Tests that AI-generated offerings work with AI Advisor
// ============================================

import prisma from '@/lib/prisma';
import { openai } from '@/lib/ai/openai';
import { cosineSimilarity } from '@/lib/ai-advisor/similarity';

/**
 * Test AI Advisor integration with AI-generated offerings
 * Verifies embeddings enable semantic search
 *
 * @param offeringId - ID of AI-generated offering to test
 */
export async function testAIAdvisorIntegration(offeringId: string) {
  console.log('🤖 Testing AI Advisor Integration...');
  console.log('===========================================\n');

  try {
    // Fetch the offering
    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: {
        id: true,
        title: true,
        shortDescription: true,
        primaryFunction: true,
        useCases: true,
        embedding: true,
        aiGenerated: true,
      },
    });

    if (!offering) {
      console.error('❌ Offering not found:', offeringId);
      return { success: false, error: 'Offering not found' };
    }

    console.log('📦 Offering Details:');
    console.log('-------------------------------------------');
    console.log('  Title:', offering.title);
    console.log('  AI Generated:', offering.aiGenerated);
    console.log('  Has Embedding:', !!offering.embedding && offering.embedding.length > 0);
    console.log('');

    // Check embedding exists
    if (!offering.embedding || offering.embedding.length === 0) {
      console.error('❌ No embedding found on offering');
      return { success: false, error: 'No embedding found' };
    }

    // Verify embedding dimensions
    if (offering.embedding.length !== 1536) {
      console.error('❌ Invalid embedding dimensions:', offering.embedding.length);
      return { success: false, error: 'Invalid embedding dimensions' };
    }

    console.log('✅ Embedding validated (1536 dimensions)');
    console.log('');

    // ===========================================
    // TEST 1: Generate User Problem Embedding
    // ===========================================
    console.log('🔍 Test 1: Generate User Problem Embedding');
    console.log('-------------------------------------------');

    // Simulate a user problem related to the offering
    const userProblem = `I need a ${offering.primaryFunction} solution for my small business`;

    console.log('  User Problem:', userProblem);

    const userEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userProblem,
    });

    const userEmbedding = userEmbeddingResponse.data[0].embedding;

    console.log('  User Embedding Generated:', userEmbedding.length, 'dimensions');
    console.log('');

    // ===========================================
    // TEST 2: Calculate Semantic Similarity
    // ===========================================
    console.log('🧮 Test 2: Calculate Semantic Similarity');
    console.log('-------------------------------------------');

    const similarity = cosineSimilarity(userEmbedding, offering.embedding);
    const similarityPercentage = (similarity * 100).toFixed(2);

    console.log('  Cosine Similarity:', similarity.toFixed(4));
    console.log('  Similarity %:', similarityPercentage + '%');
    console.log('');

    // Interpret similarity score
    let interpretation = '';
    if (similarity > 0.85) {
      interpretation = '🟢 Excellent match - Very high relevance';
    } else if (similarity > 0.75) {
      interpretation = '🟡 Good match - High relevance';
    } else if (similarity > 0.65) {
      interpretation = '🟠 Moderate match - Medium relevance';
    } else {
      interpretation = '🔴 Poor match - Low relevance';
    }

    console.log('  Interpretation:', interpretation);
    console.log('');

    // ===========================================
    // TEST 3: Query Published Offerings
    // ===========================================
    console.log('📊 Test 3: Query Published Offerings');
    console.log('-------------------------------------------');

    const publishedOfferings = await prisma.offering.findMany({
      where: {
        status: 'published',
        primaryFunction: {
          contains: offering.primaryFunction,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        title: true,
        embedding: true,
      },
      take: 10,
    });

    console.log('  Published Offerings in Category:', publishedOfferings.length);

    // Calculate similarity for all published offerings
    const similarities = publishedOfferings
      .filter(o => o.embedding && o.embedding.length === 1536)
      .map(o => ({
        id: o.id,
        title: o.title,
        similarity: cosineSimilarity(userEmbedding, o.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    console.log('');
    console.log('  Top 3 Most Similar Offerings:');
    similarities.slice(0, 3).forEach((item, index) => {
      const isTestOffering = item.id === offering.id;
      console.log(`    ${index + 1}. ${item.title} - ${(item.similarity * 100).toFixed(2)}% ${isTestOffering ? '⭐ (This offering)' : ''}`);
    });
    console.log('');

    // ===========================================
    // TEST 4: Simulate AI Advisor Scoring
    // ===========================================
    console.log('🎯 Test 4: Simulate AI Advisor Scoring');
    console.log('-------------------------------------------');

    // Simulate score breakdown (simplified)
    const scoreBreakdown = {
      categoryMatch: 30, // Max 30 points
      semanticSimilarity: Math.round(similarity * 35), // Max 35 points
      teamSizeMatch: 10, // Assuming moderate match
      budgetMatch: 10, // Assuming moderate match
      useCaseMatch: 15, // Assuming good match
      ratingScore: 5, // Assuming some reviews
    };

    const totalScore = Object.values(scoreBreakdown).reduce((sum, val) => sum + val, 0);

    console.log('  Score Breakdown:');
    Object.entries(scoreBreakdown).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });
    console.log('  ---');
    console.log('  Total Match Score:', totalScore, '/ 100');
    console.log('');

    // ===========================================
    // TEST 5: Enrichment Answers for Context
    // ===========================================
    console.log('💬 Test 5: Enrichment Answers for Context');
    console.log('-------------------------------------------');

    const enrichmentCount = await prisma.offeringEnrichmentAnswer.count({
      where: { offeringId: offering.id },
    });

    console.log('  Enrichment Answers:', enrichmentCount);

    if (enrichmentCount >= 30) {
      console.log('  ✅ Rich context available for AI Advisor');
    } else {
      console.warn('  ⚠️  Limited context (expected ~37 answers)');
    }
    console.log('');

    // ===========================================
    // FINAL SUMMARY
    // ===========================================
    console.log('🎉 AI Advisor Integration Test Complete!');
    console.log('===========================================');

    const checks = {
      embeddingExists: !!offering.embedding && offering.embedding.length > 0,
      embeddingDimensions: offering.embedding.length === 1536,
      similarityCalculation: similarity > 0,
      enrichmentAnswers: enrichmentCount >= 30,
      aiGeneratedFlag: offering.aiGenerated === true,
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    console.log('Checks Passed:', `${passedChecks}/${totalChecks}`);
    console.log('');

    Object.entries(checks).forEach(([key, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${key}`);
    });

    console.log('');

    if (passedChecks === totalChecks) {
      console.log('✅ Offering fully compatible with AI Advisor! 🚀');
      console.log('   AI Advisor can now recommend this offering based on semantic similarity.');
    } else {
      console.warn('⚠️  Some checks failed. Review above for details.');
    }

    console.log('');

    return {
      success: true,
      offering: {
        id: offering.id,
        title: offering.title,
      },
      similarity,
      totalScore,
      checks,
      passedChecks,
      totalChecks,
    };
  } catch (error: any) {
    console.error('❌ AI Advisor integration test failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run test if executed directly
 * Usage: ts-node test-ai-advisor-integration.ts <offeringId>
 */
if (require.main === module) {
  const offeringId = process.argv[2];

  if (!offeringId) {
    console.error('Usage: ts-node test-ai-advisor-integration.ts <offeringId>');
    process.exit(1);
  }

  testAIAdvisorIntegration(offeringId)
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
