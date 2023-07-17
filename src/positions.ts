import { BigInt, log, dataSource } from '@graphprotocol/graph-ts';
import {
  CollateralChanged,
  DebtChanged,
  Liquidation as LiquidationEvent,
  PositionClosed,
  PositionCreated,
} from '../generated/PositionManager/PositionManager';
import { ETHPositionChanged, StETHPositionChanged } from '../generated/PositionManagerStETH/PositionManagerStETH';
import {
  LeveragedPositionAdjusted,
  StETHLeveragedPositionChange,
} from '../generated/OneStepLeverageStETH/OneStepLeverageStETH';
import { Liquidation, OpenPositionCounter, Position, PositionTransaction } from '../generated/schema';
import { WrappedCollateralTokenPositionChanged } from '../generated/PositionManagerRETH/PositionManagerWrappedCollateralToken';
import { config } from './config';

const OPEN_POSITIONS_COUNTER_ID = 'raft-open-positions-counter';

export function handlePositionCreated(event: PositionCreated): void {
  handlePositionCountChange(true);

  const transactionHash = event.transaction.hash.toHexString();
  const positionTransaction = PositionTransaction.load(transactionHash);

  if (!positionTransaction) {
    log.warning('handlePositionCreated: Transaction with {} hash not found', [transactionHash]);
    return;
  }

  const underlyingCollateralToken = event.params.collateralToken.toHexString();

  positionTransaction.type = 'OPEN';
  positionTransaction.underlyingCollateralToken = underlyingCollateralToken;
  positionTransaction.isLeveraged = false;
  positionTransaction.save();

  const position = loadPosition(event.params.position.toHexString());
  position.underlyingCollateralToken = underlyingCollateralToken;
  position.isLeveraged = false;
  position.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  handlePositionCountChange(false);

  const transactionHash = event.transaction.hash.toHexString();
  const position = loadPosition(event.params.position.toHexString());
  const createdPositionTransaction = PositionTransaction.load(transactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(transactionHash, position, event.block.timestamp);

  positionTransaction.type = 'CLOSE';
  positionTransaction.save();

  position.underlyingCollateralToken = null;
  position.isLeveraged = false;
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
  positionTransaction.underlyingCollateralChange = event.params.collateralAmount.times(amountMultiplier);
  positionTransaction.isLeveraged = false;
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
  positionTransaction.isLeveraged = false;
  positionTransaction.save();
}

export function handleETHPositionChanged(event: ETHPositionChanged): void {
  handleDelegatePositionChange(
    event.params.position.toHexString(),
    event.transaction.hash.toHexString(),
    event.block.timestamp,
    '0x0000000000000000000000000000000000000000',
    event.params.collateralAmount,
    true,
  );
}

export function handleStETHPositionChanged(event: StETHPositionChanged): void {
  const networkConfig = config.get(dataSource.network());
  let stETHAddress = '';

  if (networkConfig != null) {
    const tokenAddress = networkConfig.get('stETH');
    stETHAddress = tokenAddress !== null ? (tokenAddress as string) : '';
  }

  handleDelegatePositionChange(
    event.params.position.toHexString(),
    event.transaction.hash.toHexString(),
    event.block.timestamp,
    stETHAddress,
    event.params.collateralAmount,
    event.params.isCollateralIncrease,
  );
}

export function handleRETHPositionChanged(event: WrappedCollateralTokenPositionChanged): void {
  const networkConfig = config.get(dataSource.network());
  let rETHAddress = '';

  if (networkConfig != null) {
    const tokenAddress = networkConfig.get('rETH');
    rETHAddress = tokenAddress !== null ? (tokenAddress as string) : '';
  }

  handleDelegatePositionChange(
    event.params.position.toHexString(),
    event.transaction.hash.toHexString(),
    event.block.timestamp,
    rETHAddress,
    event.params.collateralAmount,
    event.params.isCollateralIncrease,
  );
}

export function handleStETHLeveragePositionChanged(event: StETHLeveragedPositionChange): void {
  const networkConfig = config.get(dataSource.network());
  let stETHAddress = '';

  if (networkConfig != null) {
    const tokenAddress = networkConfig.get('stETH');
    stETHAddress = tokenAddress !== null ? (tokenAddress as string) : '';
  }

  handleDelegatePositionChange(
    event.params.position.toHexString(),
    event.transaction.hash.toHexString(),
    event.block.timestamp,
    stETHAddress,
    event.params.collateralChange,
    event.params.isCollateralIncrease,
  );
}

export function handleLiquidation(event: LiquidationEvent): void {
  const positionTransactionHash = event.transaction.hash.toHexString();
  const positionTransaction = PositionTransaction.load(positionTransactionHash);

  if (!positionTransaction) {
    log.warning('handleLiquidation: Transaction with {} hash not found', [positionTransactionHash]);
    return;
  }

  positionTransaction.type = 'LIQUIDATION';
  positionTransaction.underlyingCollateralChange = event.params.collateralLiquidated.neg();
  positionTransaction.debtChange = event.params.debtLiquidated.neg();
  positionTransaction.save();

  const liquidation = new Liquidation(positionTransactionHash);
  liquidation.position = positionTransaction.position;
  liquidation.liquidator = event.params.liquidator.toHexString();
  liquidation.transaction = positionTransaction.id;
  liquidation.save();
}

export function handleLeveragePositionAdjusted(event: LeveragedPositionAdjusted): void {
  const transactionHash = event.transaction.hash.toHexString();
  const positionTransaction = PositionTransaction.load(transactionHash);

  if (positionTransaction) {
    positionTransaction.isLeveraged = true;
    positionTransaction.save();
  }

  const position = loadPosition(event.params.position.toHexString());
  position.isLeveraged = true;
  position.save();
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
  positionTransaction.underlyingCollateralToken = position.underlyingCollateralToken
    ? (position.underlyingCollateralToken as string)
    : '';
  positionTransaction.underlyingCollateralChange = BigInt.fromI32(0);
  positionTransaction.debtChange = BigInt.fromI32(0);
  positionTransaction.timestamp = timestamp;

  return positionTransaction;
}

function loadOrCreateOpenPositionCounter(): OpenPositionCounter {
  const loadedOpenPositionCounter = OpenPositionCounter.load(OPEN_POSITIONS_COUNTER_ID);

  if (loadedOpenPositionCounter) {
    return loadedOpenPositionCounter;
  }

  const openPositionCounter = new OpenPositionCounter(OPEN_POSITIONS_COUNTER_ID);
  openPositionCounter.count = BigInt.fromI32(0);

  return openPositionCounter;
}

function handlePositionCountChange(increase: boolean): void {
  const openPositionCounter = loadOrCreateOpenPositionCounter();

  if (increase) {
    openPositionCounter.count = openPositionCounter.count.plus(BigInt.fromI32(1));
  } else {
    openPositionCounter.count = openPositionCounter.count.minus(BigInt.fromI32(1));
  }

  openPositionCounter.save();
}

function handleDelegatePositionChange(
  positionAddress: string,
  transactionHash: string,
  timestamp: BigInt, // eslint-disable-line @typescript-eslint/ban-types
  collateralTokenAddress: string,
  collateralAmount: BigInt, // eslint-disable-line @typescript-eslint/ban-types
  isCollateralIncrease: bool,
): void {
  const position = loadPosition(positionAddress);
  const createdPositionTransaction = PositionTransaction.load(transactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(transactionHash, position, timestamp);

  const amountMultiplier = isCollateralIncrease ? BigInt.fromI32(1) : BigInt.fromI32(-1);
  positionTransaction.collateralChange = collateralAmount.times(amountMultiplier);
  positionTransaction.collateralToken = collateralTokenAddress;

  positionTransaction.save();
}
