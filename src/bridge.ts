import { BigInt, dataSource } from '@graphprotocol/graph-ts';
import { CCIPSendRequested } from '../generated/CCIPOnRamp/CCIPOnRamp';
import { BridgeRequestTransaction, Position } from '../generated/schema';
import { config } from './config';

export function handleCCIPSendRequested(event: CCIPSendRequested): void {
  const networkConfig = config.get(dataSource.network());

  const transactionHash = event.transaction.hash.toHexString();
  const receiver = event.params.message.receiver.toHexString();

  const bridgeRequestTransaction = loadOrCreateBridgeRequestTransaction(transactionHash);
  const position = loadOrCreatePosition(receiver);

  bridgeRequestTransaction.position = position.id;

  if (event.params.message.tokenAmounts.length > 0) {
    const token = event.params.message.tokenAmounts.at(0).token.toHexString();

    let rTokenAddress = '';
    if (networkConfig != null) {
      const address = networkConfig.get('R');
      rTokenAddress = address !== null ? (address as string) : '';
    }
    // Skip bridge transaction if bridged token is not R
    if (token != rTokenAddress) {
      return;
    }

    bridgeRequestTransaction.amount = event.params.message.tokenAmounts.at(0).amount;
  } else {
    // Skip bridge transaction if token data is not present
    return;
  }

  let destinationChainSelector = '';
  if (networkConfig != null) {
    const selector = networkConfig.get(event.address.toHexString());
    destinationChainSelector = selector !== null ? (selector as string) : '';
  }
  bridgeRequestTransaction.destinationChainSelector = BigInt.fromString(destinationChainSelector);

  bridgeRequestTransaction.sourceChainSelector = event.params.message.sourceChainSelector;
  bridgeRequestTransaction.timestamp = event.block.timestamp;
  bridgeRequestTransaction.messageId = event.params.message.messageId.toHexString();

  position.save();
  bridgeRequestTransaction.save();
}

function loadOrCreateBridgeRequestTransaction(id: string): BridgeRequestTransaction {
  const loadedBridgeRequestTransaction = BridgeRequestTransaction.load(id);

  if (loadedBridgeRequestTransaction) {
    return loadedBridgeRequestTransaction;
  }

  return new BridgeRequestTransaction(id);
}

function loadOrCreatePosition(id: string): Position {
  const savedPosition = Position.load(id);

  if (savedPosition) {
    return savedPosition;
  }

  return new Position(id);
}
