/**
 * Prisma seed — DocNear v1.1
 * Run:  pnpm --filter=@docnear/api db:seed
 *
 * Seed order (respects FK constraints):
 *   1. system_settings
 *   2. users + super-admin
 *   3. specialities
 *   4. cities
 *   5. pharmacy_categories
 *   6. blog_categories
 *   7. doctor users → doctor_profiles → bank accounts → specialities → clinics
 *   8. patient users → patient_profiles
 *   9. coupons
 *  10. blog_posts
 *  11. pharmacy_products
 *
 * Encryption:
 *   All PII (email, phone) is encrypted with AES-256-CBC and stored as BYTEA.
 *   SHA-256 hash shadows are stored for uniqueness/lookup.
 *   The ENCRYPTION_KEY env var must be set (64 hex chars = 32 bytes).
 */

import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as nodeCrypto from 'crypto';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─── crypto helpers (inline — seed doesn't inject CryptoService) ────────────

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env['ENCRYPTION_KEY'];
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars');
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext: string): Buffer {
  const key = getKey();
  const iv = nodeCrypto.randomBytes(IV_LENGTH);
  const cipher = nodeCrypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function hashEmail(email: string): string {
  return nodeCrypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  return nodeCrypto.createHash('sha256').update(phone.trim()).digest('hex');
}

const hash = (plain: string) => bcrypt.hash(plain, 12);

function isoDate(offsetDays = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

// ─── 1. System settings ────────────────────────────────────────────────────

async function seedSystemSettings() {
  const settings: Array<{ key: string; value: unknown; description: string }> = [
    { key: 'platform_commission_pct', value: 10, description: 'Platform commission % on each booking' },
    { key: 'slot_lock_ttl_sec', value: 360, description: 'Redis slot-lock TTL in seconds' },
    { key: 'booking_payment_timeout_min', value: 15, description: 'Minutes before PENDING_PAYMENT booking is cancelled' },
    { key: 'max_family_members', value: 5, description: 'Maximum family members per patient account' },
    { key: 'consultation_default_fee_paise', value: 50000, description: 'Default consultation fee in paise (₹500)' },
    { key: 'support_email', value: 'support@docnear.in', description: 'Customer support email address' },
    { key: 'razorpay_webhook_secret', value: 'CHANGE_ME_IN_PRODUCTION', description: 'Razorpay webhook signing secret' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { id: randomUUID(), key: s.key, value: s.value, description: s.description },
    });
  }
  console.log(`✅  system_settings (${settings.length})`);
}

// ─── 2. Super-admin user ───────────────────────────────────────────────────

async function seedSuperAdmin() {
  const email = process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@docnear.in';
  const phone = '+919999900000';
  const password = process.env['SUPER_ADMIN_PASSWORD'] ?? 'Admin@123456';

  const emailHash = hashEmail(email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    console.log('  ↩  super-admin already exists');
    return;
  }

  await prisma.user.create({
    data: {
      id: randomUUID(),
      emailEnc: encrypt(email),
      emailHash,
      phoneEnc: encrypt(phone),
      phoneHash: hashPhone(phone),
      passwordHash: await hash(password),
      role: Role.SUPER_ADMIN,
      status: UserStatus.APPROVED,
      firstName: 'Super',
      lastName: 'Admin',
      emailVerified: true,
      phoneVerified: true,
    },
  });
  console.log('✅  super-admin user');
}

// ─── 3. Specialities ───────────────────────────────────────────────────────

async function seedSpecialities() {
  const specs = [
    { name: 'General Physician', slug: 'general-physician', iconUrl: '/icons/specialities/gp.svg' },
    { name: 'Cardiologist', slug: 'cardiologist', iconUrl: '/icons/specialities/cardio.svg' },
    { name: 'Dermatologist', slug: 'dermatologist', iconUrl: '/icons/specialities/derm.svg' },
    { name: 'Gynaecologist', slug: 'gynaecologist', iconUrl: '/icons/specialities/gyn.svg' },
    { name: 'Paediatrician', slug: 'paediatrician', iconUrl: '/icons/specialities/paed.svg' },
    { name: 'Orthopaedic Surgeon', slug: 'orthopaedic-surgeon', iconUrl: '/icons/specialities/ortho.svg' },
    { name: 'Neurologist', slug: 'neurologist', iconUrl: '/icons/specialities/neuro.svg' },
    { name: 'Psychiatrist', slug: 'psychiatrist', iconUrl: '/icons/specialities/psych.svg' },
    { name: 'ENT Specialist', slug: 'ent-specialist', iconUrl: '/icons/specialities/ent.svg' },
    { name: 'Ophthalmologist', slug: 'ophthalmologist', iconUrl: '/icons/specialities/eye.svg' },
    { name: 'Endocrinologist', slug: 'endocrinologist', iconUrl: '/icons/specialities/endo.svg' },
    { name: 'Gastroenterologist', slug: 'gastroenterologist', iconUrl: '/icons/specialities/gastro.svg' },
    { name: 'Pulmonologist', slug: 'pulmonologist', iconUrl: '/icons/specialities/pulmo.svg' },
    { name: 'Nephrologist', slug: 'nephrologist', iconUrl: '/icons/specialities/nephro.svg' },
    { name: 'Oncologist', slug: 'oncologist', iconUrl: '/icons/specialities/onco.svg' },
    { name: 'Rheumatologist', slug: 'rheumatologist', iconUrl: '/icons/specialities/rheum.svg' },
    { name: 'Urologist', slug: 'urologist', iconUrl: '/icons/specialities/uro.svg' },
    { name: 'Plastic Surgeon', slug: 'plastic-surgeon', iconUrl: '/icons/specialities/plastic.svg' },
    { name: 'Physiotherapist', slug: 'physiotherapist', iconUrl: '/icons/specialities/physio.svg' },
    { name: 'Dentist', slug: 'dentist', iconUrl: '/icons/specialities/dental.svg' },
  ];

  for (const s of specs) {
    await prisma.speciality.upsert({
      where: { slug: s.slug },
      update: { name: s.name, iconUrl: s.iconUrl },
      create: { id: randomUUID(), name: s.name, slug: s.slug, iconUrl: s.iconUrl },
    });
  }
  console.log(`✅  specialities (${specs.length})`);
}

// ─── 4. Cities ─────────────────────────────────────────────────────────────

async function seedCities() {
  const cities = [
    { name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.877 },
    { name: 'Delhi', slug: 'delhi', state: 'Delhi', lat: 28.614, lng: 77.209 },
    { name: 'Bangalore', slug: 'bangalore', state: 'Karnataka', lat: 12.972, lng: 77.594 },
    { name: 'Hyderabad', slug: 'hyderabad', state: 'Telangana', lat: 17.385, lng: 78.487 },
    { name: 'Chennai', slug: 'chennai', state: 'Tamil Nadu', lat: 13.083, lng: 80.27 },
    { name: 'Kolkata', slug: 'kolkata', state: 'West Bengal', lat: 22.573, lng: 88.364 },
    { name: 'Pune', slug: 'pune', state: 'Maharashtra', lat: 18.52, lng: 73.857 },
    { name: 'Ahmedabad', slug: 'ahmedabad', state: 'Gujarat', lat: 23.023, lng: 72.572 },
    { name: 'Jaipur', slug: 'jaipur', state: 'Rajasthan', lat: 26.912, lng: 75.788 },
    { name: 'Lucknow', slug: 'lucknow', state: 'Uttar Pradesh', lat: 26.847, lng: 80.947 },
  ];

  for (const c of cities) {
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: {},
      create: { id: randomUUID(), name: c.name, slug: c.slug, state: c.state, lat: c.lat, lng: c.lng },
    });
  }
  console.log(`✅  cities (${cities.length})`);
}

// ─── 5. Pharmacy categories ────────────────────────────────────────────────

async function seedPharmacyCategories() {
  const cats = [
    { name: 'Prescription Medicines', slug: 'prescription-medicines' },
    { name: 'OTC Medicines', slug: 'otc-medicines' },
    { name: 'Vitamins & Supplements', slug: 'vitamins-supplements' },
    { name: 'Personal Care', slug: 'personal-care' },
    { name: 'Baby Care', slug: 'baby-care' },
    { name: 'Ayurveda & Herbs', slug: 'ayurveda-herbs' },
    { name: 'Surgical & Equipment', slug: 'surgical-equipment' },
  ];

  for (const c of cats) {
    await prisma.pharmacyCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { id: randomUUID(), name: c.name, slug: c.slug },
    });
  }
  console.log(`✅  pharmacy_categories (${cats.length})`);
}

// ─── 6. Blog categories ────────────────────────────────────────────────────

async function seedBlogCategories() {
  const cats = [
    { name: 'Health Tips', slug: 'health-tips' },
    { name: 'Disease Awareness', slug: 'disease-awareness' },
    { name: 'Nutrition', slug: 'nutrition' },
    { name: 'Mental Health', slug: 'mental-health' },
    { name: 'Fitness', slug: 'fitness' },
    { name: 'Parenting', slug: 'parenting' },
  ];

  for (const c of cats) {
    await prisma.blogCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { id: randomUUID(), name: c.name, slug: c.slug },
    });
  }
  console.log(`✅  blog_categories (${cats.length})`);
}

// ─── 7. Test doctors ───────────────────────────────────────────────────────

async function seedDoctors() {
  const [gpSpec, cardioSpec] = await Promise.all([
    prisma.speciality.findUniqueOrThrow({ where: { slug: 'general-physician' } }),
    prisma.speciality.findUniqueOrThrow({ where: { slug: 'cardiologist' } }),
  ]);

  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.city.findUniqueOrThrow({ where: { slug: 'mumbai' } }),
    prisma.city.findUniqueOrThrow({ where: { slug: 'delhi' } }),
    prisma.city.findUniqueOrThrow({ where: { slug: 'bangalore' } }),
  ]);

  const doctors = [
    {
      email: 'dr.sharma@docnear.in',
      phone: '+919876543210',
      firstName: 'Rahul',
      lastName: 'Sharma',
      gender: 'MALE',
      speciality: gpSpec,
      city: mumbai,
      mciRegNo: 'MCI-123456',
      experience: 10,
      feePaise: 60000,
      qualifications: ['MBBS', 'MD (Medicine)'],
      bio: 'MBBS, MD (Medicine) — Apollo Hospitals Mumbai. 10 years of clinical experience.',
      languages: ['English', 'Hindi', 'Marathi'],
      slug: 'dr-rahul-sharma',
    },
    {
      email: 'dr.kapoor@docnear.in',
      phone: '+919876543211',
      firstName: 'Priya',
      lastName: 'Kapoor',
      gender: 'FEMALE',
      speciality: cardioSpec,
      city: delhi,
      mciRegNo: 'DMC-789012',
      experience: 15,
      feePaise: 120000,
      qualifications: ['MBBS', 'MD', 'DM (Cardiology)'],
      bio: 'MBBS, MD, DM (Cardiology) — AIIMS Delhi. 15 years interventional cardiology.',
      languages: ['English', 'Hindi', 'Punjabi'],
      slug: 'dr-priya-kapoor',
    },
    {
      email: 'dr.nair@docnear.in',
      phone: '+919876543212',
      firstName: 'Anjali',
      lastName: 'Nair',
      gender: 'FEMALE',
      speciality: gpSpec,
      city: bangalore,
      mciRegNo: 'KMC-345678',
      experience: 7,
      feePaise: 50000,
      qualifications: ['MBBS', 'DNB (Family Medicine)'],
      bio: 'MBBS, DNB — Manipal Hospitals Bangalore. Preventive care and family medicine.',
      languages: ['English', 'Kannada', 'Malayalam'],
      slug: 'dr-anjali-nair',
    },
  ];

  const passwordHash = await hash('Doctor@123456');

  for (const d of doctors) {
    const emailHash = hashEmail(d.email);
    const existing = await prisma.user.findUnique({ where: { emailHash } });
    if (existing) {
      console.log(`  ↩  doctor ${d.email} already exists, skipping`);
      continue;
    }

    const userId = randomUUID();
    const profileId = randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        emailEnc: encrypt(d.email),
        emailHash,
        phoneEnc: encrypt(d.phone),
        phoneHash: hashPhone(d.phone),
        passwordHash,
        role: Role.DOCTOR,
        status: UserStatus.APPROVED,
        firstName: d.firstName,
        lastName: d.lastName,
        emailVerified: true,
        phoneVerified: true,
      },
    });

    await prisma.doctorProfile.create({
      data: {
        id: profileId,
        userId,
        mciRegNo: d.mciRegNo,
        qualifications: d.qualifications,
        bio: d.bio,
        experienceYears: d.experience,
        consultationFeeClinic: d.feePaise,
        consultationFeeOnline: d.feePaise,
        languages: d.languages,
        gender: d.gender,
        verificationStatus: 'APPROVED',
        slug: d.slug,
      },
    });

    // Bank account (account number encrypted; last 4 digits for display)
    await prisma.doctorBankAccount.create({
      data: {
        id: randomUUID(),
        doctorId: profileId,
        accountNumberEnc: encrypt(`1234567890${d.mciRegNo}`),
        last4: '7890',
        ifscCode: 'HDFC0001234',
        holderName: `Dr. ${d.firstName} ${d.lastName}`,
        bankName: 'HDFC Bank',
        isVerified: true,
      },
    });

    // Primary speciality
    await prisma.doctorSpeciality.create({
      data: {
        doctorId: profileId,
        specialityId: d.speciality.id,
        isPrimary: true,
      },
    });

    // Clinic
    await prisma.clinic.create({
      data: {
        id: randomUUID(),
        doctorId: profileId,
        name: `Dr. ${d.lastName}'s Clinic`,
        addressLine1: '123 Medical Centre',
        cityId: d.city.id,
        pincode: '400001',
        lat: d.city.lat + 0.01,
        lng: d.city.lng + 0.01,
      },
    });

    console.log(`  ✓  doctor: Dr. ${d.firstName} ${d.lastName}`);
  }

  console.log('✅  doctors (3)');
}

// ─── 8. Test patients ──────────────────────────────────────────────────────

async function seedPatients() {
  const patients = [
    {
      email: 'patient1@docnear.in',
      phone: '+919123456780',
      firstName: 'Arjun',
      lastName: 'Mehta',
      gender: 'MALE',
      bloodGroup: 'B+',
    },
    {
      email: 'patient2@docnear.in',
      phone: '+919123456781',
      firstName: 'Sunita',
      lastName: 'Verma',
      gender: 'FEMALE',
      bloodGroup: 'O+',
    },
  ];

  const passwordHash = await hash('Patient@123456');

  for (const p of patients) {
    const emailHash = hashEmail(p.email);
    const existing = await prisma.user.findUnique({ where: { emailHash } });
    if (existing) {
      console.log(`  ↩  patient ${p.email} already exists, skipping`);
      continue;
    }

    const userId = randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        emailEnc: encrypt(p.email),
        emailHash,
        phoneEnc: encrypt(p.phone),
        phoneHash: hashPhone(p.phone),
        passwordHash,
        role: Role.PATIENT,
        status: UserStatus.APPROVED,
        firstName: p.firstName,
        lastName: p.lastName,
        emailVerified: true,
        phoneVerified: true,
      },
    });

    await prisma.patientProfile.create({
      data: {
        id: randomUUID(),
        userId,
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        verificationStatus: 'APPROVED',
      },
    });

    console.log(`  ✓  patient: ${p.firstName} ${p.lastName}`);
  }

  console.log('✅  patients (2)');
}

// ─── 9. Coupons ────────────────────────────────────────────────────────────

async function seedCoupons() {
  const coupons = [
    {
      code: 'WELCOME20',
      type: 'PERCENT' as const,
      value: 20,
      minOrderAmount: 50000,
      maxDiscount: 20000,
      usageLimit: 1000,
      perUserLimit: 1,
      validFrom: new Date(),
      validUntil: isoDate(365),
      isActive: true,
    },
    {
      code: 'FLAT100',
      type: 'FLAT' as const,
      value: 10000,
      minOrderAmount: 30000,
      maxDiscount: 10000,
      usageLimit: 500,
      perUserLimit: 3,
      validFrom: new Date(),
      validUntil: isoDate(90),
      isActive: true,
    },
    {
      code: 'HEART50',
      type: 'PERCENT' as const,
      value: 50,
      minOrderAmount: 100000,
      maxDiscount: 50000,
      usageLimit: 200,
      perUserLimit: 2,
      validFrom: new Date(),
      validUntil: isoDate(180),
      isActive: true,
    },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: c.isActive },
      create: { id: randomUUID(), ...c },
    });
  }
  console.log(`✅  coupons (${coupons.length})`);
}

// ─── 10. Sample blog post ──────────────────────────────────────────────────

async function seedBlogPosts() {
  const category = await prisma.blogCategory.findUnique({ where: { slug: 'health-tips' } });
  const adminEmailHash = hashEmail(process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@docnear.in');
  const author = await prisma.user.findUnique({ where: { emailHash: adminEmailHash } });

  if (!category || !author) {
    console.warn('⚠️  blog_posts: category or author not found, skipping');
    return;
  }

  await prisma.blogPost.upsert({
    where: { slug: '10-tips-for-healthy-heart' },
    update: {},
    create: {
      id: randomUUID(),
      title: '10 Tips for a Healthy Heart',
      slug: '10-tips-for-healthy-heart',
      content: `# 10 Tips for a Healthy Heart\n\nCardiovascular disease is preventable.\n\n## 1. Exercise Regularly\nAim for 150 minutes/week.\n\n## 2. Eat Heart-Healthy\nFruits, vegetables, whole grains.\n\n## 3. Quit Smoking\nBiggest single risk factor.\n\n## 4. Manage Stress\nChronic stress damages arteries.\n\n## 5. Get Check-ups\nRegular screenings save lives.`,
      excerpt: '10 evidence-based tips to reduce cardiovascular disease risk.',
      categoryId: category.id,
      authorId: author.id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  console.log('✅  blog_posts (1 sample)');
}

// ─── 11. Sample pharmacy products ─────────────────────────────────────────

async function seedPharmacyProducts() {
  const category = await prisma.pharmacyCategory.findUnique({ where: { slug: 'otc-medicines' } });
  if (!category) {
    console.warn('⚠️  pharmacy_products: OTC category not found, skipping');
    return;
  }

  const products = [
    {
      name: 'Paracetamol 500mg',
      slug: 'paracetamol-500mg',
      description: 'Fever and mild pain relief. Pack of 10 tablets.',
      mrpPaise: 1500,
      sellingPricePaise: 1200,
      manufacturer: 'Sun Pharma',
      requiresPrescription: false,
      stock: 500,
    },
    {
      name: 'Vitamin D3 1000 IU',
      slug: 'vitamin-d3-1000iu',
      description: 'Bone health and immunity. Pack of 30 capsules.',
      mrpPaise: 29900,
      sellingPricePaise: 24900,
      manufacturer: 'Himalaya',
      requiresPrescription: false,
      stock: 200,
    },
    {
      name: 'ORS Sachets',
      slug: 'ors-oral-rehydration-salts',
      description: 'WHO-approved ORS for dehydration. Pack of 5 sachets.',
      mrpPaise: 3500,
      sellingPricePaise: 2800,
      manufacturer: 'Electral',
      requiresPrescription: false,
      stock: 1000,
    },
  ];

  for (const p of products) {
    await prisma.pharmacyProduct.upsert({
      where: { slug: p.slug },
      update: { stock: p.stock, sellingPricePaise: p.sellingPricePaise },
      create: { id: randomUUID(), ...p, categoryId: category.id, isActive: true },
    });
  }
  console.log(`✅  pharmacy_products (${products.length})`);
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  DocNear seed — starting\n');

  await seedSystemSettings();
  await seedSuperAdmin();
  await seedSpecialities();
  await seedCities();
  await seedPharmacyCategories();
  await seedBlogCategories();
  await seedDoctors();
  await seedPatients();
  await seedCoupons();
  await seedBlogPosts();
  await seedPharmacyProducts();

  console.log('\n🎉  Seed complete!\n');
  console.log('Test credentials:');
  console.log(`  Admin     ${process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@docnear.in'}  / Admin@123456`);
  console.log('  Doctor 1  dr.sharma@docnear.in  / Doctor@123456');
  console.log('  Doctor 2  dr.kapoor@docnear.in  / Doctor@123456');
  console.log('  Doctor 3  dr.nair@docnear.in    / Doctor@123456');
  console.log('  Patient 1 patient1@docnear.in   / Patient@123456');
  console.log('  Patient 2 patient2@docnear.in   / Patient@123456\n');
}

main()
  .catch(e => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
