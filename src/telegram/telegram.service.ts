import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import * as solana from '@solana/web3.js';
import * as dotenv from 'dotenv';
import {
  calculateAge,
  formatLargeNumber,
  shortenAddress,
} from 'src/utils/addressUtils';
import { getBurnPercentage, queryLpByToken } from 'src/utils/lpUtils';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BIRDSEYEAPI_KEY = process.env.BIRDSEYEAPI_KEY;
const SHYFT_API_KEY = process.env.SHYFT_API_KEY;

const rpcEndpoint = `https://rpc.shyft.to/?api_key=${SHYFT_API_KEY}`;

const connection = new solana.Connection(rpcEndpoint);

const welcomeMessage = `
👋 Welcome to Alphadevbotsol 

To search for token information, simply send the token address as a message.

For example:
Send me the token address, and I'll provide you with detailed information about the token!

Enjoy your time with us!`;
const errorMessage = `❌ Oops! Something went wrong while fetching the token report. Please try again.`;

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private logger = new Logger(TelegramService.name);
  constructor() {
    this.bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

    this.bot.on('message', this.onReceiveMessage);
  }

  onReceiveMessage = async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Check if the received message is a command
    if (text.startsWith('/')) {
      // Handle commands separately
      this.onStart(chatId, text);
    }
    // Check if the recieved message is a tokenAddress
    if (text.length >= 43 && /^[a-zA-Z0-9]+$/.test(text)) {
      this.handleTokenAddress(chatId, text);
    }
  };

  private onStart = (chatId: number, command: string) => {
    // Handle different commands here
    if (command === '/start') {
      // Send welcome message for the /start command

      // Send the welcome message to the user
      this.bot.sendMessage(chatId, welcomeMessage);
    } else {
      // Handle other commands (if any)
    }
  };

  private async handleTokenAddress(chatId: number, tokenAddress: string) {
    // Valid token address
    this.logger.debug(`Valid token address received: ${tokenAddress}`);

    // Send typing indicator to show that the bot is typing
    this.bot.sendChatAction(chatId, 'typing');

    try {
      // Fetch token security data
      if (!BIRDSEYEAPI_KEY) {
        //this.bot.sendMessage(chatId, errorMessage);
        throw new Error('No API key found');
      }

      const options = {
        method: 'GET',
        headers: { 'X-API-KEY': BIRDSEYEAPI_KEY },
      };

      // Make API request to get token security data
      const securityResponse = await fetch(
        `https://public-api.birdeye.so/defi/token_security?address=${tokenAddress}`,
        options,
      );

      // Make API request to get token overview data
      const overviewResponse = await fetch(
        `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
        options,
      );
      if (!securityResponse.ok && !overviewResponse.ok) {
        //this.bot.sendMessage(chatId, errorMessage);
        throw new Error(
          'Failed to fetch token security data, Fetch Data response was not ok',
        );
      }
      if (securityResponse.ok && overviewResponse.ok) {
        const securityData = await securityResponse.json();
        const overviewData = await overviewResponse.json();

        this.sendAggregatedTokenInfo(
          chatId,
          securityData.data,
          overviewData.data,
        );
      }
    } catch (error) {
      // Log and send error message to user if API request fails
      this.logger.error(`Error fetching token report: ${error.message}`);
      //this.bot.sendMessage(chatId, errorMessage);
    }
  }

  private async sendAggregatedTokenInfo(
    chatId: number,
    securityData: any,
    overviewData: any,
  ) {
    if (!securityData && !overviewData) {
      this.bot.sendMessage(chatId, errorMessage);
      throw new Error('Token Security data and Overview data not found');
    }
    if (Object.keys(overviewData).length === 0) {
      // this.bot.sendMessage(
      //   chatId,
      //   `❌ Oops! Sorry we couldnt fetch the token information`,
      // );
    } else {
      // Extract relevant information from security data
      const tax = securityData.transferFeeData || '0';
      const creationTime = securityData.creationTime;
      const ownerAddress = securityData.ownerAddress;
      const top10HolderBalance = securityData.top10HolderBalance;
      const top10HolderPercent = securityData.top10HolderPercent
        ? securityData.top10HolderPercent
        : '🚫';
      const totalSupply = securityData.totalSupply
        ? securityData.totalSupply
        : '🚫';

      // Extract relevant information from overview data
      const symbol = overviewData.symbol;
      const name = overviewData.name;
      const address = overviewData.address ? overviewData.address : '🚫';
      const description = overviewData.extensions
        ? overviewData.extensions.description
        : '🚫';

      const liquidity = overviewData.liquidity;
      const price = overviewData.price;
      const mc = overviewData.mc;

      // Shorten the owner address
      const shortenedOwnerAddress = ownerAddress
        ? shortenAddress(ownerAddress)
        : '🚫';

      // Define authorities message
      let authoritiesMessage = '';

      if (!ownerAddress) {
        authoritiesMessage = '🛠 **Authorities:**\n👤 Renounced: ✅';
      } else {
        authoritiesMessage = `
🛠 **Authorities:**
👨‍💻 Deployer: ${shortenedOwnerAddress}
👤 Mint Authority: ${shortenedOwnerAddress}`;
      }

      const age = creationTime ? calculateAge(creationTime) : '🚫';

      //formated value
      const mcFormatted = mc ? formatLargeNumber(mc) : '🚫';
      const liquidityFormatted = liquidity
        ? formatLargeNumber(liquidity)
        : '🚫';
      const top10HolderBalanceFormatted = top10HolderBalance
        ? formatLargeNumber(top10HolderBalance)
        : '🚫';
      const totalSupplyFormatted = totalSupply
        ? formatLargeNumber(totalSupply)
        : '🚫';

      const truncatedDescription = description
        ? description.slice(0, 100)
        : '🚫';

      const info: any = await queryLpByToken(overviewData.address);
      const burnPct = await this.getBurnInfo(info);

      // Construct the message
      const message = `
 ${name} (${symbol})

🏦 Address: <i>${address}</i>  

💰 **Token Metrics:**
💲 Price: $${price.toFixed(10)}
🌿 Total Supply: ${totalSupplyFormatted}
💰 MC: $${mcFormatted}
💧 Liq: $${liquidityFormatted}
      
${authoritiesMessage}
      
👩‍👧‍👦 **Holders:**
📊 Top 10 Holder Balance: ${top10HolderBalanceFormatted}
📊 Top 10 Holder Percentage: ${(top10HolderPercent * 100).toFixed(2)}%
💰 Tax: ${tax}%
⚖️ Age: ${age}
🔥 Burn: ${burnPct ? `${burnPct.toFixed()}%` : '❌'}

📖 Description:  <em>${truncatedDescription}</em>

🔗 <a href="https://t.me/Alphadevsol_bot">Alphadevbotsol</a>

📈 <a href="https://birdeye.so/token/${address}">Birdeye</a> | 📈 <a href="https://dexscreener.com/solana/${address}">DexScreen</a> | 📈 <a href="https://www.dextools.io/app/en/solana/pair-explorer/${address}" >Dextools</a> | 🔥 <a href="https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${address}">Raydium</a> |  ⚖️<a href="https://solscan.io/account/${ownerAddress ? ownerAddress : address}" >Owner</a>  
    
      `;

      // Send the message to the user
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });
    }
  }

  private async getBurnInfo(info: any) {
    if (info) {
      const lpMint = info.Raydium_LiquidityPoolv4[0].lpMint;
      //this.logger.debug('lpMint', lpMint);
      //Once we have the lpMint address, we need to fetch the current token supply and decimals
      const parsedAccInfo: any = await connection.getParsedAccountInfo(
        new solana.PublicKey(lpMint),
      );
      const mintInfo = parsedAccInfo?.value?.data?.parsed?.info;

      //We divide the values based on the mint decimals
      const lpReserve =
        info.Raydium_LiquidityPoolv4[0].lpReserve /
        Math.pow(10, mintInfo?.decimals);
      const actualSupply = mintInfo?.supply / Math.pow(10, mintInfo?.decimals);
      // console.log(
      //   `lpMint: ${lpMint}, Reserve: ${lpReserve}, Actual Supply: ${actualSupply}`,
      // );

      //Calculate burn percentage
      const burnPct = getBurnPercentage(lpReserve, actualSupply);
      console.log(`${burnPct} LP burned`);
      return burnPct;
    }
  }
}
