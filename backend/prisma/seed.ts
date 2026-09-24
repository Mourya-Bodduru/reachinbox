import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  const senders = [
    {
      email: 'alex.sales@reachinbox.ai',
      name: 'Alex Johnson (ReachInbox Sales)',
      isDefault: true,
    },
    {
      email: 'sarah.outreach@outboxlabs.com',
      name: 'Sarah Parker (Outbox Labs Outreach)',
      isDefault: false,
    },
    {
      email: 'campaigns@growthlead.io',
      name: 'Growth Campaigns Team',
      isDefault: false,
    },
  ];

  for (const s of senders) {
    await prisma.sender.upsert({
      where: { email: s.email },
      update: s,
      create: s,
    });
  }

  await prisma.user.upsert({
    where: { email: 'demo@reachinbox.ai' },
    update: {},
    create: {
      email: 'demo@reachinbox.ai',
      name: 'ReachInbox Demo User',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
