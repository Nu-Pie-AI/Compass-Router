import { PrismaClient, ProviderType, ListingType, AnswerType, RatingSource } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================
// CATEGORIES DATA
// ============================================

const categories = [
  { slug: 'crm', name: 'CRM', description: 'Customer Relationship Management software', icon: 'users', order: 1 },
  { slug: 'accounting', name: 'Accounting', description: 'Accounting and financial management', icon: 'dollar-sign', order: 2 },
  { slug: 'hrtech', name: 'HRTech', description: 'Human Resources Technology', icon: 'briefcase', order: 3 },
  { slug: 'marketing', name: 'Marketing', description: 'Marketing automation and tools', icon: 'megaphone', order: 4 },
  { slug: 'it-services', name: 'IT Services', description: 'IT infrastructure and services', icon: 'server', order: 5 },
  { slug: 'cybersecurity', name: 'Cybersecurity', description: 'Security and data protection', icon: 'shield', order: 6 },
  { slug: 'erp', name: 'ERP', description: 'Enterprise Resource Planning', icon: 'database', order: 7 },
  { slug: 'inventory', name: 'Inventory', description: 'Inventory management systems', icon: 'package', order: 8 },
  { slug: 'procurement', name: 'Procurement', description: 'Procurement and purchasing', icon: 'shopping-bag', order: 9 },
  { slug: 'project-management', name: 'Project Management', description: 'Project and task management tools', icon: 'clipboard-list', order: 10 },
  { slug: 'field-workforce', name: 'Field Workforce Management', description: 'Field operations and workforce management', icon: 'map-pin', order: 11 },
  { slug: 'management', name: 'Management', description: 'General management software', icon: 'briefcase', order: 12 },
  { slug: 'helpdesk', name: 'Helpdesk', description: 'Customer support and ticketing', icon: 'headphones', order: 13 },
  { slug: 'bi-analytics', name: 'BI and Data Analytics', description: 'Business intelligence and analytics', icon: 'bar-chart', order: 14 },
  { slug: 'mdm', name: 'MDM', description: 'Master Data Management', icon: 'database', order: 15 },
  { slug: 'others', name: 'Others', description: 'Other business software', icon: 'grid', order: 16 },
];

// ============================================
// ONBOARDING QUESTIONS (37 Questions from CSV)
// ============================================

const onboardingQuestions = [
  // Q1
  {
    questionNumber: 1,
    category: 'Tools Ideal Fit',
    questionText: 'What problem category does your product solve?',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['CRM', 'Accounting', 'HRTech', 'Marketing', 'IT Services', 'Cybersecurity', 'ERP', 'Inventory', 'Procurement', 'Projects', 'Field workforce management', 'Management', 'Helpdesk', 'BI and Data Analytics', 'MDM', 'Others']),
    isRequired: true,
    displayOrder: 1,
  },
  // Q2
  {
    questionNumber: 2,
    category: 'Tools Ideal Fit',
    questionText: 'What are the top 5 use cases your product will solve? (in business language, not features)',
    answerType: AnswerType.TEXT,
    isRequired: true,
    displayOrder: 2,
  },
  // Q3 - Main question
  {
    questionNumber: 3,
    category: 'Tools Ideal Fit',
    questionText: 'Who is the best-fit customer?',
    answerType: AnswerType.MAIN_WITH_SUB,
    isRequired: true,
    displayOrder: 3,
  },
  // Q3a
  {
    questionNumber: 3,
    subQuestionId: 'a',
    category: 'Tools Ideal Fit',
    questionText: 'Target Industry',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 4,
  },
  // Q3b
  {
    questionNumber: 3,
    subQuestionId: 'b',
    category: 'Tools Ideal Fit',
    questionText: 'Target Company Size (Employee)',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)', '501–1,000 (Upper Mid)', '1,001–5,000 (Enterprise-lite)', '5,000+ (Enterprise)']),
    isRequired: true,
    displayOrder: 5,
  },
  // Q3c
  {
    questionNumber: 3,
    subQuestionId: 'c',
    category: 'Tools Ideal Fit',
    questionText: 'Target Company Size (Revenue)',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['< ₹5 Cr', '₹5–25 Cr', '₹25–100 Cr', '₹100–500 Cr', '₹500 Cr+']),
    isRequired: true,
    displayOrder: 6,
  },
  // Q3d
  {
    questionNumber: 3,
    subQuestionId: 'd',
    category: 'Tools Ideal Fit',
    questionText: 'Target Company Stage',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Pre-launch / Idea stage', 'Early operations (0–12 months running)', 'Early growth (basic processes forming)', 'Growth (scaling teams + multiple functions)', 'Expansion (multi-location / multi-entity)', 'Mature (process optimization + governance focus)', 'Turnaround / restructuring (cost control, efficiency focus)']),
    isRequired: true,
    displayOrder: 7,
  },
  // Q3e
  {
    questionNumber: 3,
    subQuestionId: 'e',
    category: 'Tools Ideal Fit',
    questionText: 'Target Company - any other details (Number of Products, regions of business, size of operational steps etc.)',
    answerType: AnswerType.TEXT,
    
    isRequired: false,
    displayOrder: 8,
  },
  // Q3f
  {
    questionNumber: 3,
    subQuestionId: 'f',
    category: 'Tools Ideal Fit',
    questionText: 'Target Region (Specify the regions you are targeting; It could be a specific state or country; For example, if your target is anyone within India/Global, mention India/Global and in case you are targeting specific states mention the states)',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 9,
  },
  // Q4 - Main question
  {
    questionNumber: 4,
    
    category: 'Tools Ideal Fit',
    questionText: 'Who is the primary buyer/user?',
    answerType: AnswerType.MAIN_WITH_SUB,
    
    isRequired: true,
    displayOrder: 10,
  },
  // Q4a
  {
    questionNumber: 4,
    subQuestionId: 'a',
    category: 'Tools Ideal Fit',
    questionText: 'Designation',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Founder', 'CXO', 'Directors', 'VPs', 'Managers', 'Leads']),
    isRequired: true,
    displayOrder: 11,
  },
  // Q4b
  {
    questionNumber: 4,
    subQuestionId: 'b',
    category: 'Tools Ideal Fit',
    questionText: 'Department',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Ops', 'Finance', 'IT', 'HR', 'Sales', 'Marketing', 'Planning', 'Analytics', 'Others']),
    isRequired: true,
    displayOrder: 12,
  },
  // Q5
  {
    questionNumber: 5,
    
    category: 'Tools Ideal Fit',
    questionText: 'What is the ideal situation where your tool will fit?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 13,
  },
  // Q6
  {
    questionNumber: 6,
    
    category: 'Tools Ideal Fit',
    questionText: 'What is the red flag situation where your tool will not work?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 14,
  },
  // Q7
  {
    questionNumber: 7,
    
    category: 'Outcomes & Impact',
    questionText: 'What measurable outcomes do customers typically get?',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Time saved', 'Accuracy', 'Margin', 'Productivity', 'Fewer stock-outs', 'Faster closing', 'Other (describe)']),
    isRequired: true,
    displayOrder: 15,
  },
  // Q8
  {
    questionNumber: 8,
    
    category: 'Outcomes & Impact',
    questionText: 'Provide 2–3 mini case studies (Cover: industry → problem → what you deployed → timeline → measurable outcome)',
    answerType: AnswerType.TEXT_WITH_SECTION,
    
    isRequired: true,
    displayOrder: 16,
  },
  // Q9
  {
    questionNumber: 9,
    
    category: 'Outcomes & Impact',
    questionText: 'By when will the user start seeing business value of the tool?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 17,
  },
  // Q10
  {
    questionNumber: 10,
    
    category: 'Outcomes & Impact',
    questionText: 'What internal effort on onboarding or learning needed from the customer?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 18,
  },
  // Q11
  {
    questionNumber: 11,
    
    category: 'Capabilities',
    questionText: 'List your key modules/features',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 19,
  },
  // Q12
  {
    questionNumber: 12,
    
    category: 'Capabilities',
    questionText: 'What functions within the category does it support? (example: lead → quote → invoice; requisition → PO → GRN; hire → onboarding → payroll)',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 20,
  },
  // Q13
  {
    questionNumber: 13,
    
    category: 'Model + Tech',
    questionText: 'Delivery model',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['SaaS', 'On-prem', 'Hybrid', 'Others']),
    isRequired: true,
    displayOrder: 21,
  },
  // Q15 (Q14 missing in original CSV)
  {
    questionNumber: 15,
    
    category: 'Model + Tech',
    questionText: 'Typical implementation',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Self-serve', 'Partner-led', 'Vendor-led', 'Others']),
    isRequired: true,
    displayOrder: 22,
  },
  // Q16
  {
    questionNumber: 16,
    
    category: 'Integration',
    questionText: 'What systems do you integrate with out-of-the-box? (Examples: Tally, SAP, Zoho, Shopify, WhatsApp, Razorpay, etc.)',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 23,
  },
  // Q17
  {
    questionNumber: 17,
    
    category: 'Integration',
    questionText: 'Integration methods',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['APIs', 'Webhooks', 'Connectors', 'RPA', 'Others', 'No Integration']),
    isRequired: true,
    displayOrder: 24,
  },
  // Q18
  {
    questionNumber: 18,
    
    category: 'Integration',
    questionText: 'Data import/export supported formats',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 25,
  },
  // Q19
  {
    questionNumber: 19,
    
    category: 'Integration',
    questionText: 'Data import/export supported frequency',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Real-time', 'Custom scheduled', 'Others']),
    isRequired: true,
    displayOrder: 26,
  },
  // Q20
  {
    questionNumber: 20,
    
    category: 'Integration',
    questionText: 'Do you support multi-entity?',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Yes', 'No']),
    isRequired: true,
    displayOrder: 27,
  },
  // Q21
  {
    questionNumber: 21,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Authentication methods supported',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['SSO', 'SAML', 'OAuth', 'MFA', 'Others']),
    isRequired: true,
    displayOrder: 28,
  },
  // Q22a
  {
    questionNumber: 22,
    subQuestionId: 'a',
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Which platform is the application & database hosted?',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Azure', 'GCP', 'Own servers', 'AWS', 'Others']),
    isRequired: true,
    displayOrder: 29,
  },
  // Q22b
  {
    questionNumber: 22,
    subQuestionId: 'b',
    category: 'Security, Compliance, and Access Controls',
    questionText: 'In which country is the data hosted?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 30,
  },
  // Q23
  {
    questionNumber: 23,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Role-based access control granularity',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Yes', 'No']),
    isRequired: true,
    displayOrder: 31,
  },
  // Q24
  {
    questionNumber: 24,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Certifications?',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['ISO 27001', 'SOC2', 'GDPR readiness', 'Others']),
    isRequired: false,
    displayOrder: 32,
  },
  // Q25
  {
    questionNumber: 25,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Data encryption?',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Yes', 'No']),
    isRequired: true,
    displayOrder: 33,
  },
  // Q26
  {
    questionNumber: 26,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Audit logs available?',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Yes', 'No']),
    isRequired: true,
    displayOrder: 34,
  },
  // Q27
  {
    questionNumber: 27,
    
    category: 'Security, Compliance, and Access Controls',
    questionText: 'Backup/DR policies',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 35,
  },
  // Q28
  {
    questionNumber: 28,
    
    category: 'Commercials (Pricing)',
    questionText: 'Pricing model',
    answerType: AnswerType.SINGLE_SELECT,
    options: JSON.stringify(['Per user', 'Per module', 'Per transaction', 'Per location', 'Pay as you go', 'Other']),
    isRequired: true,
    displayOrder: 36,
  },
  // Q29
  {
    questionNumber: 29,
    
    category: 'Commercials (Pricing)',
    questionText: 'Contract terms',
    answerType: AnswerType.MULTI_SELECT,
    options: JSON.stringify(['Monthly', 'Annual', 'Daily', 'Others']),
    isRequired: true,
    displayOrder: 37,
  },
  // Q30
  {
    questionNumber: 30,
    
    category: 'Commercials (Pricing)',
    questionText: 'Minimum duration of contract',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 38,
  },
  // Q31
  {
    questionNumber: 31,
    
    category: 'Commercials (Pricing)',
    questionText: 'Cancellation policy',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 39,
  },
  // Q32
  {
    questionNumber: 32,
    
    category: 'Implementation & Support',
    questionText: 'Typical implementation timeline by size',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 40,
  },
  // Q33
  {
    questionNumber: 33,
    
    category: 'Implementation & Support',
    questionText: 'Onboarding steps and implementation steps',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 41,
  },
  // Q34
  {
    questionNumber: 34,
    
    category: 'Implementation & Support',
    questionText: 'Is there training provided? In what form?',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 42,
  },
  // Q35
  {
    questionNumber: 35,
    
    category: 'Implementation & Support',
    questionText: 'Any support model',
    answerType: AnswerType.TEXT,
    
    isRequired: false,
    displayOrder: 43,
  },
  // Q36
  {
    questionNumber: 36,
    
    category: 'Implementation & Support',
    questionText: 'Escalation path and customer success ownership',
    answerType: AnswerType.TEXT,
    
    isRequired: true,
    displayOrder: 44,
  },
  // Q37
  {
    questionNumber: 37,
    
    category: 'Helping AI',
    questionText: 'The top 10 qualifying questions you ask a prospect before recommending your product. Also provide the best fit answer.',
    answerType: AnswerType.TEXT_WITH_SECTION,
    
    isRequired: true,
    displayOrder: 45,
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (in reverse dependency order)
  console.log('🧹 Clearing existing data...');
  await prisma.externalRating.deleteMany();
  await prisma.productClick.deleteMany();
  await prisma.productOnboardingAnswer.deleteMany();
  await prisma.productOnboardingQuestion.deleteMany();
  await prisma.reviewVote.deleteMany();
  await prisma.review.deleteMany();
  await prisma.pricingPlan.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.screenshot.deleteMany();
  await prisma.productView.deleteMany();
  await prisma.productVersion.deleteMany();
  await prisma.productStatusHistory.deleteMany();
  await prisma.vendorContact.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendorStatusHistory.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.searchAnalytics.deleteMany();
  await prisma.chatConversation.deleteMany();
  console.log('✅ Cleared existing data\n');

  // Seed categories
  console.log('📁 Seeding categories...');
  const createdCategories = await Promise.all(
    categories.map(cat => prisma.category.create({ data: cat }))
  );
  const catMap = Object.fromEntries(createdCategories.map(c => [c.slug, c.id]));
  console.log(`✅ Created ${createdCategories.length} categories\n`);

  // Seed onboarding questions
  console.log('❓ Seeding onboarding questions...');
  const createdQuestions = await Promise.all(
    onboardingQuestions.map(q => prisma.productOnboardingQuestion.create({ data: q }))
  );
  console.log(`✅ Created ${createdQuestions.length} onboarding questions\n`);

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@nexus.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });
  console.log(`✅ Created admin user: ${admin.email}\n`);

  // Create sample providers (vendors)
  console.log('🏢 Creating sample providers...');

  // Provider 1: Software Vendor - CRM
  const provider1User = await prisma.user.create({
    data: {
      email: 'sales@salesflow.com',
      password: await bcrypt.hash('password123', 10),
      name: 'SalesFlow Team',
      role: 'vendor',
    },
  });

  const provider1 = await prisma.vendor.create({
    data: {
      userId: provider1User.id,
      providerType: ProviderType.SOFTWARE_VENDOR,
      companyName: 'SalesFlow Inc',
      website: 'https://salesflow.com',
      industry: 'Technology',
      companySize: '51-200',
      description: 'SalesFlow is a modern CRM platform designed for SMBs to manage their sales pipeline efficiently.',
      contactEmail: 'sales@salesflow.com',
      contactPhone: '+1-555-0100',
      address: '123 Tech Street',
      city: 'San Francisco',
      country: 'USA',
      status: 'approved',
      onboardingComplete: true,
      approvedAt: new Date(),
    },
  });

  // Provider 2: Service Provider - Digital Transformation
  const provider2User = await prisma.user.create({
    data: {
      email: 'hello@digitaltransform.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Digital Transform Consulting',
      role: 'vendor',
    },
  });

  const provider2 = await prisma.vendor.create({
    data: {
      userId: provider2User.id,
      providerType: ProviderType.CONSULTING_FIRM,
      companyName: 'Digital Transform Consulting',
      website: 'https://digitaltransform.com',
      industry: 'Consulting',
      companySize: '11-50',
      description: 'We help SMBs navigate their digital transformation journey with strategy, implementation, and training.',
      contactEmail: 'hello@digitaltransform.com',
      contactPhone: '+1-555-0200',
      address: '456 Consulting Ave',
      city: 'New York',
      country: 'USA',
      status: 'approved',
      onboardingComplete: true,
      approvedAt: new Date(),
    },
  });

  // Provider 3: Hybrid - Software + Services
  const provider3User = await prisma.user.create({
    data: {
      email: 'info@accountpro.com',
      password: await bcrypt.hash('password123', 10),
      name: 'AccountPro Team',
      role: 'vendor',
    },
  });

  const provider3 = await prisma.vendor.create({
    data: {
      userId: provider3User.id,
      providerType: ProviderType.HYBRID,
      companyName: 'AccountPro Solutions',
      website: 'https://accountpro.com',
      industry: 'Finance',
      companySize: '11-50',
      description: 'AccountPro offers cloud accounting software plus implementation and training services.',
      contactEmail: 'info@accountpro.com',
      contactPhone: '+91-9876543210',
      address: '789 Finance Road',
      city: 'Mumbai',
      country: 'India',
      status: 'approved',
      onboardingComplete: true,
      approvedAt: new Date(),
    },
  });

  console.log(`✅ Created 3 providers\n`);

  // Create sample products with onboarding answers
  console.log('📦 Creating sample products with onboarding data...');

  // Product 1: SalesFlow CRM (Software Product)
  const product1 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'salesflow-crm',
      name: 'SalesFlow CRM',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'crm',
      smbFriendly: true,
      description: 'SalesFlow CRM is a modern, intuitive customer relationship management platform built specifically for small and medium businesses. Manage leads, track deals, automate follow-ups, and get insights—all in one place.',
      shortDescription: 'Modern CRM for SMBs to manage sales pipeline and customer relationships',
      logo: 'https://placehold.co/400x400/4DBC65/white?text=SF',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      website: 'https://salesflow.com',
      companyName: 'SalesFlow Inc',
      companySize: 'smb',
      founded: '2020',
      headquarters: 'San Francisco, CA',
      pricingModel: 'freemium',
      startingPrice: 29,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: true,
      averageRating: 4.7,
      reviewCount: 234,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product1.id },
    data: {
      categories: { connect: [{ id: catMap['crm'] }] },
    },
  });

  // Add features for Product 1
  await prisma.feature.createMany({
    data: [
      { productId: product1.id, name: 'Lead Management', description: 'Capture and qualify leads automatically', category: 'Core', order: 1 },
      { productId: product1.id, name: 'Pipeline Tracking', description: 'Visual pipeline with drag-and-drop', category: 'Core', order: 2 },
      { productId: product1.id, name: 'Email Integration', description: 'Connect Gmail, Outlook, and more', category: 'Integration', order: 3 },
      { productId: product1.id, name: 'Mobile App', description: 'iOS and Android apps included', category: 'General', order: 4 },
      { productId: product1.id, name: 'Reports & Analytics', description: 'Real-time sales dashboards', category: 'Analytics', order: 5 },
    ],
  });

  // Add pricing plans for Product 1
  await prisma.pricingPlan.createMany({
    data: [
      {
        productId: product1.id,
        name: 'Free',
        price: 0,
        billingCycle: 'monthly',
        features: ['Up to 100 contacts', '1 user', 'Basic pipeline', 'Email support'],
        order: 1,
      },
      {
        productId: product1.id,
        name: 'Starter',
        price: 29,
        billingCycle: 'monthly',
        features: ['Up to 1,000 contacts', '3 users', 'Email integration', 'Mobile app', 'Priority support'],
        popular: true,
        order: 2,
      },
      {
        productId: product1.id,
        name: 'Professional',
        price: 79,
        billingCycle: 'monthly',
        features: ['Unlimited contacts', 'Unlimited users', 'Advanced reports', 'API access', 'Dedicated account manager'],
        order: 3,
      },
    ],
  });

  // Add onboarding answers for Product 1 (sample answers to key questions)
  const question1 = createdQuestions.find(q => q.questionNumber === 1 && !q.subQuestionId);
  const question2 = createdQuestions.find(q => q.questionNumber === 2);
  const question3b = createdQuestions.find(q => q.questionNumber === 3 && q.subQuestionId === 'b');
  const question5 = createdQuestions.find(q => q.questionNumber === 5);
  const question7 = createdQuestions.find(q => q.questionNumber === 7);
  const question37 = createdQuestions.find(q => q.questionNumber === 37);

  await prisma.productOnboardingAnswer.createMany({
    data: [
      {
        productId: product1.id,
        questionId: question1!.id,
        answerJson: JSON.stringify(['CRM', 'Sales']),
      },
      {
        productId: product1.id,
        questionId: question2!.id,
        answerText: 'Lead management and follow-up automation, Sales pipeline visibility, Contact and deal tracking, Email integration and tracking, Sales forecasting and reporting',
      },
      {
        productId: product1.id,
        questionId: question3b!.id,
        answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']),
      },
      {
        productId: product1.id,
        questionId: question5!.id,
        answerText: 'Companies with 5-50 person sales teams that are struggling to track leads across spreadsheets, need better visibility into their pipeline, want to automate follow-ups, and are ready to invest in a proper CRM system.',
      },
      {
        productId: product1.id,
        questionId: question7!.id,
        answerJson: JSON.stringify(['Time saved', 'Faster closing', 'Productivity']),
      },
      {
        productId: product1.id,
        questionId: question37!.id,
        answerText: JSON.stringify([
          { question: 'How many sales reps do you have?', bestAnswer: '5-50 reps' },
          { question: 'Are you currently using a CRM?', bestAnswer: 'No, using spreadsheets' },
          { question: 'What is your average deal size?', bestAnswer: '$1k-$50k' },
          { question: 'How many deals do you close per month?', bestAnswer: '10-100 deals' },
          { question: 'Do you need email integration?', bestAnswer: 'Yes, Gmail/Outlook' },
          { question: 'Do you need mobile access?', bestAnswer: 'Yes' },
          { question: 'What is your monthly budget for CRM?', bestAnswer: '$50-$200' },
          { question: 'How quickly do you need to implement?', bestAnswer: 'Within 1 month' },
          { question: 'Do you need custom fields and workflows?', bestAnswer: 'Yes' },
          { question: 'Do you need API access?', bestAnswer: 'Not critical' },
        ]),
      },
    ],
  });

  // Add external ratings for Product 1
  await prisma.externalRating.createMany({
    data: [
      { productId: product1.id, source: RatingSource.G2, rating: 4.6, reviewCount: 543, url: 'https://g2.com/products/salesflow' },
      { productId: product1.id, source: RatingSource.CAPTERRA, rating: 4.7, reviewCount: 234, url: 'https://capterra.com/software/salesflow' },
    ],
  });

  console.log(`✅ Created product: ${product1.name}`);

  // Product 2: Digital Transformation Consulting Service
  const product2 = await prisma.product.create({
    data: {
      vendorId: provider2.id,
      slug: 'digital-transformation-consulting',
      name: 'Digital Transformation Consulting',
      listingType: ListingType.PROFESSIONAL_SERVICE,
      primaryFunction: 'management',
      smbFriendly: true,
      description: 'End-to-end digital transformation consulting for SMBs. We help you assess your current state, define your digital strategy, select the right tools, and implement solutions that drive business growth.',
      shortDescription: 'Strategic consulting to guide SMBs through digital transformation',
      logo: 'https://placehold.co/400x400/3772FF/white?text=DTC',
      website: 'https://digitaltransform.com',
      companyName: 'Digital Transform Consulting',
      companySize: 'smb',
      founded: '2018',
      headquarters: 'New York, NY',
      pricingModel: 'custom',
      startingPrice: 5000,
      hasFreeTrial: false,
      status: 'published',
      featured: true,
      averageRating: 4.9,
      reviewCount: 67,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product2.id },
    data: {
      categories: { connect: [{ id: catMap['management'] }] },
    },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product2.id, name: 'Digital Readiness Assessment', description: 'Comprehensive evaluation of your current state', category: 'Consulting', order: 1 },
      { productId: product2.id, name: 'Strategy Development', description: 'Custom digital transformation roadmap', category: 'Consulting', order: 2 },
      { productId: product2.id, name: 'Tool Selection & Evaluation', description: 'Expert guidance on selecting the right software', category: 'Consulting', order: 3 },
      { productId: product2.id, name: 'Implementation Support', description: 'Hands-on help deploying solutions', category: 'Implementation', order: 4 },
      { productId: product2.id, name: 'Change Management', description: 'Training and adoption support', category: 'Training', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      {
        productId: product2.id,
        questionId: question1!.id,
        answerJson: JSON.stringify(['Management', 'IT Services']),
      },
      {
        productId: product2.id,
        questionId: question2!.id,
        answerText: 'Digital strategy development, Technology stack evaluation and selection, Process automation and optimization, Change management and team training, ROI measurement and reporting',
      },
      {
        productId: product2.id,
        questionId: question3b!.id,
        answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']),
      },
      {
        productId: product2.id,
        questionId: question5!.id,
        answerText: 'Companies with 20-500 employees that are still heavily reliant on manual processes, have outdated technology, struggle with data silos, and are ready to invest in comprehensive digital transformation with executive buy-in.',
      },
      {
        productId: product2.id,
        questionId: question7!.id,
        answerJson: JSON.stringify(['Time saved', 'Productivity', 'Accuracy', 'Margin']),
      },
    ],
  });

  console.log(`✅ Created product: ${product2.name}`);

  // Product 3: AccountPro Cloud (Hybrid - Software + Services)
  const product3 = await prisma.product.create({
    data: {
      vendorId: provider3.id,
      slug: 'accountpro-cloud',
      name: 'AccountPro Cloud',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'accounting',
      smbFriendly: true,
      description: 'AccountPro Cloud is a comprehensive accounting software with full implementation and training services. Get GST-compliant accounting, invoicing, expense management, and financial reporting—plus expert help setting it all up.',
      shortDescription: 'Cloud accounting software with implementation services for Indian SMBs',
      logo: 'https://placehold.co/400x400/F2CD5D/333?text=AP',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      website: 'https://accountpro.com',
      companyName: 'AccountPro Solutions',
      companySize: 'smb',
      founded: '2019',
      headquarters: 'Mumbai, India',
      pricingModel: 'paid',
      startingPrice: 999,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: true,
      averageRating: 4.5,
      reviewCount: 156,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product3.id },
    data: {
      categories: { connect: [{ id: catMap['accounting'] }] },
    },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product3.id, name: 'GST Compliance', description: 'GSTR-1, GSTR-3B auto-filing', category: 'Compliance', order: 1 },
      { productId: product3.id, name: 'Invoicing', description: 'Professional invoices with e-way bills', category: 'Core', order: 2 },
      { productId: product3.id, name: 'Expense Tracking', description: 'Mobile app for receipt scanning', category: 'Core', order: 3 },
      { productId: product3.id, name: 'Tally Integration', description: 'Import/export data from Tally', category: 'Integration', order: 4 },
      { productId: product3.id, name: 'Implementation Service', description: 'Free setup and data migration', category: 'Service', order: 5 },
    ],
  });

  await prisma.pricingPlan.createMany({
    data: [
      {
        productId: product3.id,
        name: 'Basic',
        price: 999,
        billingCycle: 'monthly',
        currency: 'INR',
        features: ['1 company', '2 users', 'GST filing', 'Basic reports', 'Email support'],
        order: 1,
      },
      {
        productId: product3.id,
        name: 'Professional',
        price: 2499,
        billingCycle: 'monthly',
        currency: 'INR',
        features: ['3 companies', '5 users', 'Advanced reports', 'Tally integration', 'Priority support', 'Free implementation'],
        popular: true,
        order: 2,
      },
      {
        productId: product3.id,
        name: 'Enterprise',
        price: 4999,
        billingCycle: 'monthly',
        currency: 'INR',
        features: ['Unlimited companies', 'Unlimited users', 'Custom workflows', 'API access', 'Dedicated account manager', 'Free training'],
        order: 3,
      },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      {
        productId: product3.id,
        questionId: question1!.id,
        answerJson: JSON.stringify(['Accounting', 'ERP']),
      },
      {
        productId: product3.id,
        questionId: question2!.id,
        answerText: 'GST-compliant invoicing and tax filing, Real-time financial visibility, Expense tracking and approval workflows, Bank reconciliation automation, Multi-location accounting',
      },
      {
        productId: product3.id,
        questionId: question3b!.id,
        answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']),
      },
      {
        productId: product3.id,
        questionId: question5!.id,
        answerText: 'Indian SMBs with ₹5Cr-₹100Cr revenue, 10-200 employees, currently using Tally or spreadsheets, needing GST compliance, wanting cloud access, and willing to invest in proper accounting software with implementation support.',
      },
      {
        productId: product3.id,
        questionId: question7!.id,
        answerJson: JSON.stringify(['Time saved', 'Accuracy', 'Fewer stock-outs']),
      },
    ],
  });

  await prisma.externalRating.create({
    data: {
      productId: product3.id,
      source: RatingSource.GOOGLE,
      rating: 4.4,
      reviewCount: 89,
      url: 'https://google.com/reviews/accountpro',
    },
  });

  console.log(`✅ Created product: ${product3.name}\n`);

  // ============================================
  // ADDITIONAL PRODUCTS FOR AI TESTING (17 MORE)
  // ============================================

  console.log('📦 Creating additional products for robust AI testing...\n');

  // === CRM CATEGORY ===

  // Product 4: PipelineHub - Low budget CRM for micro teams
  const product4 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'pipelinehub-crm',
      name: 'PipelineHub',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'crm',
      smbFriendly: true,
      description: 'Ultra-affordable CRM for solopreneurs and micro teams. Get started with lead tracking, basic pipeline management, and email sync—without breaking the bank.',
      shortDescription: 'Budget-friendly CRM for freelancers and micro businesses',
      logo: 'https://placehold.co/400x400/FF6B6B/white?text=PH',
      website: 'https://pipelinehub.com',
      companyName: 'PipelineHub Inc',
      companySize: 'startup',
      founded: '2022',
      headquarters: 'Austin, TX',
      pricingModel: 'freemium',
      startingPrice: 9,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.2,
      reviewCount: 89,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product4.id },
    data: { categories: { connect: [{ id: catMap['crm'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product4.id, name: 'Contact Management', description: 'Organize up to 500 contacts', category: 'Core', order: 1 },
      { productId: product4.id, name: 'Simple Pipeline', description: 'Drag-and-drop deal stages', category: 'Core', order: 2 },
      { productId: product4.id, name: 'Gmail Sync', description: 'Two-way email sync', category: 'Integration', order: 3 },
      { productId: product4.id, name: 'Activity Timeline', description: 'Track all interactions', category: 'General', order: 4 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product4.id, questionId: question1!.id, answerJson: JSON.stringify(['CRM']) },
      { productId: product4.id, questionId: question2!.id, answerText: 'Basic lead tracking for freelancers, Simple contact organization, Email activity logging, Deal stage visualization, Budget-conscious sales management' },
      { productId: product4.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)']) },
      { productId: product4.id, questionId: question5!.id, answerText: 'Solopreneurs and teams of 1-5 people who are just starting out, have a tight budget (under $50/month), currently using spreadsheets or paper, and need basic lead tracking without complexity.' },
      { productId: product4.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Productivity']) },
      { productId: product4.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many people on your team?', bestAnswer: '1-5 people' },
        { question: 'What is your monthly budget?', bestAnswer: 'Under $50' },
        { question: 'Are you currently using any CRM?', bestAnswer: 'No, using spreadsheets' },
        { question: 'How urgent is your need?', bestAnswer: 'Need it this week' },
        { question: 'Do you need advanced features?', bestAnswer: 'No, just basics' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product4.name}`);

  // Product 5: EnterpriseFlow CRM - Enterprise-grade CRM
  const product5 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'enterpriseflow-crm',
      name: 'EnterpriseFlow CRM',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'crm',
      smbFriendly: false,
      description: 'Enterprise-grade CRM for growing businesses. Advanced automation, custom workflows, territory management, forecasting, and enterprise integrations for teams that need power and flexibility.',
      shortDescription: 'Advanced CRM for mid-market and enterprise teams',
      logo: 'https://placehold.co/400x400/2D3561/white?text=EF',
      website: 'https://enterpriseflow.com',
      companyName: 'EnterpriseFlow Corp',
      companySize: 'enterprise',
      founded: '2017',
      headquarters: 'Boston, MA',
      pricingModel: 'paid',
      startingPrice: 499,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: true,
      averageRating: 4.8,
      reviewCount: 421,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product5.id },
    data: { categories: { connect: [{ id: catMap['crm'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product5.id, name: 'Advanced Automation', description: 'Complex workflow automation', category: 'Core', order: 1 },
      { productId: product5.id, name: 'Territory Management', description: 'Assign and track sales territories', category: 'Core', order: 2 },
      { productId: product5.id, name: 'AI Sales Forecasting', description: 'Predictive analytics for pipeline', category: 'Analytics', order: 3 },
      { productId: product5.id, name: 'Salesforce Integration', description: 'Migrate from Salesforce easily', category: 'Integration', order: 4 },
      { productId: product5.id, name: 'Custom Objects', description: 'Build custom data models', category: 'Advanced', order: 5 },
      { productId: product5.id, name: 'API & Webhooks', description: 'Full REST API access', category: 'Integration', order: 6 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product5.id, questionId: question1!.id, answerJson: JSON.stringify(['CRM', 'Management']) },
      { productId: product5.id, questionId: question2!.id, answerText: 'Complex sales process automation, Multi-team territory management, Advanced forecasting and analytics, Enterprise system integration, Custom workflow orchestration' },
      { productId: product5.id, questionId: question3b!.id, answerJson: JSON.stringify(['201–500 (Mid)', '501–1,000 (Upper Mid)', '1,001–5,000 (Enterprise-lite)']) },
      { productId: product5.id, questionId: question5!.id, answerText: 'Companies with 200+ employees, multiple sales teams, complex sales processes, need for custom workflows, enterprise integrations (Salesforce, SAP, etc.), and budget of $500+/user/month.' },
      { productId: product5.id, questionId: question7!.id, answerJson: JSON.stringify(['Faster closing', 'Productivity', 'Margin', 'Accuracy']) },
      { productId: product5.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How large is your sales organization?', bestAnswer: '50+ sales reps' },
        { question: 'Do you need territory management?', bestAnswer: 'Yes, multiple territories' },
        { question: 'What is your CRM budget per user?', bestAnswer: '$500+ per user/month' },
        { question: 'Do you need Salesforce migration?', bestAnswer: 'Yes' },
        { question: 'Do you need custom workflows?', bestAnswer: 'Yes, very complex' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product5.name}`);

  // === MARKETING AUTOMATION ===

  // Product 6: MailFlow Pro
  const product6 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'mailflow-pro',
      name: 'MailFlow Pro',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'marketing',
      smbFriendly: true,
      description: 'Email marketing automation made simple. Create beautiful campaigns, automate nurture sequences, segment your audience, and track performance—all without the complexity.',
      shortDescription: 'Email marketing automation for SMBs',
      logo: 'https://placehold.co/400x400/9B59B6/white?text=MF',
      website: 'https://mailflowpro.com',
      companyName: 'MailFlow Inc',
      companySize: 'smb',
      founded: '2021',
      headquarters: 'Portland, OR',
      pricingModel: 'paid',
      startingPrice: 49,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.4,
      reviewCount: 312,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product6.id },
    data: { categories: { connect: [{ id: catMap['marketing'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product6.id, name: 'Drag-Drop Email Builder', description: 'Visual email designer', category: 'Core', order: 1 },
      { productId: product6.id, name: 'Marketing Automation', description: 'Automated drip campaigns', category: 'Core', order: 2 },
      { productId: product6.id, name: 'List Segmentation', description: 'Target specific audiences', category: 'Core', order: 3 },
      { productId: product6.id, name: 'A/B Testing', description: 'Test subject lines and content', category: 'Analytics', order: 4 },
      { productId: product6.id, name: 'Landing Pages', description: 'Create conversion-optimized pages', category: 'General', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product6.id, questionId: question1!.id, answerJson: JSON.stringify(['Marketing']) },
      { productId: product6.id, questionId: question2!.id, answerText: 'Email campaign creation and delivery, Automated nurture sequences, Audience segmentation and targeting, Email performance tracking, Lead capture and conversion' },
      { productId: product6.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']) },
      { productId: product6.id, questionId: question5!.id, answerText: 'SMBs with 5-100 employees, marketing teams of 1-5 people, email list of 500-50K subscribers, need for email automation, budget of $50-$300/month.' },
      { productId: product6.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Faster closing', 'Productivity']) },
      { productId: product6.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How large is your email list?', bestAnswer: '500-50,000 subscribers' },
        { question: 'Do you need automation?', bestAnswer: 'Yes, drip campaigns' },
        { question: 'What is your marketing budget?', bestAnswer: '$50-$300/month' },
        { question: 'Do you need landing pages?', bestAnswer: 'Yes' },
        { question: 'How often do you send emails?', bestAnswer: 'Weekly' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product6.name}`);

  // Product 7: MarketBoost - All-in-one marketing
  const product7 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'marketboost-platform',
      name: 'MarketBoost',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'marketing',
      smbFriendly: true,
      description: 'All-in-one marketing platform: Email, social media, SEO, content calendar, analytics, and more. One tool to replace your entire marketing stack.',
      shortDescription: 'Complete marketing automation platform for growing businesses',
      logo: 'https://placehold.co/400x400/E67E22/white?text=MB',
      website: 'https://marketboost.com',
      companyName: 'MarketBoost LLC',
      companySize: 'smb',
      founded: '2019',
      headquarters: 'Denver, CO',
      pricingModel: 'paid',
      startingPrice: 199,
      hasFreeTrial: true,
      freeTrialDays: 21,
      status: 'published',
      featured: true,
      averageRating: 4.6,
      reviewCount: 567,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product7.id },
    data: { categories: { connect: [{ id: catMap['marketing'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product7.id, name: 'Email + SMS Marketing', description: 'Multi-channel campaigns', category: 'Core', order: 1 },
      { productId: product7.id, name: 'Social Media Manager', description: 'Schedule posts across platforms', category: 'Core', order: 2 },
      { productId: product7.id, name: 'Content Calendar', description: 'Plan your marketing calendar', category: 'General', order: 3 },
      { productId: product7.id, name: 'SEO Tools', description: 'Keyword research and tracking', category: 'Core', order: 4 },
      { productId: product7.id, name: 'Marketing Analytics', description: 'Cross-channel attribution', category: 'Analytics', order: 5 },
      { productId: product7.id, name: 'CRM Integration', description: 'Connect with your CRM', category: 'Integration', order: 6 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product7.id, questionId: question1!.id, answerJson: JSON.stringify(['Marketing', 'CRM']) },
      { productId: product7.id, questionId: question2!.id, answerText: 'Unified marketing campaign management, Multi-channel customer engagement, Marketing performance tracking, Content planning and scheduling, Lead generation and nurturing' },
      { productId: product7.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product7.id, questionId: question5!.id, answerText: 'Growing businesses with dedicated marketing teams, 20-500 employees, need to consolidate multiple tools, running multi-channel campaigns, budget of $200-$500/month.' },
      { productId: product7.id, questionId: question7!.id, answerJson: JSON.stringify(['Productivity', 'Time saved', 'Faster closing']) },
      { productId: product7.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many marketing tools do you currently use?', bestAnswer: '5+ tools' },
        { question: 'Do you run multi-channel campaigns?', bestAnswer: 'Yes (email, social, SEO)' },
        { question: 'Size of marketing team?', bestAnswer: '3-10 people' },
        { question: 'What is your marketing software budget?', bestAnswer: '$200-$500/month' },
        { question: 'Do you need social media management?', bestAnswer: 'Yes' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product7.name}`);

  // Product 8: GrowthHacker - Growth marketing for startups
  const product8 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'growthhacker',
      name: 'GrowthHacker',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'marketing',
      smbFriendly: true,
      description: 'Growth marketing platform designed for early-stage startups. Rapid experimentation, viral loops, referral programs, and growth analytics—without enterprise pricing.',
      shortDescription: 'Growth marketing tools for startups and early-stage companies',
      logo: 'https://placehold.co/400x400/1ABC9C/white?text=GH',
      website: 'https://growthhacker.io',
      companyName: 'GrowthHacker Inc',
      companySize: 'startup',
      founded: '2023',
      headquarters: 'San Francisco, CA',
      pricingModel: 'freemium',
      startingPrice: 0,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: false,
      averageRating: 4.3,
      reviewCount: 145,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product8.id },
    data: { categories: { connect: [{ id: catMap['marketing'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product8.id, name: 'Referral Programs', description: 'Built-in viral referral engine', category: 'Core', order: 1 },
      { productId: product8.id, name: 'A/B Testing', description: 'Rapid experiment framework', category: 'Core', order: 2 },
      { productId: product8.id, name: 'Growth Analytics', description: 'Cohort and funnel analysis', category: 'Analytics', order: 3 },
      { productId: product8.id, name: 'Email Capture', description: 'Pop-ups and lead magnets', category: 'General', order: 4 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product8.id, questionId: question1!.id, answerJson: JSON.stringify(['Marketing']) },
      { productId: product8.id, questionId: question2!.id, answerText: 'Viral growth and referral programs, Rapid marketing experimentation, Early-stage customer acquisition, Product-led growth enablement, Startup-friendly marketing automation' },
      { productId: product8.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)']) },
      { productId: product8.id, questionId: question5!.id, answerText: 'Pre-seed to Series A startups, product-led growth companies, limited marketing budget (under $100/month), need viral loops and referrals, early growth stage (0-24 months).' },
      { productId: product8.id, questionId: question7!.id, answerJson: JSON.stringify(['Faster closing', 'Productivity', 'Time saved']) },
      { productId: product8.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'What is your company stage?', bestAnswer: 'Pre-seed to Series A' },
        { question: 'Do you need referral programs?', bestAnswer: 'Yes, critical for growth' },
        { question: 'What is your marketing budget?', bestAnswer: 'Under $100/month' },
        { question: 'Are you product-led growth?', bestAnswer: 'Yes' },
        { question: 'How urgent is customer acquisition?', bestAnswer: 'Very urgent' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product8.name}`);

  // === ACCOUNTING ===

  // Product 9: QuickLedger - Simple accounting for freelancers
  const product9 = await prisma.product.create({
    data: {
      vendorId: provider3.id,
      slug: 'quickledger',
      name: 'QuickLedger',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'accounting',
      smbFriendly: true,
      description: 'Simple accounting for freelancers and consultants. Track income, expenses, create invoices, and prepare for tax season—without the complexity of full accounting software.',
      shortDescription: 'Lightweight accounting for freelancers and solopreneurs',
      logo: 'https://placehold.co/400x400/3498DB/white?text=QL',
      website: 'https://quickledger.com',
      companyName: 'QuickLedger Inc',
      companySize: 'startup',
      founded: '2021',
      headquarters: 'Seattle, WA',
      pricingModel: 'freemium',
      startingPrice: 15,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: false,
      averageRating: 4.1,
      reviewCount: 203,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product9.id },
    data: { categories: { connect: [{ id: catMap['accounting'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product9.id, name: 'Simple Invoicing', description: 'Create and send invoices in minutes', category: 'Core', order: 1 },
      { productId: product9.id, name: 'Expense Tracking', description: 'Photo receipts, categorize expenses', category: 'Core', order: 2 },
      { productId: product9.id, name: 'Tax Reports', description: 'Quarterly and annual tax summaries', category: 'Compliance', order: 3 },
      { productId: product9.id, name: 'Bank Sync', description: 'Auto-import transactions', category: 'Integration', order: 4 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product9.id, questionId: question1!.id, answerJson: JSON.stringify(['Accounting']) },
      { productId: product9.id, questionId: question2!.id, answerText: 'Simple income and expense tracking, Professional invoice creation, Tax preparation support, Cash flow visibility, Receipt management' },
      { productId: product9.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)']) },
      { productId: product9.id, questionId: question5!.id, answerText: 'Freelancers, consultants, solopreneurs with simple finances, under $500K annual revenue, no employees, need basic invoicing and expense tracking, budget under $50/month.' },
      { productId: product9.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Accuracy']) },
      { productId: product9.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Do you have employees?', bestAnswer: 'No, just me' },
        { question: 'What is your annual revenue?', bestAnswer: 'Under $500K' },
        { question: 'Do you need inventory management?', bestAnswer: 'No' },
        { question: 'What is your accounting budget?', bestAnswer: 'Under $50/month' },
        { question: 'How complex are your finances?', bestAnswer: 'Very simple' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product9.name}`);

  // Product 10: TaxMaster Pro - Tax compliance + accounting
  const product10 = await prisma.product.create({
    data: {
      vendorId: provider3.id,
      slug: 'taxmaster-pro',
      name: 'TaxMaster Pro',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'accounting',
      smbFriendly: true,
      description: 'Advanced accounting with tax compliance automation. GST, TDS, professional tax filing, audit support, and CA collaboration features for Indian businesses.',
      shortDescription: 'Tax-first accounting software for Indian SMBs',
      logo: 'https://placehold.co/400x400/E74C3C/white?text=TM',
      website: 'https://taxmasterpro.in',
      companyName: 'TaxMaster Solutions',
      companySize: 'smb',
      founded: '2018',
      headquarters: 'Bangalore, India',
      pricingModel: 'paid',
      startingPrice: 299,
      hasFreeTrial: true,
      freeTrialDays: 15,
      status: 'published',
      featured: true,
      averageRating: 4.7,
      reviewCount: 389,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product10.id },
    data: { categories: { connect: [{ id: catMap['accounting'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product10.id, name: 'GST Auto-Filing', description: 'GSTR-1, 3B, 9 automation', category: 'Compliance', order: 1 },
      { productId: product10.id, name: 'TDS Management', description: 'TDS calculation and filing', category: 'Compliance', order: 2 },
      { productId: product10.id, name: 'E-Invoice', description: 'Government-compliant e-invoicing', category: 'Core', order: 3 },
      { productId: product10.id, name: 'CA Portal', description: 'Collaborate with your CA', category: 'General', order: 4 },
      { productId: product10.id, name: 'Audit Trail', description: 'Complete audit logs', category: 'Compliance', order: 5 },
      { productId: product10.id, name: 'Multi-Entity', description: 'Manage multiple companies', category: 'Advanced', order: 6 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product10.id, questionId: question1!.id, answerJson: JSON.stringify(['Accounting']) },
      { productId: product10.id, questionId: question2!.id, answerText: 'Automated GST compliance and filing, TDS calculation and returns, E-invoicing and e-way bills, CA collaboration and audit support, Multi-entity consolidated reporting' },
      { productId: product10.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product10.id, questionId: question5!.id, answerText: 'Indian businesses with ₹5Cr+ revenue, GST-registered, 10-500 employees, need comprehensive tax compliance, working with CA, budget of ₹15K-₹50K per year.' },
      { productId: product10.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Accuracy', 'Productivity']) },
      { productId: product10.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Are you GST registered?', bestAnswer: 'Yes' },
        { question: 'What is your annual revenue?', bestAnswer: '₹5Cr-₹100Cr' },
        { question: 'Do you need TDS management?', bestAnswer: 'Yes' },
        { question: 'Do you work with a CA?', bestAnswer: 'Yes' },
        { question: 'How many entities do you manage?', bestAnswer: '1-5 entities' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product10.name}`);

  // === HELPDESK ===

  // Product 11: SupportDesk
  const product11 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'supportdesk',
      name: 'SupportDesk',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'helpdesk',
      smbFriendly: true,
      description: 'Customer support ticketing made simple. Email, chat, and social media tickets in one place. Knowledge base, canned responses, and customer satisfaction tracking.',
      shortDescription: 'Affordable helpdesk for small support teams',
      logo: 'https://placehold.co/400x400/16A085/white?text=SD',
      website: 'https://supportdesk.io',
      companyName: 'SupportDesk Inc',
      companySize: 'smb',
      founded: '2020',
      headquarters: 'Austin, TX',
      pricingModel: 'paid',
      startingPrice: 25,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.4,
      reviewCount: 278,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product11.id },
    data: { categories: { connect: [{ id: catMap['helpdesk'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product11.id, name: 'Multi-Channel Tickets', description: 'Email, chat, social in one inbox', category: 'Core', order: 1 },
      { productId: product11.id, name: 'Knowledge Base', description: 'Self-service help center', category: 'Core', order: 2 },
      { productId: product11.id, name: 'Canned Responses', description: 'Save time with templates', category: 'General', order: 3 },
      { productId: product11.id, name: 'CSAT Surveys', description: 'Measure customer satisfaction', category: 'Analytics', order: 4 },
      { productId: product11.id, name: 'SLA Management', description: 'Track response times', category: 'Core', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product11.id, questionId: question1!.id, answerJson: JSON.stringify(['Helpdesk']) },
      { productId: product11.id, questionId: question2!.id, answerText: 'Multi-channel ticket management, Self-service knowledge base, Support team collaboration, Customer satisfaction tracking, Response time optimization' },
      { productId: product11.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']) },
      { productId: product11.id, questionId: question5!.id, answerText: 'SMBs with 1-10 support agents, handling 100-2000 tickets/month, need to consolidate email/chat/social, budget of $25-$150/agent/month.' },
      { productId: product11.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Productivity', 'Accuracy']) },
      { productId: product11.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many support agents?', bestAnswer: '1-10 agents' },
        { question: 'Tickets per month?', bestAnswer: '100-2,000' },
        { question: 'Support channels needed?', bestAnswer: 'Email, chat, social' },
        { question: 'Budget per agent?', bestAnswer: '$25-$150/month' },
        { question: 'Need knowledge base?', bestAnswer: 'Yes' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product11.name}`);

  // Product 12: ServiceHub Enterprise
  const product12 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'servicehub-enterprise',
      name: 'ServiceHub Enterprise',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'helpdesk',
      smbFriendly: false,
      description: 'Enterprise-grade customer service platform. Omnichannel support, advanced automation, AI-powered routing, custom SLAs, and comprehensive analytics for large support teams.',
      shortDescription: 'Advanced helpdesk for enterprise support operations',
      logo: 'https://placehold.co/400x400/8E44AD/white?text=SH',
      website: 'https://servicehub.com',
      companyName: 'ServiceHub Corp',
      companySize: 'enterprise',
      founded: '2016',
      headquarters: 'Seattle, WA',
      pricingModel: 'paid',
      startingPrice: 399,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: true,
      averageRating: 4.8,
      reviewCount: 892,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product12.id },
    data: { categories: { connect: [{ id: catMap['helpdesk'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product12.id, name: 'AI-Powered Routing', description: 'Smart ticket assignment', category: 'Core', order: 1 },
      { productId: product12.id, name: 'Omnichannel Support', description: 'All channels unified', category: 'Core', order: 2 },
      { productId: product12.id, name: 'Advanced Analytics', description: 'Custom dashboards and reports', category: 'Analytics', order: 3 },
      { productId: product12.id, name: 'Workflow Automation', description: 'Complex automation rules', category: 'Advanced', order: 4 },
      { productId: product12.id, name: 'API & Integrations', description: 'CRM, ERP, custom integrations', category: 'Integration', order: 5 },
      { productId: product12.id, name: 'Multi-Brand Support', description: 'Manage multiple brands', category: 'Advanced', order: 6 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product12.id, questionId: question1!.id, answerJson: JSON.stringify(['Helpdesk', 'Management']) },
      { productId: product12.id, questionId: question2!.id, answerText: 'Enterprise-scale ticket management, AI-driven support automation, Multi-brand customer service, Advanced SLA enforcement, Comprehensive support analytics' },
      { productId: product12.id, questionId: question3b!.id, answerJson: JSON.stringify(['201–500 (Mid)', '501–1,000 (Upper Mid)', '1,001–5,000 (Enterprise-lite)']) },
      { productId: product12.id, questionId: question5!.id, answerText: 'Companies with 50+ support agents, 10K+ tickets/month, multiple brands or products, complex SLA requirements, need for advanced automation, budget $400+/agent/month.' },
      { productId: product12.id, questionId: question7!.id, answerJson: JSON.stringify(['Productivity', 'Time saved', 'Accuracy']) },
      { productId: product12.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Size of support team?', bestAnswer: '50+ agents' },
        { question: 'Monthly ticket volume?', bestAnswer: '10,000+ tickets' },
        { question: 'Need AI routing?', bestAnswer: 'Yes, critical' },
        { question: 'Multi-brand support needed?', bestAnswer: 'Yes' },
        { question: 'Budget per agent?', bestAnswer: '$400+/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product12.name}`);

  // === HR ===

  // Product 13: PeopleFirst
  const product13 = await prisma.product.create({
    data: {
      vendorId: provider2.id,
      slug: 'peoplefirst-hr',
      name: 'PeopleFirst',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'hrtech',
      smbFriendly: true,
      description: 'All-in-one HR platform for SMBs. Employee database, leave management, performance reviews, document management, and employee self-service portal.',
      shortDescription: 'Complete HR management for small and medium businesses',
      logo: 'https://placehold.co/400x400/27AE60/white?text=PF',
      website: 'https://peoplefirst.com',
      companyName: 'PeopleFirst Inc',
      companySize: 'smb',
      founded: '2019',
      headquarters: 'Chicago, IL',
      pricingModel: 'paid',
      startingPrice: 79,
      hasFreeTrial: true,
      freeTrialDays: 21,
      status: 'published',
      featured: true,
      averageRating: 4.5,
      reviewCount: 445,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product13.id },
    data: { categories: { connect: [{ id: catMap['hrtech'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product13.id, name: 'Employee Database', description: 'Complete employee records', category: 'Core', order: 1 },
      { productId: product13.id, name: 'Leave Management', description: 'Automated leave tracking', category: 'Core', order: 2 },
      { productId: product13.id, name: 'Performance Reviews', description: '360° feedback and goals', category: 'Core', order: 3 },
      { productId: product13.id, name: 'Document Manager', description: 'Secure document storage', category: 'General', order: 4 },
      { productId: product13.id, name: 'Employee Self-Service', description: 'Portal for employees', category: 'General', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product13.id, questionId: question1!.id, answerJson: JSON.stringify(['HRTech']) },
      { productId: product13.id, questionId: question2!.id, answerText: 'Employee data centralization, Leave and attendance automation, Performance management, HR document organization, Employee self-service enablement' },
      { productId: product13.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product13.id, questionId: question5!.id, answerText: 'SMBs with 10-500 employees, HR team of 1-5 people, currently using spreadsheets, need to automate HR processes, budget of $75-$300/month.' },
      { productId: product13.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Productivity', 'Accuracy']) },
      { productId: product13.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many employees?', bestAnswer: '10-500 employees' },
        { question: 'Size of HR team?', bestAnswer: '1-5 people' },
        { question: 'Current HR system?', bestAnswer: 'Spreadsheets or none' },
        { question: 'What is your HR budget?', bestAnswer: '$75-$300/month' },
        { question: 'Need performance reviews?', bestAnswer: 'Yes' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product13.name}`);

  // Product 14: PayrollPro
  const product14 = await prisma.product.create({
    data: {
      vendorId: provider2.id,
      slug: 'payrollpro',
      name: 'PayrollPro',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'hrtech',
      smbFriendly: true,
      description: 'Payroll and HR combined. Auto-calculate salaries, handle taxes, generate payslips, manage compliance, and streamline employee onboarding—all in one platform.',
      shortDescription: 'Payroll automation with HR management for Indian businesses',
      logo: 'https://placehold.co/400x400/2980B9/white?text=PP',
      website: 'https://payrollpro.in',
      companyName: 'PayrollPro Solutions',
      companySize: 'smb',
      founded: '2018',
      headquarters: 'Pune, India',
      pricingModel: 'paid',
      startingPrice: 129,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.6,
      reviewCount: 521,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product14.id },
    data: { categories: { connect: [{ id: catMap['hrtech'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product14.id, name: 'Automated Payroll', description: 'Calculate salaries automatically', category: 'Core', order: 1 },
      { productId: product14.id, name: 'Tax Compliance', description: 'TDS, PF, ESI auto-calculation', category: 'Compliance', order: 2 },
      { productId: product14.id, name: 'Payslip Generation', description: 'Email payslips to employees', category: 'Core', order: 3 },
      { productId: product14.id, name: 'Attendance Integration', description: 'Sync with biometric systems', category: 'Integration', order: 4 },
      { productId: product14.id, name: 'Employee Onboarding', description: 'Digital offer letters and KYC', category: 'General', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product14.id, questionId: question1!.id, answerJson: JSON.stringify(['HRTech', 'Accounting']) },
      { productId: product14.id, questionId: question2!.id, answerText: 'Automated payroll processing, Statutory compliance (PF, ESI, TDS), Digital payslip distribution, Attendance and leave integration, Employee onboarding automation' },
      { productId: product14.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product14.id, questionId: question5!.id, answerText: 'Indian businesses with 10-500 employees, manual payroll processes, need tax compliance, currently using Excel or outsourcing, budget of ₹5K-₹25K per month.' },
      { productId: product14.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Accuracy', 'Productivity']) },
      { productId: product14.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many employees on payroll?', bestAnswer: '10-500 employees' },
        { question: 'Current payroll method?', bestAnswer: 'Manual/Excel or outsourced' },
        { question: 'Need statutory compliance?', bestAnswer: 'Yes (PF, ESI, TDS)' },
        { question: 'Do you have biometric attendance?', bestAnswer: 'Yes or planning to' },
        { question: 'Payroll software budget?', bestAnswer: '₹5K-₹25K/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product14.name}`);

  // Product 15: TalentTracker
  const product15 = await prisma.product.create({
    data: {
      vendorId: provider2.id,
      slug: 'talenttracker-ats',
      name: 'TalentTracker',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'hrtech',
      smbFriendly: true,
      description: 'Applicant Tracking System for growing teams. Post jobs, track candidates, schedule interviews, collaborate with hiring managers, and build your talent pipeline.',
      shortDescription: 'Recruitment and applicant tracking for SMBs',
      logo: 'https://placehold.co/400x400/C0392B/white?text=TT',
      website: 'https://talenttracker.com',
      companyName: 'TalentTracker Inc',
      companySize: 'smb',
      founded: '2020',
      headquarters: 'Boston, MA',
      pricingModel: 'paid',
      startingPrice: 99,
      hasFreeTrial: true,
      freeTrialDays: 21,
      status: 'published',
      featured: false,
      averageRating: 4.3,
      reviewCount: 267,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product15.id },
    data: { categories: { connect: [{ id: catMap['hrtech'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product15.id, name: 'Multi-Channel Job Posting', description: 'Post to job boards automatically', category: 'Core', order: 1 },
      { productId: product15.id, name: 'Candidate Pipeline', description: 'Visual hiring pipeline', category: 'Core', order: 2 },
      { productId: product15.id, name: 'Interview Scheduling', description: 'Calendar integration', category: 'General', order: 3 },
      { productId: product15.id, name: 'Resume Parser', description: 'Auto-extract candidate data', category: 'Core', order: 4 },
      { productId: product15.id, name: 'Hiring Team Collaboration', description: 'Feedback and scorecards', category: 'General', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product15.id, questionId: question1!.id, answerJson: JSON.stringify(['HRTech']) },
      { productId: product15.id, questionId: question2!.id, answerText: 'Streamlined recruitment workflow, Candidate tracking and management, Interview coordination, Hiring team collaboration, Talent pool building' },
      { productId: product15.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product15.id, questionId: question5!.id, answerText: 'Growing companies hiring 10-100+ people per year, HR/recruiting team of 1-10 people, using email for recruiting, need organized hiring process, budget $100-$500/month.' },
      { productId: product15.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Productivity', 'Faster closing']) },
      { productId: product15.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many hires per year?', bestAnswer: '10-100 hires' },
        { question: 'Size of recruiting team?', bestAnswer: '1-10 people' },
        { question: 'Current recruiting process?', bestAnswer: 'Email and spreadsheets' },
        { question: 'Need job board integrations?', bestAnswer: 'Yes' },
        { question: 'Recruiting software budget?', bestAnswer: '$100-$500/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product15.name}`);

  // === PROJECT MANAGEMENT ===

  // Product 16: TaskFlow
  const product16 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'taskflow',
      name: 'TaskFlow',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'project-management',
      smbFriendly: true,
      description: 'Simple project management for small teams. Create tasks, assign work, track progress, and collaborate—without the complexity of enterprise PM tools.',
      shortDescription: 'Lightweight project management for small teams',
      logo: 'https://placehold.co/400x400/F39C12/white?text=TF',
      website: 'https://taskflow.io',
      companyName: 'TaskFlow Inc',
      companySize: 'startup',
      founded: '2022',
      headquarters: 'San Francisco, CA',
      pricingModel: 'freemium',
      startingPrice: 0,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: false,
      averageRating: 4.2,
      reviewCount: 334,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product16.id },
    data: { categories: { connect: [{ id: catMap['project-management'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product16.id, name: 'Task Boards', description: 'Kanban-style task management', category: 'Core', order: 1 },
      { productId: product16.id, name: 'Team Collaboration', description: 'Comments and file attachments', category: 'General', order: 2 },
      { productId: product16.id, name: 'Calendar View', description: 'See deadlines at a glance', category: 'General', order: 3 },
      { productId: product16.id, name: 'Mobile Apps', description: 'iOS and Android', category: 'General', order: 4 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product16.id, questionId: question1!.id, answerJson: JSON.stringify(['Projects']) },
      { productId: product16.id, questionId: question2!.id, answerText: 'Simple task tracking, Team collaboration, Project visibility, Deadline management, Basic workflow organization' },
      { productId: product16.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)']) },
      { productId: product16.id, questionId: question5!.id, answerText: 'Small teams of 3-20 people, simple projects, need basic task management, currently using Trello or sticky notes, budget under $100/month or free tier.' },
      { productId: product16.id, questionId: question7!.id, answerJson: JSON.stringify(['Productivity', 'Time saved']) },
      { productId: product16.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Team size?', bestAnswer: '3-20 people' },
        { question: 'Project complexity?', bestAnswer: 'Simple' },
        { question: 'Current PM tool?', bestAnswer: 'Trello or sticky notes' },
        { question: 'Budget for PM software?', bestAnswer: 'Under $100/month or free' },
        { question: 'Need time tracking?', bestAnswer: 'No' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product16.name}`);

  // Product 17: ProjectHub Pro
  const product17 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'projecthub-pro',
      name: 'ProjectHub Pro',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'project-management',
      smbFriendly: true,
      description: 'Advanced project management with time tracking, resource allocation, Gantt charts, budget management, and custom workflows for professional teams.',
      shortDescription: 'Complete project management with time tracking and budgeting',
      logo: 'https://placehold.co/400x400/34495E/white?text=PH',
      website: 'https://projecthubpro.com',
      companyName: 'ProjectHub Inc',
      companySize: 'smb',
      founded: '2018',
      headquarters: 'New York, NY',
      pricingModel: 'paid',
      startingPrice: 159,
      hasFreeTrial: true,
      freeTrialDays: 30,
      status: 'published',
      featured: true,
      averageRating: 4.7,
      reviewCount: 678,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product17.id },
    data: { categories: { connect: [{ id: catMap['project-management'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product17.id, name: 'Time Tracking', description: 'Built-in time tracking', category: 'Core', order: 1 },
      { productId: product17.id, name: 'Gantt Charts', description: 'Visual project timelines', category: 'Core', order: 2 },
      { productId: product17.id, name: 'Resource Management', description: 'Capacity planning', category: 'Core', order: 3 },
      { productId: product17.id, name: 'Budget Tracking', description: 'Track project costs', category: 'Analytics', order: 4 },
      { productId: product17.id, name: 'Custom Workflows', description: 'Build your own processes', category: 'Advanced', order: 5 },
      { productId: product17.id, name: 'Client Portal', description: 'Share updates with clients', category: 'General', order: 6 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product17.id, questionId: question1!.id, answerJson: JSON.stringify(['Projects', 'Management']) },
      { productId: product17.id, questionId: question2!.id, answerText: 'Complex project planning, Time and budget tracking, Resource allocation, Client collaboration, Portfolio management' },
      { productId: product17.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)', '201–500 (Mid)']) },
      { productId: product17.id, questionId: question5!.id, answerText: 'Professional services firms, agencies, consulting companies with 10-500 employees, need time tracking and budgeting, manage client projects, budget $150-$500/month.' },
      { productId: product17.id, questionId: question7!.id, answerJson: JSON.stringify(['Time saved', 'Productivity', 'Margin', 'Accuracy']) },
      { productId: product17.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Do you bill clients by time?', bestAnswer: 'Yes' },
        { question: 'Need budget tracking?', bestAnswer: 'Yes, critical' },
        { question: 'Team size?', bestAnswer: '10-500 people' },
        { question: 'Need resource planning?', bestAnswer: 'Yes' },
        { question: 'PM software budget?', bestAnswer: '$150-$500/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product17.name}`);

  // Product 18: AgileBoard
  const product18 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'agileboard',
      name: 'AgileBoard',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'project-management',
      smbFriendly: true,
      description: 'Agile project management for software teams. Scrum boards, sprint planning, backlog management, burndown charts, and agile reporting built for dev teams.',
      shortDescription: 'Scrum and Agile project management for development teams',
      logo: 'https://placehold.co/400x400/7F8C8D/white?text=AB',
      website: 'https://agileboard.io',
      companyName: 'AgileBoard Inc',
      companySize: 'smb',
      founded: '2020',
      headquarters: 'San Jose, CA',
      pricingModel: 'paid',
      startingPrice: 89,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.4,
      reviewCount: 489,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product18.id },
    data: { categories: { connect: [{ id: catMap['project-management'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product18.id, name: 'Scrum Boards', description: 'Sprint planning and execution', category: 'Core', order: 1 },
      { productId: product18.id, name: 'Backlog Management', description: 'Prioritize and groom backlog', category: 'Core', order: 2 },
      { productId: product18.id, name: 'Burndown Charts', description: 'Track sprint progress', category: 'Analytics', order: 3 },
      { productId: product18.id, name: 'Story Points', description: 'Estimate and track velocity', category: 'Core', order: 4 },
      { productId: product18.id, name: 'Git Integration', description: 'Connect with GitHub, GitLab', category: 'Integration', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product18.id, questionId: question1!.id, answerJson: JSON.stringify(['Projects', 'IT Services']) },
      { productId: product18.id, questionId: question2!.id, answerText: 'Agile sprint management, Software development tracking, Backlog prioritization, Team velocity measurement, Release planning' },
      { productId: product18.id, questionId: question3b!.id, answerJson: JSON.stringify(['11–50 (Small)', '51–200 (Lower Mid)']) },
      { productId: product18.id, questionId: question5!.id, answerText: 'Software development teams of 5-100 people, using Scrum or Agile methodologies, need sprint planning and tracking, budget $90-$300/month.' },
      { productId: product18.id, questionId: question7!.id, answerJson: JSON.stringify(['Productivity', 'Time saved', 'Faster closing']) },
      { productId: product18.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'Are you a software dev team?', bestAnswer: 'Yes' },
        { question: 'Do you use Scrum/Agile?', bestAnswer: 'Yes' },
        { question: 'Dev team size?', bestAnswer: '5-100 developers' },
        { question: 'Need Git integration?', bestAnswer: 'Yes' },
        { question: 'Project management budget?', bestAnswer: '$90-$300/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product18.name}`);

  // === ADDITIONAL CATEGORIES ===

  // Product 19: CustomerVoice - Survey & feedback
  const product19 = await prisma.product.create({
    data: {
      vendorId: provider1.id,
      slug: 'customervoice',
      name: 'CustomerVoice',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'marketing',
      smbFriendly: true,
      description: 'Customer feedback and survey platform. NPS surveys, customer satisfaction tracking, product feedback collection, and sentiment analysis for data-driven decisions.',
      shortDescription: 'Customer feedback and survey tools for SMBs',
      logo: 'https://placehold.co/400x400/D35400/white?text=CV',
      website: 'https://customervoice.io',
      companyName: 'CustomerVoice Inc',
      companySize: 'startup',
      founded: '2021',
      headquarters: 'Austin, TX',
      pricingModel: 'paid',
      startingPrice: 39,
      hasFreeTrial: true,
      freeTrialDays: 14,
      status: 'published',
      featured: false,
      averageRating: 4.3,
      reviewCount: 198,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product19.id },
    data: { categories: { connect: [{ id: catMap['marketing'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product19.id, name: 'NPS Surveys', description: 'Measure customer loyalty', category: 'Core', order: 1 },
      { productId: product19.id, name: 'Custom Surveys', description: 'Build any type of survey', category: 'Core', order: 2 },
      { productId: product19.id, name: 'Sentiment Analysis', description: 'AI-powered feedback analysis', category: 'Analytics', order: 3 },
      { productId: product19.id, name: 'Email Distribution', description: 'Send surveys automatically', category: 'General', order: 4 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product19.id, questionId: question1!.id, answerJson: JSON.stringify(['Marketing', 'Helpdesk']) },
      { productId: product19.id, questionId: question2!.id, answerText: 'Customer satisfaction measurement, Product feedback collection, NPS tracking and improvement, Voice of customer insights, Data-driven decision making' },
      { productId: product19.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']) },
      { productId: product19.id, questionId: question5!.id, answerText: 'SMBs with 50-10K customers, need customer feedback, building products or services, want to improve NPS, budget $40-$200/month.' },
      { productId: product19.id, questionId: question7!.id, answerJson: JSON.stringify(['Productivity', 'Accuracy', 'Faster closing']) },
      { productId: product19.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many customers?', bestAnswer: '50-10,000 customers' },
        { question: 'Need NPS tracking?', bestAnswer: 'Yes' },
        { question: 'Do you collect feedback now?', bestAnswer: 'No or manually' },
        { question: 'Survey software budget?', bestAnswer: '$40-$200/month' },
        { question: 'Need sentiment analysis?', bestAnswer: 'Yes' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product19.name}`);

  // Product 20: InventoryMax
  const product20 = await prisma.product.create({
    data: {
      vendorId: provider3.id,
      slug: 'inventorymax',
      name: 'InventoryMax',
      listingType: ListingType.SOFTWARE_PRODUCT,
      primaryFunction: 'inventory',
      smbFriendly: true,
      description: 'Inventory management for retailers and wholesalers. Track stock levels, manage warehouses, automate reordering, barcode scanning, and multi-location inventory.',
      shortDescription: 'Inventory management for retail and wholesale businesses',
      logo: 'https://placehold.co/400x400/8E44AD/white?text=IM',
      website: 'https://inventorymax.com',
      companyName: 'InventoryMax Inc',
      companySize: 'smb',
      founded: '2019',
      headquarters: 'Dallas, TX',
      pricingModel: 'paid',
      startingPrice: 69,
      hasFreeTrial: true,
      freeTrialDays: 21,
      status: 'published',
      featured: false,
      averageRating: 4.4,
      reviewCount: 312,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  await prisma.product.update({
    where: { id: product20.id },
    data: { categories: { connect: [{ id: catMap['inventory'] }] } },
  });

  await prisma.feature.createMany({
    data: [
      { productId: product20.id, name: 'Real-Time Stock Tracking', description: 'Live inventory levels', category: 'Core', order: 1 },
      { productId: product20.id, name: 'Barcode Scanning', description: 'Mobile barcode scanner', category: 'Core', order: 2 },
      { productId: product20.id, name: 'Auto-Reordering', description: 'Set reorder points', category: 'Core', order: 3 },
      { productId: product20.id, name: 'Multi-Location', description: 'Manage multiple warehouses', category: 'Advanced', order: 4 },
      { productId: product20.id, name: 'Shopify Integration', description: 'Sync with e-commerce', category: 'Integration', order: 5 },
    ],
  });

  await prisma.productOnboardingAnswer.createMany({
    data: [
      { productId: product20.id, questionId: question1!.id, answerJson: JSON.stringify(['Inventory', 'ERP']) },
      { productId: product20.id, questionId: question2!.id, answerText: 'Real-time stock level tracking, Stock-out prevention, Multi-location inventory management, Automated purchase orders, E-commerce integration' },
      { productId: product20.id, questionId: question3b!.id, answerJson: JSON.stringify(['1–10 (Micro)', '11–50 (Small)', '51–200 (Lower Mid)']) },
      { productId: product20.id, questionId: question5!.id, answerText: 'Retail and wholesale businesses with 100-100K SKUs, 1-10 locations, currently using spreadsheets, experiencing stock-outs, budget $70-$300/month.' },
      { productId: product20.id, questionId: question7!.id, answerJson: JSON.stringify(['Fewer stock-outs', 'Accuracy', 'Time saved']) },
      { productId: product20.id, questionId: question37!.id, answerText: JSON.stringify([
        { question: 'How many SKUs do you manage?', bestAnswer: '100-100,000 SKUs' },
        { question: 'How many locations?', bestAnswer: '1-10 locations' },
        { question: 'Current inventory system?', bestAnswer: 'Spreadsheets or none' },
        { question: 'Do you have stock-out issues?', bestAnswer: 'Yes, frequently' },
        { question: 'Inventory software budget?', bestAnswer: '$70-$300/month' },
      ]) },
    ],
  });

  console.log(`✅ Created product: ${product20.name}\n`);

  console.log('✅ Successfully created 17 additional products!\n');

  // Create sample reviews
  console.log('⭐ Creating sample reviews...');

  const reviewer1 = await prisma.user.create({
    data: {
      email: 'john@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'John Smith',
      role: 'user',
    },
  });

  await prisma.review.create({
    data: {
      userId: reviewer1.id,
      productId: product1.id,
      rating: 5,
      title: 'Best CRM for small teams!',
      content: 'We switched from spreadsheets to SalesFlow 3 months ago and it\'s been a game changer. The interface is intuitive, email integration works flawlessly, and the mobile app lets us update deals on the go. Highly recommended!',
      pros: 'Easy to use, Great mobile app, Excellent support team',
      cons: 'Could use more advanced reporting features',
      userRole: 'Manager',
      companySize: '11-50',
      industry: 'Technology',
      usageDuration: '6-12 months',
      status: 'approved',
      verified: true,
      verificationMethod: 'email',
      moderatedAt: new Date(),
      helpfulCount: 12,
      notHelpfulCount: 1,
    },
  });

  const reviewer2 = await prisma.user.create({
    data: {
      email: 'sarah@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Sarah Johnson',
      role: 'user',
    },
  });

  await prisma.review.create({
    data: {
      userId: reviewer2.id,
      productId: product1.id,
      rating: 4,
      title: 'Solid CRM with room for improvement',
      content: 'SalesFlow does the basics really well. Lead management and pipeline tracking are excellent. The free tier was perfect for us to get started. As we grew, we upgraded to the Starter plan. Would like to see better analytics and custom fields in the future.',
      pros: 'Good value for money, Responsive support, Clean interface',
      cons: 'Limited customization, Analytics could be better',
      userRole: 'Founder',
      companySize: '1-10',
      industry: 'Retail',
      usageDuration: '1-2 years',
      status: 'approved',
      verified: true,
      verificationMethod: 'purchase',
      moderatedAt: new Date(),
      helpfulCount: 8,
      notHelpfulCount: 0,
    },
  });

  console.log(`✅ Created 2 sample reviews\n`);

  console.log('✨ Database seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - Categories: ${createdCategories.length}`);
  console.log(`   - Onboarding Questions: ${createdQuestions.length}`);
  console.log(`   - Providers: 3`);
  console.log(`   - Products: 20 (across CRM, Marketing, Accounting, Helpdesk, HR, Project Management, Inventory)`);
  console.log(`   - Reviews: 2`);
  console.log(`   - Admin User: admin@nexus.com (password: admin123)\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
