import { BigInt, log, dataSource, Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  CollateralChanged,
  DebtChanged,
  Liquidation as LiquidationEvent,
  PositionClosed,
  PositionCreated,
} from '../generated/PositionManager/PositionManager';
import {
  PositionCreated as InterestPositionCreated,
  PositionClosed as InterestPositionClosed,
  CollateralChanged as InterestCollateralChanged,
  DebtChanged as InterestDebtChanged,
  Liquidation as InterestLiquidationEvent,
} from '../generated/InterestRatePositionManager/InterestRatePositionManager';
import { ETHPositionChanged, StETHPositionChanged } from '../generated/PositionManagerStETH/PositionManagerStETH';
import {
  LeveragedPositionAdjusted,
  StETHLeveragedPositionChange,
} from '../generated/OneStepLeverageStETH/OneStepLeverageStETH';
import {
  Liquidation,
  OpenPositionCounter,
  Position,
  PositionTransaction,
  RaftHolder,
  RaftHoldersCounter,
  SaversCounter,
  SavingsBalance,
  SavingsTransaction,
} from '../generated/schema';
import { WrappedCollateralTokenPositionChanged } from '../generated/PositionManagerRETH/PositionManagerWrappedCollateralToken';
import { Deposit, Transfer, Withdraw } from '../generated/SavingsR/RSavings';
import { config } from './config';
import { ZERO_ADDRESS } from './constants';

const OPEN_POSITIONS_COUNTER_ID = 'raft-open-positions-counter';
const SAVERS_COUNTER_ID = 'r-savers-count';
const RAFT_HOLDERS_COUNTER_ID = 'raft-holders-count';

function handlePositionCreated(
  transactionHash: string,
  underlyingCollateralToken: string,
  positionAddress: string,
  vaultVersion: string,
): void {
  handlePositionCountChange(true);

  const positionTransaction = PositionTransaction.load(transactionHash);
  if (!positionTransaction) {
    log.warning('handlePositionCreated: Transaction with {} hash not found', [transactionHash]);
    return;
  }

  positionTransaction.type = 'OPEN';
  positionTransaction.underlyingCollateralToken = underlyingCollateralToken;
  positionTransaction.isLeveraged = false;
  positionTransaction.save();

  const position = loadPosition(positionAddress);
  position.underlyingCollateralToken = underlyingCollateralToken;
  position.isLeveraged = false;
  position.vaultVersion = vaultVersion;
  position.save();
}

export function handlePositionCreatedV1(event: PositionCreated): void {
  const transactionHash = event.transaction.hash.toHexString();
  const underlyingCollateralToken = event.params.collateralToken.toHexString();
  const positionAddress = event.params.position.toHexString();

  handlePositionCreated(transactionHash, underlyingCollateralToken, positionAddress, 'v1');
}

export function handlePositionCreatedV2(event: InterestPositionCreated): void {
  const transactionHash = event.transaction.hash.toHexString();
  const underlyingCollateralToken = event.params.collateralToken.toHexString();
  const positionAddress = event.params.position.toHexString();

  handlePositionCreated(transactionHash, underlyingCollateralToken, positionAddress, 'v2');
}

function handlePositionClosed(transactionHash: string, positionAddress: string, timestamp: BigInt): void {
  handlePositionCountChange(false);

  const position = loadPosition(positionAddress);
  const loadedPositionTransaction = PositionTransaction.load(transactionHash);
  const positionTransaction = loadedPositionTransaction
    ? loadedPositionTransaction
    : createPositionTransaction(transactionHash, position, timestamp);

  positionTransaction.type = 'CLOSE';
  positionTransaction.save();

  position.underlyingCollateralToken = null;
  position.isLeveraged = false;
  position.save();
}

export function handlePositionClosedV1(event: PositionClosed): void {
  const transactionHash = event.transaction.hash.toHexString();
  const positionAddress = event.params.position.toHexString();
  const timestamp = event.block.timestamp;

  handlePositionClosed(transactionHash, positionAddress, timestamp);
}

export function handlePositionClosedV2(event: InterestPositionClosed): void {
  const transactionHash = event.transaction.hash.toHexString();
  const positionAddress = event.params.position.toHexString();
  const timestamp = event.block.timestamp;

  handlePositionClosed(transactionHash, positionAddress, timestamp);
}

function handlePositionCollateralChanged(
  positionAddress: string,
  transactionHash: string,
  timestamp: BigInt,
  isCollateralIncrease: boolean,
  collateralAmount: BigInt,
): void {
  const position = loadPosition(positionAddress);

  const createdPositionTransaction = PositionTransaction.load(transactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(transactionHash, position, timestamp);

  const amountMultiplier = isCollateralIncrease ? BigInt.fromI32(1) : BigInt.fromI32(-1);
  positionTransaction.type = 'ADJUST';
  positionTransaction.underlyingCollateralChange = collateralAmount.times(amountMultiplier);
  positionTransaction.isLeveraged = false;
  positionTransaction.save();
}

export function handlePositionCollateralChangedV1(event: CollateralChanged): void {
  const positionAddress = event.params.position.toHexString();
  const transactionHash = event.transaction.hash.toHexString();
  const timestamp = event.block.timestamp;
  const isCollateralIncrease = event.params.isCollateralIncrease;
  const collateralAmount = event.params.collateralAmount;

  // Skip processing transactions from interest rate position manager
  if (isInterestRatePositionManagerCaller(positionAddress) == true) {
    return;
  }

  handlePositionCollateralChanged(positionAddress, transactionHash, timestamp, isCollateralIncrease, collateralAmount);
}

export function handlePositionCollateralChangedV2(event: InterestCollateralChanged): void {
  const positionAddress = event.params.position.toHexString();
  const transactionHash = event.transaction.hash.toHexString();
  const timestamp = event.block.timestamp;
  const isCollateralIncrease = event.params.isCollateralIncrease;
  const collateralAmount = event.params.collateralAmount;

  handlePositionCollateralChanged(positionAddress, transactionHash, timestamp, isCollateralIncrease, collateralAmount);
}

function handlePositionDebtChanged(
  positionAddress: string,
  transactionHash: string,
  timestamp: BigInt,
  isDebtIncrease: boolean,
  debtAmount: BigInt,
): void {
  const position = loadPosition(positionAddress);

  const createdPositionTransaction = PositionTransaction.load(transactionHash);
  const positionTransaction = createdPositionTransaction
    ? createdPositionTransaction
    : createPositionTransaction(transactionHash, position, timestamp);

  const amountMultiplier = isDebtIncrease ? BigInt.fromI32(1) : BigInt.fromI32(-1);
  positionTransaction.type = 'ADJUST';
  positionTransaction.debtChange = debtAmount.times(amountMultiplier);
  positionTransaction.isLeveraged = false;
  positionTransaction.save();
}

export function handlePositionDebtChangedV1(event: DebtChanged): void {
  const positionAddress = event.params.position.toHexString();
  const transactionHash = event.transaction.hash.toHexString();
  const timestamp = event.block.timestamp;
  const isDebtIncrease = event.params.isDebtIncrease;
  const debtAmount = event.params.debtAmount;

  // Skip processing transactions from interest rate position manager
  if (isInterestRatePositionManagerCaller(positionAddress) == true) {
    return;
  }

  handlePositionDebtChanged(positionAddress, transactionHash, timestamp, isDebtIncrease, debtAmount);
}

export function handlePositionDebtChangedV2(event: InterestDebtChanged): void {
  const positionAddress = event.params.position.toHexString();
  const transactionHash = event.transaction.hash.toHexString();
  const timestamp = event.block.timestamp;
  const isDebtIncrease = event.params.isDebtIncrease;
  const debtAmount = event.params.debtAmount;

  handlePositionDebtChanged(positionAddress, transactionHash, timestamp, isDebtIncrease, debtAmount);
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

function handleLiquidation(
  transactionHash: string,
  collateralLiquidated: BigInt,
  debtLiquidated: BigInt,
  liquidator: string,
): void {
  const positionTransaction = PositionTransaction.load(transactionHash);

  if (!positionTransaction) {
    log.warning('handleLiquidation: Transaction with {} hash not found', [transactionHash]);
    return;
  }

  positionTransaction.type = 'LIQUIDATION';
  positionTransaction.underlyingCollateralChange = collateralLiquidated.neg();
  positionTransaction.debtChange = debtLiquidated.neg();
  positionTransaction.save();

  const liquidation = new Liquidation(transactionHash);
  liquidation.position = positionTransaction.position;
  liquidation.liquidator = liquidator;
  liquidation.transaction = positionTransaction.id;
  liquidation.save();
}

export function handleLiquidationV1(event: LiquidationEvent): void {
  const positionTransactionHash = event.transaction.hash.toHexString();
  const collateralLiquidated = event.params.collateralLiquidated;
  const debtLiquidated = event.params.debtLiquidated;
  const liquidator = event.params.liquidator.toHexString();

  handleLiquidation(positionTransactionHash, collateralLiquidated, debtLiquidated, liquidator);
}

export function handleLiquidationV2(event: InterestLiquidationEvent): void {
  const positionTransactionHash = event.transaction.hash.toHexString();
  const collateralLiquidated = event.params.collateralLiquidated;
  const debtLiquidated = event.params.debtLiquidated;
  const liquidator = event.params.liquidator.toHexString();

  handleLiquidation(positionTransactionHash, collateralLiquidated, debtLiquidated, liquidator);
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

function loadSavingsBalance(id: string): SavingsBalance {
  const loadedSavingsBalance = SavingsBalance.load(id);

  if (loadedSavingsBalance) {
    return loadedSavingsBalance;
  }

  const createdSavingsBalance = new SavingsBalance(id);
  createdSavingsBalance.balance = BigInt.fromI32(0);

  return createdSavingsBalance;
}

function loadSaversCounter(): SaversCounter {
  const loadedSaversCounter = SaversCounter.load(SAVERS_COUNTER_ID);

  if (loadedSaversCounter) {
    return loadedSaversCounter;
  }

  const createdSaversCounter = new SaversCounter(SAVERS_COUNTER_ID);
  createdSaversCounter.count = BigInt.fromI32(0);

  return createdSaversCounter;
}

function loadRaftHolder(id: string): RaftHolder {
  const loadedRaftHolder = RaftHolder.load(id);

  if (loadedRaftHolder) {
    return loadedRaftHolder;
  }

  const createdRaftHolder = new RaftHolder(id);
  createdRaftHolder.balance = BigInt.fromI32(0);

  return createdRaftHolder;
}

function loadRaftHoldersCounter(): RaftHoldersCounter {
  const loadedRaftHoldersCounter = RaftHoldersCounter.load(RAFT_HOLDERS_COUNTER_ID);

  if (loadedRaftHoldersCounter) {
    return loadedRaftHoldersCounter;
  }

  const createdRaftHoldersCounter = new RaftHoldersCounter(RAFT_HOLDERS_COUNTER_ID);
  createdRaftHoldersCounter.count = BigInt.fromI32(0);

  return createdRaftHoldersCounter;
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

function createSavingsTransaction(
  transactionHash: string,
  position: Position,
  timestamp: BigInt, // eslint-disable-line @typescript-eslint/ban-types
): SavingsTransaction {
  const savingsTransaction = new SavingsTransaction(transactionHash);
  savingsTransaction.position = position.id;
  savingsTransaction.amount = BigInt.fromI32(0);
  savingsTransaction.timestamp = timestamp;

  return savingsTransaction;
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

export function handleSavingsDeposit(event: Deposit): void {
  handleSavingsTransaction(event.transaction.hash, event.block, event.params.owner, 'DEPOSIT', event.params.assets);
}

export function handleSavingsWithdraw(event: Withdraw): void {
  handleSavingsTransaction(event.transaction.hash, event.block, event.params.owner, 'WITHDRAW', event.params.assets);
}

export function handleRRTransfer(event: Transfer): void {
  const fromAddress = event.params.from.toHexString();
  const toAddress = event.params.to.toHexString();

  const fromSavingsBalance = loadSavingsBalance(fromAddress);
  const toSavingsBalance = loadSavingsBalance(toAddress);

  const saversCount = loadSaversCounter();

  // In case user receiving transfer is new, we need to increase current number of savers
  if (toAddress != ZERO_ADDRESS && toSavingsBalance.balance.equals(BigInt.zero())) {
    saversCount.count = saversCount.count.plus(BigInt.fromI32(1));
  }

  if (fromAddress != ZERO_ADDRESS) {
    fromSavingsBalance.balance = fromSavingsBalance.balance.minus(event.params.value);
    fromSavingsBalance.save();
  }

  if (toAddress != ZERO_ADDRESS) {
    toSavingsBalance.balance = toSavingsBalance.balance.plus(event.params.value);
    toSavingsBalance.save();
  }

  // In case user sending transfer has 0 balance remaining, we need to decrease current number of savers
  if (fromAddress != ZERO_ADDRESS && fromSavingsBalance.balance.equals(BigInt.zero())) {
    saversCount.count = saversCount.count.minus(BigInt.fromI32(1));
  }

  saversCount.save();
}

export function handleRaftTransfer(event: Transfer): void {
  const fromAddress = event.params.from.toHexString();
  const toAddress = event.params.to.toHexString();

  const fromRaftHolder = loadRaftHolder(fromAddress);
  const toRaftHolder = loadRaftHolder(toAddress);

  const raftHoldersCount = loadRaftHoldersCounter();

  // In case user receiving transfer is new, we need to increase current number of savers
  if (toAddress != ZERO_ADDRESS && toRaftHolder.balance.equals(BigInt.zero())) {
    raftHoldersCount.count = raftHoldersCount.count.plus(BigInt.fromI32(1));
  }

  if (fromAddress != ZERO_ADDRESS) {
    fromRaftHolder.balance = fromRaftHolder.balance.minus(event.params.value);
    fromRaftHolder.save();
  }

  if (toAddress != ZERO_ADDRESS) {
    toRaftHolder.balance = toRaftHolder.balance.plus(event.params.value);
    toRaftHolder.save();
  }

  // In case user sending transfer has 0 balance remaining, we need to decrease current number of savers
  if (fromAddress != ZERO_ADDRESS && fromRaftHolder.balance.equals(BigInt.zero())) {
    raftHoldersCount.count = raftHoldersCount.count.minus(BigInt.fromI32(1));
  }

  raftHoldersCount.save();
}

function handleSavingsTransaction(
  hash: Bytes,
  block: ethereum.Block,
  owner: Address,
  type: string,
  amount: BigInt, // eslint-disable-line @typescript-eslint/ban-types
): void {
  const positionAddress = owner.toHexString();
  const position = loadPosition(positionAddress);

  const savingsTransactionHash = hash.toHexString();
  const loadedSavingsTransaction = SavingsTransaction.load(savingsTransactionHash);
  const savingsTransaction = loadedSavingsTransaction
    ? loadedSavingsTransaction
    : createSavingsTransaction(savingsTransactionHash, position, block.timestamp);

  savingsTransaction.type = type;
  savingsTransaction.amount = amount;
  savingsTransaction.save();
  position.save();
}

function isInterestRatePositionManagerCaller(callerAddress: string): boolean {
  const networkConfig = config.get(dataSource.network());
  let interestRatePositionManager = '';

  if (networkConfig != null) {
    const interestRatePositionManagerAddress = networkConfig.get('interestRatePositionManager');
    interestRatePositionManager =
      interestRatePositionManagerAddress != null ? (interestRatePositionManagerAddress as string) : '';
  }

  if (callerAddress.toLowerCase() == interestRatePositionManager.toLowerCase()) {
    return true;
  }
  return false;
}
