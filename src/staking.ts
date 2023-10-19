import { StakingTransaction } from '../generated/schema';
import { Deposit, Withdraw } from '../generated/VotingEscrow/VotingEscrow';
import { TokensClaimed } from '../generated/FeeDistributor/FeeDistributor';
import { loadPosition } from './positions';
import { config } from './config';
import { dataSource } from '@graphprotocol/graph-ts';

const DEPOSIT_TYPES = ['DEPOSIT_FOR', 'CREATE_LOCK', 'INCREASE_LOCK_AMOUNT', 'INCREASE_UNLOCK_TIME', 'WITHDRAW'];

export function handleDeposit(event: Deposit): void {
  const networkConfig = config.get(dataSource.network());

  const transactionHash = event.transaction.hash.toHexString();
  const provider = event.params.provider.toHexString().toLowerCase();
  const type = DEPOSIT_TYPES[event.params.deposit_type];
  const amount = event.params.value;
  const unlockTime = event.params.locktime;
  const timestamp = event.params.ts;
  let token = '';

  if (networkConfig !== null) {
    const tokenAddress = networkConfig.get('RAFT_BPT');
    token = tokenAddress !== null ? (token as string) : '';
  }

  const position = loadPosition(provider);

  const transaction = new StakingTransaction(transactionHash);
  transaction.type = type;
  transaction.position = position.id;
  transaction.provider = provider;
  transaction.token = token;
  transaction.amount = amount;
  transaction.unlockTime = unlockTime;
  transaction.timestamp = timestamp;
  transaction.save();
  position.save();
}

export function handleWithdraw(event: Withdraw): void {
  const networkConfig = config.get(dataSource.network());

  const transactionHash = event.transaction.hash.toHexString();
  const provider = event.params.provider.toHexString().toLowerCase();
  const amount = event.params.value;
  const timestamp = event.params.ts;
  let token = '';

  if (networkConfig !== null) {
    const tokenAddress = networkConfig.get('RAFT_BPT');
    token = tokenAddress !== null ? (token as string) : '';
  }

  const position = loadPosition(provider);

  const transaction = new StakingTransaction(transactionHash);
  transaction.type = 'WITHDRAW';
  transaction.position = position.id;
  transaction.provider = provider;
  transaction.token = token;
  transaction.amount = amount;
  transaction.timestamp = timestamp;
  transaction.save();
  position.save();
}

export function handleClaim(event: TokensClaimed): void {
  const transactionHash = event.transaction.hash.toHexString();
  const user = event.params.user.toHexString().toLowerCase();
  const token = event.params.token.toHexString().toLowerCase();
  const amount = event.params.amount;
  const timestamp = event.params.userTokenTimeCursor;

  const position = loadPosition(user);

  const transaction = new StakingTransaction(transactionHash);
  transaction.type = 'CLAIM';
  transaction.position = position.id;
  transaction.provider = user;
  transaction.token = token;
  transaction.amount = amount;
  transaction.timestamp = timestamp;
  transaction.save();
  position.save();
}
