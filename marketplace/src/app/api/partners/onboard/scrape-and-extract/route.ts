// ============================================
// API: Scrape Website and Extract Structured Data
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { scrapeWebsite, extractTextFromHTML } from '@/lib/ai/website-scraper';
import { extractStructuredData } from '@/lib/ai/extraction-pipeline';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow partners and admins
    if (session.user.role !== 'vendor' && session.user.role !== 'partner' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only partners/admins can access onboarding' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { website, partnerId } = body;

    if (!website) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
    }

    // Determine which partner to mark as IN_PROGRESS
    let partnerToUpdate;
    if (session.user.role === 'admin' && partnerId) {
      partnerToUpdate = await prisma.partner.findUnique({
        where: { id: partnerId },
      });
    } else {
      partnerToUpdate = await prisma.partner.findUnique({
        where: { userId: session.user.id },
      });
    }

    if (partnerToUpdate) {
      if (session.user.role !== 'admin' && !isApprovedPartner(partnerToUpdate)) {
        return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
      }

      // Mark onboarding as IN_PROGRESS (if not already)
      if (partnerToUpdate.onboardingStatus === 'NOT_STARTED') {
        await prisma.partner.update({
          where: { id: partnerToUpdate.id },
          data: { onboardingStatus: 'IN_PROGRESS' },
        });
        console.log(`Marked partner ${partnerToUpdate.id} onboarding as IN_PROGRESS`);
      }
    }

    // Step 1: Scrape website
    console.log(`Scraping website: ${website}`);
    const scrapedContent = await scrapeWebsite(website);

    // Step 2: Extract text from HTML
    const homepageText = extractTextFromHTML(scrapedContent.homepage);

    // Step 3: Use AI to extract structured data
    console.log(`Extracting structured data for: ${website}`);
    const extractionResult = await extractStructuredData(
      website,
      homepageText,
      []
    );

    return NextResponse.json({
      success: true,
      partner: extractionResult.partner,
      offerings: extractionResult.offerings,
      message: `Successfully extracted ${extractionResult.offerings.length} offering(s)`,
    });
  } catch (error: any) {
    console.error('Scrape and extract error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scrape and extract data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
