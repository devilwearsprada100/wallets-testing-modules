import { Inject, Injectable } from '@nestjs/common';
import * as ganache from 'ganache';
import { Server } from 'ganache';
import {
  Request,
  APIRequestContext,
  APIResponse,
  BrowserContext,
  Page,
} from 'playwright';
import { providers, utils, BigNumber, Contract } from "ethers";
import {
  EthereumNodeServiceOptions,
  OPTIONS,
  ServiceUnreachableError,
  ERC20_SHORT_ABI,
} from './node.constants';

@Injectable()
export class EthereumNodeService {
  state:
    | { node: Server; nodeUrl: string; accounts: string[]; secretKeys: string[] }
    | undefined;

  constructor(@Inject(OPTIONS) private options: EthereumNodeServiceOptions) {}

  async startNode() {
    if (this.state !== undefined) return;
    const node = ganache.server({
      chainId: this.options.chainId || 0x1,
      fork: { url: this.options.rpcUrl },
      logging: { quiet: true },
      wallet: { defaultBalance: this.options.defaultBalance || 1000 },
    });
    await node.listen(this.options.port || 7545);
    const nodeUrl = `http://127.0.0.1:${this.options.port || 7545}`;
    const initialAccounts = await node.provider.getInitialAccounts();
    const accounts = Object.keys(initialAccounts);
    const secretKeys = accounts.map((key)=>initialAccounts[key].secretKey);
    await Promise.all(
      accounts.map(async (key: string) => {
        await node.provider.send('evm_setAccountNonce', [
          key,
          '0x' + Math.floor(Math.random() * 9) + 1,
        ]);
      }),
    );

    node.on('close', async () => {
      this.state = undefined;
    });
    this.state = { node, nodeUrl, accounts, secretKeys };
  }

  async stopNode() {
    if (this.state !== undefined) await this.state.node.close();
  }

  async getBalance(account?: string) {
    if (this.state === undefined) return undefined;
    const response = await this.state.node.provider.request({
      method: 'eth_getBalance',
      params: [account || this.state.accounts[0], 'latest'],
    });
    return utils.formatEther(response);
  }

  async setErc20Balance(account: string, tokenAddress: string, mappingSlot: number, balance: number) {
    if (this.state === undefined) throw "Node not ready";
  
    const ethersProvider = new providers.Web3Provider(this.state.node.provider as any);
    const contract = new Contract(tokenAddress, ERC20_SHORT_ABI, ethersProvider);
    const decimals = BigNumber.from(10).pow(await contract.decimals());
    // slot index for _balances mapping in the contract
    const mappingSlotHex = BigNumber.from(mappingSlot).toHexString();
  
    // calculate slot index for account address in the mapping
    const slot = utils.solidityKeccak256(
      ["bytes32", "bytes32"],
      [utils.hexZeroPad(account, 32), utils.hexZeroPad(mappingSlotHex, 32)]
    );
  
    const value = BigNumber.from(balance).mul(decimals);
  
    await this.state.node.provider.request({
      method: "evm_setAccountStorageAt",
      params: [tokenAddress, slot, value.toHexString()],
    });
    const balanceAfter = await contract.balanceOf(account);
    return balanceAfter.div(decimals)
  }

  async mockRoute(url: string, contextOrPage: BrowserContext | Page) {
    await contextOrPage.route(url, async (route) => {
      if (this.state === undefined) return;
      const response = await this.fetchSafety(
        contextOrPage.request,
        this.state.nodeUrl,
        {
          method: route.request().method(),
          data: route.request().postData(),
        },
      );
      return route.fulfill({
        response: response,
      });
    });
  }

  async fetchSafety(
    request: APIRequestContext,
    urlOrRequest: string | Request,
    options: any,
  ): Promise<APIResponse> {
    let lastErr;
    options.timeout = 0;
    options.headers = { Connection: 'Keep-Alive', 'Keep-Alive': 'timeout=1' };
    for (let tryCount = 0; tryCount < 3; tryCount++) {
      try {
        return await request.fetch(urlOrRequest, options);
      } catch (err) {
        lastErr = err as { message: string };
      }
    }
    // it causes if we force recreate browser context and there is no problem
    if (
      lastErr !== undefined &&
      !String(lastErr.message).includes(
        'Target page, context or browser has been closed',
      )
    )
      throw new ServiceUnreachableError(lastErr, options);
    throw Error("There's no response");
  }
}
