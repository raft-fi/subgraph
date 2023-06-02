import { TypedMap } from '@graphprotocol/graph-ts';

const config = new TypedMap<string, TypedMap<string, string>>();

const mainnetConfig = new TypedMap<string, string>();
mainnetConfig.set('stETH', '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');

const goerliConfig = new TypedMap<string, string>();
goerliConfig.set('stETH', '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F');

config.set('mainnet', mainnetConfig);
config.set('goerli', goerliConfig);

export {config};
