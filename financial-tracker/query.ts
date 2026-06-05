import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

(async () => {
  try {
    // Get positions
    const positions = await db.position.findMany({
      include: { lots: true, finAccount: true },
      take: 5
    });
    
    console.log("=== POSITIONS ===");
    positions.forEach(p => {
      console.log(`${p.symbol} (${p.unitKind}): ${p.lots.length} lots`);
    });
    
    // Get investment transactions
    const invTxns = await db.transaction.findMany({
      where: { positionId: { not: null } },
      include: { finAccount: true },
      take: 5
    });
    
    console.log("\n=== INVESTMENT TRANSACTIONS ===");
    invTxns.forEach(t => {
      console.log(`${t.type} ${t.baseAmount} on ${t.finAccount.name}`);
    });
    
    // Get all transactions (for P&L)
    const allTxns = await db.transaction.findMany({
      where: { type: { in: ["INCOME", "EXPENSE"] } },
      take: 10
    });
    
    console.log("\n=== ALL P&L TRANSACTIONS (before filter) ===");
    console.log(`Total: ${allTxns.length}`);
    
    // Get transactions that should be in P&L (positionId = null)
    const pnlTxns = await db.transaction.findMany({
      where: { type: { in: ["INCOME", "EXPENSE"] }, positionId: null },
      take: 10
    });
    
    console.log("\n=== P&L TRANSACTIONS (after positionId filter) ===");
    console.log(`Total: ${pnlTxns.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
