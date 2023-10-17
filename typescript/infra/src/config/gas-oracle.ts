import { BigNumber, ethers } from 'ethers';

import { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import { convertDecimalsEthersBigNumber } from '@hyperlane-xyz/utils';

import { mustGetChainNativeTokenDecimals } from '../utils/utils';

export type RemoteGasData = {
  tokenExchangeRate: BigNumber;
  gasPrice: BigNumber;
};

export type RemoteGasDataConfig = RemoteGasData & {
  remoteDomain: number;
};

// Gas data to configure on a single local chain. Includes RemoteGasData
// for each remote chain.
export type StorageGasOracleConfig = ChainMap<RemoteGasData>;

// StorageGasOracleConfigs for each local chain
export type AllStorageGasOracleConfigs = ChainMap<StorageGasOracleConfig>;

export const TOKEN_EXCHANGE_RATE_DECIMALS = 10;
export const TOKEN_EXCHANGE_RATE_SCALE = ethers.utils.parseUnits(
  '1',
  TOKEN_EXCHANGE_RATE_DECIMALS,
);

// Overcharge by 30% to account for market making risk
const TOKEN_EXCHANGE_RATE_MULTIPLIER = ethers.utils.parseUnits(
  '1.30',
  TOKEN_EXCHANGE_RATE_DECIMALS,
);

// Gets the StorageGasOracleConfig for a particular local chain
function getLocalStorageGasOracleConfig(
  local: ChainName,
  remotes: ChainName[],
  gasPrices: ChainMap<BigNumber>,
  getTokenExchangeRate: (local: ChainName, remote: ChainName) => BigNumber,
): StorageGasOracleConfig {
  return remotes.reduce((agg, remote) => {
    const exchangeRate = getTokenExchangeRate(local, remote);
    return {
      ...agg,
      [remote]: {
        tokenExchangeRate: exchangeRate,
        gasPrice: gasPrices[remote],
      },
    };
  }, {});
}

// Gets the StorageGasOracleConfig for each local chain
export function getAllStorageGasOracleConfigs(
  chainNames: ChainName[],
  gasPrices: ChainMap<BigNumber>,
  getTokenExchangeRate: (local: ChainName, remote: ChainName) => BigNumber,
): AllStorageGasOracleConfigs {
  return chainNames.reduce((agg, local) => {
    const remotes = chainNames.filter((chain) => local !== chain);
    return {
      ...agg,
      [local]: getLocalStorageGasOracleConfig(
        local,
        remotes,
        gasPrices,
        getTokenExchangeRate,
      ),
    };
  }, {}) as AllStorageGasOracleConfigs;
}

export function getTokenExchangeRateFromValues(
  local: ChainName,
  localValue: BigNumber,
  remote: ChainName,
  remoteValue: BigNumber,
) {
  // This does not yet account for decimals!
  const exchangeRate = remoteValue
    .mul(TOKEN_EXCHANGE_RATE_MULTIPLIER)
    .div(localValue);

  return convertDecimalsEthersBigNumber(
    mustGetChainNativeTokenDecimals(remote),
    mustGetChainNativeTokenDecimals(local),
    exchangeRate,
  );
}
