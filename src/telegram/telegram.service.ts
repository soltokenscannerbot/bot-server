import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

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
      const welcomeMessage = `
      👋 Welcome to SolTokenScannerBot! 
      
      To search for token information, simply send the token address as a message.
      
      For example:
      Send me the token address, and I'll provide you with detailed information about the token!
      
      Enjoy your time with us!`;

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
      // Now you can perform further actions with the token address, such as querying Solana
      // For demonstration purposes, let's send a confirmation message back to the user
      this.bot.sendMessage(
        chatId,
        `🔍 Excellent choice! You've provided a valid token address: ${tokenAddress}. Let me start gathering information about this token for you. Please hang tight!`,
      );

      // Send typing indicator to show that the bot is typing
      this.bot.sendChatAction(chatId, 'typing');

      try {
        // Make API request to get token report
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          // Log the results
          //this.logger.debug(`API Response: ${JSON.stringify(data.pairs)}`);
          // Send aggregated token information to the user
          this.sendAggregatedTokenInfo(chatId, data.pairs);
        } else {
          console.error('Failed to fetch data');
        }
      } catch (error) {
        // Log and send error message to user if API request fails
        this.logger.error(`Error fetching token report: ${error.message}`);
        this.bot.sendMessage(
          chatId,
          `❌ Oops! Something went wrong while fetching the token report. Please try again later.`,
        );
      }
    } else {
      // Invalid token address
      this.logger.debug(
        `Invalid token address received: ${tokenAddress} ${tokenAddress.length}`,
      );
      // Send a message to the user informing them about the invalid token address format
      this.bot.sendMessage(
        chatId,
        `❌ Oops! It seems like the token address you sent is invalid. Please make sure it's 32 characters long and consists only of alphanumeric characters.`,
      );
    }
  }

  private async sendAggregatedTokenInfo(chatId: number, pairs: any[]) {
    if (!pairs) {
      this.bot.sendMessage(
        chatId,
        `❌ Oops! Sorry we couldnt get that token information.`,
      );
    }
    // Extract token name, symbol, and age from the first array element
    const name = pairs[0]?.baseToken?.name;
    const symbol = pairs[0]?.baseToken?.symbol;
    const pairCreatedAt = pairs[0]?.pairCreatedAt;
    // Initialize variables to store aggregated values
    let totalLiquidityUSD = 0;
    let totalFDV = 0;
    let totalPriceUSD = 0;
    let validPairsCount = 0; // To count valid pairs for average calculation

    // Calculate age in days
    const currentDate = new Date();
    const creationDate = new Date(pairCreatedAt);
    const ageInMilliseconds = currentDate.getTime() - creationDate.getTime();
    const ageInDays = Math.floor(ageInMilliseconds / (1000 * 3600 * 24));

    // Iterate over each token pair to calculate aggregated values
    pairs.forEach((token: any) => {
      const liq = token.liquidity?.usd;
      const fdv = token.fdv;
      const price = token.priceUsd;

      // Check if all required values are present
      if (liq !== undefined && !isNaN(liq) && !isNaN(fdv) && !isNaN(price)) {
        // Add values to the totals
        totalLiquidityUSD += liq;
        totalFDV += fdv;
        totalPriceUSD += Number(price); // Ensure price is treated as a number
        validPairsCount++;
      }
    });

    // Calculate average price if there are valid pairs
    const averagePriceUSD = validPairsCount
      ? totalPriceUSD / validPairsCount
      : 0;

    // Construct the message with aggregated token details
    const message = `
🔍 Aggregated Token Information:
📌 Token Details:
📄 Name: ${name}
💲 Symbol: ${symbol}
⚖ Age: ${ageInDays} days
💰 Total FDV: $${totalFDV.toFixed(2)}
💰 Total Liquidity: $${totalLiquidityUSD.toFixed(2)}
📈 Average Price: $${averagePriceUSD.toFixed(2)}
    `;

    // Send the constructed message to the user
    this.bot.sendMessage(chatId, message);
  }
}

