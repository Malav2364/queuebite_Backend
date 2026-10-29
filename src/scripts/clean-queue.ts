import { PrismaClient, TableStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanQueueData() {
  console.log('Cleaning active and past queue data...');

  // 1. Delete Table Assignments
  const deletedAssignments = await prisma.tableAssignment.deleteMany({});
  console.log(`Deleted ${deletedAssignments.count} table assignments`);

  // 2. Delete Pre-Order Items & Pre-Orders
  const deletedOrderItems = await prisma.preOrderItem.deleteMany({});
  console.log(`Deleted ${deletedOrderItems.count} pre-order items`);

  const deletedOrders = await prisma.preOrder.deleteMany({});
  console.log(`Deleted ${deletedOrders.count} pre-orders`);

  // 3. Delete Queue Events & Queue Entries
  const deletedEvents = await prisma.queueEvent.deleteMany({});
  console.log(`Deleted ${deletedEvents.count} queue events`);

  const deletedEntries = await prisma.queueEntry.deleteMany({});
  console.log(`Deleted ${deletedEntries.count} queue entries`);

  // 4. Delete Group Members & Group Sessions
  const deletedMembers = await prisma.groupMember.deleteMany({});
  console.log(`Deleted ${deletedMembers.count} group members`);

  const deletedSessions = await prisma.groupSession.deleteMany({});
  console.log(`Deleted ${deletedSessions.count} group sessions`);

  // 5. Reset all tables to AVAILABLE
  const resetTables = await prisma.restaurantTable.updateMany({
    data: {
      status: TableStatus.AVAILABLE,
    },
  });
  console.log(`Reset ${resetTables.count} tables to AVAILABLE`);

  console.log('All queue, pre-order, and dining state has been cleaned successfully!');
  await prisma.$disconnect();
}

cleanQueueData().catch((err) => {
  console.error('Error cleaning queue data:', err);
  prisma.$disconnect();
  process.exit(1);
});
