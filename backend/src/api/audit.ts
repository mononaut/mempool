import logger from '../logger';
import { BlockExtended, TransactionExtended, MempoolBlockWithTransactions } from '../mempool.interfaces';

const PROPAGATION_MARGIN = 180; // in seconds, time since a transaction is first seen after which it is assumed to have propagated to all miners

class Audit {
  auditBlock(block: BlockExtended, txIds: string[], transactions: TransactionExtended[],
    projectedBlocks: MempoolBlockWithTransactions[], mempool: { [txId: string]: TransactionExtended },
  ): { censored: string[], added: string[], score: number } {
    const matches: string[] = []; // present in both mined block and template
    const added: string[] = []; // present in mined block, not in template
    const fresh: string[] = []; // missing, but firstSeen within PROPAGATION_MARGIN
    const isCensored = {}; // missing, without excuse
    const isDisplaced = {};
    let displacedWeight = 0;

    logger.warn(`projected block with ${projectedBlocks[0].transactionIds.length} txs weight ${projectedBlocks[0].blockVSize * 4}`);

    const inBlock = {};
    const inTemplate = {};

    const now = Math.round((Date.now() / 1000));
    for (const tx of transactions) {
      inBlock[tx.txid] = tx;
    }
    // coinbase is always expected
    if (transactions[0]) {
      inTemplate[transactions[0].txid] = true;
    }
    // look for transactions that were expected in the template, but missing from the mined block
    for (const txid of projectedBlocks[0].transactionIds) {
      if (!inBlock[txid]) {
        // tx is recent, may have reached the miner too late for inclusion
        if (mempool[txid]?.firstSeen != null && (now - (mempool[txid]?.firstSeen || 0)) <= PROPAGATION_MARGIN) {
          fresh.push(txid);
        } else {
          isCensored[txid] = true;
        }
        displacedWeight += mempool[txid].weight;
      }
      inTemplate[txid] = true;
    }

    displacedWeight += (4000 - transactions[0].weight);

    logger.warn(`${fresh.length} fresh, ${Object.keys(isCensored).length} possibly censored, ${displacedWeight} displaced weight`);

    // we can expect an honest miner to include 'displaced' transactions in place of recent arrivals and censored txs
    // these displaced transactions should occupy the first N weight units of the next projected block
    let displacedWeightRemaining = displacedWeight;
    let index = 0;
    let lastFeeRate = Infinity;
    let failures = 0;
    let totalDisplacedWeight = 0;
    while (projectedBlocks[1] && index < projectedBlocks[1].transactionIds.length && failures < 500) {
      const txid = projectedBlocks[1].transactionIds[index];
      const fits = (mempool[txid].weight - displacedWeightRemaining) < 4000;
      const feeMatches = mempool[txid].effectiveFeePerVsize >= lastFeeRate;
      if (fits || feeMatches) {
        isDisplaced[txid] = true;
        totalDisplacedWeight += mempool[txid].weight;
        if (fits) {
          lastFeeRate = Math.min(lastFeeRate, mempool[txid].effectiveFeePerVsize);
        }
        if (mempool[txid].firstSeen == null || (now - (mempool[txid]?.firstSeen || 0)) > PROPAGATION_MARGIN) {
          displacedWeightRemaining -= mempool[txid].weight;
        }
        failures = 0;
      } else {
        failures++;
      }
      index++;
    }

    logger.warn(`identified ${Object.keys(isDisplaced).length} displaced txs, weight ${totalDisplacedWeight}`);

    // mark unexpected transactions in the mined block as 'added'
    let overflowWeight = 0;
    for (const tx of transactions) {
      if (inTemplate[tx.txid]) {
        matches.push(tx.txid);
      } else {
        if (!isDisplaced[tx.txid]) {
          added.push(tx.txid);
        }
        overflowWeight += tx.weight;
      }
    }

    logger.warn(`mined block with ${matches.length} matches ${added.length} added, ${transactions.length - matches.length - added.length} selected, ${overflowWeight} overflow weight`);

    // transactions missing from near the end of our template are probably not being censored
    let overflowWeightRemaining = overflowWeight;
    let lastOverflowRate = 1.00;
    let sameFeeRate = 0;
    let sameFeeRateWeight = 0;
    index = projectedBlocks[0].transactionIds.length - 1;
    while (index >= 0) {
      const txid = projectedBlocks[0].transactionIds[index];
      if (overflowWeightRemaining > 0) {
        if (isCensored[txid]) {
          delete isCensored[txid];
        }
        lastOverflowRate = mempool[txid].effectiveFeePerVsize;
      } else if (Math.floor(mempool[txid].effectiveFeePerVsize * 100) <= (lastOverflowRate * 100)) { // tolerance of 0.01 sat/vb
        if (isCensored[txid]) {
          sameFeeRate++;
          sameFeeRateWeight += mempool[txid].weight;
          delete isCensored[txid];
        }
      }
      overflowWeightRemaining -= (mempool[txid]?.weight || 0);
      index--;
    }

    logger.warn(`reduced estimate of ${Object.keys(isCensored).length} censored. ${sameFeeRate} txs / ${sameFeeRateWeight} weight by same fee band ${lastOverflowRate}s/vb`);

    const numCensored = Object.keys(isCensored).length;
    const score = matches.length > 0 ? (matches.length / (matches.length + numCensored)) : 0;

    logger.warn(`score: ${matches.length} / (${matches.length} + ${numCensored}) = ${score}`);

    return {
      censored: Object.keys(isCensored),
      added,
      score
    };
  }
}

export default new Audit();