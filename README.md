# Raft Subgraph

Raft is an immutable, decentralized lending protocol that allows people to take out stablecoin loans against capital-efficient collateral.

R is the first Ethereum USD stablecoin solely backed by stETH (Lido Staked Ether). R provides the most capital-efficient way to borrow using your stETH. R aims to be the stablecoin of choice within the decentralized ecosystem, with deep liquidity across many trading pairs and a stable peg.

This repository utilizes [The Graph](https://thegraph.com) to index the Raft protocol and provide a GraphQL endpoint for querying the data. Check out the [official Raft subgraph](https://thegraph.com/explorer/subgraphs/93YgGPdoraNcpG6531Jo3KqTcrmQ4BR4Ny9MfkH49NLX) on The Graph Explorer.

## Getting Started

### Installation

Clone the repository and install the dependencies via NPM:

```bash
npm install
```

### Building

To build the subgraph, run the following command:

```bash
npm run build
```

### Deploying

To deploy the subgraph to the official Graph Node, run the following command:

```bash
npm run deploy
```

## License

This project is licensed under the [MIT License](LICENSE).
