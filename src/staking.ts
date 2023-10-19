import { StakingTransaction } from '../generated/schema';
import { Deposit, Withdraw } from '../generated/VotingEscrow/VotingEscrow';
import { loadPosition } from './positions';

const DEPOSIT_TYPES = ['DEPOSIT_FOR', 'CREATE_LOCK', 'INCREASE_LOCK_AMOUNT', 'INCREASE_UNLOCK_TIME', 'WITHDRAW'];

export function handleDeposit(event: Deposit): void {
  const transactionHash = event.transaction.hash.toHexString();
  const provider = event.params.provider.toHexString().toLowerCase();
  const type = DEPOSIT_TYPES[event.params.deposit_type];
  const amount = event.params.value;
  const unlockTime = event.params.locktime;
  const timestamp = event.params.ts;

  const position = loadPosition(provider);

  const transaction = new StakingTransaction(transactionHash);
  transaction.type = type;
  transaction.position = position.id;
  transaction.provider = provider;
  transaction.amount = amount;
  transaction.unlockTime = unlockTime;
  transaction.timestamp = timestamp;
  transaction.save();
  position.save();
}

export function handleWithdraw(event: Withdraw): void {
  const transactionHash = event.transaction.hash.toHexString();
  const provider = event.params.provider.toHexString().toLowerCase();
  const amount = event.params.value;
  const timestamp = event.params.ts;

  const position = loadPosition(provider);

  const transaction = new StakingTransaction(transactionHash);
  transaction.type = 'WITHDRAW';
  transaction.position = position.id;
  transaction.provider = provider;
  transaction.amount = amount;
  transaction.timestamp = timestamp;
  transaction.save();
  position.save();
}
