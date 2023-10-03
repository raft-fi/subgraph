import { TypedMap } from '@graphprotocol/graph-ts';

const config = new TypedMap<string, TypedMap<string, string>>();

const mainnetConfig = new TypedMap<string, string>();
mainnetConfig.set('stETH', '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');
mainnetConfig.set('rETH', '0xae78736cd615f374d3085123a210448e74fc6393');
mainnetConfig.set('R', '0x183015a9ba6ff60230fdeadc3f43b3d788b13e21');
mainnetConfig.set('interestRatePositionManager', '0x9AB6b21cDF116f611110b048987E58894786C244');
mainnetConfig.set('0xe2eb229e88f56691e96bb98256707bc62160fe73', '15971525489660198786'); // CCIPOnRampContract -> destinationChainSelector

const goerliConfig = new TypedMap<string, string>();
goerliConfig.set('stETH', '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F');
goerliConfig.set('rETH', '0x0b26a03413aCca79eE539015f036B7dF79ddD1c5');
goerliConfig.set('interestRatePositionManager', '0x7b07fc0c5829fc8c74cc18df99c50b7d7fe830b4');

const baseConfig = new TypedMap<string, string>();
baseConfig.set('R', '0xafb2820316e7bc5ef78d295ab9b8bb2257534576');
baseConfig.set('0xd44371bfde87f2db3ea6df242091351a06c2e181', '5009297550715157269'); // CCIPOnRampContract -> destinationChainSelector

config.set('mainnet', mainnetConfig);
config.set('goerli', goerliConfig);
config.set('base', baseConfig);

export { config };
