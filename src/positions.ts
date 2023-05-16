import { BigInt, log } from '@graphprotocol/graph-ts';
import {
  CollateralChanged,
  DebtChanged,
  PositionClosed,
  PositionCreated,
} from '../generated/PositionManager/PositionManager';
import { OpenPositionCounter, Position, PositionTransaction } from '../generated/schema';

const OPEN_POSITIONS_COUNTER_ID = 'raft-open-positions-counter';

export function handlePositionCreated(event: PositionCreated): void {
  handlePositionCountChange(true);

  const transactionHash = event.transaction.hash.toHexString();
  const positionTransaction = PositionTransaction.load(transactionHash);

  if (!positionTransaction) {
    log.warning('handlePositionCreated: Transaction with {} hash not found', [transactionHash]);
    return;
  }

  positionTransaction.type = 'OPEN';
  positionTransaction.save();

  const position = loadPosition(event.params.position.toHexString());
  position.collateralToken = event.params.collateralToken.toHexString();
  position.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  handlePositionCountChange(false);

  const transactionHash = event.transaction.hash.toHexString();
  const positionTransaction = PositionTransaction.load(transactionHash);

  if (!positionTransaction) {
    log.warning('handlePositionClosed: Transaction with {} hash not found', [transactionHash]);
    return;
  }

  positionTransaction.type = 'CLOSE';
  positionTransaction.save();

  const position = loadPosition(event.params.position.toHexString());
  position.collateralToken = null;
  position.save();
}

export function handlePositionCollateralChanged(event: CollateralChanged): void {
  const positionAddress = event.params.position.toHexString();
  const position = loadPosition(positionAddress);

  const positionTransactionHash = event.transaction.hash.toHexString();
  const createdPositionTransaction = PositionTransaction.load(positionTransactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(positionTransactionHash, position, event.block.timestamp);

  const amountMultiplier = event.params.isCollateralIncrease ? BigInt.fromI32(1) : BigInt.fromI32(-1);
  positionTransaction.type = 'ADJUST';
  positionTransaction.collateralChange = event.params.collateralAmount.times(amountMultiplier);
  positionTransaction.save();
}

export function handlePositionDebtChanged(event: DebtChanged): void {
  const positionAddress = event.params.position.toHexString();
  const position = loadPosition(positionAddress);

  const positionTransactionHash = event.transaction.hash.toHexString();
  const createdPositionTransaction = PositionTransaction.load(positionTransactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(positionTransactionHash, position, event.block.timestamp);

  const amountMultiplier = event.params.isDebtIncrease ? BigInt.fromI32(1) : BigInt.fromI32(-1);
  positionTransaction.type = 'ADJUST';
  positionTransaction.debtChange = event.params.debtAmount.times(amountMultiplier);
  positionTransaction.save();
}

function loadPosition(positionId: string): Position {
  const savedPosition = Position.load(positionId);

  if (savedPosition) {
    return savedPosition;
  }

  return new Position(positionId);
}

function createPositionTransaction(
  transactionHash: string,
  position: Position,
  timestamp: BigInt, // eslint-disable-line @typescript-eslint/ban-types
): PositionTransaction {
  const positionTransaction = new PositionTransaction(transactionHash);
  positionTransaction.position = position.id;
  positionTransaction.collateralToken = position.collateralToken ? (position.collateralToken as string) : '';
  positionTransaction.collateralChange = BigInt.fromI32(0);
  positionTransaction.debtChange = BigInt.fromI32(0);
  positionTransaction.createdAt = timestamp;

  return positionTransaction;
}

function loadOpenPositionCounter(): OpenPositionCounter {
  const loadedOpenPositionCounter = OpenPositionCounter.load(OPEN_POSITIONS_COUNTER_ID);

  if (loadedOpenPositionCounter) {
    return loadedOpenPositionCounter;
  }

  const openPositionCounter = new OpenPositionCounter(OPEN_POSITIONS_COUNTER_ID);
  openPositionCounter.count = BigInt.fromI32(0);

  return openPositionCounter;
}

function handlePositionCountChange(increase: boolean): void {
  const openPositionCounter = loadOpenPositionCounter();

  if (increase) {
    openPositionCounter.count = openPositionCounter.count.plus(BigInt.fromI32(1));
  } else {
    openPositionCounter.count = openPositionCounter.count.minus(BigInt.fromI32(1));
  }

  openPositionCounter.save();
}
