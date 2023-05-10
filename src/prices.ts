import { BigInt } from '@graphprotocol/graph-ts';
import { AnswerUpdated as EthPriceUpdatedEvent } from '../generated/ChainlinkPriceAggregatorETH/ChainlinkPriceAggregatorETH';
import { AnswerUpdated as StEthPriceUpdatedEvent } from '../generated/ChainlinkPriceAggregatorStETH/ChainlinkPriceAggregatorStETH';
import { Price } from '../generated/schema';

export function handleEthPriceUpdated(event: EthPriceUpdatedEvent): void {
  updatePrice('ETH', event.params.current, event.params.updatedAt);
}

export function handleStEthPriceUpdated(event: StEthPriceUpdatedEvent): void {
  updatePrice('stETH', event.params.current, event.params.updatedAt);
}

// eslint-disable-next-line @typescript-eslint/ban-types
function updatePrice(token: string, price: BigInt, updatedAt: BigInt): void {
  const previousPrice = Price.load(token);
  const entity = previousPrice ? previousPrice : new Price(token);
  entity.value = price;
  entity.updatedAt = updatedAt;

  entity.save();
}
