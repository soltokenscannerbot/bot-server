import { gql, GraphQLClient } from 'graphql-request';

import * as dotenv from 'dotenv';

dotenv.config();

const SHYFT_API_KEY = process.env.SHYFT_API_KEY;

const gqlEndpoint = `https://programs.shyft.to/v0/graphql/?api_key=${SHYFT_API_KEY}`;

const graphQLClient = new GraphQLClient(gqlEndpoint, {
  method: `POST`,
  jsonSerializer: {
    parse: JSON.parse,
    stringify: JSON.stringify,
  },
});

/*
This is taken from Raydium's FE code
https://github.com/raydium-io/raydium-frontend/blob/572e4973656e899d04e30bfad1f528efbf79f975/src/pages/liquidity/add.tsx#L646
*/
export function getBurnPercentage(
  lpReserve: number,
  actualSupply: number,
): number {
  const maxLpSupply = Math.max(actualSupply, lpReserve - 1);
  const burnAmt = maxLpSupply - actualSupply;
  //console.log(`burn amt: ${burnAmt}`);
  return (burnAmt / maxLpSupply) * 100;
}

export async function queryLpByToken(token: string) {
  // Get all proposalsV2 accounts
  const query = gql`
    query MyQuery($where: Raydium_LiquidityPoolv4_bool_exp) {
      Raydium_LiquidityPoolv4(where: $where) {
        _updatedAt
        amountWaveRatio
        baseDecimal
        baseLotSize
        baseMint
        baseVault
        depth
        lpMint
        lpReserve
        lpVault
        marketId
        pubkey
      }
    }
  `;

  //Tokens can be either baseMint or quoteMint, so we will check for both with an _or operator
  const variables = {
    where: {
      _or: [{ baseMint: { _eq: token } }, { quoteMint: { _eq: token } }],
    },
  };

  return await graphQLClient.request(query, variables);
}
