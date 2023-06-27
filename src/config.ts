import { TypedMap } from '@graphprotocol/graph-ts';

const config = new TypedMap<string, TypedMap<string, string>>();

const mainnetConfig = new TypedMap<string, string>();
mainnetConfig.set('stETH', '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');
mainnetConfig.set('rETH', '0xae78736cd615f374d3085123a210448e74fc6393');

const goerliConfig = new TypedMap<string, string>();
goerliConfig.set('stETH', '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F');
goerliConfig.set('rETH', '0x0b26a03413aCca79eE539015f036B7dF79ddD1c5');

config.set('mainnet', mainnetConfig);
config.set('goerli', goerliConfig);

export { config };
