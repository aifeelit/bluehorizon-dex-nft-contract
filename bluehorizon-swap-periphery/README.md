# BlueHorizon Swap Periphery

# Local Development

The following assumes the use of `node@>=10`.

## Install Dependencies

`yarn`

## Compile Contracts

`yarn compile`

## Run Tests

`yarn test`

# Contract verification

`yarn truffle run verify BlueHorizonRouter@CONTRACT_ADDRESS --forceConstructorArgs string:ROUTER_ADDRESS string:WETH_ADDRESS --network NETWORK_NAME`
