// ============================================
// DATABASE VERIFICATION SCRIPT
// Verifies offering was created correctly with all records
// ============================================

import prisma from '@/lib/prisma';

/**
 * Verify an offering was created correctly
 * @param offeringId - ID of the offering to verify
 */
export async function verifyOfferingCreation(offeringId: string) {
  console.log('🔍 Verifying Offering Creation...');
  console.log('===========================================\n');

  try {
    // Fetch offering with all relations
    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      include: {
        partner: {
          select: {
            id: true,
            companyName: true,
            totalOfferings: true,
          },
        },
        enrichmentAnswers: {
          select: {
            id: true,
            question: true,
            answer: true,
            aiGenerated: true,
          },
        },
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!offering) {
      console.error('❌ Offering not found:', offeringId);
      return { success: false, error: 'Offering not found' };
    }

    console.log('✅ Offering Found:', offering.id);
    console.log('');

    // ===========================================
    // VERIFY BASIC FIELDS
    // ===========================================
    console.log('📋 Basic Fields Verification');
    console.log('-------------------------------------------');
    console.log('  Title:', offering.title);
    console.log('  Slug:', offering.slug);
    console.log('  Type:', offering.offeringType);
    console.log('  Status:', offering.status);
    console.log('  Primary Function:', offering.primaryFunction);
    console.log('  AI Generated:', offering.aiGenerated);
    console.log('  Confidence Score:', offering.confidenceScore + '%');
    console.log('');

    // Verify required fields
    const requiredFields = ['title', 'slug', 'shortDescription', 'primaryFunction'];
    const missingFields = requiredFields.filter((field) => !offering[field as keyof typeof offering]);

    if (missingFields.length > 0) {
      console.warn('⚠️  Missing required fields:', missingFields);
    } else {
      console.log('✅ All required fields present');
    }
    console.log('');

    // ===========================================
    // VERIFY ARRAYS
    // ===========================================
    console.log('📚 Array Fields Verification');
    console.log('-------------------------------------------');
    console.log('  Use Cases:', offering.useCases.length, 'items');
    console.log('  Pain Points:', offering.painPointsSolved.length, 'items');
    console.log('  Integrations:', offering.integrations.length, 'items');
    console.log('  Compliance Flags:', offering.complianceFlags.length, 'items');
    console.log('  ICP Industries:', offering.icpIndustry.length, 'items');
    console.log('  Regions:', offering.regions.length, 'items');
    console.log('');

    // ===========================================
    // VERIFY ICP (Ideal Customer Profile)
    // ===========================================
    console.log('🎯 ICP Verification');
    console.log('-------------------------------------------');
    console.log('  Team Size:', offering.icpTeamSize || 'Not set');
    console.log('  Industries:', offering.icpIndustry.join(', ') || 'Not set');
    console.log('  Company Stage:', offering.icpCompanyStage || 'Not set');
    console.log('  Budget:', offering.icpBudget || 'Not set');
    console.log('');

    // ===========================================
    // VERIFY EMBEDDING
    // ===========================================
    console.log('🔢 Embedding Verification');
    console.log('-------------------------------------------');

    if (offering.embedding && Array.isArray(offering.embedding)) {
      const embeddingLength = offering.embedding.length;
      const isValidDimensions = embeddingLength === 1536;

      console.log('  Dimensions:', embeddingLength);
      console.log('  Valid (1536 dims):', isValidDimensions ? '✅' : '❌');

      if (embeddingLength > 0) {
        const sampleValues = offering.embedding.slice(0, 5);
        console.log('  Sample values:', sampleValues.map(v => v.toFixed(4)).join(', '));
      }

      if (!isValidDimensions) {
        console.warn('⚠️  Invalid embedding dimensions. Expected 1536, got', embeddingLength);
      }
    } else {
      console.warn('⚠️  No embedding found');
    }
    console.log('');

    // ===========================================
    // VERIFY ENRICHMENT ANSWERS
    // ===========================================
    console.log('💬 Enrichment Answers Verification');
    console.log('-------------------------------------------');
    console.log('  Total Q&A Pairs:', offering.enrichmentAnswers.length);
    console.log('  AI Generated:', offering.enrichmentAnswers.filter(a => a.aiGenerated).length);
    console.log('');

    // Check for expected question count (should be ~37)
    if (offering.enrichmentAnswers.length < 30) {
      console.warn('⚠️  Low enrichment answer count. Expected ~37, got', offering.enrichmentAnswers.length);
    } else {
      console.log('✅ Enrichment answers complete');
    }

    // Show sample questions
    console.log('  Sample Questions:');
    offering.enrichmentAnswers.slice(0, 3).forEach((qa) => {
      console.log(`    - ${qa.question.slice(0, 60)}...`);
    });
    console.log('');

    // ===========================================
    // VERIFY PARTNER INTEGRATION
    // ===========================================
    console.log('🤝 Partner Integration Verification');
    console.log('-------------------------------------------');
    console.log('  Partner:', offering.partner.companyName);
    console.log('  Partner Total Offerings:', offering.partner.totalOfferings);
    console.log('');

    // ===========================================
    // VERIFY CATEGORY ASSIGNMENT
    // ===========================================
    console.log('📂 Category Assignment Verification');
    console.log('-------------------------------------------');

    if (offering.categories.length > 0) {
      offering.categories.forEach((cat) => {
        console.log('  Category:', cat.name, `(${cat.slug})`);
      });
      console.log('✅ Category assigned');
    } else {
      console.warn('⚠️  No category assigned');
    }
    console.log('');

    // ===========================================
    // FINAL SUMMARY
    // ===========================================
    console.log('🎉 Verification Complete!');
    console.log('===========================================');

    const checks = {
      basicFields: missingFields.length === 0,
      embedding: offering.embedding && offering.embedding.length === 1536,
      enrichmentAnswers: offering.enrichmentAnswers.length >= 30,
      category: offering.categories.length > 0,
      partner: !!offering.partner,
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
      console.log('✅ All checks passed! Offering is ready for AI Advisor. 🚀');
    } else {
      console.warn('⚠️  Some checks failed. Review above for details.');
    }

    console.log('');

    return {
      success: true,
      offering,
      checks,
      passedChecks,
      totalChecks,
    };
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run verification if executed directly
 * Usage: ts-node verify-database.ts <offeringId>
 */
if (require.main === module) {
  const offeringId = process.argv[2];

  if (!offeringId) {
    console.error('Usage: ts-node verify-database.ts <offeringId>');
    process.exit(1);
  }

  verifyOfferingCreation(offeringId)
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
