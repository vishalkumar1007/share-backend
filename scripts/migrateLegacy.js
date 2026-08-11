import 'dotenv/config';
import connectDb from '../lib/db.js';
import shareModel from '../models/shareModel.js';
import multiverseUniversalTextModel from '../models/multiverseUniversalTextModel.js';

const run = async () => {
  await connectDb();

  const legacyDocs = await multiverseUniversalTextModel.find({}).lean();
  let inserted = 0;
  let skipped = 0;

  for (const doc of legacyDocs) {
    const shareId = String(doc.multiverseCode);
    if (!/^\d{6}$/.test(shareId)) {
      skipped++;
      continue;
    }
    const existing = await shareModel.findOne({ shareId }).select({ _id: 1 }).lean();
    if (existing) {
      skipped++;
      continue;
    }
    await shareModel.create({
      shareId,
      type: 'text',
      title: '',
      content: doc.codeMappedText,
      privacy: 'public',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ownerId: null,
      createdAt: doc.createdAt || new Date(),
    });
    inserted++;
  }

  console.log(`Migration done: inserted=${inserted} skipped=${skipped}`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Migration failed:', error?.message);
  process.exit(1);
});
