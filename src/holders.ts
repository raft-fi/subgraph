import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Transfer } from '../generated/RaftDebtTokenHolders/ERC20Indexable';
import { RaftDebtTokenHolder } from '../generated/schema';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function createOrLoadHolder(holderAddress: Address): RaftDebtTokenHolder | null {
  if (holderAddress.toHexString() == ZERO_ADDRESS) {
    return null;
  }

  const holderId = holderAddress.toHexString();
  const loadedHolder = RaftDebtTokenHolder.load(holderId);
  if (loadedHolder != null) {
    return loadedHolder;
  }

  const holder = new RaftDebtTokenHolder(holderId);
  holder.balance = BigInt.zero();

  holder.save();

  return holder;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function updateHolderBalance(fromAddress: Address, toAddress: Address, value: BigInt): void {
  const fromHolder = createOrLoadHolder(fromAddress);
  const toHolder = createOrLoadHolder(toAddress);
  if (fromHolder) {
    fromHolder.balance = fromHolder.balance.minus(value);
    fromHolder.save();
  }

  if (toHolder) {
    toHolder.balance = toHolder.balance.plus(value);
    toHolder.save();
  }
}

export function handleDebtTokenTransfer(event: Transfer): void {
  updateHolderBalance(event.params.from, event.params.to, event.params.value);
}
