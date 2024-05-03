import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import {
  calculateAge,
  formatLargeNumber,
  shortenAddress,
} from 'src/utils/addressUtils';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BIRDSEYEAPI_KEY = process.env.BIRDSEYEAPI_KEY;
const welcomeMessage = `
👋 Welcome to SolTokenScannerBot! 

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
    } else {
      // Regular message, proceed with token address validation
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
    // Check if the received text is a valid token address (44 characters)
    if (tokenAddress.length === 44 && /^[a-zA-Z0-9]+$/.test(tokenAddress)) {
      // Valid token address
      this.logger.debug(`Valid token address received: ${tokenAddress}`);

      this.bot.sendMessage(
        chatId,
        `🎉 Excellent choice! You've provided a valid token address: ${tokenAddress}. 🔍 I'll begin retrieving information about this token. Please wait a moment.`,
      );

      // Send typing indicator to show that the bot is typing
      this.bot.sendChatAction(chatId, 'typing');

      try {
        // Fetch token security data
        if (!BIRDSEYEAPI_KEY) {
          this.bot.sendMessage(chatId, errorMessage);
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
          this.bot.sendMessage(chatId, errorMessage);
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
        this.bot.sendMessage(chatId, errorMessage);
      }
    } else {
      // Invalid token address
      this.logger.debug(
        `Invalid token address received: ${tokenAddress} ${tokenAddress.length}`,
      );
      // Send a message to the user informing them about the invalid token address format
      this.bot.sendMessage(
        chatId,
        `❌ Oops! It seems like the token address you sent is invalid. Please make sure it's 44 characters long and consists only of alphanumeric characters.`,
      );
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
      this.bot.sendMessage(
        chatId,
        `❌ Oops! Sorry we couldnt fetch the token information`,
      );
    } else {
      //this.logger.debug('Security data', securityData);
      //this.logger.debug('Overview data', overviewData);
      // Extract relevant information from security data
      const tax = securityData.transferFeeData || '_';
      const creationTime = securityData.creationTime;
      const ownerAddress = securityData.ownerAddress;
      const top10HolderBalance = securityData.top10HolderBalance;
      const top10HolderPercent = securityData.top10HolderPercent
        ? securityData.top10HolderPercent
        : '_';
      const totalSupply = securityData.totalSupply
        ? securityData.totalSupply
        : '_';

      // Extract relevant information from overview data
      const symbol = overviewData.symbol;
      const name = overviewData.name;
      const address = overviewData.address;
      const description = overviewData.extensions
        ? overviewData.extensions.description
        : '__';

      const liquidity = overviewData.liquidity;
      const price = overviewData.price;
      const mc = overviewData.mc;

      // Shorten the owner address
      const shortenedOwnerAddress = ownerAddress
        ? shortenAddress(ownerAddress)
        : '_';
      const shortenedAddress = address ? shortenAddress(address) : '_';
      const age = creationTime ? calculateAge(creationTime) : '_';

      //formated value
      const mcFormatted = mc ? formatLargeNumber(mc) : '_';
      const liquidityFormatted = liquidity ? formatLargeNumber(liquidity) : '_';
      const top10HolderBalanceFormatted = top10HolderBalance
        ? formatLargeNumber(top10HolderBalance)
        : '_';
      const totalSupplyFormatted = totalSupply
        ? formatLargeNumber(totalSupply)
        : '_';

      const truncatedDescription = description
        ? description.slice(0, 100)
        : '_';

      // Construct the message
      const message = `
 ${name} (${symbol})

🏦 Address: ${shortenedAddress}   
💰 **Token Metrics:**
 💲 Price: $${price.toFixed(10)}
 🌿 Total Supply: ${totalSupplyFormatted}
 💰 MC: $${mcFormatted}
 💧 Liq: $${liquidityFormatted}
      
🛠 **Authorities:**
 👨‍💻 Deployer: ${shortenedOwnerAddress}
 👤 Mint Authority: ${shortenedOwnerAddress}
      
👩‍👧‍👦 **Holders:**
 📊 Top 10 Holder Balance: ${top10HolderBalanceFormatted}
 📊 Top 10 Holder Percentage: ${(top10HolderPercent * 100).toFixed(2)}%
 💰 Tax: ${tax}%
 ⚖️ Age: ${age}

 📖 Description: ${truncatedDescription}

 https://t.me/Alphadevsol_bot

 📈 Birdeye | 📈 DexScreen | 📈 Dextools | 🔥 Raydium |  ⚖️ Owner  |  ⚖️ Pair | Chart
    
      `;

      // Send the message to the user
      this.bot.sendMessage(chatId, message);
    }
  }
}

// 📌 Print Protocol (PRINT)
// ⚠ Mutable Metadata | 8.0% Tax

// 📌 Pair: 8rTx...Uvdr
// 👨‍💻 Deployer: 8gy2...mmRN
// 👤 Owner: *RENOUNCED
// 🔸 Chain: SOL | ⚖️ Age: 20d
// 🌿 Mint: No ✅ | Liq: ❌ | Tax: 8.0%
// ⚡ Unibot | Banana | Shuriken | STBot | BonkBot

// 💰 MC: $7.34M | Liq: 845.3K (11%)
// 📈 24h: 3.1% | V: $550.2K | B:1K S:511
// 📊 ⚡ Photon HyperSpeed ⚡ | Birdeye | DexS

// 💲 Price: $0.000734
// 💵 Launch MC: $86.2K (85x)
// 👆 ATH: $31.01M (359x)
// 🔗 Website

// 📊 TS: 9.998B
// 👩‍👧‍👦 Holders: 28K | Top10: 22.49%
// 💸 Airdrops: No Airdrops

// 💵 TEAM WALLETS
// Deployer 4.99 SOL | 0.0% PRINT
// Tax: 4.99 SOL | 0.0% PRINT

// DYOR/NFA: Automated report.

// Caney Est ($YEEZY)

// 🪅 CA: Hce1hZx7takFkgd6BGjkxrvfbCGtaCYT26ADw2YgKv3B 🅲
// 🎯 Exchange: Raydium
// 💡 Market Cap: $1.22K
// 💧 Liquidity: $1K
// 💰 Token Price: $0.0001222
// ⛽ Pooled SOL: 6.3 SOL
// 🔥 Burn: 100%
// 👤 Renounced: ✅

// 📖 Description:
// caney est hav rise frm da trenches and come 2 solona. buy da new yeezys 4 da culture.

// https://t.me/CaneyEst

// 📈 Birdeye | 📈 DexScreen | 📈 Dextools | 🔥 Raydium |  ⚖️ Owner  |  ⚖️ Pair | Chart
