import logger from '../logger';
import { MempoolBlock, TransactionExtended, AuditTransaction, TransactionStripped, MempoolBlockWithTransactions, MempoolBlockDelta, Ancestor } from '../mempool.interfaces';
import { Common } from './common';
import config from '../config';
import { PairingHeap } from '../utils/pairing-heap';

class MempoolBlocks {
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: MempoolBlockDelta[] = [];

  constructor() {}

  public getMempoolBlocks(): MempoolBlock[] {
    return this.mempoolBlocks.map((block) => {
      return {
        blockSize: block.blockSize,
        blockVSize: block.blockVSize,
        nTx: block.nTx,
        totalFees: block.totalFees,
        medianFee: block.medianFee,
        feeRange: block.feeRange,
      };
    });
  }

  public getMempoolBlocksWithTransactions(): MempoolBlockWithTransactions[] {
    return this.mempoolBlocks;
  }

  public getMempoolBlockDeltas(): MempoolBlockDelta[] {
    return this.mempoolBlockDeltas;
  }

  public updateMempoolBlocks(memPool: { [txid: string]: TransactionExtended }): void {
    const latestMempool = memPool;
    const memPoolArray: TransactionExtended[] = [];
    for (const i in latestMempool) {
      if (latestMempool.hasOwnProperty(i)) {
        memPoolArray.push(latestMempool[i]);
      }
    }
    const start = new Date().getTime();

    // Clear bestDescendants & ancestors
    memPoolArray.forEach((tx) => {
      tx.bestDescendant = null;
      tx.ancestors = [];
      tx.cpfpChecked = false;
      if (!tx.effectiveFeePerVsize) {
        tx.effectiveFeePerVsize = tx.feePerVsize;
      }
    });

    // First sort
    memPoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);

    // Loop through and traverse all ancestors and sum up all the sizes + fees
    // Pass down size + fee to all unconfirmed children
    let sizes = 0;
    memPoolArray.forEach((tx, i) => {
      sizes += tx.weight;
      if (sizes > 4000000 * 8) {
        return;
      }
      Common.setRelativesAndGetCpfpInfo(tx, memPool);
    });

    // Final sort, by effective fee
    memPoolArray.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);

    const end = new Date().getTime();
    const time = end - start;
    logger.debug('Mempool blocks calculated in ' + time / 1000 + ' seconds');

    const { blocks, deltas } = this.calculateMempoolBlocks(memPoolArray, this.mempoolBlocks);

    this.mempoolBlocks = blocks;
    this.mempoolBlockDeltas = deltas;
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[], prevBlocks: MempoolBlockWithTransactions[]):
    { blocks: MempoolBlockWithTransactions[], deltas: MempoolBlockDelta[] } {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    const mempoolBlockDeltas: MempoolBlockDelta[] = [];
    let blockWeight = 0;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    transactionsSorted.forEach((tx) => {
      if (blockWeight + tx.weight <= config.MEMPOOL.BLOCK_WEIGHT_UNITS
        || mempoolBlocks.length === config.MEMPOOL.MEMPOOL_BLOCKS_AMOUNT - 1) {
        blockWeight += tx.weight;
        blockSize += tx.size;
        transactions.push(tx);
      } else {
        mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
        blockWeight = tx.weight;
        blockSize = tx.size;
        transactions = [tx];
      }
    });
    if (transactions.length) {
      mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
    }

    // Calculate change from previous block states
    for (let i = 0; i < Math.max(mempoolBlocks.length, prevBlocks.length); i++) {
      let added: TransactionStripped[] = [];
      let removed: string[] = [];
      if (mempoolBlocks[i] && !prevBlocks[i]) {
        added = mempoolBlocks[i].transactions;
      } else if (!mempoolBlocks[i] && prevBlocks[i]) {
        removed = prevBlocks[i].transactions.map(tx => tx.txid);
      } else if (mempoolBlocks[i] && prevBlocks[i]) {
        const prevIds = {};
        const newIds = {};
        prevBlocks[i].transactions.forEach(tx => {
          prevIds[tx.txid] = true;
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          newIds[tx.txid] = true;
        });
        prevBlocks[i].transactions.forEach(tx => {
          if (!newIds[tx.txid]) {
            removed.push(tx.txid);
          }
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          if (!prevIds[tx.txid]) {
            added.push(tx);
          }
        });
      }
      mempoolBlockDeltas.push({
        added,
        removed
      });
    }

    return {
      blocks: mempoolBlocks,
      deltas: mempoolBlockDeltas
    };
  }

  /*
  * Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
  * (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
  *
  * blockLimit: number of blocks to build in total.
  * condenseRest: whether to ignore excess transactions or append them to the final block.
  */
  public makeBlockTemplates(mempool: { [txid: string]: AuditTransaction }, blockLimit: number = Infinity, condenseRest = false): MempoolBlockWithTransactions[] {
    const start = Date.now();
    const mempoolArray: AuditTransaction[] = Object.values(mempool);

    console.log('converted to array: ', (Date.now() - start) / 1000);

    mempoolArray.forEach((tx) => {
      tx.bestDescendant = null;
      tx.cpfpChecked = false;
    });

    console.log('reset mempool', (Date.now() - start) / 1000);

    mempoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);

    console.log('first sort', (Date.now() - start) / 1000);

    // Build relatives graph & calculate ancestor scores
    const packageLimit = mempoolArray.length; //Math.min(2400 * 8, mempoolArray.length);
    for (let i = 0; i < packageLimit; i++) {
      if (!mempoolArray[i].ancestorSet) {
        this.setRelatives(mempoolArray[i], mempool);
      }
    }

    console.log('set relatives', (Date.now() - start) / 1000);

    // Sort by descending ancestor score
    mempoolArray.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log('second sort', (Date.now() - start) / 1000);

    // Build blocks by greedily choosing the highest feerate package
    // (i.e. the package rooted in the transaction with the best ancestor score)
    const blocks: MempoolBlockWithTransactions[] = [];
    let blockWeight = 4000;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    const modified: PairingHeap<AuditTransaction> = new PairingHeap((a, b): boolean => (a.score || 0) > (b.score || 0));
    let overflow: AuditTransaction[] = [];
    let failures = 0;
    let top = 0;
    while ((top < mempoolArray.length || !modified.isEmpty()) && (condenseRest || blocks.length < blockLimit)) {
      // this.mainLoop++;
      // Select best next package

      while (top < mempoolArray.length && (mempoolArray[top].used || mempoolArray[top].modified)) {
        top++;
      }

      let nextTx;
      const nextPoolTx = mempoolArray[top];
      const nextModifiedTx = modified.peek();
      if (nextPoolTx && (!nextModifiedTx || (nextPoolTx.score || 0) > (nextModifiedTx.score || 0))) {
        nextTx = nextPoolTx;
        top++;
      } else {
        modified.pop();
        // this.modified--;
        if (nextModifiedTx) {
          nextTx = nextModifiedTx;
          delete nextTx.modifiedNode;
        }
      }

      if (!nextTx?.used) {
        // Check if the package fits into this block
        if (blockWeight + nextTx.ancestorWeight < config.MEMPOOL.BLOCK_WEIGHT_UNITS) {
          blockWeight += nextTx.ancestorWeight;
          const ancestors: AuditTransaction[] = Array.from(nextTx.ancestorSet.values());
          // sort txSet by dependency graph (equivalent to sorting by ascending ancestor count)
          const sortedTxSet = [...ancestors.sort((a: AuditTransaction, b: AuditTransaction) => {
            return (a.ancestorSet?.size || 0) - (b.ancestorSet?.size || 0);
          }), nextTx];
          sortedTxSet.forEach((ancestor, i, arr) => {
            const tx = mempool[ancestor.txid];
            if (!tx?.used) {
              tx.used = true;
              tx.effectiveFeePerVsize = nextTx.ancestorFee / (nextTx.ancestorWeight / 4);
              tx.cpfpChecked = true;
              // tx.ancestors = Array.from(tx.ancestorSet?.values()).map(a => {
              //   return {
              //     txid: a.txid,
              //     fee: a.fee,
              //     weight: a.weight,
              //   }
              // })
              if (i < arr.length - 1) {
                tx.bestDescendant = {
                  txid: arr[i + 1].txid,
                  fee: arr[i + 1].fee,
                  weight: arr[i + 1].weight,
                };
              }
              transactions.push(tx);
              blockSize += tx.size;
            }
          });

          // remove these as valid package ancestors for any remaining descendants
          if (sortedTxSet.length) {
            sortedTxSet.forEach(tx => {
              this.updateDescendants(tx.txid, mempool, modified);
            });
          }

          failures = 0;
        } else {
          // hold this package in an overflow list while we check for smaller options
          overflow.push(nextTx);
          // this.overflowed++;
          failures++;
        }
      }

      // this block is full
      const exceededPackageTries = failures > 1000 && blockWeight > (config.MEMPOOL.BLOCK_WEIGHT_UNITS - 4000);
      if (exceededPackageTries && (!condenseRest || blocks.length < blockLimit - 1)) {
        // construct this block
        if (transactions.length) {
          blocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, blocks.length));
        }
        // reset for the next block
        transactions = [];
        blockSize = 0;
        blockWeight = 4000;

        // 'overflow' packages didn't fit in this block, but are valid candidates for the next
        for (const overflowTx of overflow.reverse()) {
          if (overflowTx.modified) {
            overflowTx.modifiedNode = modified.add(overflowTx);
            // this.modified++;
            // this.maxModified = Math.max(this.maxModified, this.modified);
          } else {
            top--;
            mempoolArray[top] = overflowTx;
          }
        }
        overflow = [];
      }
    }
    console.log('build blocks', (Date.now() - start) / 1000);
    if (condenseRest) {
      for (const tx of overflow) {
        if (tx?.used) {
          continue;
        }
        if (blockWeight + tx.weight <= config.MEMPOOL.BLOCK_WEIGHT_UNITS
          || blocks.length >= blockLimit - 1) {
          blockWeight += tx.weight;
          blockSize += tx.size;
          transactions.push(tx);
          tx.used = true;
        } else {
          if (transactions.length) {
            blocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, blocks.length));
          }
          blockWeight = tx.weight;
          blockSize = tx.size;
          transactions = [tx];
          tx.used = true;
        }
      }
    }
    if (transactions.length) {
      blocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, blocks.length));
    }
    console.log('condensed rest', (Date.now() - start) / 1000);

    const end = Date.now();
    const time = end - start;
    logger.debug('Mempool templates calculated in ' + time / 1000 + ' seconds');

    // console.log('setRelativesCalled', this.setRelativesCalled);
    // console.log('updateDescendantsCalled', this.updateDescendantsCalled);
    // console.log('increaseKey', this.increaseKey);
    // console.log('decreaseKey', this.decreaseKey);
    // console.log('mainLoop', this.mainLoop);
    // console.log('modified', this.modified);
    // console.log('maxModified', this.maxModified);
    // console.log('overflowed', this.overflowed);

    return blocks;
  }

  public setRelatives(
    tx: AuditTransaction,
    mempool: { [txid: string]: AuditTransaction },
  ): void {
    // this.setRelativesCalled++;
    let ancestors: Map<string, AuditTransaction> = new Map();
    tx.vin.forEach((parent) => {
      const parentTx = mempool[parent.txid];
      if (parentTx && !ancestors.has(parent.txid)) {
        ancestors.set(parent.txid, parentTx);
        if (!parentTx.children) {
          parentTx.children = new Set([tx.txid]);
        } else {
          parentTx.children.add(tx.txid);
        }
        if (!parentTx.ancestorSet) {
          this.setRelatives(parentTx, mempool);
        }
        if (parentTx.ancestorSet) {
          parentTx.ancestorSet.forEach(ancestor => {
            ancestors.set(ancestor.txid, ancestor);
          });
        }
      }
    });
    let totalFees = tx.fee;
    let totalWeight = tx.weight;
    ancestors.forEach(ancestor => {
      totalFees += ancestor.fee;
      totalWeight += ancestor.weight;
    });
    tx.ancestorFee = totalFees;
    tx.ancestorWeight = totalWeight;
    tx.score = totalFees / totalWeight;

    if (tx?.ancestorSet?.size! >= 25) {
      console.log('too many ancestors!!');
    }

    tx.ancestorSet = ancestors;
  }

  // iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
  private updateDescendants(
    txid: string,
    mempool: { [txid: string]: AuditTransaction },
    modified: PairingHeap<AuditTransaction>,
  ): void {
    // this.updateDescendantsCalled++;
    const rootTx = mempool[txid];
    const descendantSet: Set<string> = new Set();
    const descendants: string[] = [];
    let childTx;
    let childId;
    let ancestorIndex;
    let tmpScore;
    if (rootTx.children) {
      rootTx.children.forEach(childId => {
        if (!descendantSet.has(childId)) {
          descendants.push(childId);
          descendantSet.add(childId);
        }
      });
    }
    while (descendants.length) {
      childId = descendants.pop();
      childTx = mempool[childId];
      if (childTx && childTx.ancestorSet && childTx.ancestorSet.has(txid)) {
        // remove tx as ancestor
        childTx.ancestorSet.delete(txid);
        childTx.ancestorFee -= rootTx.fee;
        childTx.ancestorWeight -= rootTx.weight;
        tmpScore = childTx.score;
        childTx.score = childTx.ancestorFee / childTx.ancestorWeight;

        if (!childTx.modifiedNode) {
          childTx.modified = true;
          childTx.modifiedNode = modified.add(childTx);
          // this.modified++;
          // this.maxModified = Math.max(this.maxModified, this.modified);
        } else {
          if (childTx.score < tmpScore) {
            // this.decreaseKey++;
            modified.decreasePriority(childTx.modifiedNode);
          } else if (childTx.score > tmpScore) {
            // this.increaseKey++;
            modified.increasePriority(childTx.modifiedNode);
          }
        }

        if (childTx.children) {
          childTx.children.forEach(childId => {
            if (!descendantSet.has(childId)) {
              descendants.push(childId);
              descendantSet.add(childId);
            }
          });
        }
      }
    }
  }

  private dataToMempoolBlocks(transactions: TransactionExtended[],
    blockSize: number, blockWeight: number, blocksIndex: number): MempoolBlockWithTransactions {
    let rangeLength = 4;
    if (blocksIndex === 0) {
      rangeLength = 8;
    }
    if (transactions.length > 4000) {
      rangeLength = 6;
    } else if (transactions.length > 10000) {
      rangeLength = 8;
    }
    return {
      blockSize: blockSize,
      blockVSize: blockWeight / 4,
      nTx: transactions.length,
      totalFees: transactions.reduce((acc, cur) => acc + cur.fee, 0),
      medianFee: Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE),
      feeRange: Common.getFeesInRange(transactions, rangeLength),
      transactionIds: transactions.map((tx) => tx.txid),
      transactions: transactions.map((tx) => Common.stripTransaction(tx)),
    };
  }
}

export default new MempoolBlocks();
